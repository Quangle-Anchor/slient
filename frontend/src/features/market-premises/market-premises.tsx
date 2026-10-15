import { useEffect, useRef, useState } from "react";
import { useList } from "@refinedev/core";
import { X } from "lucide-react";

import type { Market } from "@/domains/market/types";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { Button } from "@/shared/ui/button";

import { MarketBoard } from "./market-board";
import { MarketMap } from "./market-map";
import { MarketPanel } from "./market-panel";
import { usePremisesParams } from "./premises-params";

/** Everything below the map that belongs to the open market, cleared together. */
const BOARD_PARAMS = {
  building: null,
  floor: null,
  point: null,
  state: null,
  view: null,
};

/**
 * Market premises: where each market is, and what is inside the one you open.
 *
 * The map answers "where", the panel beside it "which" and "what about it",
 * and choosing a market on either side selects it on the other. "Xem mặt bằng
 * chợ" then opens that market's inside (`MarketBoard`) **under the map, on
 * this same page**: the map and the premises are one scroll apart instead of
 * one Back apart. Nothing is drawn there until a market is opened, and
 * deselecting the market closes it again.
 *
 * Which market is open lives in the URL (`?market=1`), next to the board's own
 * scope, so a link to a point under the map still lands on that point.
 *
 * The map and panel share one height, the viewport below the header, so the
 * map is never cut off below the fold. Under `lg` they stack, and the map
 * takes a fixed share instead.
 */
export const MarketPremises = () => {
  const params = usePremisesParams();
  const openId = params.market ? Number(params.market) : null;

  // A deep link to an open market starts with that market selected.
  const [selectedId, setSelectedId] = useState<number | null>(openId);

  const { result, query } = useList<Market>({
    resource: "markets",
    // Every market at once: the map needs all of them, and there are a dozen.
    pagination: { pageSize: 200 },
    sorters: [{ field: "code", order: "asc" }],
  });
  const markets = result.data ?? [];
  const opened = markets.find((m) => m.id === openId) ?? null;
  const isOpen = opened !== null;

  // Selecting another market while one is open moves the board to it; a
  // board showing a market nobody has selected any more would be a stale
  // answer to a question that changed. The scope is cleared with it, because
  // point codes repeat between markets (every one has an A1-01-01).
  const select = (id: number | null) => {
    setSelectedId(id);
    if (openId === null || id === openId) return;
    params.update({ market: id === null ? null : String(id), ...BOARD_PARAMS });
  };

  const boardRef = useRef<HTMLElement>(null);
  const [scrollRequest, setScrollRequest] = useState(0);
  const open = (id: number) => {
    if (id !== openId) params.update({ market: String(id), ...BOARD_PARAMS });
    setScrollRequest((n) => n + 1);
  };
  const close = () => params.update({ market: null, ...BOARD_PARAMS });

  // After the render that mounted the board, not in the click: the section
  // does not exist yet when "Xem mặt bằng chợ" is pressed for the first time.
  useEffect(() => {
    if (!scrollRequest || !boardRef.current) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    boardRef.current.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
    // `isOpen`, not `opened`: switching the open market from the map must not
    // yank the page down to the board.
  }, [scrollRequest, isOpen]);

  return (
    <ListView>
      <ListViewHeader
        canCreate={false}
        description="Các chợ do đơn vị quản lý trên địa bàn phường Cao Lãnh, tỉnh Đồng Tháp. Chọn một chợ trên bản đồ hoặc trong danh sách để xem chi tiết."
      />
      <div className="grid gap-4 lg:h-[calc(100svh-13rem)] lg:min-h-[600px] lg:grid-cols-[minmax(0,1fr)_23rem]">
        <MarketMap
          markets={markets}
          selectedId={selectedId}
          onSelect={select}
          className="h-[60svh] min-h-[420px] lg:h-auto lg:min-h-0"
        />
        <MarketPanel
          markets={markets}
          isLoading={query.isLoading}
          selectedId={selectedId}
          onSelect={select}
          openId={openId}
          onOpen={open}
          className="max-lg:max-h-[80svh]"
        />
      </div>

      {opened && (
        <section
          ref={boardRef}
          aria-label={`Mặt bằng ${opened.name}`}
          // Clears the sticky 4rem app header when scrolled to.
          // At least a viewport tall, so scrolling to it can bring its top under
          // the header even for a small market at the bottom of the page.
          className="flex min-h-[calc(100svh-5rem)] scroll-mt-20 flex-col gap-4 border-t pt-6"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-sm">Mặt bằng chợ</p>
              <h2 className="truncate text-2xl leading-8 font-bold tracking-tight">
                {opened.name}
              </h2>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={close}>
              <X className="size-3.5" />
              Đóng
            </Button>
          </div>
          <MarketBoard
            key={opened.id}
            marketId={opened.id}
            market={opened}
            // Scrolled to, the section starts under the app header; the title
            // row and the facts strip take the rest, the workspace the remainder.
            workspaceClassName="xl:h-[calc(100svh-17rem)]"
          />
        </section>
      )}
    </ListView>
  );
};
