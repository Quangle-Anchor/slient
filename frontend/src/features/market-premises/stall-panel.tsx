import type { ReactNode } from "react";
import { PanelRightClose, PanelRightOpen, Phone, Store, X } from "lucide-react";

import {
  STALL_STATES,
  STALL_STATE_LABELS,
  daysUntil,
  type PremisesSummary,
  type StallEntry,
  type StallState,
} from "@/domains/market/premises";
import {
  DetailList,
  DetailRow,
  EmptyValue,
} from "@/shared/components/views/record-detail";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { formatArea, formatDate, formatMoney } from "@/shared/lib/format";
import { STALL_STATE_VARIANTS } from "@/shared/lib/status-variants";
import { cn } from "@/shared/lib/utils";

import { STALL_SWATCH } from "./stall-state-style";

/**
 * The right-hand side: one point when one is chosen, otherwise what the
 * current scope adds up to. The counts double as the state filter.
 *
 * The whole panel folds away into a rail from the button in its header, which
 * hands its width to the plan. The page owns that state (the grid column is
 * the page's), so this only draws the two shapes and reports the toggle.
 */
export function StallPanel({
  scopeLabel,
  summary,
  selected,
  activeState,
  onState,
  onSelect,
  collapsed,
  onCollapsedChange,
  className,
}: {
  scopeLabel: string;
  summary: PremisesSummary;
  selected: StallEntry | null;
  activeState: StallState | null;
  onState: (state: StallState | null) => void;
  onSelect: (entry: StallEntry | null) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  className?: string;
}) {
  const collapse = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8"
      aria-label="Thu gọn"
      title="Thu gọn"
      onClick={() => onCollapsedChange(true)}
    >
      <PanelRightClose className="size-4" />
    </Button>
  );

  return (
    <aside
      aria-label={
        selected ? `Điểm kinh doanh ${selected.stall.code}` : "Tổng hợp"
      }
      className={cn(
        // No card of its own: it is the right-hand part of the one workspace
        // surface the page draws, hairlined from the plan beside it.
        "flex min-h-0 flex-col overflow-hidden",
        className
      )}
    >
      {collapsed ? (
        <CollapsedRail
          label={selected ? selected.stall.code : scopeLabel}
          onExpand={() => onCollapsedChange(false)}
        />
      ) : selected ? (
        <StallDetail
          entry={selected}
          action={collapse}
          onClose={() => onSelect(null)}
        />
      ) : (
        <ScopeSummary
          scopeLabel={scopeLabel}
          summary={summary}
          activeState={activeState}
          onState={onState}
          action={collapse}
        />
      )}
    </aside>
  );
}

/**
 * The folded panel: the same 4rem band, holding only the way back, and the
 * scope written sideways down the rail so it is clear what was folded.
 */
function CollapsedRail({
  label,
  onExpand,
}: {
  label: string;
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Mở rộng tổng hợp"
      title="Mở rộng"
      className={cn(
        "group flex min-h-0 flex-1 flex-col items-center text-start transition-colors",
        "hover:bg-accent focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
        "max-lg:flex-row max-lg:gap-3 max-lg:px-4"
      )}
    >
      <span className="bg-surface-subtle flex h-16 w-full shrink-0 items-center justify-center border-b max-lg:w-auto max-lg:border-0 max-lg:bg-transparent">
        <PanelRightOpen className="text-muted-foreground group-hover:text-foreground size-4" />
      </span>
      <span className="text-muted-foreground truncate py-4 text-sm font-medium lg:[writing-mode:vertical-rl]">
        Tổng hợp · {label}
      </span>
    </button>
  );
}

