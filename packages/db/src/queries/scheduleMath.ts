/**
 * Installment-schedule math shared by the reports engine (Outstanding/Aging,
 * Collect-Today, Finance, Customer-attention). There is no stored per-
 * installment schedule table — a sale only records its plan parameters
 * (occurrence, durationCount, regularInstallmentPaise, finalInstallmentPaise).
 * Due dates and overdue amounts are therefore derived on read: "how many
 * installment steps have elapsed since saleDate" vs. "how much has actually
 * been collected". This is an approximation (it assumes installments are due
 * evenly every `stepDays`, not against a calendar the shop may adjust for
 * holidays) — good enough for reporting/prioritization, not a substitute for
 * the ledger as the source of truth for balances.
 */
import { Occurrence, type Occurrence as OccurrenceType } from "@indus/shared-types";

export function stepDaysFor(occurrence: OccurrenceType): number {
  switch (occurrence) {
    case Occurrence.Daily:
      return 1;
    case Occurrence.Weekly:
      return 7;
    case Occurrence.Monthly:
      return 30;
  }
}

export function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.floor((to - from) / 86_400_000);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface SchedulePlan {
  saleDate: string;
  advancePaise: number;
  occurrence: OccurrenceType;
  durationCount: number;
  regularInstallmentPaise: number;
  finalInstallmentPaise: number;
}

export interface ScheduleStatus {
  /** advance + every installment that should have been paid by asOfDate */
  expectedPaidPaise: number;
  /** advance + actual collections posted to date */
  collectedPaise: number;
  /** max(0, expected - collected) */
  overdueAmountPaise: number;
  installmentsElapsed: number;
  installmentsPaid: number;
  /** approx days the oldest unmet installment has been outstanding */
  daysOverdue: number;
  nextDueDate: string;
  isOverdue: boolean;
  isDueToday: boolean;
}

/**
 * @param collectedSinceAdvancePaise sum of COLLECTION ledger entries for this sale (excludes the advance, which is already baked into the plan)
 */
export function computeScheduleStatus(
  plan: SchedulePlan,
  collectedSinceAdvancePaise: number,
  asOfDate: string
): ScheduleStatus {
  const stepDays = stepDaysFor(plan.occurrence);
  const daysSinceSale = Math.max(0, daysBetween(plan.saleDate, asOfDate));
  const installmentsElapsed =
    plan.durationCount === 0
      ? 0
      : Math.min(plan.durationCount, Math.floor(daysSinceSale / stepDays));

  const expectedInstallmentsPaise =
    installmentsElapsed === 0
      ? 0
      : installmentsElapsed >= plan.durationCount
        ? plan.regularInstallmentPaise * (plan.durationCount - 1) + plan.finalInstallmentPaise
        : plan.regularInstallmentPaise * installmentsElapsed;

  const expectedPaidPaise = plan.advancePaise + expectedInstallmentsPaise;
  const collectedPaise = plan.advancePaise + collectedSinceAdvancePaise;
  const overdueAmountPaise = Math.max(0, expectedPaidPaise - collectedPaise);

  const installmentsPaid =
    plan.regularInstallmentPaise > 0
      ? Math.min(
          plan.durationCount,
          Math.floor(collectedSinceAdvancePaise / plan.regularInstallmentPaise)
        )
      : 0;
  const overdueInstallments = Math.max(0, installmentsElapsed - installmentsPaid);
  const daysOverdue = overdueInstallments * stepDays;
  const nextDueDate = addDaysIso(plan.saleDate, (installmentsPaid + 1) * stepDays);

  return {
    expectedPaidPaise,
    collectedPaise,
    overdueAmountPaise,
    installmentsElapsed,
    installmentsPaid,
    daysOverdue,
    nextDueDate,
    isOverdue: overdueAmountPaise > 0,
    isDueToday: nextDueDate === asOfDate
  };
}

export function agingBucket(daysOverdue: number): "0-30" | "31-60" | "61-90" | "90+" | "current" {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "0-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}
