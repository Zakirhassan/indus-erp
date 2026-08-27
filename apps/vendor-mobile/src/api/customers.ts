import type { Customer, LedgerEntry, Occurrence, Relation, Sale } from "@indus/shared-types";
import { api, buildQuery } from "../lib/apiClient";

export interface Page<T> {
  items: T[];
  total: number;
}

export interface CustomerListRow extends Customer {
  purchaseDate: string;
  productsSummary: string;
  occurrence: Occurrence;
  financeAmountPaise: number;
  finalAmountPaise: number;
  advancePaise: number;
  balancePaise: number;
  lastCollectionDate: string | null;
}

export async function listCustomers(params: {
  search?: string;
  fieldId?: string;
  pageSize?: number;
}): Promise<Page<CustomerListRow>> {
  return api.get<Page<CustomerListRow>>(`/api/customers${buildQuery(params)}`);
}

/** This collector's own submitted sales (any approval status) — the vendor app's "My Submissions" list. */
export async function listMySubmittedCustomers(params: { fieldId?: string } = {}): Promise<Page<CustomerListRow>> {
  return api.get<Page<CustomerListRow>>(`/api/customers${buildQuery({ ...params, mine: true, pageSize: 200 })}`);
}

export interface CustomerWithSale {
  customer: Customer;
  sale: Sale;
}

export async function getCustomer(id: string): Promise<CustomerWithSale> {
  return api.get<CustomerWithSale>(`/api/customers/${id}`);
}

export async function getLedger(id: string): Promise<LedgerEntry[]> {
  return api.get<LedgerEntry[]>(`/api/customers/${id}/ledger`);
}

export interface CreateCustomerInput {
  fieldId: string;
  purchaseDate: string;
  name: string;
  relation: Relation;
  relationName: string;
  address: string;
  phone: string;
  aadhaarLast4?: string;
  notes?: string;
  items: { productId: string; adjustedPricePaise: number; quantity: number }[];
  discountPaise: number;
  advancePaise: number;
  occurrence: Occurrence;
  financeAmountPaise: number;
}

/** Submits a new customer + sale. Held pending — no ledger/inventory effect — until an admin approves it. */
export async function createCustomer(input: CreateCustomerInput): Promise<CustomerWithSale> {
  return api.post<CustomerWithSale>("/api/customers", input);
}

export interface AddSaleItemInput {
  productId: string;
  adjustedPricePaise: number;
  quantity: number;
}

/** Adds a product to an existing (approved) customer's sale — grows the balance and re-derives the installment plan. */
export async function addSaleItem(customerId: string, input: AddSaleItemInput): Promise<CustomerWithSale> {
  return api.post<CustomerWithSale>(`/api/customers/${customerId}/items`, input);
}
