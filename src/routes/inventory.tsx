import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SkuMasterPage } from "@/components/sku/SkuMasterPage";
import { InventoryBinMapPage } from "@/components/inventory/InventoryBinMapPage";
import { TransactionsPage } from "@/components/inventory/TransactionsPage";
import { StockLevelsPage } from "@/components/inventory/StockLevelsPage";
import { Boxes, Map, ArrowLeftRight, Gauge } from "lucide-react";
import { useInvBinStore } from "@/lib/inventory-bin-store";
import { useSkuStore } from "@/lib/sku-store";
import { ensureSeeded } from "@/lib/transaction-store";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — TriloWMS" },
      { name: "description", content: "SKU Master, Live Bin Mapping & Transactions" },
    ],
  }),
  // Deep-link params used by the notification bell, e.g.
  // /inventory?tab=sku&filter=lowStock
  validateSearch: (search: Record<string, unknown>): InventorySearch => ({
    tab: ["sku", "stock", "binmap", "transactions"].includes(search.tab as string) ? (search.tab as Tab) : undefined,
    filter: ["lowStock", "onHold", "criticalBins"].includes(search.filter as string)
      ? (search.filter as InventorySearch["filter"])
      : undefined,
  }),
  component: InventoryPage,
});

type Tab = "sku" | "stock" | "binmap" | "transactions";
export interface InventorySearch {
  tab?: Tab;
  filter?: "lowStock" | "onHold" | "criticalBins";
}

const TABS: { id: Tab; label: string; icon: typeof Boxes; badge?: string }[] = [
  { id: "sku",          label: "SKU Master",   icon: Boxes },
  { id: "stock",        label: "Stock Levels",  icon: Gauge,           badge: "Live" },
  { id: "binmap",       label: "Bin Map",       icon: Map,             badge: "Live" },
  { id: "transactions", label: "Transactions",  icon: ArrowLeftRight,  badge: "New" },
];

function InventoryPage() {
  const search = Route.useSearch();
  const [tab, setTab] = useState<Tab>(search.tab ?? "sku");
  const activeWarehouseName = useInvBinStore((s) => s.activeWarehouseName);

  // Apply the tab + filter requested by a notification link. Runs again when
  // the link is clicked while already on this page (search params change).
  useEffect(() => {
    if (search.tab) setTab(search.tab);
    if (search.filter === "lowStock" || search.filter === "onHold") {
      const sku = useSkuStore.getState();
      sku.resetFilters();
      sku.setFilters(search.filter === "lowStock" ? { lowStock: true } : { status: "Hold" });
    } else if (search.filter === "criticalBins") {
      const bins = useInvBinStore.getState();
      bins.resetFilters();
      bins.setFilters({ criticalOnly: true });
    }
  }, [search.tab, search.filter]);

  // Ensure transaction seed data exists for this warehouse
  useEffect(() => {
    if (activeWarehouseName) {
      ensureSeeded(activeWarehouseName);
    }
  }, [activeWarehouseName]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border bg-sidebar shrink-0 px-2">
        {TABS.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {badge && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-primary/10 text-primary rounded uppercase tracking-wider">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === "sku"          && <SkuMasterPage />}
        {tab === "stock"        && <StockLevelsPage />}
        {tab === "binmap"       && <InventoryBinMapPage />}
        {tab === "transactions" && <TransactionsPage />}
      </div>
    </div>
  );
}
