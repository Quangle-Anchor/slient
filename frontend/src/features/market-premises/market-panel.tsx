import { useMemo, useState } from "react";
import { ArrowDown, ExternalLink, Search, Store, X } from "lucide-react";

import { flattenLayout, summarize } from "@/domains/market/premises";
import { hasPosition, searchKey, type Market } from "@/domains/market/types";
import {
  DetailList,
  DetailRow,
  EmptyValue,
} from "@/shared/components/views/record-detail";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";

import { useMarketLayout } from "./use-market-layout";

/**
 * The side of the screen that is about the markets rather than the ground.
 *
 * One panel, three zones, like a list screen: a toolbar on the subtle surface,
 * the markets as rows, and, once one is chosen, its detail docked under them.
 * Docked rather than replacing the list, because the next question after "where
 * is this market" is usually "and the one next to it", and a detail view that
 * hides the list makes that a round trip.
 *
 * Rows carry no status chips. Where a pin came from is the map's business; what
 * somebody choosing a market wants is what is let and what is free, which the
 * detail answers.
 */
export function MarketPanel({
  markets,
  isLoading,
  selectedId,
  onSelect,
  openId,
  onOpen,
  className,
}: {
  markets: Market[];
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  /** The market whose premises are open under the map, if any. */
  openId: number | null;
  onOpen: (id: number) => void;
  className?: string;
}) {
  const [term, setTerm] = useState("");

  const rows = useMemo(() => {
    const key = searchKey(term.trim());
    return markets.filter(
      (market) =>
        !key ||
        searchKey(
          `${market.name} ${market.code} ${market.ward} ${market.address ?? ""}`
        ).includes(key)
    );
  }, [markets, term]);

  const selected = markets.find((m) => m.id === selectedId) ?? null;

  return (
    <section
      aria-label="Danh sách chợ"
      className={cn(
        "bg-card shadow-e1 flex min-h-0 flex-col overflow-hidden rounded-lg border",
        className
      )}
    >
      <div className="bg-surface-subtle flex flex-col gap-2 border-b p-3">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Tìm chợ, mã, đường (gõ không dấu được)"
            aria-label="Tìm chợ"
            className="bg-card ps-8"
          />
        </div>
        <p className="text-muted-foreground text-xs">
          {isLoading ? "Đang tải…" : `${markets.length} chợ`}
        </p>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {isLoading &&
          Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 px-2.5 py-2">
              <Skeleton className="size-7 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </li>
          ))}
        {!isLoading && rows.length === 0 && (
          <li className="text-muted-foreground px-3 py-6 text-center text-sm">
            {markets.length
              ? "Không có chợ nào khớp. Thử gõ ngắn hơn."
              : "Chưa có chợ nào."}
          </li>
        )}
        {rows.map((market) => {
          const active = market.id === selectedId;
          return (
            <li key={market.id}>
              <button
                type="button"
                aria-current={active || undefined}
                onClick={() => onSelect(active ? null : market.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-start transition-colors",
                  "hover:bg-accent focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
                  active && "bg-accent"
                )}
              >
                <MarketIcon active={active} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {market.name}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {[market.code, market.ward].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && (
        <MarketDetail
          market={selected}
          isOpen={openId === selected.id}
          onOpen={() => onOpen(selected.id)}
          onClose={() => onSelect(null)}
        />
      )}
    </section>
  );
}

function MarketDetail({
  market,
  isOpen,
  onOpen,
  onClose,
}: {
  market: Market;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  // The same query the board under the map reads, so opening it is free.
  const { layout } = useMarketLayout(market.id);
  const summary = useMemo(
    () => (layout ? summarize(flattenLayout(layout)) : null),
    [layout]
  );

  const count = (value: number | undefined) =>
    value === undefined ? (
      <Skeleton className="h-4 w-14" />
    ) : (
      <span className="tabular-nums">{value} điểm</span>
    );

  return (
    <div
      className="max-h-[55%] shrink-0 overflow-y-auto border-t"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <MarketIcon active />
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs">{market.code}</p>
          <h2 className="truncate text-lg leading-6 font-semibold">
            {market.name}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-me-2 size-8"
          aria-label="Bỏ chọn"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <DetailList className="border-t">
        {/* The whole address, not just the ward: after the 2025 merger every
            market here is in the same ward, so the ward alone tells nobody
            where to go. */}
        <DetailRow label="Địa chỉ">
          {market.address ?? market.ward ?? (
            <EmptyValue>Chưa có địa chỉ</EmptyValue>
          )}
        </DetailRow>
        <DetailRow label="Đang thuê">{count(summary?.occupied)}</DetailRow>
        <DetailRow label="Còn trống">{count(summary?.counts.vacant)}</DetailRow>
        <DetailRow label="Tạm ngưng">
          {count(summary?.counts.suspended)}
        </DetailRow>
      </DetailList>

      {/*
        The way in to what is inside: buildings, floors, rows, business points.
        It opens under the map rather than on a page of its own, so the map and
        the market's inside are one scroll apart instead of one Back apart.
        Once open, the same button just takes you back down to it.
      */}
      <div className="flex flex-col gap-2 border-t px-4 py-3">
        <Button
          type="button"
          size="sm"
          variant={isOpen ? "outline" : "default"}
          className="w-full"
          onClick={onOpen}
        >
          {isOpen ? "Đang mở bên dưới" : "Xem mặt bằng chợ"}
          <ArrowDown className="size-3.5" />
        </Button>
        {hasPosition(market) && (
          <Button asChild variant="ghost" size="sm" className="w-full">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${market.latitude},${market.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-3.5" />
              Mở Google Maps
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

/** The storefront tile the map draws for a market, so a row and its pin look alike. */
function MarketIcon({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-foreground text-background"
      )}
    >
      <Store className="size-4" />
    </span>
  );
}
