import type { FieldRoute } from "@indus/shared-types";
import { api } from "../lib/apiClient";

export async function listFields(): Promise<FieldRoute[]> {
  return api.get<FieldRoute[]>("/api/fields");
}
