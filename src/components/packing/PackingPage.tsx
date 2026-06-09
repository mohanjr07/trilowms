/**
 * TriloWMS — Packing Module Page
 */

import { useState } from "react";
import { PackageCheck, Search, X, ChevronRight, Monitor, Box, Printer, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { usePackingStore, PACK_STATUS_META, type PackOrder, type PackOrderStatus, type PackStation } from "@/lib/packing-store";
import { PageHeader, KPICard, Panel } from "@/components/wms/Primitives";
import { cn } from "@/lib/utils";

function PackingKPIs() {
  const kpis = usePackingStore((s) => s.kpis)();
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <KPICard label="STATIONS ACTIVE" value={String(kpis.activeStations)} sub="/10" tone="info" />
      <KPICard label="CARTONS PACKED" value={String(kpis.cartonsPacked)} tone="success" />
      <KPICard label="AVG PACK TIME" value={kpis.avgPackTime} tone="primary" />
      <KPICard label="REWORK" value={String(kpis.rework)} tone="warning" />
      <KPICard label="PENDING LABEL" value={String(kpis.pendingLabel)} tone="info" />
      <KPICard label="DISPATCHED TODAY" value={String(kpis.dispatched)} tone="success" />
    </div>
  );
}

function StationBoard() {
  const stations = usePackingStore((s) => s.stations);
  const STATUS_COLOR: Record<PackStation["status"], string> = {
    ACTIVE:      "border-emerald-500/40 bg-emerald-500/5",
    IDLE:        "border-slate-500/40 bg-slate-500/5",
    PAUSED:      "border-amber-500/40 bg-amber-500/5",
    MAINTENANCE: "border-red-500/40 bg-red-500/5",
  };
  return (
    <Panel title="PACK STATION STATUS">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {stations.map((st) => (
          <div key={st.id} className={cn("rounded-lg border p-3", STATUS_COLOR[st.status])}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold font-mono text-sm">{st.code}</span>
              <Monitor className={cn("h-3.5 w-3.5", st.status === "ACTIVE" ? "text-emerald-400" : st.status === "MAINTENANCE" ? "text-red-400" : "text-muted-foreground")} />
            </div>
            <div className="text-[11px] text-muted-foreground truncate">{st.operatorName ?? "Unassigned"}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Packed today: <strong className="text-foreground">{st.packedToday}</strong></div>
            <div className="text-[10px] text-muted-foreground">Avg: {st.avgPackTime}m</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function OrderDetail({ order, onClose }: { order: PackOrder; onClose: () => void }) {
  const { startPacking, completeOrder, labelCarton, flagException } = usePackingStore();
  const meta = PACK_STATUS_META[order.status];
  const progress = order.totalUnits > 0 ? Math.round((order.packedUnits / order.totalUnits) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary">{order.orderNumber}</span>
            <span className={cn("text-[11px] px-2 py-0.5 rounded font-semibold", meta.color, meta.bg)}>{meta.label}</span>
            <span className={cn("text-[10px] px-1.5 rounded font-semibold",
              order.priority === "SAME_DAY" ? "text-red-400 bg-red-500/10" :
              order.priority === "RUSH" ? "text-orange-400 bg-orange-500/10" :
              "text-slate-400 bg-slate-500/10"
            )}>{order.priority}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{order.customer} · {order.carrier} {order.serviceLevel}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-4 gap-3 p-4 border-b border-border">
        {[["Station", order.stationCode ?? "—"], ["Lines", String(order.totalLines)], ["Units", String(order.totalUnits)], ["Cartons", String(order.cartons.length)]].map(([l, v]) => (
          <div key={l} className="text-center">
            <div className="text-[10px] text-muted-foreground uppercase">{l}</div>
            <div className="font-bold text-sm font-mono mt-0.5">{v}</div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-b border-border">
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1"><span>Packing Progress</span><span>{progress}%</span></div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="flex gap-2 px-4 py-2 border-b border-border flex-wrap">
        {order.status === "ASSIGNED" && <Button size="sm" onClick={() => startPacking(order.id)}>Start Packing</Button>}
        {order.status === "PACKING" && <Button size="sm" variant="outline" onClick={() => completeOrder(order.id)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Complete</Button>}
        {order.status === "PACKED" && <Button size="sm" onClick={() => {}}><Printer className="h-3.5 w-3.5 mr-1" /> Print Labels</Button>}
        {!["DISPATCHED","EXCEPTION"].includes(order.status) && (
          <Button size="sm" variant="ghost" className="text-red-400" onClick={() => flagException(order.id, "Manual exception raised")}>
            <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Exception
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Cartons ({order.cartons.length})</div>
        {order.cartons.map((c) => (
          <div key={c.id} className={cn("rounded-lg border p-3", c.reworkRequired ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card/30")}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Box className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-xs text-primary">{c.cartonCode}</span>
                  <span className={cn("text-[10px] px-1.5 rounded font-semibold",
                    c.status === "LABELLED" || c.status === "SCANNED" ? "text-emerald-400 bg-emerald-500/10" :
                    c.status === "OPEN" ? "text-amber-400 bg-amber-500/10" :
                    "text-slate-400 bg-slate-500/10"
                  )}>{c.status}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {c.length}×{c.width}×{c.height}cm · {c.grossWeight}kg · {c.items.length} items
                </div>
                {c.trackingNumber && <div className="text-[10px] text-primary font-mono mt-0.5">TRK: {c.trackingNumber}</div>}
                {c.reworkRequired && <div className="text-[10px] text-amber-400 mt-0.5">Rework: {c.reworkReason}</div>}
              </div>
              {!c.trackingNumber && order.status === "PACKED" && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => labelCarton(order.id, c.id, `TRK${Date.now()}`)}>
                  Label
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderTable({ onSelect }: { onSelect: (o: PackOrder) => void }) {
  const { filteredOrders, filters, setFilters, page, setPage, pageSize } = usePackingStore();
  const all = filteredOrders();
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const total = Math.max(1, Math.ceil(all.length / pageSize));

  return (
    <Panel title={`PACK ORDERS (${all.length})`}>
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search order, customer..." value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as PackOrderStatus })}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {(["QUEUED","ASSIGNED","PACKING","PACKED","LABELLED","MANIFESTED","DISPATCHED","EXCEPTION"] as PackOrderStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{PACK_STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filters.search || filters.status) && <Button variant="ghost" size="sm" onClick={() => setFilters({ search: "", status: "" })} className="h-8"><X className="h-3.5 w-3.5" /></Button>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wide">
              {["Order","Customer","Station","Carrier","Lines","Units","Pack%","Cartons","Due By","Priority","Status",""].map((h) => (
                <th key={h} className="text-left py-2 px-2 whitespace-nowrap font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paged.map((o) => {
              const meta = PACK_STATUS_META[o.status];
              const pct = o.totalUnits > 0 ? Math.round((o.packedUnits / o.totalUnits) * 100) : 0;
              const overdue = new Date(o.dueBy) < new Date() && !["DISPATCHED"].includes(o.status);
              return (
                <tr key={o.id} className="hover:bg-accent/30 cursor-pointer" onClick={() => onSelect(o)}>
                  <td className="py-2 px-2 font-mono text-xs text-primary">{o.orderNumber.slice(-8)}</td>
                  <td className="py-2 px-2 text-xs truncate max-w-28">{o.customer}</td>
                  <td className="py-2 px-2 font-mono text-xs">{o.stationCode ?? "—"}</td>
                  <td className="py-2 px-2 text-xs">{o.carrier}</td>
                  <td className="py-2 px-2 text-center">{o.totalLines}</td>
                  <td className="py-2 px-2 font-mono text-xs text-right">{o.totalUnits}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      <Progress value={pct} className="h-1.5 w-14 shrink-0" />
                      <span className="text-[11px] font-mono">{pct}%</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center">{o.cartons.length}</td>
                  <td className={cn("py-2 px-2 text-xs whitespace-nowrap", overdue ? "text-red-400" : "")}>
                    {new Date(o.dueBy).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-2 px-2">
                    <span className={cn("text-[10px] px-1.5 rounded font-semibold",
                      o.priority === "SAME_DAY" ? "text-red-400 bg-red-500/10" :
                      o.priority === "RUSH" ? "text-orange-400 bg-orange-500/10" :
                      "text-slate-400 bg-slate-500/10"
                    )}>{o.priority}</span>
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

export function PackingPage() {
  const [selectedOrder, setSelectedOrder] = useState<PackOrder | null>(null);
  const [tab, setTab] = useState("orders");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader icon={PackageCheck} title="Packing" subtitle="Pack stations, cartonization, labelling & manifesting" />
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 pt-4 border-b border-border">
          <TabsList>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="stations">Stations</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <PackingKPIs />
          <TabsContent value="orders" className="mt-0">
            <OrderTable onSelect={setSelectedOrder} />
          </TabsContent>
          <TabsContent value="stations" className="mt-0">
            <StationBoard />
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={!!selectedOrder} onOpenChange={(o) => !o && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 gap-0">
          {selectedOrder && <OrderDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
