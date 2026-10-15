import { useMemo, useState } from "react";
import type { BaseKey } from "@refinedev/core";
import { LayoutGrid, Rows3, Search, X } from "lucide-react";

import {
  STALL_STATE_LABELS,
  flattenLayout,
  summarize,
  type StallEntry,
} from "@/domains/market/premises";
import { searchKey, type Market } from "@/domains/market/types";
import { MetaItem, MetaStrip } from "@/shared/components/views/record-detail";
import { formatMoneyShort } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/tabs/tabs";

import { PremisesTable } from "./premises-table";
import { PremisesTree } from "./premises-tree";
import { usePremisesParams } from "./premises-params";
import { StackingPlan } from "./stacking-plan";
import { StallPanel } from "./stall-panel";
import { useMarketLayout } from "./use-market-layout";

/**
 * One market, inside: buildings › floors › rows › business points.
 *
 * Three columns, each answering one question. The tree on the left is *how
 * much* of the market you are looking at; the middle is *what is there*, as a
 * stacking plan or a table; the right is *what about it* — one point, or the
 * totals and the to-do list of the scope. Every choice lives in the URL
 * (`premises-params.ts`), so a link to a point is a link to that point.
 *
 * Under `xl` the three stack and the page scrolls; a 15rem tree beside a 22rem
 * panel leaves too little between them for a row of sixteen points.
 *
 * Rendered under the map on the markets screen, for the market opened there.
 * Mount it with `key={marketId}`: the search box is local state, and one
 * market's search should not follow you into the next.
 */
