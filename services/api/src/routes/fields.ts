import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "@indus/auth";
import { Role } from "@indus/shared-types";
import { listFields, upsertField } from "@indus/db";
import { asyncHandler } from "../asyncHandler.js";

export const fieldsRouter = Router();
fieldsRouter.use(requireAuth);

fieldsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await listFields());
  }),
);

const upsertFieldSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
  active: z.boolean(),
});

fieldsRouter.post(
  "/",
  requireRole(Role.Admin),
  asyncHandler(async (req, res) => {
    const parsed = upsertFieldSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
      return;
    }
    res.status(201).json(await upsertField(parsed.data));
  }),
);

fieldsRouter.patch(
  "/:id",
  requireRole(Role.Admin),
  asyncHandler(async (req, res) => {
    const parsed = upsertFieldSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
      return;
    }
    try {
      res.json(await upsertField({ id: req.params.id!, ...parsed.data }));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update field" });
    }
  }),
);
