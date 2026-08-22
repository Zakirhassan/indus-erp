import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "@indus/auth";
import { Role } from "@indus/shared-types";
import { createUser, listUsers } from "@indus/db";
import { asyncHandler } from "../asyncHandler.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.use(requireRole(Role.Admin));

usersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await listUsers());
  }),
);

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  fieldIds: z.array(z.string()).default([]),
});

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
      return;
    }
    try {
      const { user, tempPassword } = await createUser(parsed.data);
      res.status(201).json({ ...user, tempPassword });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create user" });
    }
  }),
);
