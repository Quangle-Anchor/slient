import { useEffect, useRef, useState } from "react";

import { hasPosition, type Market } from "@/domains/market/types";
import { useTheme } from "@/shared/components/theme/theme-provider";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";

/**
 * The ward map with the markets pinned on it.
 *
 * The map is a self-contained page (`public/maps/cao-lanh.html`: inline SVG
 * geometry, its own script and styles) embedded with an iframe rather than
 * ported into React. Its global selectors (`:root`, `body`, `.item`, `.list`…)
 * would collide with the shell's, and its script looks elements up by id at
 * load; an iframe keeps both exactly as they were written.
 *
 * `?embed` tells it to drop its own ward panel — this screen draws the panel —
 * and the two talk over `postMessage`: this side hands in the markets and the
 * selection, the map answers with the market somebody clicked. The protocol is
 * documented beside the listener at the bottom of the map's script.
 */

const MAP_URL = `${import.meta.env.BASE_URL}maps/cao-lanh.html?embed`;

const HOST_SOURCE = "market-premises";
const MAP_SOURCE = "cao-lanh-map";

type MapMessage =
  | { source: typeof MAP_SOURCE; type: "ready" }
  | { source: typeof MAP_SOURCE; type: "select"; id: number | null };

export function MarketMap({
  markets,
  selectedId,
  onSelect,
  className,
}: {
  markets: Market[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  className?: string;
}) {
  const { resolvedMode } = useTheme();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  // A selection the map reported is already drawn there; sending it back would
  // only make the map fly to a pin the user just clicked.
  const fromMap = useRef<number | null | undefined>(undefined);

  // Kept in a ref so the listener below is attached once, not per render.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      const message = event.data as MapMessage | undefined;
      if (message?.source !== MAP_SOURCE) return;
      if (message.type === "ready") setReady(true);
      if (message.type === "select") {
        fromMap.current = message.id;
        onSelectRef.current(message.id);
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  useEffect(() => {
    if (!ready) return;
    post(frameRef.current, {
      type: "markets",
      // Only what can be pinned. The numbering is the panel's, so a market with
      // no position leaves a gap rather than renumbering the ones after it.
      markets: markets.flatMap((m, index) =>
        hasPosition(m)
          ? [
              {
                id: m.id,
                n: index + 1,
                name: m.name,
                lon: m.longitude,
                lat: m.latitude,
              },
            ]
          : []
      ),
    });
  }, [ready, markets]);

  useEffect(() => {
    if (!ready) return;
    if (fromMap.current === selectedId) {
      fromMap.current = undefined;
      return;
    }
    post(frameRef.current, { type: "select", id: selectedId });
  }, [ready, selectedId, markets]);

  // The map has its own light and dark palettes, keyed off `data-theme` on its
  // root. Same origin, so the shell's resolved mode can be handed straight in —
  // otherwise it would follow the OS while the shell follows the user's choice.
  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (ready && doc) doc.documentElement.dataset.theme = resolvedMode;
  }, [ready, resolvedMode]);

  return (
    <div
      className={cn(
        "bg-card shadow-e1 relative overflow-hidden rounded-lg border",
        className
      )}
    >
      {!ready && <Skeleton className="absolute inset-3 rounded-md" />}
      <iframe
        ref={frameRef}
        src={MAP_URL}
        title="Bản đồ các chợ trên địa bàn phường Cao Lãnh"
        // Matching the shell's scheme keeps the browser from painting an
        // opaque backdrop behind the map's transparent body.
        style={{ colorScheme: resolvedMode }}
        // Absolute rather than h-full: the panel's height comes from the grid
        // row, which a percentage cannot resolve against, and an iframe that
        // cannot resolve its height falls back to 150px.
        className="absolute inset-0 block size-full border-0"
      />
    </div>
  );
}

function post(
  frame: HTMLIFrameElement | null,
  message: Record<string, unknown>
) {
  frame?.contentWindow?.postMessage(
    { source: HOST_SOURCE, ...message },
    window.location.origin
  );
}
