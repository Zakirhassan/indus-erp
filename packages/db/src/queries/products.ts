import { asc, desc, eq, count, ilike, or } from "drizzle-orm";
import { InventoryTxnType, type InventoryTransaction, type Product } from "@indus/shared-types";
import { db } from "../client.js";
import { inventoryTransactions, products } from "../schema.js";
import { genId, todayIso } from "../id.js";
import type { Page } from "./types.js";

export type { Page };

export interface ListProductsParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listProducts(params: ListProductsParams = {}): Promise<Page<Product>> {
  const { search = "", page = 1, pageSize = 20 } = params;
  const where = search.trim() ? or(ilike(products.name, `%${search.trim()}%`), ilike(products.type, `%${search.trim()}%`)) : undefined;

  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(asc(products.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(products).where(where),
  ]);

  return { items, total: totalRows[0]?.value ?? 0 };
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return rows[0];
}

export interface CreateProductInput {
  name: string;
  type: string;
  pricePaise: number;
  costPricePaise?: number;
  quantity: number;
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  return db.transaction(async (tx) => {
    const id = genId("prod");
    const createdAt = todayIso();
    const product: Product = {
      id,
      name: input.name,
      type: input.type,
      pricePaise: input.pricePaise,
      costPricePaise: input.costPricePaise ?? null,
      quantity: input.quantity,
      createdAt,
    };
    await tx.insert(products).values(product);
    if (input.quantity > 0) {
      await tx.insert(inventoryTransactions).values({
        id: genId("itxn"),
        productId: id,
        type: InventoryTxnType.PurchaseIn,
        quantityDelta: input.quantity,
        balanceAfter: input.quantity,
        referenceId: null,
        note: "Initial stock on product creation",
        createdAt,
      });
    }
    return product;
  });
}

export interface UpdateProductInput {
  name?: string;
  type?: string;
  pricePaise?: number;
  costPricePaise?: number | null;
}

export async function updateProduct(id: string, patch: UpdateProductInput): Promise<Product> {
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  const existing = rows[0];
  if (!existing) throw new Error("Product not found");
  const updated: Product = {
    ...existing,
    name: patch.name ?? existing.name,
    type: patch.type ?? existing.type,
    pricePaise: patch.pricePaise ?? existing.pricePaise,
    costPricePaise: patch.costPricePaise !== undefined ? patch.costPricePaise : existing.costPricePaise,
  };
  await db
    .update(products)
    .set({ name: updated.name, type: updated.type, pricePaise: updated.pricePaise, costPricePaise: updated.costPricePaise })
    .where(eq(products.id, id));
  return updated;
}

export async function purchaseIn(productId: string, quantity: number, note?: string): Promise<Product> {
  if (quantity <= 0) throw new Error("Quantity must be positive");
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(products).where(eq(products.id, productId)).limit(1);
    const product = rows[0];
    if (!product) throw new Error("Product not found");
    const newQuantity = product.quantity + quantity;
    await tx.update(products).set({ quantity: newQuantity }).where(eq(products.id, productId));
    await tx.insert(inventoryTransactions).values({
      id: genId("itxn"),
      productId,
      type: InventoryTxnType.PurchaseIn,
      quantityDelta: quantity,
      balanceAfter: newQuantity,
      referenceId: null,
      note: note ?? "Purchase order — stock in",
      createdAt: todayIso(),
    });
    return { ...product, quantity: newQuantity };
  });
}

export async function listInventoryTransactions(productId: string): Promise<InventoryTransaction[]> {
  const rows = await db
    .select()
    .from(inventoryTransactions)
    .where(eq(inventoryTransactions.productId, productId))
    .orderBy(desc(inventoryTransactions.createdAt));
  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    type: r.type as InventoryTxnType,
    quantityDelta: r.quantityDelta,
    balanceAfter: r.balanceAfter,
    referenceId: r.referenceId,
    note: r.note,
    createdAt: r.createdAt,
  }));
}
