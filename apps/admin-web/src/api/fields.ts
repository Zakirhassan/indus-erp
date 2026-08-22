import type { FieldRoute } from "@indus/shared-types";
import { api } from "../lib/apiClient";

export async function listFields(): Promise<FieldRoute[]> {
  return api.get<FieldRoute[]>("/api/fields");
}

export interface UpsertFieldInput {
  id?: string;
  code: string;
  description: string;
  active: boolean;
}

export async function upsertField(input: UpsertFieldInput): Promise<FieldRoute> {
  if (input.id) {
    return api.patch<FieldRoute>(`/api/fields/${input.id}`, {
      code: input.code,
      description: input.description,
      active: input.active,
    });
  }
  return api.post<FieldRoute>("/api/fields", { code: input.code, description: input.description, active: input.active });
}
