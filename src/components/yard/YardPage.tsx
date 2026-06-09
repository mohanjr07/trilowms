/**
 * TriloWMS — Yard & Dock Module Page
 */

import { useState } from "react";
import { Truck, Search, X, ChevronRight, Clock, AlertTriangle, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useYardStore, YARD_STATUS_META, type YardTruck, type YardTruckStatus } from "@/lib/yard-store";
import { PageHeader, KPICard, Panel } from "@/components/wms/Primitives";
import { cn } from "@/lib/utils";

function YardKPIs() {
  const kpis = useYardStore((s) => s.kpis)();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <KPICard label="IN YARD" value={String(kpis.inYard)} tone="primary" />
      <KPICard label="DOCKED INBOUND" value={String(kpis.dockedIn)} tone="info" />
      <KPICard label="DOCKED OUTBOUND" value={String(kpis.dockedOut)} tone="info" />
      <KPICard label="AVG DWELL" value={kpis.avgDwell} tone="warning" />
      <KPICard label="DWELL ALERTS" value={String(kpis.dwellAlerts)} tone="destructive" />
      <KPICard label="GATE MOVES TODAY" value={String(kpis.gateMoves)} tone="success" />
      <KPICard label="AVAIL DOCKS" value={String(kpis.availableDocks)} tone="success" />
    </div>
  );
}

