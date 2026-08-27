/**
 * Dev seed: fields, demo users (with real bcrypt-hashed passwords matching
 * the app's documented demo credentials), a product catalog, and a modest
 * set of demo customers/sales/ledger history so the Customers page isn't
 * empty on first run. Ported from apps/admin-web/src/mock/seed.ts (kept in
 * sync on field codes + product catalog so local dev "feels the same").
 */
import { eq } from "drizzle-orm";
import { hashPassword } from "@indus/auth";
import {
  CustomerStatus,
  InventoryTxnType,
  LedgerEntryType,
  Occurrence,
  Relation,
  Role,
  planFromInstallmentAmount,
  rupeesToPaise,
  type Occurrence as OccurrenceType,
} from "@indus/shared-types";
import { db, pool } from "./client.js";
import { customers, fields, inventoryTransactions, ledgerEntries, products, saleItems, sales, userFields, users } from "./schema.js";
import { genId } from "./id.js";

const FIELD_DEFS = [
  { code: "C1", description: "North District — Commercial" },
  { code: "D1", description: "Downtown — Residential" },
  { code: "D2", description: "East Sector — Residential" },
  { code: "E1", description: "Riverside Colony — Residential" },
] as const;

const PRODUCT_DEFS: { type: string; names: string[]; priceRange: [number, number] }[] = [
  { type: "Bed", names: ["Queen Sheesham Bed", "King Teak Bed", "Single Divan Bed", "Bunk Bed"], priceRange: [8000, 22000] },
  { type: "Almirah", names: ["3-Door Steel Almirah", "2-Door Wooden Almirah", "Mirror Almirah"], priceRange: [6000, 18000] },
  { type: "Table", names: ["Dining Table 6-Seater", "Study Table", "Center Table", "Folding Table"], priceRange: [1500, 12000] },
  { type: "Sofa", names: ["3-Seater Sofa Set", "L-Shape Sofa", "Sofa Cum Bed", "Recliner Chair"], priceRange: [7000, 25000] },
  {
    type: "Household Item",
    names: ["Ceiling Fan", "Pedestal Fan", "Plastic Chair (Set of 4)", "Cooler", "Mixer Grinder", "Steel Trunk"],
    priceRange: [400, 4500],
  },
];

const FIRST_NAMES = ["Ram", "Shyam", "Suresh", "Mahesh", "Geeta", "Sita", "Rekha", "Anil", "Sunil", "Vijay"];
const LAST_NAMES = ["Kumar", "Sharma", "Verma", "Singh", "Yadav", "Gupta", "Prasad", "Devi"];
const RELATIONS: Relation[] = [Relation.SonOf, Relation.DaughterOf, Relation.WifeOf, Relation.CareOf];
const OCCURRENCES: OccurrenceType[] = [Occurrence.Daily, Occurrence.Weekly, Occurrence.Monthly];

function intBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[intBetween(0, arr.length - 1)]!;
}
function randomName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function installmentAmountFor(occurrence: OccurrenceType): number {
  switch (occurrence) {
    case Occurrence.Daily:
      return rupeesToPaise(intBetween(20, 80));
    case Occurrence.Weekly:
      return rupeesToPaise(intBetween(80, 300));
    case Occurrence.Monthly:
      return rupeesToPaise(intBetween(500, 2000));
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("[seed] Refusing to run demo-data seed against a production environment (NODE_ENV=production).");
  }

  console.log("[seed] Seeding fields...");
  const fieldRows = FIELD_DEFS.map((f) => ({ id: genId("field"), code: f.code, description: f.description, active: true }));
  await db.insert(fields).values(fieldRows).onConflictDoNothing();
  const existingFields = await db.select({ id: fields.id, code: fields.code, description: fields.description }).from(fields);
  const byCode = (code: string) => existingFields.find((f) => f.code === code)!;

  console.log("[seed] Seeding demo users...");
  const userDefs = [
    { name: "Sarah Jenkins", email: "admin@proledger.local", password: "admin123", role: Role.Admin, fieldCodes: [] as string[] },
    { name: "Ram Babu", email: "rambabu@proledger.local", password: "collector123", role: Role.Collector, fieldCodes: ["C1", "D1", "D2", "E1"] },
    { name: "Michael Kane", email: "mkane@proledger.local", password: "collector123", role: Role.Collector, fieldCodes: ["D2", "E1"] },
  ];
  for (const u of userDefs) {
    const passwordHash = await hashPassword(u.password);
    const [inserted] = await db
      .insert(users)
      .values({ id: genId("user"), name: u.name, email: u.email, passwordHash, role: u.role, lastActiveAt: new Date() })
      .onConflictDoNothing()
      .returning({ id: users.id });
    const userId = inserted?.id ?? (await db.select({ id: users.id }).from(users).where(eq(users.email, u.email)))[0]!.id;
    for (const code of u.fieldCodes) {
      await db.insert(userFields).values({ userId, fieldId: byCode(code).id }).onConflictDoNothing();
    }
  }

  console.log("[seed] Seeding products...");
  const productRows: (typeof products.$inferInsert)[] = [];
  for (const group of PRODUCT_DEFS) {
    for (const name of group.names) {
      const pricePaise = rupeesToPaise(intBetween(group.priceRange[0], group.priceRange[1]));
      // Demo cost basis: ~65-80% of selling price, so profit reports have real numbers in dev.
      const costPricePaise = Math.round(pricePaise * (intBetween(65, 80) / 100));
      const quantity = intBetween(4, 40);
      productRows.push({ id: genId("prod"), name, type: group.type, pricePaise, costPricePaise, quantity, createdAt: isoDaysAgo(90) });
    }
  }
  await db.insert(products).values(productRows);
  for (const p of productRows) {
    await db.insert(inventoryTransactions).values({
      id: genId("itxn"),
      productId: p.id,
      type: InventoryTxnType.PurchaseIn,
      quantityDelta: p.quantity,
      balanceAfter: p.quantity,
      referenceId: null,
      note: "Opening stock",
      createdAt: p.createdAt,
    });
  }

  console.log("[seed] Seeding demo customers + sales + ledger history...");
  const serialByField: Record<string, number> = Object.fromEntries(existingFields.map((f) => [f.code, 0]));
  for (const field of existingFields) {
    for (let i = 0; i < 6; i++) {
      serialByField[field.code] = (serialByField[field.code] ?? 0) + 1;
      const serialNo = serialByField[field.code]!;
      const daysSinceSale = intBetween(5, 200);
      const saleDate = isoDaysAgo(daysSinceSale);

      const itemCount = intBetween(1, 2);
      const chosenProducts = Array.from({ length: itemCount }, () => pick(productRows));
      const items = chosenProducts.map((product) => {
        const quantity = intBetween(1, 2);
        const adjustedPricePaise = product.pricePaise;
        return { productId: product.id, productName: product.name, masterPricePaise: product.pricePaise, adjustedPricePaise, quantity, subtotalPaise: adjustedPricePaise * quantity };
      });
      const totalPaise = items.reduce((s, it) => s + it.subtotalPaise, 0);
      const discountPaise = 0;
      const finalAmountPaise = totalPaise;
      const advancePaise = Math.round(finalAmountPaise * (intBetween(10, 30) / 100));
      const balancePaise = finalAmountPaise - advancePaise;
      const occurrence = pick(OCCURRENCES);
      const targetInstallment = installmentAmountFor(occurrence);
      const plan = planFromInstallmentAmount(Math.max(balancePaise, targetInstallment), targetInstallment);

      const customerId = genId("cust");
      const saleId = genId("sale");

      await db.insert(customers).values({
        id: customerId,
        fieldId: field.id,
        fieldCode: field.code,
        serialNo,
        name: randomName(),
        relation: pick(RELATIONS),
        relationName: randomName(),
        address: `House ${intBetween(1, 400)}, ${field.description.split(" — ")[0]}`,
        phone: `9${intBetween(100000000, 999999999)}`,
        aadhaarLast4: String(intBetween(1000, 9999)),
        notes: null,
        status: CustomerStatus.Active,
        saleId: null,
        createdAt: saleDate,
      });

      await db.insert(sales).values({
        id: saleId,
        customerId,
        totalPaise,
        discountPaise,
        finalAmountPaise,
        advancePaise,
        balancePaise,
        occurrence,
        financeAmountPaise: targetInstallment,
        durationCount: plan.durationCount,
        regularInstallmentPaise: plan.regularInstallmentPaise,
        finalInstallmentPaise: plan.finalInstallmentPaise,
        saleDate,
        createdAt: saleDate,
      });
      await db.update(customers).set({ saleId }).where(eq(customers.id, customerId));

      for (const item of items) {
        await db.insert(saleItems).values({
          id: genId("sitem"),
          saleId,
          productId: item.productId,
          productName: item.productName,
          masterPricePaise: item.masterPricePaise,
          adjustedPricePaise: item.adjustedPricePaise,
          quantity: item.quantity,
          subtotalPaise: item.subtotalPaise,
        });
        const productRow = productRows.find((p) => p.id === item.productId)!;
        productRow.quantity = Math.max(0, productRow.quantity - item.quantity);
        await db.update(products).set({ quantity: productRow.quantity }).where(eq(products.id, item.productId));
        await db.insert(inventoryTransactions).values({
          id: genId("itxn"),
          productId: item.productId,
          type: InventoryTxnType.SaleOut,
          quantityDelta: -item.quantity,
          balanceAfter: productRow.quantity,
          referenceId: saleId,
          note: `Sale to ${field.code}-${serialNo}`,
          createdAt: saleDate,
        });
      }

      await db.insert(ledgerEntries).values({
        id: genId("ledg"),
        customerId,
        saleId,
        date: saleDate,
        type: LedgerEntryType.Sale,
        debitPaise: finalAmountPaise,
        creditPaise: 0,
        balanceAfterPaise: balancePaise,
        collectedBy: null,
        note: "Sale — finance plan opened",
        createdAt: saleDate,
      });
    }
  }

  console.log("[seed] Done.");
  await pool.end();
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