export function MarketBoard({
  marketId,
  market,
  workspaceClassName,
}: {
  marketId: BaseKey;
  market: Market;
  /** The workspace's height from `xl`, which only the page around it can work out. */
  workspaceClassName?: string;
}) {
  const id = marketId;
  const params = usePremisesParams();
  const [term, setTerm] = useState("");
  const { layout, query: layoutQuery } = useMarketLayout(id);

  const entries = useMemo(
    () => (layout ? flattenLayout(layout) : []),
    [layout]
  );

  // Scope: a code in the URL that matches nothing (a stale link) falls back to
  // the whole market rather than to an empty screen.
  const building =
    layout?.buildings.find((b) => b.code === params.building) ?? null;
  const floor =
    building?.floors.find((f) => String(f.level) === params.floor) ?? null;
  const scoped = useMemo(
    () =>
      entries.filter(
        (e) =>
          (!building || e.building.id === building.id) &&
          (!floor || e.floor.id === floor.id)
      ),
    [entries, building, floor]
  );
  const selected = entries.find((e) => e.stall.code === params.point) ?? null;

  const key = searchKey(term.trim());
  const isMatch = (e: StallEntry) =>
    (!params.state || e.state === params.state) &&
    (!key ||
      searchKey(
        `${e.stall.code} ${e.stall.tenant?.name ?? ""} ${
          e.stall.tradeType ?? ""
        }`
      ).includes(key));

  const marketSummary = useMemo(() => summarize(entries), [entries]);
  const scopeSummary = useMemo(() => summarize(scoped), [scoped]);
  const scopeLabel = floor
    ? `Toà ${building!.code} · ${floor.name}`
    : building
    ? `Toà ${building.code} · ${building.name}`
    : "Toàn chợ";

  // Folding the right-hand panel hands its width to the plan. Remembered in
  // this browser, because somebody who folds it does so to work in the plan,
  // on every market, not once.
  const [panelCollapsed, setPanelCollapsedState] = useState(readPanelCollapsed);
  const setPanelCollapsed = (value: boolean) => {
    setPanelCollapsedState(value);
    writePanelCollapsed(value);
  };

  const select = (entry: StallEntry | null) => {
    const point =
      entry && entry.stall.code !== params.point ? entry.stall.code : null;
    params.update({ point });
    // Choosing a point asks for its detail, so a folded panel opens to show it.
    if (point) setPanelCollapsed(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card shadow-e1 rounded-lg border px-4 py-3">
        <MetaStrip>
          <MetaItem label="Mã chợ">{market.code}</MetaItem>
          <MetaItem label="Phường, xã">
            {market.ward ?? "Chưa xác định"}
          </MetaItem>
          <MetaItem label="Toà">
            {layout ? layout.buildings.length : <Pending />}
          </MetaItem>
          <MetaItem label="Điểm kinh doanh">
            {layout ? marketSummary.total : <Pending />}
          </MetaItem>
          <MetaItem label="Lấp đầy">
            {layout ? (
              `${Math.round(marketSummary.occupancy * 100)}%`
            ) : (
              <Pending />
            )}
          </MetaItem>
          <MetaItem label="Phí thuê / tháng">
            {layout ? formatMoneyShort(marketSummary.monthlyFees) : <Pending />}
          </MetaItem>
          <MetaItem label="Công nợ">
            {layout ? (
              <span
                className={
                  marketSummary.debt > 0 ? "text-destructive-text" : undefined
                }
              >
                {formatMoneyShort(marketSummary.debt)}
              </span>
            ) : (
              <Pending />
            )}
          </MetaItem>
        </MetaStrip>
      </div>

      {layoutQuery.isError ? (
        <p className="text-destructive-text text-sm">
          Không tải được mặt bằng của chợ này.
        </p>
      ) : !layout ? (
        <div className="grid gap-4 xl:grid-cols-[15rem_minmax(0,1fr)]">
          <Skeleton className="h-72" />
          <Skeleton className="h-[28rem]" />
        </div>
      ) : layout.buildings.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
          Chợ này chưa được khai báo toà, tầng hay dãy nào.
        </p>
      ) : (
        /*
          The tree, and one workspace surface holding the plan and the detail.
          From xl the tree's chosen item is a tab of that surface (see
          `premises-tree.tsx`), so the outline runs unbroken from what was
          chosen, round the plan, to the detail it opened. The workspace sits
          one pixel under the tree column for that: its left hairline is what
          the tab covers.
        */
        <div
          className={cn(
            "grid gap-4 xl:min-h-[560px] xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-0",
            workspaceClassName
          )}
        >
          <PremisesTree
            layout={layout}
            entries={entries}
            building={building?.code ?? null}
            floor={floor ? String(floor.level) : null}
            onScope={(b, f) => params.update({ building: b, floor: f })}
            className="xl:relative xl:z-10"
          />

          <div
            className={cn(
              "bg-card shadow-e1 grid min-h-0 min-w-0",
              panelCollapsed
                ? "lg:grid-cols-[minmax(0,1fr)_3.5rem]"
                : "lg:grid-cols-[minmax(0,1fr)_22rem]",
              " overflow-hidden rounded-lg border lg:divide-x max-lg:divide-y max-xl:lg:h-[80svh] xl:-ms-px"
            )}
          >
            <section
              aria-label="Mặt bằng"
              className="flex min-h-0 min-w-0 flex-col max-lg:max-h-[75svh]"
            >
              {/* The same 4rem band as the detail's header beside it: one strip across the surface. */}
              <div className="bg-surface-subtle flex h-16 shrink-0 items-center gap-2 border-b px-3">
                <div className="relative min-w-0 flex-1">
                  <Search className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
                  <Input
                    type="search"
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder="Tìm mã điểm, người thuê, ngành hàng"
                    aria-label="Tìm điểm kinh doanh"
                    className="bg-card ps-8"
                  />
                </div>
                {/*
                  The state filter is set from the summary panel, which a chosen
                  point replaces. Restated here, it stays visible and can be
                  cleared whatever the right-hand side is showing.
                */}
                {params.state && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => params.update({ state: null })}
                    aria-label={`Bỏ lọc ${STALL_STATE_LABELS[params.state]}`}
                  >
                    Chỉ {STALL_STATE_LABELS[params.state].toLowerCase()}
                    <X className="size-3.5" />
                  </Button>
                )}
                <Tabs
                  value={params.view}
                  onValueChange={(value) =>
                    params.update({ view: value === "table" ? "table" : null })
                  }
                >
                  <TabsList>
                    <TabsTrigger value="plan">
                      <LayoutGrid />
                      Sơ đồ
                    </TabsTrigger>
                    <TabsTrigger value="table">
                      <Rows3 />
                      Bảng
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/*
                Keyed by scope, so choosing another building or floor fades the
                new contents in: the change is seen to come from the tab that
                was clicked rather than the plan silently swapping under it.
              */}
              <div
                key={`${building?.code ?? ""}-${floor?.level ?? ""}-${
                  params.view
                }`}
                className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-1 min-h-0 flex-1 overflow-auto motion-safe:duration-200"
              >
                {params.view === "plan" ? (
                  <StackingPlan
                    buildings={building ? [building] : layout.buildings}
                    entries={scoped}
                    floorLevel={floor?.level ?? null}
                    isMatch={isMatch}
                    selectedId={selected?.stall.id ?? null}
                    onSelect={select}
                  />
                ) : (
                  <PremisesTable
                    entries={scoped.filter(isMatch)}
                    selectedId={selected?.stall.id ?? null}
                    onSelect={select}
                  />
                )}
              </div>

              <p className="text-muted-foreground border-t px-4 py-2 text-xs">
                Sơ đồ khối theo mã dãy và mã điểm, không thể hiện vị trí thực tế
                trong chợ.
              </p>
            </section>

            <StallPanel
              scopeLabel={scopeLabel}
              summary={scopeSummary}
              selected={selected}
              activeState={params.state}
              onState={(state) => params.update({ state })}
              onSelect={select}
              collapsed={panelCollapsed}
              onCollapsedChange={setPanelCollapsed}
              className="max-lg:max-h-[75svh]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** A fact still on its way: the shape of a value, not a dash that reads as "none". */
function Pending() {
  return <Skeleton className="mt-0.5 h-4 w-12" />;
}

const PANEL_COLLAPSED_KEY = "market-premises:panel-collapsed";

function readPanelCollapsed(): boolean {
  try {
    return localStorage.getItem(PANEL_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writePanelCollapsed(collapsed: boolean) {
  try {
    if (collapsed) localStorage.setItem(PANEL_COLLAPSED_KEY, "1");
    else localStorage.removeItem(PANEL_COLLAPSED_KEY);
  } catch {
    // Storage blocked: the panel still folds, it just is not remembered.
  }
}
