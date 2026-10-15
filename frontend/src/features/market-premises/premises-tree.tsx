import type { ReactNode } from "react";
import { Building2, Layers, Store } from "lucide-react";

import {
  summarize,
  type MarketLayout,
  type StallEntry,
} from "@/domains/market/premises";
import { cn } from "@/shared/lib/utils";

/**
 * The market's buildings and floors, as the screen's scope.
 *
 * Only two levels deep on purpose. Rows and points are what the plan in the
 * middle shows; repeating them here would be a second, longer copy of the same
 * list with nothing to say that the plan does not say better.
 *
 * Floors are listed top floor first, the way the plan stacks them and the way
 * a building is drawn, so the tree and the plan read in the same direction.
 *
 * From `xl` the tree is not a panel of its own. It sits on the page, and the
 * chosen item is a **tab of the workspace beside it**: same surface, same
 * hairline, no edge between them, joined by two concave corners. What you
 * picked and what it opened are then visibly one thing, which a highlighted
 * row in a separate card could only suggest. Below `xl` the tree stacks above
 * the workspace, there is nothing to join to, and it is an ordinary card.
 */
export function PremisesTree({
  layout,
  entries,
  building,
  floor,
  onScope,
  className,
}: {
  layout: MarketLayout;
  entries: StallEntry[];
  building: string | null;
  floor: string | null;
  onScope: (building: string | null, floor: string | null) => void;
  className?: string;
}) {
  return (
    <nav
      aria-label="Toà và tầng"
      className={cn(
        "bg-card shadow-e1 flex min-h-0 flex-col overflow-hidden rounded-lg border",
        "xl:rounded-none xl:border-0 xl:bg-transparent xl:shadow-none",
        className
      )}
    >
      {/* As tall as the workspace's toolbar band, so the two read as one line. */}
      <div className="bg-surface-subtle flex h-16 shrink-0 items-center border-b px-4 xl:border-0 xl:bg-transparent xl:ps-2.5">
        <h2 className="text-muted-foreground text-sm font-medium">Toà, tầng</h2>
      </div>
      {/*
        The scroll container ends exactly on the workspace's left hairline (the
        workspace is pulled one pixel under it), so the chosen item can cover
        that hairline without overflowing, which would be clipped.
      */}
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5 [scrollbar-width:thin] xl:py-4 xl:ps-0 xl:pe-0">
        <li>
          <TreeItem
            icon={<Store className="size-4" />}
            label="Toàn chợ"
            entries={entries}
            active={!building}
            onClick={() => onScope(null, null)}
          />
        </li>
        {layout.buildings.map((b) => {
          const inBuilding = entries.filter((e) => e.building.id === b.id);
          return (
            <li key={b.id}>
              <TreeItem
                icon={<Building2 className="size-4" />}
                label={`Toà ${b.code}`}
                hint={b.name}
                entries={inBuilding}
                active={building === b.code && !floor}
                onClick={() => onScope(b.code, null)}
              />
              <ul className="ms-4 space-y-0.5 border-s ps-1.5 xl:ms-5">
                {[...b.floors].reverse().map((f) => (
                  <li key={f.id}>
                    <TreeItem
                      icon={<Layers className="size-3.5" />}
                      label={f.name}
                      entries={inBuilding.filter((e) => e.floor.id === f.id)}
                      active={building === b.code && floor === String(f.level)}
                      onClick={() => onScope(b.code, String(f.level))}
                      compact
                    />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The two concave corners that join the active tab to the workspace's edge.
 *
 * Each is a 16px box against the tab's right edge, just above or below it,
 * with one rounded corner whose two borders draw the curve. Its box-shadow
 * paints the card colour into the corner outside that curve and over the
 * workspace's hairline beside it, so the outline turns the corner instead of
 * crossing it. The shadow is clipped to the ear's own box: unclipped it reaches
 * as far into the tab as the ear is tall and paints over the tab's counts.
 */
const EARS = [
  "xl:before:pointer-events-none xl:before:absolute xl:before:end-0 xl:before:-top-4 xl:before:size-4",
  "xl:before:rounded-br-[1rem] xl:before:border-e xl:before:border-b xl:before:border-border",
  "xl:before:shadow-[8px_8px_0_8px_var(--card)] xl:before:[clip-path:inset(0)]",
  "xl:after:pointer-events-none xl:after:absolute xl:after:end-0 xl:after:-bottom-4 xl:after:size-4",
  "xl:after:rounded-tr-[1rem] xl:after:border-e xl:after:border-t xl:after:border-border",
  "xl:after:shadow-[8px_-8px_0_8px_var(--card)] xl:after:[clip-path:inset(0)]",
];

function TreeItem({
  icon,
  label,
  hint,
  entries,
  active,
  onClick,
  compact,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  entries: StallEntry[];
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const summary = summarize(entries);
  const lettable = summary.occupied + summary.counts.vacant;
  return (
    <button
      type="button"
      aria-current={active || undefined}
      onClick={onClick}
      className={cn(
        "relative flex w-full flex-col gap-1 rounded-xl border border-transparent px-2.5 text-start",
        "transition-[background-color,margin,border-color] duration-200",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        compact ? "py-1.5" : "py-2",
        active
          ? [
              "bg-accent",
              // From xl: a tab of the workspace, flush with its edge.
              "xl:bg-card xl:border-border xl:rounded-s-2xl xl:rounded-e-none xl:border-e-0",
              ...EARS,
            ]
          : "hover:bg-accent xl:me-4"
      )}
    >
      <span className="flex items-center gap-2">
        <span className={cn("text-muted-foreground", active && "text-primary")}>
          {icon}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            active ? "font-semibold" : "font-medium"
          )}
        >
          {label}
          {hint && (
            <span className="text-muted-foreground font-normal"> · {hint}</span>
          )}
        </span>
        {summary.counts.overdue > 0 && (
          <span
            className="bg-destructive-subtle text-destructive-text rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
            title={`${summary.counts.overdue} điểm nợ phí`}
          >
            {summary.counts.overdue}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2 ps-6">
        <span
          className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
          aria-hidden
        >
          <span
            className="bg-success block h-full rounded-full"
            style={{ width: `${Math.round(summary.occupancy * 100)}%` }}
          />
        </span>
        <span className="text-muted-foreground text-[11px] tabular-nums">
          {summary.occupied}/{lettable}
        </span>
      </span>
    </button>
  );
}
