import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "@indus/auth";
import type { Role, User } from "@indus/shared-types";
import { db } from "../client.js";
import { userFields, users } from "../schema.js";
import { genId } from "../id.js";

export interface UserWithPasswordHash extends User {
  passwordHash: string;
}

async function fieldIdsFor(userId: string): Promise<string[]> {
  const rows = await db.select({ fieldId: userFields.fieldId }).from(userFields).where(eq(userFields.userId, userId));
  return rows.map((r) => r.fieldId);
}

export async function findUserByEmail(email: string): Promise<UserWithPasswordHash | undefined> {
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  const user = rows[0];
  if (!user) return undefined;
  const fieldIds = await fieldIdsFor(user.id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    fieldIds,
    lastActiveAt: user.lastActiveAt ? user.lastActiveAt.toISOString() : null,
    passwordHash: user.passwordHash,
  };
}

export async function findUserById(id: string): Promise<User | undefined> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const user = rows[0];
  if (!user) return undefined;
  const fieldIds = await fieldIdsFor(user.id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    fieldIds,
    lastActiveAt: user.lastActiveAt ? user.lastActiveAt.toISOString() : null,
  };
}

export async function touchLastActive(id: string): Promise<void> {
  await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, id));
}

export async function listUsers(): Promise<User[]> {
  const rows = await db.select().from(users).orderBy(users.name);
  return Promise.all(
    rows.map(async (user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      fieldIds: await fieldIdsFor(user.id),
      lastActiveAt: user.lastActiveAt ? user.lastActiveAt.toISOString() : null,
    })),
  );
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: Role;
  fieldIds: string[];
}

export interface CreateUserResult {
  user: User;
  /** Shown once at invite time — there's no email/SMS delivery integration yet, so the admin relays it out-of-band. */
  tempPassword: string;
}

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email.toLowerCase())).limit(1);
  if (existing[0]) throw new Error("A user with this email already exists");

  const tempPassword = randomUUID().slice(0, 12);
  const passwordHash = await hashPassword(tempPassword);
  const id = genId("user");
  await db.insert(users).values({
    id,
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash,
    role: input.role,
    lastActiveAt: null,
  });
  for (const fieldId of input.fieldIds) {
    await db.insert(userFields).values({ userId: id, fieldId });
  }
  const user: User = { id, name: input.name, email: input.email.toLowerCase(), role: input.role, fieldIds: input.fieldIds, lastActiveAt: null };
  return { user, tempPassword };
}
