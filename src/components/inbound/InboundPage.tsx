/**
 * TriloWMS — Inbound Module
 * Full industrial-grade ASN management, receiving, dock scheduling
 */

import { useState } from "react";
import {
  ArrowDownToLine, Truck, Package, AlertTriangle, Search, Filter,
  Plus, CheckCircle2, Clock, RefreshCw, ChevronRight, X, Eye,
  ClipboardList, AlertCircle, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  useInboundStore,
  ASN_STATUS_META,
  PRIORITY_META,
  type ASN,
  type AsnStatus,
  type DockDoor,
} from "@/lib/inbound-store";
import { PageHeader, KPICard, Panel } from "@/components/wms/Primitives";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function InboundKPIs() {
  const kpis = useInboundStore((s) => s.kpis)();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <KPICard label="OPEN ASNs" value={String(kpis.openAsns)} tone="primary" />
      <KPICard label="RECEIVED TODAY" value={String(kpis.receivedToday)} tone="success" delta="↑ 12%" />
      <KPICard label="DOCKED NOW" value={String(kpis.dockedNow)} tone="info" />
      <KPICard label="DISCREPANCIES" value={String(kpis.discrepancies)} tone="destructive" />
      <KPICard label="URGENT PENDING" value={String(kpis.urgentPending)} tone="warning" />
      <KPICard label="AVG RECV TIME" value={kpis.avgReceivingTime} tone="info" />
      <KPICard label="PENDING PUTAWAY" value={String(kpis.pendingPutaway)} tone="warning" />
    </div>
  );
}

// ─── Dock Board ───────────────────────────────────────────────────────────────

