import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "@indus/auth";
import { Role } from "@indus/shared-types";
import {
  approveCollectionBatch,
  deleteCollectionBatch,
  findBatchForDateField,
  findBatchForDateFieldCollector,
  findUserById,
  getBatch,
  listBatchesForCollectorDay,
  listCollectionBatches,
  listPendingCollectionBatches,
  listRecentCollectorBatches,
  listUnsubmittedPriorDayBatches,
  rejectCollectionBatch,
  reopenCollectionBatch,
  saveCollectionBatch,
  submitAllPriorDayBatches,
  submitCollectorBatch,
  submitDraftBatchesForDay,
  submitFieldBatchForDay,
  todayIso,
  validateBatchEntries,
  verifyCollectionBatch,
} from "@indus/db";
import { asyncHandler } from "../asyncHandler.js";

export const collectionsRouter = Router();
collectionsRouter.use(requireAuth);

collectionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { fieldId, dateFrom, dateTo, page, pageSize } = req.query;
    res.json(
      await listCollectionBatches({
        fieldId: typeof fieldId === "string" ? fieldId : undefined,
        dateFrom: typeof dateFrom === "string" ? dateFrom : undefined,
        dateTo: typeof dateTo === "string" ? dateTo : undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      }),
    );
  }),
);

collectionsRouter.get(
  "/lookup",
  asyncHandler(async (req, res) => {
    const { date, fieldId } = req.query;
    if (typeof date !== "string" || typeof fieldId !== "string") {
      res.status(400).json({ error: "date and fieldId are required" });
      return;
    }
    res.json((await findBatchForDateField(date, fieldId)) ?? null);
  }),
);

/** The requesting collector's own in-progress batch for a date+field — used to resume/avoid duplicating today's submission. */
collectionsRouter.get(
  "/mine",
  requireRole(Role.Collector),
  asyncHandler(async (req, res) => {
    const { date, fieldId } = req.query;
    if (typeof date !== "string" || typeof fieldId !== "string") {
      res.status(400).json({ error: "date and fieldId are required" });
      return;
    }
    res.json((await findBatchForDateFieldCollector(date, fieldId, req.user!.userId)) ?? null);
  }),
);

collectionsRouter.get(
  "/pending",
  requireRole(Role.Admin),
  asyncHandler(async (_req, res) => {
    res.json(await listPendingCollectionBatches());
  }),
);

/** This collector's batches across every field for one day — the vendor app's end-of-day summary. */
collectionsRouter.get(
  "/mine-today",
  requireRole(Role.Collector),
  asyncHandler(async (req, res) => {
    const { date } = req.query;
    if (typeof date !== "string") {
      res.status(400).json({ error: "date is required" });
      return;
    }
    res.json(await listBatchesForCollectorDay(req.user!.userId, date));
  }),
);

/**
 * Day-close gate: outstanding DRAFT batches from before today that this collector never
 * submitted. The server, not the client, decides where "today" starts — trusting a
 * client-supplied date here would defeat the point of the gate.
 */
collectionsRouter.get(
  "/pending-day-close",
  requireRole(Role.Collector),
  asyncHandler(async (req, res) => {
    res.json(await listUnsubmittedPriorDayBatches(req.user!.userId, todayIso()));
  }),
);

/** "Submit All & Continue" on the day-close gate: promotes every outstanding prior-day batch to PENDING. */
collectionsRouter.post(
  "/submit-past",
  requireRole(Role.Collector),
  asyncHandler(async (req, res) => {
    res.json(await submitAllPriorDayBatches(req.user!.userId, todayIso()));
  }),
);

/** This collector's recent submitted batches across every field — powers the vendor app's Recent Collections history. */
collectionsRouter.get(
  "/recent",
  requireRole(Role.Collector),
  asyncHandler(async (req, res) => {
    const { limit } = req.query;
    res.json(await listRecentCollectorBatches(req.user!.userId, limit ? Number(limit) : undefined));
  }),
);

const entrySchema = z.object({ serialNo: z.number().int().nonnegative(), amountPaise: z.number().int() });

