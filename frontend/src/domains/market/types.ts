/**
 * The `markets` resource: the markets whose premises this application manages.
 *
 * Served by the mock API only for now (`mock/data.ts`); the backend has no
 * `markets` endpoint yet, so this shape is the proposal the backend will be
 * written against rather than a mirror of an existing Java record.
 */
export type Market = {
  id: number;
  code: string;
  name: string;
  /**
   * The ward or commune (after the 2025 merger) the market is in, or null
   * where that is not known yet.
   */
  ward: string | null;
  address: string | null;
  /** Null, both of them, for a market whose position nobody has fixed yet. */
  latitude: number | null;
  longitude: number | null;
  /**
   * How far the position can be trusted.
   *
   * `surveyed` — taken from the market's own outline or point on
   * OpenStreetMap. `approximate` — placed from the name of the place it is in,
   * and needs confirming on site before anything is measured from it.
   * `unknown` — no position at all; the market is listed but not pinned.
   */
  locationPrecision: LocationPrecision;
  status: MarketStatus;
  createdAt: string;
  updatedAt: string | null;
};

export type LocationPrecision = "surveyed" | "approximate" | "unknown";

export type MarketStatus = "active" | "inactive";

export const LOCATION_PRECISION_LABELS: Record<LocationPrecision, string> = {
  surveyed: "Theo OpenStreetMap",
  approximate: "Ước tính — cần xác nhận",
  unknown: "Chưa có vị trí",
};

/** Whether the market can be pinned on the map. */
export function hasPosition(
  market: Market
): market is Market & { latitude: number; longitude: number } {
  return market.latitude !== null && market.longitude !== null;
}

export const STATUS_LABELS: Record<MarketStatus, string> = {
  active: "Đang hoạt động",
  inactive: "Ngừng hoạt động",
};

/** Lower-case, accent-free, so "cao lanh" finds "Chợ Cao Lãnh". */
export function searchKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}
