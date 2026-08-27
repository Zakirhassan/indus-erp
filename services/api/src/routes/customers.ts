import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "@indus/auth";
import { Occurrence, Relation, Role } from "@indus/shared-types";
import {
  addSaleItem,
  approveCustomerSale,
  createCustomer,
  findUserById,
  getCustomer,
  getCustomerLedger,
  listCustomers,
  listPendingCustomers,
  markCustomerInactive,
  markCustomerReturn,
  rejectCustomerSale,
} from "@indus/db";
import { asyncHandler } from "../asyncHandler.js";

export const customersRouter = Router();
customersRouter.use(requireAuth);

customersRouter.get(
  "/pending",
  requireRole(Role.Admin),
  asyncHandler(async (_req, res) => {
    res.json(await listPendingCustomers());
  }),
);

customersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, fieldId, dateFrom, dateTo, page, pageSize, submittedBy, mine } = req.query;
    // ?mine=true scopes to the caller's own submissions (any role) — used for a "my submissions"
    // view that includes pending ones. Otherwise a collector sees the same approved field roster
    // as everyone else (needed to record collections against customers other collectors/admin
    // submitted); only an admin may target a specific submitter via ?submittedBy=.
    const effectiveSubmittedBy =
      mine === "true"
        ? req.user?.userId
        : req.user?.role === Role.Collector
          ? undefined
          : typeof submittedBy === "string"
            ? submittedBy
            : undefined;
    res.json(
      await listCustomers({
        search: typeof search === "string" ? search : undefined,
        fieldId: typeof fieldId === "string" ? fieldId : undefined,
        dateFrom: typeof dateFrom === "string" ? dateFrom : undefined,
        dateTo: typeof dateTo === "string" ? dateTo : undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
        submittedBy: effectiveSubmittedBy,
      }),
    );
  }),
);

const createCustomerSchema = z.object({
  fieldId: z.string().min(1),
  purchaseDate: z.string().min(1),
  name: z.string().min(1),
  relation: z.nativeEnum(Relation),
  relationName: z.string(),
  address: z.string(),
  phone: z.string(),
  aadhaarLast4: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        adjustedPricePaise: z.number().int().nonnegative(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  discountPaise: z.number().int().nonnegative(),
  advancePaise: z.number().int().nonnegative(),
  occurrence: z.nativeEnum(Occurrence),
  financeAmountPaise: z.number().int().nonnegative(),
});

customersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
      return;
    }
    try {
      let submittedBy: { id: string; name: string } | undefined;
      if (req.user?.role === Role.Collector) {
        const collector = await findUserById(req.user.userId);
        submittedBy = { id: req.user.userId, name: collector?.name ?? "Collector" };
      }
      const result = await createCustomer({ ...parsed.data, submittedBy });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create customer" });
    }
  }),
);

customersRouter.post(
  "/:id/approve",
  requireRole(Role.Admin),
  asyncHandler(async (req, res) => {
    try {
      res.json(await approveCustomerSale(req.params.id!));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to approve sale" });
    }
  }),
);

customersRouter.post(
  "/:id/reject",
  requireRole(Role.Admin),
  asyncHandler(async (req, res) => {
    try {
      res.json(await rejectCustomerSale(req.params.id!));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to reject sale" });
    }
  }),
);

customersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await getCustomer(req.params.id!);
    if (!result) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    res.json(result);
  }),
);

const addSaleItemSchema = z.object({
  productId: z.string().min(1),
  adjustedPricePaise: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
});

customersRouter.post(
  "/:id/items",
  asyncHandler(async (req, res) => {
    const parsed = addSaleItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
      return;
    }
    try {
      let addedByName: string | undefined;
      if (req.user) {
        const actor = await findUserById(req.user.userId);
        addedByName = actor?.name ?? (req.user.role === Role.Collector ? "Collector" : "Admin");
      }
      res.json(await addSaleItem(req.params.id!, { ...parsed.data, addedByName }));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to add product" });
    }
  }),
);

customersRouter.get(
  "/:id/ledger",
  asyncHandler(async (req, res) => {
    res.json(await getCustomerLedger(req.params.id!));
  }),
);

customersRouter.patch(
  "/:id/inactive",
  asyncHandler(async (req, res) => {
    try {
      res.json(await markCustomerInactive(req.params.id!));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update customer" });
    }
  }),
);

const returnSchema = z.object({ note: z.string().optional(), reason: z.string().optional() });

customersRouter.post(
  "/:id/return",
  asyncHandler(async (req, res) => {
    const parsed = returnSchema.safeParse(req.body ?? {});
    const note = parsed.success ? parsed.data.note : undefined;
    const reason = parsed.success ? parsed.data.reason : undefined;
    try {
      res.json(await markCustomerReturn(req.params.id!, note, reason));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to process return" });
    }
  }),
);
