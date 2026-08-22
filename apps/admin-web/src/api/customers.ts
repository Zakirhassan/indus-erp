import type { Customer, LedgerEntry, Occurrence, Relation, Sale } from "@indus/shared-types";
import { api, buildQuery } from "../lib/apiClient";
import type { Page } from "./products";

export interface CustomerListRow extends Customer {
  purchaseDate: string;
  productsSummary: string;
  occurrence: Occurrence;
  financeAmountPaise: number;
  finalAmountPaise: number;
  advancePaise: number;
  balancePaise: number;
}

export interface ListCustomersParams {
  search?: string;
  fieldId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export async function listCustomers(params: ListCustomersParams = {}): Promise<Page<CustomerListRow>> {
  return api.get<Page<CustomerListRow>>(`/api/customers${buildQuery(params)}`);
}

export interface CustomerWithSale {
  customer: Customer;
  sale: Sale;
}

export async function getCustomer(id: string): Promise<CustomerWithSale | undefined> {
  return api.get<CustomerWithSale>(`/api/customers/${id}`);
}

export async function getCustomerLedger(id: string): Promise<LedgerEntry[]> {
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

export async function createCustomer(input: CreateCustomerInput): Promise<CustomerWithSale> {
  return api.post<CustomerWithSale>("/api/customers", input);
}

export async function markCustomerInactive(id: string): Promise<Customer> {
  return api.patch<Customer>(`/api/customers/${id}/inactive`);
}

export async function markCustomerReturn(id: string, note?: string, reason?: string): Promise<Customer> {
  return api.post<Customer>(`/api/customers/${id}/return`, { note, reason });
}

/** Sales submitted from the vendor app, awaiting admin approval. */
export async function listPendingCustomers(): Promise<CustomerWithSale[]> {
  return api.get<CustomerWithSale[]>("/api/customers/pending");
}

export async function approveCustomerSale(id: string): Promise<CustomerWithSale> {
  return api.post<CustomerWithSale>(`/api/customers/${id}/approve`);
}

export async function rejectCustomerSale(id: string): Promise<Customer> {
  return api.post<Customer>(`/api/customers/${id}/reject`);
}
