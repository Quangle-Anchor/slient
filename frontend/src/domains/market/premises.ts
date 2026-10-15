/**
 * What is inside a market: buildings (toà) › floors (tầng) › rows (dãy) ›
 * business points (điểm kinh doanh), one tenant to a point.
 *
 * Nobody has the markets' drawings, so nothing here says where anything is —
 * no coordinates, no outlines, no sizes on a plan. It records only what
 * contains what, and every view of it is generated from that: a point is drawn
 * as one cell among its row's cells, in code order, which is true whatever the
 * row really looks like.
 *
 * Served whole by `GET /markets/{id}/layout` (mock API only, like `markets`).
 */
export type MarketLayout = {
  marketId: number;
  buildings: Building[];
};

export type Building = {
  id: number;
  /** One letter, the first part of every code under it: `A`. */
  code: string;
  name: string;
  floors: Floor[];
};

export type Floor = {
  id: number;
  /** 1 is the ground floor. */
  level: number;
  name: string;
  rows: StallRow[];
};

export type StallRow = {
  id: number;
  /** Building, level, row: `A1-03`. */
  code: string;
  name: string;
  stalls: Stall[];
};

export type Stall = {
  id: number;
  /** The row's code and the point's number in it: `A1-03-07`. */
  code: string;
  /** Square metres. */
  area: number;
  /** What is sold there; null while nobody rents it. */
  tradeType: string | null;
  status: StallStatus;
  /** VND per month. */
  monthlyFee: number;
  /** Fees owed and unpaid, VND. Zero for a point that owes nothing. */
  debt: number;
  tenant: Tenant | null;
  contract: Contract | null;
  note: string | null;
};

/** What the point *is*; `StallState` below is what somebody managing it needs to know. */
export type StallStatus = "leased" | "vacant" | "suspended";

export type Tenant = {
  name: string;
  phone: string;
};

export type Contract = {
  number: string;
  startDate: string;
  endDate: string;
};

/**
 * One state per point, the one a cell is coloured by.
 *
 * A leased point can be both in debt and near the end of its contract; it gets
 * the one that needs acting on first. Unpaid fees outrank an expiring contract
 * because money already owed is a problem now and a renewal is one next month.
 */
export type StallState =
  | "overdue"
  | "expiring"
  | "leased"
  | "vacant"
  | "suspended";

/** The order states are listed in — the legend, the counts, the filter. */
export const STALL_STATES: StallState[] = [
  "leased",
  "expiring",
  "overdue",
  "vacant",
  "suspended",
];

export const STALL_STATE_LABELS: Record<StallState, string> = {
  leased: "Đang thuê",
  expiring: "Sắp hết hạn",
  overdue: "Nợ phí",
  vacant: "Trống",
  suspended: "Tạm ngưng",
};

/** How close to its end a contract has to be to count as expiring. */
export const EXPIRING_WITHIN_DAYS = 60;

const DAY = 24 * 60 * 60 * 1000;

/** Whole days from `today` to `date`; negative once it has passed. */
export function daysUntil(date: string, today: Date = new Date()): number {
  const start = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const [y, m, d] = date.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - start) / DAY);
}

export function stallState(stall: Stall, today: Date = new Date()): StallState {
  if (stall.status !== "leased") return stall.status;
  if (stall.debt > 0) return "overdue";
  if (
    stall.contract &&
    daysUntil(stall.contract.endDate, today) <= EXPIRING_WITHIN_DAYS
  ) {
    return "expiring";
  }
  return "leased";
}

/** A point with everything above it, so a flat list can still say where it is. */
export type StallEntry = {
  stall: Stall;
  state: StallState;
  building: Building;
  floor: Floor;
  row: StallRow;
};

export function flattenLayout(
  layout: MarketLayout,
  today: Date = new Date()
): StallEntry[] {
  return layout.buildings.flatMap((building) =>
    building.floors.flatMap((floor) =>
      floor.rows.flatMap((row) =>
        row.stalls.map((stall) => ({
          stall,
          state: stallState(stall, today),
          building,
          floor,
          row,
        }))
      )
    )
  );
}

export type PremisesSummary = {
  total: number;
  counts: Record<StallState, number>;
  /** Points with a tenant, whatever else is true of them. */
  occupied: number;
  /** Of the points that can be let — a point under repair is not an empty one. */
  occupancy: number;
  monthlyFees: number;
  debt: number;
};

export function summarize(entries: StallEntry[]): PremisesSummary {
  const counts = Object.fromEntries(STALL_STATES.map((s) => [s, 0])) as Record<
    StallState,
    number
  >;
  let monthlyFees = 0;
  let debt = 0;
  for (const { stall, state } of entries) {
    counts[state]++;
    if (stall.status === "leased") monthlyFees += stall.monthlyFee;
    debt += stall.debt;
  }
  const occupied = counts.leased + counts.expiring + counts.overdue;
  const lettable = occupied + counts.vacant;
  return {
    total: entries.length,
    counts,
    occupied,
    occupancy: lettable ? occupied / lettable : 0,
    monthlyFees,
    debt,
  };
}

/** The last segment of a point's code — what fits inside its cell. */
export function stallNumber(stall: Stall): string {
  return stall.code.slice(stall.code.lastIndexOf("-") + 1);
}
