import type { InventoryTransaction, Product } from "@indus/shared-types";
import { api, buildQuery } from "../lib/apiClient";

export interface Page<T> {
  items: T[];
  total: number;
}

export interface ListProductsParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listProducts(params: ListProductsParams = {}): Promise<Page<Product>> {
  return api.get<Page<Product>>(`/api/products${buildQuery(params)}`);
}

export async function getProduct(id: string): Promise<Product> {
  return api.get<Product>(`/api/products/${id}`);
}

export interface CreateProductInput {
  name: string;
  type: string;
  pricePaise: number;
  costPricePaise?: number;
  quantity: number;
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  return api.post<Product>("/api/products", input);
}

export interface UpdateProductInput {
  name?: string;
  type?: string;
  pricePaise?: number;
  costPricePaise?: number | null;
}

export async function updateProduct(id: string, patch: UpdateProductInput): Promise<Product> {
  return api.patch<Product>(`/api/products/${id}`, patch);
}

export async function purchaseIn(productId: string, quantity: number, note?: string): Promise<Product> {
  return api.post<Product>(`/api/products/${productId}/purchase`, { quantity, note });
}

export async function listInventoryTxns(productId: string): Promise<InventoryTransaction[]> {
  return api.get<InventoryTransaction[]>(`/api/products/${productId}/transactions`);
}
