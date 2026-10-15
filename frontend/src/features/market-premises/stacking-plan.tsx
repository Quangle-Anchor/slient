import {
  STALL_STATE_LABELS,
  stallNumber,
  summarize,
  type Building,
  type StallEntry,
} from "@/domains/market/premises";
import { formatMoney } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

import { STALL_CELL } from "./stall-state-style";

/**
 * The market as a stack of floors, each floor its rows, each row its points.
 *
 * This is a diagram of what contains what, not a plan of where things are:
 * nobody has the drawings, so every point is the same size and a row's points
 * are drawn in code order. That is what keeps it true without them — it never
 * claims that A1-03 is beside A1-04 on the ground, only that both are in that
 * row. Once a market's drawings exist they are a different view, not a
 * correction of this one.
 *
 * Top floor first, the way a building is drawn and the way the tree lists it.
 * A point that does not match the search or the state filter is dimmed rather
 * than removed: removing it would close the gap and change the shape of the
 * row, which is the one thing a reader uses to find their way back.
 */
export function StackingPlan({
  buildings,
  entries,
  floorLevel,
  isMatch,
  selectedId,
  onSelect,
}: {
  buildings: Building[];
  /** Every point in scope, already flattened — states are computed once, by the page. */
  entries: StallEntry[];
  /** Only this floor of each building, when set. */
  floorLevel: number | null;
  isMatch: (entry: StallEntry) => boolean;
  selectedId: number | null;
  onSelect: (entry: StallEntry) => void;
}) {
  const byStall = new Map(entries.map((e) => [e.stall.id, e]));

  return (
    <div className="space-y-6 p-4">
      {buildings.map((building) => {
        const floors = [...building.floors]
          .filter((f) => floorLevel === null || f.level === floorLevel)
          .reverse();
        const inBuilding = entries.filter((e) => e.building.id === building.id);
        const summary = summarize(inBuilding);
        return (
          <section key={building.id} aria-label={`Toà ${building.code}`}>
            <header className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-base font-semibold">
                Toà {building.code}
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · {building.name}
                </span>
              </h3>
              <span className="text-muted-foreground text-xs">
                {summary.occupied}/{summary.occupied + summary.counts.vacant}{" "}
                điểm có người thuê · {Math.round(summary.occupancy * 100)}%
              </span>
            </header>

            <div className="divide-border overflow-hidden rounded-md border">
              {floors.map((floor) => {
                const inFloor = inBuilding.filter(
                  (e) => e.floor.id === floor.id
                );
                const floorSummary = summarize(inFloor);
                return (
                  <div
                    key={floor.id}
                    className="grid border-b last:border-b-0 md:grid-cols-[8.5rem_minmax(0,1fr)]"
                  >
                    {/* The floor's label column: what a reader scans down first. */}
                    <div className="bg-surface-subtle flex flex-row items-baseline gap-3 border-b px-3 py-2.5 md:flex-col md:gap-0.5 md:border-e md:border-b-0">
                      <span className="text-sm font-semibold">
                        {floor.name}
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {floorSummary.occupied}/
                        {floorSummary.occupied + floorSummary.counts.vacant} ·{" "}
                        {Math.round(floorSummary.occupancy * 100)}%
                      </span>
                      {floorSummary.counts.overdue > 0 && (
                        <span className="text-destructive-text text-xs">
                          {floorSummary.counts.overdue} nợ phí
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 space-y-1.5 px-3 py-2.5">
                      {floor.rows.map((row) => (
                        <div key={row.id} className="flex items-start gap-2">
                          <span
                            className="text-muted-foreground w-14 shrink-0 pt-1.5 font-mono text-[11px] tabular-nums"
                            title={row.name}
                          >
                            {row.code}
                          </span>
                          <ul
                            className="flex min-w-0 flex-wrap gap-1"
                            aria-label={row.name}
                          >
                            {row.stalls.map((stall) => {
                              const entry = byStall.get(stall.id);
                              if (!entry) return null;
                              const selected = stall.id === selectedId;
                              const dimmed = !isMatch(entry);
                              return (
                                <li key={stall.id}>
                                  <button
                                    type="button"
                                    onClick={() => onSelect(entry)}
                                    aria-pressed={selected}
                                    aria-label={`${stall.code}, ${
                                      STALL_STATE_LABELS[entry.state]
                                    }${
                                      stall.tenant
                                        ? `, ${stall.tenant.name}`
                                        : ""
                                    }`}
                                    title={[
                                      stall.code,
                                      STALL_STATE_LABELS[entry.state],
                                      stall.tenant?.name,
                                      stall.tradeType,
                                      stall.debt
                                        ? `Nợ ${formatMoney(stall.debt)}`
                                        : null,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                    className={cn(
                                      "flex size-8 items-center justify-center rounded-sm border text-[11px] font-semibold tabular-nums",
                                      "transition-[opacity,box-shadow] hover:shadow-e2",
                                      "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
                                      STALL_CELL[entry.state],
                                      dimmed && "opacity-20",
                                      selected &&
                                        "ring-primary ring-offset-background ring-2 ring-offset-2"
                                    )}
                                  >
                                    {stallNumber(stall)}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                      {floor.rows.length === 0 && (
                        <p className="text-muted-foreground py-1 text-sm">
                          Tầng này chưa có dãy nào.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
