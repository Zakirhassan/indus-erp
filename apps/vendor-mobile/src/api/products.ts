import type { Product } from "@indus/shared-types";
import { api, buildQuery } from "../lib/apiClient";
import type { Page } from "./customers";

export async function listProducts(params: { search?: string; pageSize?: number } = {}): Promise<Page<Product>> {
  return api.get<Page<Product>>(`/api/products${buildQuery(params)}`);
}
