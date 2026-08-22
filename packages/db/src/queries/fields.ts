import { asc, eq } from "drizzle-orm";
import type { FieldRoute } from "@indus/shared-types";
import { db } from "../client.js";
import { fields } from "../schema.js";
import { genId } from "../id.js";

export async function listFields(): Promise<FieldRoute[]> {
  return db.select().from(fields).orderBy(asc(fields.code));
}

export interface UpsertFieldInput {
  id?: string;
  code: string;
  description: string;
  active: boolean;
}

export async function upsertField(input: UpsertFieldInput): Promise<FieldRoute> {
  if (input.id) {
    const rows = await db
      .update(fields)
      .set({ code: input.code, description: input.description, active: input.active })
      .where(eq(fields.id, input.id))
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Field not found");
    return row;
  }
  const rows = await db
    .insert(fields)
    .values({ id: genId("field"), code: input.code, description: input.description, active: input.active })
    .returning();
  return rows[0]!;
}
