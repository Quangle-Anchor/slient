import {
  STALL_STATE_LABELS,
  daysUntil,
  type StallEntry,
} from "@/domains/market/premises";
import { Badge } from "@/shared/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { formatArea, formatDate, formatMoney } from "@/shared/lib/format";
import { STALL_STATE_VARIANTS } from "@/shared/lib/status-variants";
import { cn } from "@/shared/lib/utils";

/**
 * The same points as the plan, as rows — for the work the plan is bad at:
 * reading names, comparing amounts, and going down a list of who to call.
 *
 * Client-side over the layout already loaded rather than a `useTable` over an
 * endpoint: a market is a few hundred points, the plan needs all of them
 * anyway, and the two views must show exactly the same set with the same
 * filter applied. Filtered points are removed here rather than dimmed — a
 * table has no shape to preserve.
 */
export function PremisesTable({
  entries,
  selectedId,
  onSelect,
}: {
  entries: StallEntry[];
  selectedId: number | null;
  onSelect: (entry: StallEntry) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-10 text-center text-sm">
        Không có điểm kinh doanh nào khớp bộ lọc.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader className="bg-surface-subtle sticky top-0 z-10">
        <TableRow>
          <TableHead className="text-overline">Mã điểm</TableHead>
          <TableHead className="text-overline">Người thuê</TableHead>
          <TableHead className="text-overline">Ngành hàng</TableHead>
          <TableHead className="text-overline text-end">Diện tích</TableHead>
          <TableHead className="text-overline text-end">Phí / tháng</TableHead>
          <TableHead className="text-overline">Hợp đồng đến</TableHead>
          <TableHead className="text-overline text-end">Công nợ</TableHead>
          <TableHead className="text-overline">Tình trạng</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const { stall } = entry;
          const days = stall.contract
            ? daysUntil(stall.contract.endDate)
            : null;
          return (
            <TableRow
              key={stall.id}
              data-state={stall.id === selectedId ? "selected" : undefined}
              onClick={() => onSelect(entry)}
              className="cursor-pointer"
            >
              {/* The code already names the building, floor and row: B1-03-12. */}
              <TableCell
                className="font-mono text-xs tabular-nums"
                title={`Toà ${entry.building.code} · ${entry.floor.name} · ${entry.row.name}`}
              >
                {stall.code}
              </TableCell>
              <TableCell className="font-medium">
                {stall.tenant?.name ?? (
                  <span className="text-muted-foreground font-normal">—</span>
                )}
              </TableCell>
              <TableCell>
                {stall.tradeType ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {formatArea(stall.area)}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {formatMoney(stall.monthlyFee)}
              </TableCell>
              <TableCell
                className={cn(
                  "whitespace-nowrap tabular-nums",
                  entry.state === "expiring" && "text-warning-text"
                )}
              >
                {stall.contract ? formatDate(stall.contract.endDate) : "—"}
                {entry.state === "expiring" && days !== null && (
                  <span className="text-xs"> · còn {days} ngày</span>
                )}
              </TableCell>
              <TableCell
                className={cn(
                  "text-end tabular-nums",
                  stall.debt > 0 && "text-destructive-text font-medium"
                )}
              >
                {stall.debt > 0 ? formatMoney(stall.debt) : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={STALL_STATE_VARIANTS[entry.state]} size="sm">
                  {STALL_STATE_LABELS[entry.state]}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
