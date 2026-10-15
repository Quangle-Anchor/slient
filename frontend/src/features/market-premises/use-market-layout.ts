import { useCustom, type BaseKey } from "@refinedev/core";

import type { MarketLayout } from "@/domains/market/premises";
import { API_URL } from "@/shared/api/constants";
import { customResult } from "@/shared/hooks/use-custom-result";

/**
 * One market's buildings › floors › rows › points.
 *
 * Both the market panel beside the map (its counts) and the board under it
 * read this, and through the same query key, so opening the board for the
 * market whose counts are already showing costs no second request.
 */
export function useMarketLayout(marketId: BaseKey | null) {
  const { result, query } = useCustom<MarketLayout>({
    url: `${API_URL}/markets/${marketId}/layout`,
    method: "get",
    queryOptions: { enabled: marketId !== null },
  });
  // Not `result?.data` alone: see `customResult`.
  return { layout: customResult(result?.data, "buildings"), query };
}
