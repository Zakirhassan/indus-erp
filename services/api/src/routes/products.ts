import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "@indus/auth";
import {
  createProduct,
  getProductById,
  listInventoryTransactions,
  listProducts,
  purchaseIn,
  updateProduct,
} from "@indus/db";
import { asyncHandler } from "../asyncHandler.js";

export const productsRouter = Router();
productsRouter.use(requireAuth);

productsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;
    res.json(await listProducts({ search, page, pageSize }));
  }),
);

const createProductSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  pricePaise: z.number().int().positive(),
  costPricePaise: z.number().int().nonnegative().optional(),
  quantity: z.number().int().nonnegative(),
});

productsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
      return;
    }
    res.status(201).json(await createProduct(parsed.data));
  }),
);

productsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await getProductById(req.params.id!);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(product);
  }),
);

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  pricePaise: z.number().int().positive().optional(),
  costPricePaise: z.number().int().nonnegative().nullable().optional(),
});

productsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
      return;
    }
    try {
      res.json(await updateProduct(req.params.id!, parsed.data));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update product" });
    }
  }),
);

const purchaseInSchema = z.object({
  quantity: z.number().int().positive(),
  note: z.string().optional(),
});

productsRouter.post(
  "/:id/purchase",
  asyncHandler(async (req, res) => {
    const parsed = purchaseInSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
      return;
    }
    try {
      res.json(await purchaseIn(req.params.id!, parsed.data.quantity, parsed.data.note));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to record purchase" });
    }
  }),
);

productsRouter.get(
  "/:id/transactions",
  asyncHandler(async (req, res) => {
    res.json(await listInventoryTransactions(req.params.id!));
  }),
);
