import { X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSkuStore, SKU_CATEGORIES, DEFAULT_FILTERS } from "@/lib/sku-store";

const STATUS_OPTIONS = ["Active", "Inactive", "Hold", "Discontinued", "Pending"];
const STORAGE_OPTIONS = ["Ambient", "Cold", "Frozen", "Hazmat", "Secure", "Bulk"];

export function SkuFilterPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { filters, setFilters, resetFilters, filteredSkus } = useSkuStore();
  const count = filteredSkus().length;

  const hasActive =
    filters.category || filters.status || filters.storageType ||
    filters.batchTracking || filters.serialTracking || filters.expiryTracking || filters.lowStock;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30"
          style={{ background: "rgba(0,0,0,0.3)" }}
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-72 z-40 border-l border-border flex flex-col transition-transform duration-200",
        )}
        style={{
          background: "var(--panel)",
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold tracking-tight">Filters</span>
            {hasActive && (
              <span className="text-[10px] bg-primary/15 border border-primary/30 text-primary px-1.5 py-0.5 rounded font-bold">
                ACTIVE
              </span>
            )}
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filters body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Category */}
          <FilterSection label="Category">
            <div className="space-y-1">
              <FilterChip
                label="All Categories"
                active={!filters.category}
                onClick={() => setFilters({ category: "" })}
              />
              {Object.keys(SKU_CATEGORIES).map((c) => (
                <FilterChip
                  key={c} label={c}
                  active={filters.category === c}
                  onClick={() => setFilters({ category: c === filters.category ? "" : c })}
                />
              ))}
            </div>
          </FilterSection>

          {/* Status */}
          <FilterSection label="Status">
            <div className="space-y-1">
              <FilterChip label="All" active={!filters.status} onClick={() => setFilters({ status: "" })} />
              {STATUS_OPTIONS.map((s) => (
                <FilterChip
                  key={s} label={s}
                  active={filters.status === s}
                  onClick={() => setFilters({ status: s === filters.status ? "" : s })}
                  color={statusColor(s)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Storage type */}
          <FilterSection label="Storage Type">
            <div className="space-y-1">
              <FilterChip label="All" active={!filters.storageType} onClick={() => setFilters({ storageType: "" })} />
              {STORAGE_OPTIONS.map((s) => (
                <FilterChip
                  key={s} label={s}
                  active={filters.storageType === s}
                  onClick={() => setFilters({ storageType: s === filters.storageType ? "" : s })}
                />
              ))}
            </div>
          </FilterSection>

          {/* Tracking */}
          <FilterSection label="Tracking">
            <div className="space-y-1">
              {[
                { key: "batchTracking" as const, label: "Batch Tracking" },
                { key: "serialTracking" as const, label: "Serial Tracking" },
                { key: "expiryTracking" as const, label: "Expiry Tracking" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <select
                    className="text-xs bg-input border border-border rounded px-2 py-0.5 text-mono"
                    value={filters[key]}
                    onChange={(e) => setFilters({ [key]: e.target.value as "" | "true" | "false" })}
                  >
                    <option value="">Any</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              ))}
            </div>
          </FilterSection>

          {/* Low stock */}
          <FilterSection label="Stock Alerts">
            <button
              onClick={() => setFilters({ lowStock: !filters.lowStock })}
              className={cn(
                "w-full text-left px-3 py-2 rounded border text-xs transition-colors",
                filters.lowStock
                  ? "bg-warning/10 border-warning/40 text-warning"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              ⚠ Below Reorder Level
            </button>
          </FilterSection>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-2">
          <div className="text-xs text-center text-muted-foreground">
            Showing <span className="text-primary font-bold text-mono">{count}</span> SKUs
          </div>
          <button
            onClick={() => { resetFilters(); onClose(); }}
            disabled={!hasActive}
            className="w-full py-2 rounded border border-border text-xs font-bold tracking-wider disabled:opacity-40 hover:bg-secondary transition-colors"
          >
            CLEAR ALL FILTERS
          </button>
        </div>
      </div>
    </>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">{label.toUpperCase()}</div>
      {children}
    </div>
  );
}

function FilterChip({ label, active, onClick, color }: {
  label: string; active: boolean; onClick: () => void; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors",
        active
          ? "bg-primary/15 border border-primary/40 text-primary font-bold"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
      )}
      style={active && color ? { background: color + "15", borderColor: color + "40", color } : undefined}
    >
      {label}
    </button>
  );
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    Active: "var(--success)",
    Hold: "var(--warning)",
    Inactive: "var(--muted-foreground)",
    Discontinued: "var(--destructive)",
    Pending: "var(--info)",
  };
  return map[s];
}