function DockBoard() {
  const dockDoors = useInboundStore((s) => s.dockDoors);
  const asns = useInboundStore((s) => s.asns);
  const updateDockStatus = useInboundStore((s) => s.updateDockStatus);

  const DOCK_STATUS_COLORS: Record<DockDoor["status"], string> = {
    AVAILABLE: "border-emerald-500/40 bg-emerald-500/5 text-emerald-400",
    OCCUPIED: "border-amber-500/40 bg-amber-500/5 text-amber-400",
    MAINTENANCE: "border-red-500/40 bg-red-500/5 text-red-400",
    RESERVED: "border-blue-500/40 bg-blue-500/5 text-blue-400",
  };

  return (
    <Panel title="DOCK DOOR STATUS">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 p-1">
        {dockDoors.map((dock) => {
          const asn = dock.assignedAsnId ? asns.find((a) => a.id === dock.assignedAsnId) : null;
          return (
            <div
              key={dock.id}
              className={cn(
                "rounded-lg border p-3 flex flex-col gap-1 cursor-default select-none",
                DOCK_STATUS_COLORS[dock.status]
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm font-mono">{dock.code}</span>
                <span className={cn("text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded", DOCK_STATUS_COLORS[dock.status])}>
                  {dock.status}
                </span>
              </div>
              {asn && (
                <div className="text-[11px] opacity-80 truncate">
                  {asn.asnNumber.slice(-4)} · {asn.vendor.split(" ")[0]}
                </div>
              )}
              {dock.occupiedSince && (
                <div className="text-[10px] opacity-60">
                  Since {new Date(dock.occupiedSince).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
              {dock.status === "OCCUPIED" && (
                <button
                  onClick={() => updateDockStatus(dock.id, "AVAILABLE")}
                  className="mt-1 text-[10px] underline opacity-60 hover:opacity-100 text-left"
                >
                  Release
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ─── ASN Status Badge ─────────────────────────────────────────────────────────

function AsnStatusBadge({ status }: { status: AsnStatus }) {
  const meta = ASN_STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border", meta.color, meta.bg, meta.border)}>
      {meta.label}
    </span>
  );
}

// ─── ASN Detail Panel ─────────────────────────────────────────────────────────

function AsnDetailPanel({ asn, onClose }: { asn: ASN; onClose: () => void }) {
  const { receiveLine, updateAsnStatus, raiseDiscrepancy, resolveDiscrepancy, availableDocks, assignDock } = useInboundStore();
  const [receivingLine, setReceivingLine] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState("");
  const [tab, setTab] = useState("lines");

  const receiveProgress = asn.totalUnits > 0 ? Math.round((asn.receivedUnits / asn.totalUnits) * 100) : 0;

  const handleReceive = (lineId: string) => {
    const qty = parseInt(receiveQty);
    if (!isNaN(qty) && qty > 0) {
      receiveLine(asn.id, lineId, qty);
      setReceivingLine(null);
      setReceiveQty("");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm text-primary">{asn.asnNumber}</span>
            <AsnStatusBadge status={asn.status} />
            <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded", PRIORITY_META[asn.priority].color, PRIORITY_META[asn.priority].bg)}>
              {asn.priority}
            </span>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{asn.vendor} · {asn.carrierName}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3 p-4 border-b border-border">
        {[
          { label: "Lines", value: `${asn.totalLines}` },
          { label: "Total Units", value: asn.totalUnits.toLocaleString() },
          { label: "Received", value: asn.receivedUnits.toLocaleString() },
          { label: "Dock", value: asn.dockCode ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
            <div className="font-bold text-sm mt-0.5 font-mono">{value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
          <span>Receiving Progress</span>
          <span>{receiveProgress}%</span>
        </div>
        <Progress value={receiveProgress} className="h-2" />
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-2 border-b border-border flex-wrap">
        {asn.status === "PENDING" && (
          <Button size="sm" variant="outline" onClick={() => updateAsnStatus(asn.id, "SCHEDULED")}>
            <Building2 className="h-3.5 w-3.5 mr-1" /> Schedule Dock
          </Button>
        )}
        {asn.status === "SCHEDULED" && (
          <Button size="sm" variant="outline" onClick={() => updateAsnStatus(asn.id, "ARRIVED")}>
            <Truck className="h-3.5 w-3.5 mr-1" /> Mark Arrived
          </Button>
        )}
        {asn.status === "ARRIVED" && (
          <Button size="sm" variant="outline" onClick={() => updateAsnStatus(asn.id, "DOCKED")}>
            <Package className="h-3.5 w-3.5 mr-1" /> Assign to Dock
          </Button>
        )}
        {["DOCKED", "PARTIAL"].includes(asn.status) && (
          <Button size="sm" onClick={() => updateAsnStatus(asn.id, "RECEIVING")}>
            <ClipboardList className="h-3.5 w-3.5 mr-1" /> Start Receiving
          </Button>
        )}
        {asn.status === "RECEIVING" && (
          <Button size="sm" variant="outline" onClick={() => updateAsnStatus(asn.id, "RECEIVED")}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Complete Receipt
          </Button>
        )}
        {asn.status === "RECEIVED" && (
          <Button size="sm" variant="outline" onClick={() => updateAsnStatus(asn.id, "CLOSED")}>
            Close ASN
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="mx-4 mt-2 w-fit">
          <TabsTrigger value="lines">Lines ({asn.totalLines})</TabsTrigger>
          <TabsTrigger value="discrepancies">
            Discrepancies
            {asn.discrepancies.length > 0 && (
              <span className="ml-1 bg-destructive text-destructive-foreground text-[10px] px-1 rounded-full">
                {asn.discrepancies.filter((d) => d.status === "OPEN").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="info">Details</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <TabsContent value="lines" className="mt-3 space-y-2">
            {asn.lines.map((line) => (
              <div key={line.id} className="rounded-lg border border-border bg-card/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-primary">{line.skuCode}</span>
                      <span className="text-xs text-muted-foreground truncate">{line.skuName}</span>
                    </div>
                    <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                      <span>PO: {line.poNumber}</span>
                      <span>Expected: <strong className="text-foreground">{line.expectedQty} {line.uom}</strong></span>
                      <span>Received: <strong className="text-emerald-400">{line.receivedQty}</strong></span>
                      {line.damagedQty > 0 && <span className="text-red-400">Damaged: {line.damagedQty}</span>}
                    </div>
                    {line.batchNumber && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">Batch: {line.batchNumber}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn(
                      "text-[11px] px-2 py-0.5 rounded font-semibold",
                      line.status === "RECEIVED" ? "text-emerald-400 bg-emerald-500/10" :
                      line.status === "IN_PROGRESS" ? "text-amber-400 bg-amber-500/10" :
                      line.status === "DAMAGED" ? "text-red-400 bg-red-500/10" :
                      "text-slate-400 bg-slate-500/10"
                    )}>
                      {line.status}
                    </span>
                    {["DOCKED", "RECEIVING"].includes(asn.status) && line.status !== "RECEIVED" && (
                      receivingLine === line.id ? (
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            value={receiveQty}
                            onChange={(e) => setReceiveQty(e.target.value)}
                            placeholder="Qty"
                            className="w-20 h-7 text-xs"
                          />
                          <Button size="sm" className="h-7 px-2 text-xs" onClick={() => handleReceive(line.id)}>OK</Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setReceivingLine(null)}>×</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReceivingLine(line.id)}>
                          Receive
                        </Button>
                      )
                    )}
                  </div>
                </div>
                <Progress
                  value={line.expectedQty > 0 ? Math.min(100, Math.round((line.receivedQty / line.expectedQty) * 100)) : 0}
                  className="h-1 mt-2"
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="discrepancies" className="mt-3 space-y-2">
            {asn.discrepancies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/40" />
                No discrepancies reported
              </div>
            ) : (
              asn.discrepancies.map((disc) => (
                <div key={disc.id} className={cn(
                  "rounded-lg border p-3",
                  disc.status === "OPEN" ? "border-red-500/30 bg-red-500/5" : "border-emerald-500/30 bg-emerald-500/5"
                )}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={cn("h-3.5 w-3.5", disc.status === "OPEN" ? "text-red-400" : "text-emerald-400")} />
                        <span className="font-semibold text-sm">{disc.type.replace(/_/g, " ")}</span>
                        <span className={cn(
                          "text-[10px] px-1.5 rounded font-semibold",
                          disc.status === "OPEN" ? "text-red-400 bg-red-500/10" :
                          disc.status === "RESOLVED" ? "text-emerald-400 bg-emerald-500/10" :
                          "text-amber-400 bg-amber-500/10"
                        )}>
                          {disc.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {disc.skuCode} · Expected: {disc.expectedQty} · Actual: {disc.actualQty} · Variance: {disc.variance} ({disc.variancePct}%)
                      </div>
                      {disc.notes && <div className="text-xs text-muted-foreground mt-1">{disc.notes}</div>}
                      {disc.resolution && <div className="text-xs text-emerald-400 mt-1">Resolution: {disc.resolution}</div>}
                    </div>
                    {disc.status === "OPEN" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => resolveDiscrepancy(asn.id, disc.id, "Current User", "Vendor credit initiated")}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="info" className="mt-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["ASN Number", asn.asnNumber],
                ["Vendor", asn.vendor],
                ["Vendor Code", asn.vendorCode],
                ["Carrier", asn.carrierName],
                ["Truck #", asn.truckNumber ?? "—"],
                ["Trailer #", asn.trailerNumber ?? "—"],
                ["Dock Door", asn.dockCode ?? "Unassigned"],
                ["PO Numbers", asn.poNumbers.join(", ")],
                ["Pallet Count", String(asn.palletCount)],
                ["Gross Weight", `${asn.grossWeight.toLocaleString()} kg`],
                ["Scheduled Arrival", new Date(asn.scheduledArrival).toLocaleString()],
                ["Actual Arrival", asn.actualArrival ? new Date(asn.actualArrival).toLocaleString() : "—"],
                ["Hazmat", asn.hazmat ? "Yes" : "No"],
                ["Temp Required", asn.temperatureRequired ? "Yes" : "No"],
                ["Created By", asn.createdBy],
                ["Created At", new Date(asn.createdAt).toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className="rounded border border-border bg-card/30 p-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
                  <div className="text-sm font-medium mt-0.5 font-mono">{value}</div>
                </div>
              ))}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─── Receiving Volume Chart ───────────────────────────────────────────────────

function ReceivingChart() {
  const data = Array.from({ length: 12 }, (_, i) => ({
    hour: `${(6 + i) % 24}:00`,
    units: Math.floor(200 + Math.random() * 800),
    asns: Math.floor(1 + Math.random() * 5),
  }));

  return (
    <Panel title="RECEIVING VOLUME — LAST 12H" className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
          <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
          <Bar dataKey="units" fill="var(--color-primary)" radius={[3, 3, 0, 0]} name="Units" />
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}

// ─── ASN Table ────────────────────────────────────────────────────────────────

function AsnTable({ onSelect }: { onSelect: (asn: ASN) => void }) {
  const { filteredAsns, filters, setFilters, page, totalPages, setPage } = useInboundStore();
  const all = filteredAsns();
  const pageSize = 15;
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const total = Math.max(1, Math.ceil(all.length / pageSize));

  return (
    <Panel title={`ASN QUEUE (${all.length})`}>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search ASN, vendor, PO..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as AsnStatus })}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(["PENDING","SCHEDULED","ARRIVED","DOCKED","RECEIVING","PARTIAL","RECEIVED","DISCREPANCY","CLOSED"] as AsnStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{ASN_STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.priority || "all"} onValueChange={(v) => setFilters({ priority: v === "all" ? "" : v })}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="NORMAL">Normal</SelectItem>
          </SelectContent>
        </Select>
        {(filters.search || filters.status || filters.priority) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ search: "", status: "", priority: "" })} className="h-8">
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wide">
              {["ASN #","Vendor","Carrier","Dock","ETA","Lines","Units","Recv%","Priority","Status",""].map((h) => (
                <th key={h} className="text-left py-2 px-2 whitespace-nowrap font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paged.map((asn) => {
              const pct = asn.totalUnits > 0 ? Math.round((asn.receivedUnits / asn.totalUnits) * 100) : 0;
              return (
                <tr
                  key={asn.id}
                  className="hover:bg-accent/30 cursor-pointer transition-colors"
                  onClick={() => onSelect(asn)}
                >
                  <td className="py-2 px-2 font-mono text-primary text-xs whitespace-nowrap">{asn.asnNumber.slice(-8)}</td>
                  <td className="py-2 px-2 whitespace-nowrap">{asn.vendor}</td>
                  <td className="py-2 px-2 text-muted-foreground text-xs whitespace-nowrap">{asn.carrierName.split(" ")[0]}</td>
                  <td className="py-2 px-2 font-mono text-xs">{asn.dockCode ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2 px-2 text-xs whitespace-nowrap">
                    {new Date(asn.scheduledArrival).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-2 px-2 text-center">{asn.totalLines}</td>
                  <td className="py-2 px-2 text-right font-mono text-xs">{asn.totalUnits.toLocaleString()}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      <Progress value={pct} className="h-1.5 w-16 shrink-0" />
                      <span className="text-[11px] font-mono">{pct}%</span>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold", PRIORITY_META[asn.priority].color, PRIORITY_META[asn.priority].bg)}>
                      {asn.priority}
                    </span>
                  </td>
                  <td className="py-2 px-2"><AsnStatusBadge status={asn.status} /></td>
                  <td className="py-2 px-2">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <span>Showing {paged.length} of {all.length} ASNs</span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</Button>
          <span className="px-2 py-1">Page {page} / {total}</span>
          <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= total} onClick={() => setPage(page + 1)}>Next ›</Button>
        </div>
      </div>
    </Panel>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function InboundPage() {
  const [selectedAsn, setSelectedAsn] = useState<ASN | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const handleSelect = (asn: ASN) => {
    setSelectedAsn(asn);
    setShowDetail(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={ArrowDownToLine}
        title="Inbound"
        subtitle="ASN management, receiving workflow, dock scheduling & discrepancy tracking"
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <InboundKPIs />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <ReceivingChart />
          <DockBoard />
        </div>
        <AsnTable onSelect={handleSelect} />
      </div>

      {/* Side panel detail */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 gap-0">
          {selectedAsn && (
            <AsnDetailPanel asn={selectedAsn} onClose={() => setShowDetail(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
