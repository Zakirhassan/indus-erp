import {
  CollectionBatchStatus,
  CustomerApprovalStatus,
  CustomerStatus,
  InventoryTxnType,
  LedgerEntryType,
  Occurrence,
  Relation,
  Role,
  planFromInstallmentAmount,
  rupeesToPaise,
  type Customer,
  type CollectionBatch,
  type FieldRoute,
  type InventoryTransaction,
  type LedgerEntry,
  type Product,
  type ReturnRecord,
  type Sale,
  type User,
} from "@indus/shared-types";
import { intBetween, mulberry32, pick } from "./rng";

export interface Db {
  fields: FieldRoute[];
  users: User[];
  products: Product[];
  inventoryTxns: InventoryTransaction[];
  customers: Customer[];
  sales: Sale[];
  ledgerEntries: LedgerEntry[];
  collectionBatches: CollectionBatch[];
  returns: ReturnRecord[];
}

const rng = mulberry32(20260819);
const uid = (prefix: string, n: number) => `${prefix}_${n.toString().padStart(4, "0")}`;
const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

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
  { type: "Household Item", names: ["Ceiling Fan", "Pedestal Fan", "Plastic Chair (Set of 4)", "Cooler", "Mixer Grinder", "Steel Trunk"], priceRange: [400, 4500] },
];

const FIRST_NAMES = ["Ram", "Shyam", "Suresh", "Mahesh", "Geeta", "Sita", "Rekha", "Anil", "Sunil", "Vijay", "Manoj", "Rajesh", "Kavita", "Pooja", "Deepak", "Ashok", "Meena", "Radha", "Vikas", "Sanjay"];
const LAST_NAMES = ["Kumar", "Sharma", "Verma", "Singh", "Yadav", "Gupta", "Prasad", "Devi", "Mishra", "Chauhan"];
const RELATIONS: Relation[] = [Relation.SonOf, Relation.DaughterOf, Relation.WifeOf, Relation.CareOf];

function randomName(): string {
  return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
}

function buildFields(): FieldRoute[] {
  return FIELD_DEFS.map((f, i) => ({ id: uid("field", i + 1), code: f.code, description: f.description, active: true }));
}

function buildUsers(fields: FieldRoute[]): User[] {
  const byCode = (c: string) => fields.find((f) => f.code === c)!.id;
  return [
    { id: uid("user", 1), name: "Sarah Jenkins", email: "admin@proledger.local", role: Role.Admin, fieldIds: [], lastActiveAt: new Date().toISOString() },
    { id: uid("user", 2), name: "Ram Babu", email: "rambabu@proledger.local", role: Role.Collector, fieldIds: [byCode("C1"), byCode("D1")], lastActiveAt: isoDaysAgo(0) },
    { id: uid("user", 3), name: "Michael Kane", email: "mkane@proledger.local", role: Role.Collector, fieldIds: [byCode("D2"), byCode("E1")], lastActiveAt: isoDaysAgo(1) },
  ];
}

function buildProducts(): { products: Product[]; txns: InventoryTransaction[] } {
  const products: Product[] = [];
  const txns: InventoryTransaction[] = [];
  let n = 0;
  for (const group of PRODUCT_DEFS) {
    for (const name of group.names) {
      n += 1;
      const pricePaise = rupeesToPaise(intBetween(rng, group.priceRange[0], group.priceRange[1]));
      const costPricePaise = Math.round(pricePaise * (intBetween(rng, 65, 80) / 100));
      const quantity = intBetween(rng, 4, 40);
      const id = uid("prod", n);
      products.push({ id, name, type: group.type, pricePaise, costPricePaise, quantity, createdAt: isoDaysAgo(90) });
      txns.push({
        id: uid("itxn", n),
        productId: id,
        type: InventoryTxnType.PurchaseIn,
        quantityDelta: quantity,
        balanceAfter: quantity,
        referenceId: null,
        note: "Opening stock",
        createdAt: isoDaysAgo(90),
      });
    }
  }
  return { products, txns };
}

const OCCURRENCE_WEIGHTED: Occurrence[] = [
  Occurrence.Weekly, Occurrence.Weekly, Occurrence.Weekly,
  Occurrence.Daily, Occurrence.Daily,
  Occurrence.Monthly,
];

function installmentAmountFor(occurrence: Occurrence): number {
  switch (occurrence) {
    case Occurrence.Daily:
      return rupeesToPaise(intBetween(rng, 20, 80));
    case Occurrence.Weekly:
      return rupeesToPaise(intBetween(rng, 80, 300));
    case Occurrence.Monthly:
      return rupeesToPaise(intBetween(rng, 500, 2000));
  }
}

function stepDaysFor(occurrence: Occurrence): number {
  switch (occurrence) {
    case Occurrence.Daily:
      return 1;
    case Occurrence.Weekly:
      return 7;
    case Occurrence.Monthly:
      return 30;
  }
}

