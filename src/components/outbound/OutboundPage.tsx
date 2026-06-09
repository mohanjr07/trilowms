/**
 * TriloWMS — Outbound Module Page
 */

import { useState } from "react";
import { ArrowUpFromLine, Search, X, ChevronRight, Truck, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOutboundStore, SHIPMENT_STATUS_META, type Shipment, type ShipmentStatus } from "@/lib/outbound-store";
import { PageHeader, KPICard, Panel } from "@/components/wms/Primitives";
import { cn } from "@/lib/utils";

function OutboundKPIs() {
  const kpis = useOutboundStore((s) => s.kpis());
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <KPICard label="DISPATCHED TODAY" value={String(kpis.dispatched)} tone="success" />
      <KPICard label="STAGED" value={String(kpis.staged)} tone="info" />
      <KPICard label="LOADING" value={String(kpis.loading)} tone="primary" />
      <KPICard label="DELAYED" value={String(kpis.delayed)} tone="warning" />
      <KPICard label="SLA COMPLIANCE" value={kpis.slaCompliance} tone="success" />
      <KPICard label="TRUCKS LOADING" value={String(kpis.trucksLoading)} tone="info" />
      <KPICard label="EXCEPTIONS" value={String(kpis.exceptionsOpen)} tone="destructive" />
    </div>
  );
}

