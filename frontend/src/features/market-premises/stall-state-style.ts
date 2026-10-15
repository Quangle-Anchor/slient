import type { StallState } from "@/domains/market/premises";

/**
 * How a point's cell is painted on the stacking plan.
 *
 * The status families' wash and label, like a badge, because a floor is a
 * column of forty statuses and a solid fill on every one of them would leave
 * nothing standing out. Debt is the exception that earns a drawn edge as well:
 * it is the one state somebody has to find in a full floor at a glance.
 * Vacant is dashed — an empty point is a hole in the row, not a colour.
 */
export const STALL_CELL: Record<StallState, string> = {
  leased: "bg-success-subtle text-success-text border-transparent",
  expiring: "bg-warning-subtle text-warning-text border-warning",
  overdue: "bg-destructive-subtle text-destructive-text border-destructive",
  vacant: "bg-card text-muted-foreground border-dashed border-border",
  suspended:
    "bg-neutral-subtle text-neutral-text border-transparent line-through",
};

/** The legend's swatch: the same cell, small. */
export const STALL_SWATCH: Record<StallState, string> = {
  leased: "bg-success-subtle border-success",
  expiring: "bg-warning-subtle border-warning",
  overdue: "bg-destructive-subtle border-destructive",
  vacant: "bg-card border-dashed border-muted-foreground",
  suspended: "bg-neutral-subtle border-neutral",
};