export function buildSeed(): Db {
  const fields = buildFields();
  const users = buildUsers(fields);
  const { products, txns: inventoryTxns } = buildProducts();
  const customers: Customer[] = [];
  const sales: Sale[] = [];
  const ledgerEntries: LedgerEntry[] = [];
  const collectionBatches: CollectionBatch[] = [];
  const returns: ReturnRecord[] = [];

  let customerN = 0;
  let saleN = 0;
  let ledgerN = 0;
  let batchN = 0;

  // Serial counters per field, so C1-121 / D2-121 can be forced as a deliberate duplicate.
  const serialByField: Record<string, number> = Object.fromEntries(fields.map((f) => [f.code, 0]));
  function nextSerial(fieldCode: string, forced?: number): number {
    if (forced !== undefined) return forced;
    serialByField[fieldCode] = (serialByField[fieldCode] ?? 0) + 1;
    return serialByField[fieldCode];
  }

  function createCustomerWithSale(
    fieldCode: string,
    forcedSerial?: number,
    opts: { nearZero?: boolean; daysSinceSale?: number } = {},
  ): Customer {
    const field = fields.find((f) => f.code === fieldCode)!;
    customerN += 1;
    saleN += 1;
    const serialNo = nextSerial(fieldCode, forcedSerial);
    const daysSinceSale = opts.daysSinceSale ?? intBetween(rng, 5, 200);
    const saleDate = isoDaysAgo(daysSinceSale);

    const itemCount = intBetween(rng, 1, 3);
    const items = Array.from({ length: itemCount }, () => {
      const product = pick(rng, products);
      const quantity = intBetween(rng, 1, 3);
      const adjustPct = intBetween(rng, -12, 5) / 100;
      const adjustedPricePaise = Math.max(1, Math.round(product.pricePaise * (1 + adjustPct)));
      return {
        productId: product.id,
        productName: product.name,
        masterPricePaise: product.pricePaise,
        adjustedPricePaise,
        quantity,
        subtotalPaise: adjustedPricePaise * quantity,
      };
    });
    const totalPaise = items.reduce((s, it) => s + it.subtotalPaise, 0);
    const discountPaise = rupeesToPaise(intBetween(rng, 0, 3) * 10);
    const finalAmountPaise = Math.max(0, totalPaise - discountPaise);
    const advancePaise = Math.round(finalAmountPaise * (intBetween(rng, 10, 30) / 100));
    const balancePaise = finalAmountPaise - advancePaise;

    const occurrence = pick(rng, OCCURRENCE_WEIGHTED);
    const targetInstallment = installmentAmountFor(occurrence);
    const plan = planFromInstallmentAmount(Math.max(balancePaise, targetInstallment), targetInstallment);

    const saleId = uid("sale", saleN);
    const sale: Sale = {
      id: saleId,
      customerId: "", // set below
      items,
      totalPaise,
      discountPaise,
      finalAmountPaise,
      advancePaise,
      balancePaise,
      financePlan: {
        occurrence,
        financeAmountPaise: targetInstallment,
        durationCount: plan.durationCount,
        regularInstallmentPaise: plan.regularInstallmentPaise,
        finalInstallmentPaise: plan.finalInstallmentPaise,
      },
      saleDate,
      createdAt: saleDate,
    };

    const customerId = uid("cust", customerN);
    sale.customerId = customerId;

    const customer: Customer = {
      id: customerId,
      fieldId: field.id,
      fieldCode: field.code,
      serialNo,
      name: randomName(),
      relation: pick(rng, RELATIONS),
      relationName: randomName(),
      address: `House ${intBetween(rng, 1, 400)}, ${field.description.split(" — ")[0]}`,
      phone: `9${intBetween(rng, 100000000, 999999999)}`,
      aadhaarLast4: String(intBetween(rng, 1000, 9999)),
      notes: null,
      status: CustomerStatus.Active,
      saleId,
      approvalStatus: CustomerApprovalStatus.Approved,
      submittedBy: null,
      submittedByName: null,
      createdAt: saleDate,
    };

    // Decrement inventory for the sale.
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId)!;
      product.quantity = Math.max(0, product.quantity - item.quantity);
      inventoryTxns.push({
        id: uid("itxn", inventoryTxns.length + 1),
        productId: product.id,
        type: InventoryTxnType.SaleOut,
        quantityDelta: -item.quantity,
        balanceAfter: product.quantity,
        referenceId: saleId,
        note: `Sale to ${customer.fieldCode}-${customer.serialNo}`,
        createdAt: saleDate,
      });
    }

    // Opening ledger row: the sale itself.
    ledgerN += 1;
    ledgerEntries.push({
      id: uid("ledg", ledgerN),
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

    // Simulate collection history: post regular installments walking forward from saleDate.
    let runningBalance = balancePaise;
    const step = stepDaysFor(occurrence);
    let cursorDaysAgo = daysSinceSale - step;
    const stopAt = opts.nearZero ? plan.regularInstallmentPaise : 0;
    while (cursorDaysAgo > 0 && runningBalance > stopAt) {
      const collectPaise = Math.min(plan.regularInstallmentPaise, runningBalance - stopAt);
      if (collectPaise <= 0) break;
      runningBalance -= collectPaise;
      const entryDate = isoDaysAgo(cursorDaysAgo);
      const collector = pick(rng, users.filter((u) => u.role === Role.Collector));
      ledgerN += 1;
      ledgerEntries.push({
        id: uid("ledg", ledgerN),
        customerId,
        saleId,
        date: entryDate,
        type: LedgerEntryType.Collection,
        debitPaise: 0,
        creditPaise: collectPaise,
        balanceAfterPaise: runningBalance,
        collectedBy: collector.name,
        note: null,
        createdAt: entryDate,
      });

      // Fold this simulated collection into a per-day-per-field APPROVED batch so
      // the Collections Dashboard has real historical batches to show.
      let batch = collectionBatches.find((b) => b.date === entryDate && b.fieldId === field.id);
      if (!batch) {
        batchN += 1;
        batch = {
          id: uid("batch", batchN),
          date: entryDate,
          fieldId: field.id,
          fieldCode: field.code,
          collectorId: collector.id,
          collectorName: collector.name,
          entries: [],
          totalAmountPaise: 0,
          status: CollectionBatchStatus.Approved,
          createdAt: entryDate,
          reopenedAt: null,
          reopenedByName: null,
        };
        collectionBatches.push(batch);
      }
      batch.entries.push({
        id: uid("bentry", batch.entries.length + 1 + batchN * 100),
        batchId: batch.id,
        customerId,
        serialNo,
        amountPaise: collectPaise,
        error: null,
      });
      batch.totalAmountPaise += collectPaise;

      cursorDaysAgo -= step;
    }
    sale.balancePaise = runningBalance;
    customer.status = runningBalance <= 0 ? CustomerStatus.Inactive : CustomerStatus.Active;
    if (runningBalance <= 0) {
      // Keep the last ledger row's balance pinned at 0 for consistency.
      const last = ledgerEntries[ledgerEntries.length - 1];
      if (last && last.customerId === customerId) last.balanceAfterPaise = 0;
    }

    sales.push(sale);
    customers.push(customer);
    return customer;
  }

  // ~40 customers spread across the 4 fields, including a forced duplicate serial (121)
  // in both C1 and D2 per the tracker's seed spec.
  const perField = 9;
  for (const f of FIELD_DEFS) {
    for (let i = 0; i < perField; i++) {
      createCustomerWithSale(f.code);
    }
  }
  createCustomerWithSale("C1", 121);
  createCustomerWithSale("D2", 121);
  // One customer deliberately left one installment away from zero balance, to demo
  // the auto-Inactive transition live.
  createCustomerWithSale("D1", undefined, { nearZero: true, daysSinceSale: 40 });

  // A couple of PENDING batches "submitted from the field" awaiting admin approval —
  // entries here are NOT yet posted to the ledger (that happens on approval).
  const activeCustomersByField = (fieldId: string) =>
    customers.filter((c) => c.fieldId === fieldId && c.status === CustomerStatus.Active);

  const pendingSpecs = [
    { fieldCode: "D2", collector: "Michael Kane", daysAgo: 0 },
    { fieldCode: "C1", collector: "Ram Babu", daysAgo: 1 },
  ];
  for (const spec of pendingSpecs) {
    const field = fields.find((f) => f.code === spec.fieldCode)!;
    const collector = users.find((u) => u.name === spec.collector)!;
    const pool = activeCustomersByField(field.id).slice(0, 6);
    batchN += 1;
    const date = isoDaysAgo(spec.daysAgo);
    const entries = pool.map((c, idx) => {
      const sale = sales.find((s) => s.id === c.saleId)!;
      const amount = Math.min(sale.financePlan.regularInstallmentPaise, sale.balancePaise);
      return {
        id: uid("bentry", idx + 1 + batchN * 100),
        batchId: uid("batch", batchN),
        customerId: c.id,
        serialNo: c.serialNo,
        amountPaise: amount,
        error: null,
      };
    });
    collectionBatches.push({
      id: uid("batch", batchN),
      date,
      fieldId: field.id,
      fieldCode: field.code,
      collectorId: collector.id,
      collectorName: collector.name,
      entries,
      totalAmountPaise: entries.reduce((s, e) => s + e.amountPaise, 0),
      status: CollectionBatchStatus.Pending,
      createdAt: date,
      reopenedAt: null,
      reopenedByName: null,
    });
  }

  return { fields, users, products, inventoryTxns, customers, sales, ledgerEntries, collectionBatches, returns };
}
