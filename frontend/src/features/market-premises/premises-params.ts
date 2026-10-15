import { useCallback } from "react";
import { useSearchParams } from "react-router";

import { STALL_STATES, type StallState } from "@/domains/market/premises";

export type PremisesView = "plan" | "table";

/**
 * What the market screen is looking at, kept in the URL:
 * `/markets?market=1&building=A&floor=2&point=A2-03-07&state=overdue&view=table`.
 *
 * Codes rather than ids, because the URL is something people paste into a
 * chat — "A2-03-07" is a point anybody at the market can walk to. Every change
 * replaces the history entry instead of pushing one: clicking through forty
 * points should not take forty presses of Back to leave the screen.
 */
export function usePremisesParams() {
  const [params, setParams] = useSearchParams();

  const update = useCallback(
    (patch: Record<string, string | null>) =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === "") next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true }
      ),
    [setParams]
  );

  const state = params.get("state");

  return {
    /** The market whose premises are open under the map. */
    market: params.get("market"),
    building: params.get("building"),
    floor: params.get("floor"),
    point: params.get("point"),
    state: STALL_STATES.includes(state as StallState)
      ? (state as StallState)
      : null,
    view: (params.get("view") === "table" ? "table" : "plan") as PremisesView,
    update,
  };
}
