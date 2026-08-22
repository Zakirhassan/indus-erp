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
  listCollectionBatches,
  listPendingCollectionBatches,
  rejectCollectionBatch,
  saveCollectionBatch,
  submitCollectorBatch,
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

/** Collector app submission: entries are recorded but NOT posted to the ledger/balance until an admin approves. */
collectionsRouter.post(
  "/submit",
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
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to submit collection batch" });
    }
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

collectionsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    try {
      await deleteCollectionBatch(req.params.id!);
      res.status(204).send();
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to delete collection batch" });
    }
  }),
);