function ShipmentDetail({ shipment, onClose }: { shipment: Shipment; onClose: () => void }) {
  const { updateStatus } = useOutboundStore();
  const meta = SHIPMENT_STATUS_META[shipment.status];
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary">{shipment.shipmentNumber}</span>
            <span className={cn("text-[11px] px-2 py-0.5 rounded font-semibold", meta.color, meta.bg)}>{meta.label}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{shipment.carrier} {shipment.serviceLevel} · Dock: {shipment.dockCode ?? "—"}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-4 gap-2 p-4 border-b border-border">
        {[["Orders", shipment.totalOrders],["Cartons", shipment.totalCartons],["Pallets", shipment.totalPallets],["Weight", `${shipment.totalWeight}kg`]].map(([l, v]) => (
          <div key={l} className="text-center">
            <div className="text-[10px] text-muted-foreground uppercase">{l}</div>
            <div className="font-bold text-sm font-mono mt-0.5">{v}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 px-4 py-2 border-b border-border flex-wrap">
        {shipment.status === "PLANNED" && <Button size="sm" onClick={() => updateStatus(shipment.id, "STAGED")}>Stage Shipment</Button>}
        {shipment.status === "STAGED" && <Button size="sm" onClick={() => updateStatus(shipment.id, "LOADING")}><Truck className="h-3.5 w-3.5 mr-1" /> Start Loading</Button>}
        {shipment.status === "LOADING" && <Button size="sm" onClick={() => updateStatus(shipment.id, "LOADED")}>Mark Loaded</Button>}
        {shipment.status === "LOADED" && <Button size="sm" onClick={() => updateStatus(shipment.id, "DISPATCHED")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Dispatch</Button>}
        {shipment.status === "DISPATCHED" && <Button size="sm" variant="outline" onClick={() => updateStatus(shipment.id, "IN_TRANSIT")}>Mark In Transit</Button>}
        {shipment.status === "IN_TRANSIT" && <Button size="sm" variant="outline" onClick={() => updateStatus(shipment.id, "DELIVERED")}>Mark Delivered</Button>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {[
            ["BOL Number", shipment.masterBOL ?? "—"],
            ["PRO Number", shipment.proNumber ?? "—"],
            ["Seal Number", shipment.sealNumber ?? "—"],
            ["Truck", shipment.truckPlate ?? "—"],
            ["Driver", shipment.driverName ?? "—"],
            ["Route", shipment.routeCode ?? "—"],
            ["Scheduled Dispatch", new Date(shipment.scheduledDispatch).toLocaleString()],
            ["Actual Dispatch", shipment.actualDispatch ? new Date(shipment.actualDispatch).toLocaleString() : "—"],
            ["Est. Delivery", shipment.estimatedDelivery ? new Date(shipment.estimatedDelivery).toLocaleString() : "—"],
            ["SLA By", new Date(shipment.slaAt).toLocaleString()],
          ].map(([l, v]) => (
            <div key={l} className="rounded border border-border bg-card/30 p-2">
              <div className="text-[10px] text-muted-foreground uppercase">{l}</div>
              <div className="text-sm font-mono mt-0.5">{v}</div>
            </div>
          ))}
        </div>

        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3">Orders in Shipment</div>
        {shipment.orders.map((o) => (
          <div key={o.id} className="rounded-lg border border-border bg-card/30 p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-primary">{o.orderId}</span>
              <span className="text-xs text-muted-foreground">{o.customer}</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">{o.cartons} cartons · {o.pallets} pallets · {o.weight}kg</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{o.address}</div>
          </div>
        ))}

        {shipment.exceptions.length > 0 && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <div className="text-sm font-semibold text-red-400 mb-2">Exceptions</div>
            {shipment.exceptions.map((ex, i) => (
              <div key={i} className="text-xs text-muted-foreground">[{ex.code}] {ex.description}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ShipmentTable({ onSelect }: { onSelect: (s: Shipment) => void }) {
  const { filteredShipments, filters, setFilters, page, setPage, pageSize } = useOutboundStore();
  const all = filteredShipments();
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const total = Math.max(1, Math.ceil(all.length / pageSize));

  return (
    <Panel title={`SHIPMENTS (${all.length})`}>
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search shipment, carrier..." value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as ShipmentStatus })}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {(["PLANNED","STAGED","LOADING","LOADED","DISPATCHED","IN_TRANSIT","DELIVERED","EXCEPTION"] as ShipmentStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{SHIPMENT_STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filters.search || filters.status) && <Button variant="ghost" size="sm" onClick={() => setFilters({ search: "", status: "" })} className="h-8"><X className="h-3.5 w-3.5" /></Button>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wide">
              {["Shipment","Carrier","Dock","Orders","Cartons","Pallets","Weight","Sched. Dispatch","Priority","Status",""].map((h) => (
                <th key={h} className="text-left py-2 px-2 whitespace-nowrap font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paged.map((s) => {
              const meta = SHIPMENT_STATUS_META[s.status];
              const overdue = !["DELIVERED","EXCEPTION","RETURNED"].includes(s.status) && new Date(s.scheduledDispatch) < new Date();
              return (
                <tr key={s.id} className="hover:bg-accent/30 cursor-pointer" onClick={() => onSelect(s)}>
                  <td className="py-2 px-2 font-mono text-xs text-primary">{s.shipmentNumber}</td>
                  <td className="py-2 px-2 text-xs">{s.carrier}</td>
                  <td className="py-2 px-2 font-mono text-xs">{s.dockCode ?? "—"}</td>
                  <td className="py-2 px-2 text-center">{s.totalOrders}</td>
                  <td className="py-2 px-2 text-center">{s.totalCartons}</td>
                  <td className="py-2 px-2 text-center">{s.totalPallets}</td>
                  <td className="py-2 px-2 font-mono text-xs text-right">{s.totalWeight}kg</td>
                  <td className={cn("py-2 px-2 text-xs whitespace-nowrap", overdue ? "text-red-400" : "")}>
                    {new Date(s.scheduledDispatch).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}{overdue ? " ⚠" : ""}
                  </td>
                  <td className="py-2 px-2">
                    <span className={cn("text-[10px] px-1.5 rounded font-semibold",
                      s.priority === "URGENT" ? "text-red-400 bg-red-500/10" :
                      s.priority === "HIGH" ? "text-orange-400 bg-orange-500/10" :
                      "text-slate-400 bg-slate-500/10"
                    )}>{s.priority}</span>
                  </td>
                  <td className="py-2 px-2">
                    <span className={cn("text-[11px] px-2 py-0.5 rounded font-semibold", meta.color, meta.bg)}>{meta.label}</span>
                  </td>
                  <td className="py-2 px-2"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <span>Showing {paged.length} of {all.length}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</Button>
          <span className="px-2 py-1">{page} / {total}</span>
          <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= total} onClick={() => setPage(page + 1)}>›</Button>
        </div>
      </div>
    </Panel>
  );
}

export function OutboundPage() {
  const [selected, setSelected] = useState<Shipment | null>(null);
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader icon={ArrowUpFromLine} title="Outbound" subtitle="Shipment planning, dispatch, carrier manifests & SLA tracking" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <OutboundKPIs />
        <ShipmentTable onSelect={setSelected} />
      </div>
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 gap-0">
          {selected && <ShipmentDetail shipment={selected} onClose={() => setSelected(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
