import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SkuMasterPage } from "@/components/sku/SkuMasterPage";
import { InventoryBinMapPage } from "@/components/inventory/InventoryBinMapPage";
import { TransactionsPage } from "@/components/inventory/TransactionsPage";
import { StockLevelsPage } from "@/components/inventory/StockLevelsPage";
import { Boxes, Map, ArrowLeftRight, Gauge, Tags } from "lucide-react";
import { LabelPrintDialog } from "@/components/inventory/LabelPrintDialog";
import { useInvBinStore } from "@/lib/inventory-bin-store";
import { ensureSeeded } from "@/lib/transaction-store";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — TriloWMS" },
      { name: "description", content: "SKU Master, Live Bin Mapping & Transactions" },
    ],
  }),
  component: InventoryPage,
});

type Tab = "sku" | "stock" | "binmap" | "transactions";

const TABS: { id: Tab; label: string; icon: typeof Boxes; badge?: string }[] = [
  { id: "sku",          label: "SKU Master",   icon: Boxes },
  { id: "stock",        label: "Stock Levels",  icon: Gauge,           badge: "Live" },
  { id: "binmap",       label: "Bin Map",       icon: Map,             badge: "Live" },
  { id: "transactions", label: "Transactions",  icon: ArrowLeftRight,  badge: "New" },
];

function InventoryPage() {
  const [tab, setTab] = useState<Tab>("sku");
  const [labelsOpen, setLabelsOpen] = useState(false);
  const activeWarehouseName = useInvBinStore((s) => s.activeWarehouseName);

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
        <button
          onClick={() => setLabelsOpen(true)}
          className="ml-auto mr-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
        >
          <Tags className="h-3.5 w-3.5" /> Print labels
        </button>
      </div>
      <LabelPrintDialog open={labelsOpen} onClose={() => setLabelsOpen(false)} />

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
