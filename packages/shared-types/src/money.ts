/**
 * All money in this codebase is integer paise (1 rupee = 100 paise) to avoid
 * floating-point drift in ledgers. Never store or compute money as a float.
 */
export type Paise = number;

export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

export function formatINR(paise: Paise): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paiseToRupees(paise));
}

export interface InstallmentPlan {
  durationCount: number;
  regularInstallmentPaise: Paise;
  finalInstallmentPaise: Paise;
}

/**
 * Duration is fixed (e.g. customer negotiated "7 weeks"); installment amount
 * is derived. floor(balance / duration), with the rounding remainder folded
 * into the final installment so the plan always sums exactly to the balance.
 */
export function planFromDuration(balancePaise: Paise, durationCount: number): InstallmentPlan {
  if (durationCount <= 0) throw new Error("durationCount must be positive");
  const regularInstallmentPaise = Math.floor(balancePaise / durationCount);
  const finalInstallmentPaise =
    balancePaise - regularInstallmentPaise * (durationCount - 1);
  return { durationCount, regularInstallmentPaise, finalInstallmentPaise };
}

/**
 * Installment amount is fixed (e.g. "100/Weekly"); duration is derived as
 * the number of occurrences needed to clear the balance, with the last
 * installment absorbing whatever remainder is left.
 */
export function planFromInstallmentAmount(
  balancePaise: Paise,
  targetInstallmentPaise: Paise,
): InstallmentPlan {
  if (targetInstallmentPaise <= 0) throw new Error("targetInstallmentPaise must be positive");
  const durationCount = Math.ceil(balancePaise / targetInstallmentPaise);
  const finalInstallmentPaise =
    balancePaise - targetInstallmentPaise * (durationCount - 1);
  return {
    durationCount,
    regularInstallmentPaise: targetInstallmentPaise,
    finalInstallmentPaise,
  };
}