function DockBoard() {
  const { docks, assignDock } = useYardStore();
  const STATUS_COLOR: Record<string, string> = {
    AVAILABLE: "border-emerald-500/40 bg-emerald-500/5 text-emerald-400",
    OCCUPIED_IN: "border-blue-500/40 bg-blue-500/5 text-blue-400",
    OCCUPIED_OUT: "border-violet-500/40 bg-violet-500/5 text-violet-400",
    MAINTENANCE: "border-red-500/40 bg-red-500/5 text-red-400",
    RESERVED: "border-amber-500/40 bg-amber-500/5 text-amber-400",
  };
  const inDocks = docks.filter((d) => d.type === "INBOUND" || d.type === "BOTH");
  const outDocks = docks.filter((d) => d.type === "OUTBOUND");

  return (
    <Panel title="DOCK STATUS BOARD">
      <div className="space-y-4">
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Inbound Docks</div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {inDocks.map((d) => (
              <div key={d.id} className={cn("rounded-lg border p-2 text-center", STATUS_COLOR[d.status])}>
                <div className="font-bold font-mono text-sm">{d.code}</div>
                <div className="text-[10px] mt-0.5">{d.status.replace("_", " ")}</div>
                {d.currentWeight > 0 && <div className="text-[10px] opacity-70">{d.currentWeight}t</div>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Outbound Docks</div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {outDocks.map((d) => (
              <div key={d.id} className={cn("rounded-lg border p-2 text-center", STATUS_COLOR[d.status])}>
                <div className="font-bold font-mono text-sm">{d.code}</div>
                <div className="text-[10px] mt-0.5">{d.status.replace("_", " ")}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function AppointmentsPanel() {
  const appointments = useYardStore((s) => s.appointments);
  const upcoming = appointments.filter((a) => new Date(a.scheduledTime) >= new Date()).slice(0, 12);
  const STATUS_COLOR: Record<string, string> = {
    SCHEDULED: "text-blue-400 bg-blue-500/10",
    CHECKED_IN: "text-cyan-400 bg-cyan-500/10",
    DOCKED: "text-amber-400 bg-amber-500/10",
    COMPLETED: "text-emerald-400 bg-emerald-500/10",
    NO_SHOW: "text-red-400 bg-red-500/10",
    CANCELLED: "text-slate-400 bg-slate-500/10",
  };
  return (
    <Panel title="APPOINTMENTS">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground uppercase">
              {["Appt #","Direction","Carrier","Type","Scheduled","Reference","Status"].map((h) => (
                <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {upcoming.map((a) => (
              <tr key={a.id} className="hover:bg-accent/30">
                <td className="py-2 px-2 font-mono text-xs text-primary">{a.appointmentNumber}</td>
                <td className="py-2 px-2">
                  <span className={cn("text-[10px] px-1.5 rounded font-semibold", a.direction === "INBOUND" ? "text-blue-400 bg-blue-500/10" : "text-violet-400 bg-violet-500/10")}>
                    {a.direction}
                  </span>
                </td>
                <td className="py-2 px-2 text-xs">{a.carrier}</td>
                <td className="py-2 px-2 text-xs">{a.truckType}</td>
                <td className="py-2 px-2 text-xs whitespace-nowrap">{new Date(a.scheduledTime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="py-2 px-2 font-mono text-xs text-primary">{a.referenceDoc}</td>
                <td className="py-2 px-2">
                  <span className={cn("text-[10px] px-1.5 rounded font-semibold", STATUS_COLOR[a.status])}>{a.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function TruckDetail({ truck, onClose }: { truck: YardTruck; onClose: () => void }) {
  const { updateTruckStatus, assignDock, gateOut } = useYardStore();
  const meta = YARD_STATUS_META[truck.status];
  return (
    <div className="p-6 space-y-4 overflow-y-auto">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary">{truck.truckNumber}</span>
            <span className={cn("text-[11px] px-2 py-0.5 rounded font-semibold", meta.color, meta.bg)}>{meta.label}</span>
            <span className={cn("text-[10px] px-1.5 rounded font-semibold", truck.direction === "INBOUND" ? "text-blue-400 bg-blue-500/10" : "text-violet-400 bg-violet-500/10")}>{truck.direction}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">{truck.carrier} · {truck.driver}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      {truck.dwellAlert && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-400">Dwell Alert: {truck.dwellMinutes}m (threshold {truck.dwellThresholdMinutes}m)</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {[
          ["Plate", truck.plateNumber],
          ["Dock", truck.dockCode ?? "—"],
          ["Yard Position", truck.spotNumber ?? "—"],
          ["Direction", truck.direction],
          ["Driver Mobile", truck.driverMobile],
          ["Dwell Time", `${truck.dwellMinutes}m`],
          ["Gate In", truck.gateInTime ? new Date(truck.gateInTime).toLocaleTimeString() : "—"],
          ["Dock Assigned", truck.dockAssignedTime ? new Date(truck.dockAssignedTime).toLocaleTimeString() : "—"],
          ["Seals", truck.seals.join(", ") || "—"],
          ["Hazmat", truck.hazmat ? "Yes" : "No"],
          ["ASN", truck.asnId ?? "—"],
          ["Shipment", truck.shipmentId ?? "—"],
        ].map(([l, v]) => (
          <div key={l} className="rounded border border-border bg-card/30 p-2">
            <div className="text-[10px] text-muted-foreground uppercase">{l}</div>
            <div className="text-sm font-mono mt-0.5">{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {truck.status === "WAITING" && <Button size="sm" onClick={() => updateTruckStatus(truck.id, "DOCKING")}>Assign to Dock</Button>}
        {truck.status === "DOCKED_IN" && <Button size="sm" onClick={() => updateTruckStatus(truck.id, "UNLOADING")}>Start Unloading</Button>}
        {truck.status === "UNLOADING" && <Button size="sm" variant="outline" onClick={() => updateTruckStatus(truck.id, "GATE_OUT")}>Complete & Gate Out</Button>}
        {truck.status === "DOCKED_OUT" && <Button size="sm" onClick={() => updateTruckStatus(truck.id, "LOADING")}>Start Loading</Button>}
        {truck.status === "LOADING" && <Button size="sm" variant="outline" onClick={() => updateTruckStatus(truck.id, "LOADED")}>Mark Loaded</Button>}
        {truck.status === "LOADED" && <Button size="sm" onClick={() => gateOut(truck.id)}>Gate Out</Button>}
      </div>
    </div>
  );
}

function TruckTable({ onSelect }: { onSelect: (t: YardTruck) => void }) {
  const { filteredTrucks, filters, setFilters, page, setPage } = useYardStore();
  const all = filteredTrucks();
  const pageSize = 15;
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const total = Math.max(1, Math.ceil(all.length / pageSize));

  return (
    <Panel title={`TRUCKS IN YARD (${all.length})`}>
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search truck, carrier, driver..." value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as YardTruckStatus })}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {(["GATE_IN","WAITING","DOCKING","DOCKED_IN","DOCKED_OUT","LOADING","UNLOADING","LOADED"] as YardTruckStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{YARD_STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.direction || "all"} onValueChange={(v) => setFilters({ direction: v === "all" ? "" : v as "INBOUND" | "OUTBOUND" })}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Direction" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="INBOUND">Inbound</SelectItem>
            <SelectItem value="OUTBOUND">Outbound</SelectItem>
          </SelectContent>
        </Select>
        {(filters.search || filters.status || filters.direction) && <Button variant="ghost" size="sm" onClick={() => setFilters({ search: "", status: "", direction: "" })} className="h-8"><X className="h-3.5 w-3.5" /></Button>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wide">
              {["Truck","Plate","Carrier","Driver","Direction","Dock","Position","Dwell","Priority","Status",""].map((h) => (
                <th key={h} className="text-left py-2 px-2 whitespace-nowrap font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paged.map((t) => {
              const meta = YARD_STATUS_META[t.status];
              return (
                <tr key={t.id} className="hover:bg-accent/30 cursor-pointer" onClick={() => onSelect(t)}>
                  <td className="py-2 px-2 font-mono text-xs text-primary">{t.truckNumber}</td>
                  <td className="py-2 px-2 font-mono text-xs">{t.plateNumber}</td>
                  <td className="py-2 px-2 text-xs">{t.carrier}</td>
                  <td className="py-2 px-2 text-xs">{t.driver}</td>
                  <td className="py-2 px-2">
                    <span className={cn("text-[10px] px-1.5 rounded font-semibold", t.direction === "INBOUND" ? "text-blue-400 bg-blue-500/10" : "text-violet-400 bg-violet-500/10")}>{t.direction}</span>
                  </td>
                  <td className="py-2 px-2 font-mono text-xs">{t.dockCode ?? "—"}</td>
                  <td className="py-2 px-2 text-xs">{t.spotNumber ?? "—"}</td>
                  <td className={cn("py-2 px-2 text-xs font-mono", t.dwellAlert ? "text-amber-400 font-bold" : "")}>
                    {t.dwellMinutes}m {t.dwellAlert && "⚠"}
                  </td>
                  <td className="py-2 px-2">
                    <span className={cn("text-[10px] px-1.5 rounded font-semibold",
                      t.priority === "URGENT" ? "text-red-400 bg-red-500/10" :
                      t.priority === "HIGH" ? "text-orange-400 bg-orange-500/10" :
                      "text-slate-400 bg-slate-500/10"
                    )}>{t.priority}</span>
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

export function YardPage() {
  const [selected, setSelected] = useState<YardTruck | null>(null);
  const [tab, setTab] = useState("trucks");
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader icon={Truck} title="Yard & Dock" subtitle="Yard map, gate control, dock assignment & dwell time management" />
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 pt-4 border-b border-border">
          <TabsList>
            <TabsTrigger value="trucks">Yard Trucks</TabsTrigger>
            <TabsTrigger value="docks">Dock Board</TabsTrigger>
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <YardKPIs />
          <TabsContent value="trucks" className="mt-0">
            <TruckTable onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="docks" className="mt-0">
            <DockBoard />
          </TabsContent>
          <TabsContent value="appointments" className="mt-0">
            <AppointmentsPanel />
          </TabsContent>
        </div>
      </Tabs>
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="overflow-y-auto flex-1">
            {selected && <TruckDetail truck={selected} onClose={() => setSelected(null)} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
