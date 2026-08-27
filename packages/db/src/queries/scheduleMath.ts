/**
 * Installment-schedule math shared by the reports engine (Outstanding/Aging,
 * Collect-Today, Finance, Customer-attention). There is no stored per-
 * installment schedule table — a sale only records its plan parameters
 * (occurrence, durationCount, regularInstallmentPaise, finalInstallmentPaise).
 * Due dates and overdue amounts are therefore derived on read: "how many
 * installment periods have elapsed since saleDate" vs. "how much has
 * actually been collected". Weekly/Monthly periods are calendar-aligned
 * (Sun–Sat weeks / calendar months, see periodStart/periodEnd below) rather
 * than a rolling N-day window from the exact sale date — a weekly customer
 * can pay any day of the week and still be on time, not just the exact
 * weekday they happened to sign up on. This is still an approximation (not
 * against a calendar the shop may adjust for holidays) — good enough for
 * reporting/prioritization, not a substitute for the ledger as the source
 * of truth for balances.
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

/** The Sunday starting the Sun–Sat calendar week containing `iso`. */
export function weekStartSunday(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

/** First day of the calendar month containing `iso`. */
export function monthStartIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/** Last day of the calendar month containing `iso`. */
export function monthEndIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

/**
 * Calendar-aligned period boundaries — a shared Sun–Sat week grid (Weekly) or calendar-month
 * grid (Monthly), not a rolling N-day window anchored to each customer's individual sale date.
 * This is what lets a weekly customer pay any day of the week (most pay Sunday) without being
 * flagged overdue for missing the exact weekday they happened to sign up on. Daily is a no-op —
 * each day already is its own period.
 */
export function periodStart(occurrence: OccurrenceType, iso: string): string {
  switch (occurrence) {
    case Occurrence.Daily:
      return iso;
    case Occurrence.Weekly:
      return weekStartSunday(iso);
    case Occurrence.Monthly:
      return monthStartIso(iso);
  }
}

export function periodEnd(occurrence: OccurrenceType, iso: string): string {
  switch (occurrence) {
    case Occurrence.Daily:
      return iso;
    case Occurrence.Weekly:
      return addDaysIso(weekStartSunday(iso), 6);
    case Occurrence.Monthly:
      return monthEndIso(iso);
  }
}

/** Shifts `iso` by `n` whole periods (n days / n×7 days / n calendar months). */
export function shiftPeriods(occurrence: OccurrenceType, iso: string, n: number): string {
  switch (occurrence) {
    case Occurrence.Daily:
      return addDaysIso(iso, n);
    case Occurrence.Weekly:
      return addDaysIso(iso, n * 7);
    case Occurrence.Monthly: {
      const d = new Date(`${iso}T00:00:00Z`);
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate())).toISOString().slice(0, 10);
    }
  }
}

/**
 * Number of period boundaries separating the period containing `fromIso` from the period
 * containing `toIso` (0 if both fall in the same period).
 */
export function periodsBetweenCalendar(occurrence: OccurrenceType, fromIso: string, toIso: string): number {
  if (occurrence === Occurrence.Daily) return daysBetween(fromIso, toIso);
  const fromStart = periodStart(occurrence, fromIso);
  const toStart = periodStart(occurrence, toIso);
  if (occurrence === Occurrence.Weekly) return Math.round(daysBetween(fromStart, toStart) / 7);
  const a = new Date(`${fromStart}T00:00:00Z`);
  const b = new Date(`${toStart}T00:00:00Z`);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
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
  const installmentsElapsed =
    plan.durationCount === 0
      ? 0
      : Math.min(plan.durationCount, Math.max(0, periodsBetweenCalendar(plan.occurrence, plan.saleDate, asOfDate)));

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
  const nextDueDate = periodEnd(plan.occurrence, shiftPeriods(plan.occurrence, plan.saleDate, installmentsPaid + 1));

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