function StallDetail({
  entry,
  action,
  onClose,
}: {
  entry: StallEntry;
  action: ReactNode;
  onClose: () => void;
}) {
  const { stall, building, floor, row, state } = entry;
  const days = stall.contract ? daysUntil(stall.contract.endDate) : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
      <div className="bg-surface-subtle sticky top-0 z-10 flex h-16 items-center gap-2 border-b px-4">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs">Điểm kinh doanh</p>
          <h2 className="font-mono text-base leading-6 font-semibold tabular-nums">
            {stall.code}
          </h2>
        </div>
        <Badge variant={STALL_STATE_VARIANTS[state]} size="sm" dot>
          {STALL_STATE_LABELS[state]}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Bỏ chọn"
          title="Bỏ chọn"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
        <div className="-me-2">{action}</div>
      </div>

      <DetailList>
        <DetailRow label="Vị trí">
          Toà {building.code} › {floor.name} › {row.name}
        </DetailRow>
        <DetailRow label="Diện tích">{formatArea(stall.area)}</DetailRow>
        <DetailRow label="Ngành hàng">
          {stall.tradeType ?? <EmptyValue />}
        </DetailRow>
        <DetailRow label="Phí thuê / tháng">
          <span className="tabular-nums">{formatMoney(stall.monthlyFee)}</span>
        </DetailRow>
        <DetailRow label="Công nợ">
          {stall.debt > 0 ? (
            <span className="text-destructive-text font-medium tabular-nums">
              {formatMoney(stall.debt)}
              <span className="text-muted-foreground font-normal">
                {" "}
                · {Math.round(stall.debt / stall.monthlyFee)} tháng
              </span>
            </span>
          ) : (
            <EmptyValue>Không nợ</EmptyValue>
          )}
        </DetailRow>
        {stall.note && <DetailRow label="Ghi chú">{stall.note}</DetailRow>}
      </DetailList>

      <h3 className="text-overline text-muted-foreground bg-surface-subtle border-y px-4 py-2.5">
        Người thuê
      </h3>
      {stall.tenant && stall.contract ? (
        <DetailList>
          <DetailRow label="Họ tên">
            <span className="font-medium">{stall.tenant.name}</span>
          </DetailRow>
          <DetailRow label="Điện thoại">
            <a
              href={`tel:${stall.tenant.phone}`}
              className="text-primary inline-flex items-center gap-1.5 tabular-nums hover:underline"
            >
              <Phone className="size-3.5" />
              {stall.tenant.phone}
            </a>
          </DetailRow>
          <DetailRow label="Hợp đồng">
            <span className="font-mono text-xs">{stall.contract.number}</span>
          </DetailRow>
          <DetailRow label="Thời hạn">
            <span className="tabular-nums">
              {formatDate(stall.contract.startDate)} đến{" "}
              {formatDate(stall.contract.endDate)}
            </span>
            {days !== null && (
              <span
                className={cn(
                  "block text-xs",
                  state === "expiring"
                    ? "text-warning-text"
                    : "text-muted-foreground"
                )}
              >
                {days >= 0 ? `Còn ${days} ngày` : `Đã hết hạn ${-days} ngày`}
              </span>
            )}
          </DetailRow>
        </DetailList>
      ) : (
        <div className="text-muted-foreground flex items-start gap-3 px-4 py-4 text-sm">
          <Store className="mt-0.5 size-4 shrink-0" />
          <p>
            {stall.status === "suspended"
              ? "Điểm này đang tạm ngưng cho thuê."
              : "Điểm này đang trống, chưa có người thuê."}
          </p>
        </div>
      )}
    </div>
  );
}

function ScopeSummary({
  scopeLabel,
  summary,
  activeState,
  onState,
  action,
}: {
  scopeLabel: string;
  summary: PremisesSummary;
  activeState: StallState | null;
  onState: (state: StallState | null) => void;
  action: ReactNode;
}) {
  const percent = Math.round(summary.occupancy * 100);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="bg-surface-subtle sticky top-0 z-10 flex h-16 items-center gap-2 border-b px-4">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs">Tổng hợp</p>
          <h2 className="truncate text-base leading-6 font-semibold">
            {scopeLabel}
          </h2>
        </div>
        <div className="-me-2">{action}</div>
      </div>

      <div className="space-y-2 border-b px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground text-sm">Tỷ lệ lấp đầy</span>
          <span className="text-2xl font-semibold tabular-nums">
            {percent}%
          </span>
        </div>
        <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
          <div
            className="bg-success h-full rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          {summary.occupied} trên {summary.occupied + summary.counts.vacant}{" "}
          điểm có thể cho thuê
          {summary.counts.suspended > 0 &&
            ` · ${summary.counts.suspended} tạm ngưng`}
        </p>
      </div>

      {/* Doubles as the filter: the counts are what somebody wants to narrow by. */}
      <ul className="border-b p-1.5">
        {STALL_STATES.map((state) => {
          const active = activeState === state;
          return (
            <li key={state}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onState(active ? null : state)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-start text-sm transition-colors",
                  "hover:bg-accent focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  active && "bg-accent font-semibold"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-3.5 rounded-[3px] border",
                    STALL_SWATCH[state]
                  )}
                />
                <span className="flex-1">{STALL_STATE_LABELS[state]}</span>
                <span className="tabular-nums">{summary.counts[state]}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <DetailList className="border-b">
        <DetailRow label="Phí thuê / tháng">
          <span className="tabular-nums">
            {formatMoney(summary.monthlyFees)}
          </span>
        </DetailRow>
        <DetailRow label="Công nợ">
          {summary.debt > 0 ? (
            <span className="text-destructive-text font-medium tabular-nums">
              {formatMoney(summary.debt)}
            </span>
          ) : (
            <EmptyValue>Không có</EmptyValue>
          )}
        </DetailRow>
      </DetailList>
    </div>
  );
}
