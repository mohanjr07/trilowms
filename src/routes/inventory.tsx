import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Filter, Download, Plus, Search } from "lucide-react";
import { PageHeader, KPICard, Panel, DataTable, StatusBadge } from "@/components/wms/Primitives";
import { warehouse } from "@/lib/wms-data";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory — TriloWMS" }, { name: "description", content: "SKU inventory, on-hand, allocated, and bin assignments." }] }),
  component: Inventory,
});

const SKUS = Array.from({ length: 25 }, (_, i) => {
  const onHand = Math.floor(20 + Math.random() * 4000);
  const allocated = Math.floor(Math.random() * onHand * 0.4);
  return {
    sku: `SKU-${10000 + i}`,
    desc: ["Aluminum Bracket", "Steel Coil 2.5mm", "Hydraulic Pump", "Carbon Filter", "Insulated Wire 14AWG", "PCB Module v3", "Bearing 6204-2RS", "Lithium Cell 18650"][i % 8],
    category: ["Hardware", "Electronics", "Raw Material", "Packaging"][i % 4],
    onHand, allocated, available: onHand - allocated,
    bin: warehouse.zones[i % warehouse.zones.length].aisles[0]?.racks[0]?.bins[0]?.code ?? "—",
    status: ["Active", "Active", "Active", "Hold"][i % 4],
  };
});

function Inventory() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={Boxes} title="Inventory" subtitle="On-hand, allocated, available across all locations"
        actions={
          <>
            <button className="px-3 py-2 rounded border border-border text-sm flex items-center gap-2"><Filter className="h-4 w-4" /> Filter</button>
            <button className="px-3 py-2 rounded border border-border text-sm flex items-center gap-2"><Download className="h-4 w-4" /> Export</button>
            <button className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm flex items-center gap-2 glow-amber"><Plus className="h-4 w-4" /> New SKU</button>
          </>
        }
      />
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="TOTAL SKUS" value="12,847" tone="primary" />
        <KPICard label="ON HAND UNITS" value="2.4M" tone="success" delta="▲ 1.2%" />
        <KPICard label="ALLOCATED" value="184K" tone="info" />
        <KPICard label="LOW STOCK" value="48" tone="warning" sub="Below reorder point" />
      </div>
      <div className="px-6 pb-6 flex-1 min-h-0">
        <Panel title="SKU LEDGER" actions={
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input placeholder="Search SKU..." className="pl-7 pr-3 py-1 text-xs rounded bg-input/50 border border-border" />
          </div>
        } className="h-full">
          <DataTable
            rows={SKUS}
            columns={[
              { key: "sku", label: "SKU", render: (r) => <span className="text-primary">{r.sku}</span> },
              { key: "desc", label: "Description" },
              { key: "category", label: "Category" },
              { key: "onHand", label: "On Hand", render: (r) => r.onHand.toLocaleString() },
              { key: "allocated", label: "Allocated", render: (r) => r.allocated.toLocaleString() },
              { key: "available", label: "Available", render: (r) => <span className={r.available < 50 ? "text-warning" : "text-success"}>{r.available.toLocaleString()}</span> },
              { key: "bin", label: "Primary Bin" },
              { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