const validateSchema = z.object({ fieldId: z.string().min(1), entries: z.array(entrySchema) });

collectionsRouter.post(
  "/validate",
  asyncHandler(async (req, res) => {
    const parsed = validateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
      return;
    }
    res.json(await validateBatchEntries(parsed.data.fieldId, parsed.data.entries));
  }),
);

const saveSchema = z.object({ date: z.string().min(1), fieldId: z.string().min(1), entries: z.array(entrySchema) });

collectionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
      return;
    }
    const user = req.user ? await findUserById(req.user.userId) : undefined;
    try {
      const result = await saveCollectionBatch(parsed.data, user?.name ?? "Shop Owner");
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to save collection batch" });
    }
  }),
);

/** Collector app autosave: entries are recorded as a DRAFT, invisible to admin review, until the collector submits the day. */
collectionsRouter.post(
  "/draft",
  requireRole(Role.Collector),
  asyncHandler(async (req, res) => {
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
      return;
    }
    const collectorId = req.user!.userId;
    const collector = await findUserById(collectorId);
    try {
      const result = await submitCollectorBatch(parsed.data, collectorId, collector?.name ?? "Collector");
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to save collection draft" });
    }
  }),
);

/** End-of-day action: promotes every DRAFT batch this collector touched today (one per field) to PENDING for admin review. */
const submitDaySchema = z.object({ date: z.string().min(1) });

collectionsRouter.post(
  "/submit-day",
  requireRole(Role.Collector),
  asyncHandler(async (req, res) => {
    const parsed = submitDaySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
      return;
    }
    res.json(await submitDraftBatchesForDay(req.user!.userId, parsed.data.date));
  }),
);

/** Wrap up one field's route the moment it's done: promotes just that field's draft batch to PENDING. */
const submitFieldSchema = z.object({ date: z.string().min(1), fieldId: z.string().min(1) });

collectionsRouter.post(
  "/submit-field",
  requireRole(Role.Collector),
  asyncHandler(async (req, res) => {
    const parsed = submitFieldSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
      return;
    }
    res.json(await submitFieldBatchForDay(req.user!.userId, parsed.data.fieldId, parsed.data.date));
  }),
);

collectionsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const batch = await getBatch(req.params.id!);
    if (!batch) {
      res.status(404).json({ error: "Batch not found" });
      return;
    }
    res.json(batch);
  }),
);

collectionsRouter.post(
  "/:id/verify",
  requireRole(Role.Admin),
  asyncHandler(async (req, res) => {
    try {
      res.json(await verifyCollectionBatch(req.params.id!));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to verify batch" });
    }
  }),
);

collectionsRouter.post(
  "/:id/approve",
  requireRole(Role.Admin),
  asyncHandler(async (req, res) => {
    try {
      res.json(await approveCollectionBatch(req.params.id!));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to approve batch" });
    }
  }),
);

collectionsRouter.post(
  "/:id/reject",
  requireRole(Role.Admin),
  asyncHandler(async (req, res) => {
    try {
      res.json(await rejectCollectionBatch(req.params.id!));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to reject batch" });
    }
  }),
);

const reopenSchema = z.object({ reason: z.string().optional() });

/**
 * Admin sign-off to correct a mistake on an already-submitted batch: unlocks it back to DRAFT
 * (reversing its ledger effect first if it was APPROVED) so the collector can fix an entry.
 * `reason` isn't persisted on the batch — it's accepted purely so the audit-log middleware
 * captures why this batch was reopened.
 */
collectionsRouter.post(
  "/:id/reopen",
  requireRole(Role.Admin),
  asyncHandler(async (req, res) => {
    const parsed = reopenSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
      return;
    }
    try {
      const admin = await findUserById(req.user!.userId);
      res.json(await reopenCollectionBatch(req.params.id!, admin?.name ?? "Admin"));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to reopen batch" });
    }
  }),
);

collectionsRouter.delete(
  "/:id",
  requireRole(Role.Admin),
  asyncHandler(async (req, res) => {
    try {
      await deleteCollectionBatch(req.params.id!);
      res.status(204).send();
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to delete collection batch" });
    }
  }),
);
