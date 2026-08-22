import { Router } from "express";
import { z } from "zod";
import { requireAuth, signAccessToken, verifyPassword } from "@indus/auth";
import { findUserByEmail, findUserById, touchLastActive } from "@indus/db";
import { asyncHandler } from "../asyncHandler.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const { email, password } = parsed.data;
    const user = await findUserByEmail(email.trim().toLowerCase());
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: "Incorrect email or password." });
      return;
    }
    await touchLastActive(user.id);
    const token = signAccessToken({ userId: user.id, role: user.role });
    res.json({ token, userId: user.id, name: user.name, role: user.role });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await findUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  }),
);
