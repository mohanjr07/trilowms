/**
 * TriloWMS — SKU Master Module
 * Full enterprise SKU management: KPIs, search, filters, CRUD table
 */

import { useState, useCallback } from "react";
import {
  Boxes, Plus, Search, SlidersHorizontal, Download,
  RefreshCw, Package, CheckCircle2, AlertTriangle, PauseCircle,
  BarChart3, X, Grid2X2, List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSkuStore, SKU_CATEGORIES, type SKU } from "@/lib/sku-store";
import { useAuthStore } from "@/lib/auth-store";
import { PageHeader, KPICard } from "@/components/wms/Primitives";
import { SkuTable } from "@/components/sku/SkuTable";
import { SkuFormModal } from "@/components/sku/SkuFormModal";
import { SkuDeleteModal } from "@/components/sku/SkuDeleteModal";
import { SkuFilterPanel } from "@/components/sku/SkuFilterPanel";

type ModalMode = "create" | "edit" | "view";

export function SkuMasterPage() {
  const { filters, setFilters, resetFilters, kpis, filteredSkus } = useSkuStore();
  const { session } = useAuthStore();

  const role = session?.user.role;
  const canWrite = role === "inventory_manager" || role === "super_admin" || role === "warehouse_admin";

  // Modal state
  const [modal, setModal] = useState<{ mode: ModalMode; sku: SKU | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SKU | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const stats = kpis();
  const totalFiltered = filteredSkus().length;

  const hasActiveFilters =
    filters.category || filters.status || filters.storageType ||
    filters.batchTracking || filters.serialTracking || filters.expiryTracking || filters.lowStock;

  const handleView = useCallback((sku: SKU) => setModal({ mode: "view", sku }), []);
  const handleEdit = useCallback((sku: SKU) => setModal({ mode: "edit", sku }), []);
  const handleDelete = useCallback((sku: SKU) => setDeleteTarget(sku), []);

  function exportCsv() {
    const skus = filteredSkus();
    const headers = ["SKU Code", "Barcode", "Item Name", "Category", "Subcategory", "UOM", "Status", "Storage Type", "On Hand", "Allocated", "Available", "Reorder Level"];
    const rows = skus.map((s) => [
      s.skuCode, s.barcode, s.itemName, s.category, s.subcategory, s.uom,
      s.status, s.storageType, s.onHand ?? 0, s.allocated ?? 0, s.available ?? 0, s.reorderLevel,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "sku-master.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Page header */}
      <PageHeader
        icon={Boxes}
        title="SKU Master"
        subtitle="Enterprise item catalog — manage SKU definitions, attributes, and configurations"
        actions={
          <>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="px-3 py-1.5 rounded border border-warning/40 bg-warning/10 text-warning text-xs flex items-center gap-1.5 hover:bg-warning/20 transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Clear Filters
              </button>
            )}
            <button
              onClick={() => setFilterOpen(true)}
              className={cn(
                "px-3 py-1.5 rounded border text-xs flex items-center gap-1.5 transition-colors",
                hasActiveFilters
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border hover:bg-secondary"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="bg-primary text-primary-foreground rounded-full text-[9px] h-4 w-4 flex items-center justify-center font-bold">
                  !
                </span>
              )}
            </button>
            <button
              onClick={exportCsv}
              className="px-3 py-1.5 rounded border border-border text-xs flex items-center gap-1.5 hover:bg-secondary transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            {canWrite && (
              <button
                onClick={() => setModal({ mode: "create", sku: null })}
                className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity glow-amber"
              >
                <Plus className="h-3.5 w-3.5" /> New SKU
              </button>
            )}
          </>
        }
      />

      {/* KPI row */}
      <div className="px-6 pt-4 pb-0 grid grid-cols-2 md:grid-cols-5 gap-3 flex-shrink-0">
        <KPICard
          label="TOTAL SKUS"
          value={stats.total.toLocaleString()}
          icon={Package}
          tone="primary"
        />
        <KPICard
          label="ACTIVE"
          value={stats.active.toLocaleString()}
          icon={CheckCircle2}
          tone="success"
          delta={`${Math.round((stats.active / stats.total) * 100)}% of catalog`}
        />
        <KPICard
          label="ON HOLD"
          value={stats.onHold.toLocaleString()}
          icon={PauseCircle}
          tone="warning"
        />
        <KPICard
          label="LOW STOCK"
          value={stats.lowStock.toLocaleString()}
          icon={AlertTriangle}
          tone={stats.lowStock > 10 ? "destructive" : "warning"}
          sub="Below reorder level"
        />
        <KPICard
          label="TOTAL ON HAND"
          value={stats.totalOnHand > 1_000_000
            ? `${(stats.totalOnHand / 1_000_000).toFixed(1)}M`
            : stats.totalOnHand > 1000
              ? `${(stats.totalOnHand / 1000).toFixed(1)}K`
              : stats.totalOnHand.toString()}
          icon={BarChart3}
          tone="info"
        />
      </div>

      {/* Toolbar: search + category quick-filters */}
      <div className="px-6 py-3 flex items-center gap-3 flex-shrink-0 border-b border-border/60">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder="Search SKU code, name, barcode, category..."
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-input border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/60 text-mono"
          />
          {filters.search && (
            <button
              onClick={() => setFilters({ search: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Quick category filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto flex-1">
          <QuickChip
            label="All"
            active={!filters.category}
            onClick={() => setFilters({ category: "" })}
          />
          {Object.keys(SKU_CATEGORIES).map((c) => (
            <QuickChip
              key={c}
              label={c}
              active={filters.category === c}
              onClick={() => setFilters({ category: c === filters.category ? "" : c })}
            />
          ))}
        </div>

        {/* Result count */}
        <div className="text-xs text-muted-foreground flex-shrink-0 text-mono">
          <span className="text-primary font-bold">{totalFiltered}</span> items
        </div>
      </div>

      {/* Table area */}
      <div className="flex-1 min-h-0 px-6 pb-6 pt-4">
        <div
          className="h-full rounded-md border border-border overflow-hidden flex flex-col"
          style={{ background: "var(--panel)" }}
        >
          <div className="px-4 py-2.5 border-b border-border/60 flex items-center justify-between flex-shrink-0">
            <h3 className="text-xs font-bold tracking-wider text-muted-foreground">SKU MASTER CATALOG</h3>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {!canWrite && (
                <span className="px-2 py-0.5 rounded border border-border bg-secondary text-[10px] tracking-wider">
                  READ-ONLY
                </span>
              )}
              <RefreshCw className="h-3 w-3" />
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <SkuTable
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              readOnly={!canWrite}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal && (
        <SkuFormModal
          open
          mode={modal.mode}
          sku={modal.sku}
          onClose={() => setModal(null)}
        />
      )}
      <SkuDeleteModal
        open={!!deleteTarget}
        sku={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
      <SkuFilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
      />

      {/* CSS for row animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function QuickChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded text-[11px] font-bold tracking-wide whitespace-nowrap transition-all border flex-shrink-0",
        active
          ? "bg-primary/15 border-primary/40 text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border hover:bg-secondary"
      )}
    >
      {label}
    </button>
  );
}
