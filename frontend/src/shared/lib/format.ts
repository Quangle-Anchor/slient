/**
 * How a date is written, everywhere.
 *
 * There were two shapes on screen at once and both were right on their own:
 * `toLocaleDateString(…, { month: "short" })` gave "Aug 23, 2026" and a bare
 * `toLocaleString()` gave "8/31/2026, 4:00:24 PM". A detail card showing both,
 * two rows apart, makes the reader work out that they are the same kind of
 * value — and the seconds are noise on a record nobody is timing.
 *
 * Both formatters take the browser's locale rather than a fixed one, which is
 * the point of `undefined` here: the *shape* is the application's decision,
 * the *language* is the reader's.
 */

const DATE: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

const DATE_TIME: Intl.DateTimeFormatOptions = {
  ...DATE,
  hour: "2-digit",
  minute: "2-digit",
};

/** The em dash, not an empty cell — a blank reads as a rendering failure. */
export const EMPTY = "—";

export function formatDate(value?: string | null): string {
  if (!value) return EMPTY;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? EMPTY
    : date.toLocaleDateString(undefined, DATE);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return EMPTY;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? EMPTY
    : date.toLocaleString(undefined, DATE_TIME);
}

/**
 * Money is always đồng, so it is written the Vietnamese way whatever the
 * browser's locale — "1.200.000 ₫", never "₫1,200,000". The language of a date
 * is the reader's; the notation of a currency is the currency's.
 */
const MONEY = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function formatMoney(value?: number | null): string {
  return value === null || value === undefined ? EMPTY : MONEY.format(value);
}

/** "1,2 tr" — for totals in a strip, where seven digits do not fit. */
export function formatMoneyShort(value: number): string {
  if (Math.abs(value) < 1_000_000) return formatMoney(value);
  const millions = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value / 1_000_000);
  return `${millions} tr ₫`;
}

/** "8,5 m²" — written with the same Vietnamese notation as the money beside it. */
export function formatArea(value?: number | null): string {
  return value === null || value === undefined
    ? EMPTY
    : `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} m²`;
}
