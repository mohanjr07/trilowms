import { useState } from "react";
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  Eye, Edit2, Trash2, Copy, MoreHorizontal,
  Package, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type SKU, useSkuStore } from "@/lib/sku-store";
import { useStockStore } from "@/lib/stock-store";
import { StatusBadge } from "@/components/wms/Primitives";

interface Props {
  onView: (sku: SKU) => void;
  onEdit: (sku: SKU) => void;
  onDelete: (sku: SKU) => void;
  readOnly?: boolean;
}

const STORAGE_COLORS: Record<string, string> = {
  Ambient: "text-foreground",
  Cold: "text-info",
  Frozen: "text-accent",
  Hazmat: "text-destructive",
  Secure: "text-warning",
  Bulk: "text-muted-foreground",
};

const STATUS_MAP: Record<string, string> = {
  Active: "Active",
  Inactive: "Inactive",
  Hold: "Hold",
  Discontinued: "Failed",
  Pending: "Pending",
};

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc"
    ? <ChevronUp className="h-3 w-3 text-primary" />
    : <ChevronDown className="h-3 w-3 text-primary" />;
}

function RowMenu({
  sku, onView, onEdit, onDelete, readOnly,
}: {
  sku: SKU; onView: () => void; onEdit: () => void; onDelete: () => void; readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="h-6 w-6 rounded flex items-center justify-center hover:bg-secondary transition-colors"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-7 z-20 w-40 rounded border border-border shadow-xl overflow-hidden"
            style={{ background: "var(--popover)" }}
          >
            <MenuItem icon={Eye} label="View Details" onClick={() => { setOpen(false); onView(); }} />
            {!readOnly && (
              <>
                <MenuItem icon={Edit2} label="Edit SKU" onClick={() => { setOpen(false); onEdit(); }} />
                <MenuItem icon={Copy} label="Duplicate" onClick={() => { setOpen(false); }} />
                <div className="border-t border-border/60" />
                <MenuItem icon={Trash2} label="Delete" onClick={() => { setOpen(false); onDelete(); }} danger />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon, label, onClick, danger,
}: {
  icon: typeof Eye; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary/70 transition-colors",
        danger ? "text-destructive" : "text-foreground"
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

export function SkuTable({ onView, onEdit, onDelete, readOnly }: Props) {
  const { pagedSkus, filteredSkus, sortKey, sortDir, setSort, page, pageSize, totalPages, setPage, setPageSize } = useSkuStore();
  // Live stock ledger — same source of truth as Stock Levels / Putaway / Picking,
  // instead of the static seed numbers on the SKU record.
  const stockBySkuCode = useStockStore((s) => s.stock);
  const availableFor = (skuCode: string) => {
    const rec = stockBySkuCode[skuCode];
    return rec ? Math.max(0, rec.onHand - rec.reserved) : 0;
  };

  let rows = pagedSkus();
  // "Available" now renders the live ledger value rather than the SKU's static
  // seed field, so when sorted by that column, re-sort the visible page by the
  // same live numbers to keep order and displayed value in sync.
  if (sortKey === "available") {
    rows = [...rows].sort((a, b) =>
      sortDir === "asc" ? availableFor(a.skuCode) - availableFor(b.skuCode) : availableFor(b.skuCode) - availableFor(a.skuCode)
    );
  }
  const total = filteredSkus().length;
  const pages = totalPages();

  type ColDef = {
    key: keyof SKU | "actions";
    label: string;
    sortable?: boolean;
    w?: string;
    render?: (row: SKU) => React.ReactNode;
  };

  const COLS: ColDef[] = [
    {
      key: "skuCode", label: "SKU CODE", sortable: true, w: "120px",
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Package className="h-3 w-3 text-primary" />
          </div>
          <span className="text-primary font-bold text-mono">{r.skuCode}</span>
        </div>
      ),
    },
    {
      key: "itemName", label: "ITEM NAME", sortable: true,
      render: (r) => (
        <div>
          <div className="font-medium truncate max-w-[200px]">{r.itemName}</div>
          <div className="text-[10px] text-muted-foreground text-mono truncate max-w-[200px]">{r.barcode}</div>
        </div>
      ),
    },
    {
      key: "category", label: "CATEGORY", sortable: true,
      render: (r) => (
        <div>
          <div className="text-xs">{r.category}</div>
          <div className="text-[10px] text-muted-foreground">{r.subcategory}</div>
        </div>
      ),
    },
    {
      key: "uom", label: "UOM", w: "60px",
      render: (r) => <span className="text-mono text-xs bg-secondary px-1.5 py-0.5 rounded">{r.uom}</span>,
    },
    {
      key: "storageType", label: "STORAGE", sortable: true, w: "90px",
      render: (r) => (
        <span className={cn("text-xs font-bold text-mono", STORAGE_COLORS[r.storageType])}>
          {r.storageType.toUpperCase()}
        </span>
      ),
    },
    {
      key: "available", label: "AVAIL.", sortable: true, w: "80px",
      render: (r) => {
        const avail = availableFor(r.skuCode);
        const low = avail < (r.reorderLevel ?? 100);
        return (
          <div className="flex items-center gap-1">
            {low && <AlertTriangle className="h-3 w-3 text-warning flex-shrink-0" />}
            <span className={cn("text-mono font-bold text-xs", low ? "text-warning" : "text-success")}>
              {avail.toLocaleString()}
            </span>
          </div>
        );
      },
    },
    {
      key: "reorderLevel", label: "REORDER", sortable: true, w: "80px",
      render: (r) => <span className="text-mono text-xs">{r.reorderLevel.toLocaleString()}</span>,
    },
    {
      key: "batchTracking", label: "TRACK", w: "90px",
      render: (r) => (
        <div className="flex gap-1">
          {r.batchTracking && <TrackBadge label="B" title="Batch" />}
          {r.serialTracking && <TrackBadge label="S" title="Serial" color="info" />}
          {r.expiryTracking && <TrackBadge label="E" title="Expiry" color="warning" />}
        </div>
      ),
    },
    {
      key: "status", label: "STATUS", sortable: true, w: "90px",
      render: (r) => <StatusBadge status={STATUS_MAP[r.status] ?? r.status} />,
    },
    {
      key: "actions", label: "", w: "40px",
      render: (r) => (
        <RowMenu
          sku={r}
          onView={() => onView(r)}
          onEdit={() => onEdit(r)}
          onDelete={() => onDelete(r)}
          readOnly={readOnly}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10" style={{ background: "var(--background)" }}>
            <tr className="text-left text-[10px] font-bold tracking-wider text-muted-foreground border-b border-border">
              {COLS.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    "px-4 py-2.5 whitespace-nowrap",
                    col.sortable && "cursor-pointer hover:text-foreground select-none"
                  )}
                  style={{ width: col.w }}
                  onClick={() => col.sortable && setSort(col.key as keyof SKU)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="px-4 py-16 text-center text-muted-foreground text-sm">
                  <div className="flex flex-col items-center gap-3">
                    <Package className="h-10 w-10 opacity-20" />
                    <div>No SKUs match your filters</div>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.id}
                  className="border-b border-border/40 hover:bg-secondary/30 transition-colors cursor-pointer group"
                  style={{
                    animationDelay: `${i * 20}ms`,
                    animation: "fadeIn 0.2s ease both",
                  }}
                  onClick={() => onView(row)}
                >
                  {COLS.map((col) => (
                    <td
                      key={String(col.key)}
                      className="px-4 py-2.5"
                      onClick={col.key === "actions" ? (e) => e.stopPropagation() : undefined}
                    >
                      {col.render
                        ? col.render(row)
                        : <span className="text-mono">{String((row as any)[col.key] ?? "—")}</span>}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/60 bg-background/40 flex-shrink-0">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="text-mono">
            {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <select
            className="bg-input border border-border rounded px-2 py-0.5 text-mono text-xs"
            value={pageSize}
            onChange={(e) => setPageSize(+e.target.value)}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <PageBtn onClick={() => setPage(1)} disabled={page <= 1} label="«" />
          <PageBtn onClick={() => setPage(page - 1)} disabled={page <= 1} label="‹" />
          {Array.from({ length: Math.min(5, pages) }, (_, i) => {
            const half = Math.floor(5 / 2);
            let start = Math.max(1, page - half);
            const end = Math.min(pages, start + 4);
            start = Math.max(1, end - 4);
            return start + i;
          }).filter((n) => n >= 1 && n <= pages).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={cn(
                "h-6 w-6 rounded text-[10px] font-bold text-mono transition-colors",
                n === page
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary text-muted-foreground"
              )}
            >
              {n}
            </button>
          ))}
          <PageBtn onClick={() => setPage(page + 1)} disabled={page >= pages} label="›" />
          <PageBtn onClick={() => setPage(pages)} disabled={page >= pages} label="»" />
        </div>
      </div>
    </div>
  );
}

function TrackBadge({ label, title, color = "success" }: { label: string; title: string; color?: string }) {
  const cls: Record<string, string> = {
    success: "bg-success/15 border-success/40 text-success",
    info: "bg-info/15 border-info/40 text-info",
    warning: "bg-warning/15 border-warning/40 text-warning",
  };
  return (
    <span title={title} className={cn("text-[9px] font-bold px-1 py-0.5 rounded border", cls[color] ?? cls.success)}>
      {label}
    </span>
  );
}

function PageBtn({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-6 px-1.5 rounded text-[11px] font-mono hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
    >
      {label}
    </button>
  );
}
