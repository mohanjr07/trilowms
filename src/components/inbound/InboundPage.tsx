/**
 * TriloWMS — Inbound Module
 * Industrial-grade ASN management, appointment & dock scheduling, receiving
 * workflow, lot/batch capture, and discrepancy resolution.
 *
 * Layout: PageHeader → sub-tab workspace (Overview · ASN Queue · Receiving ·
 * Docks & Appointments · Discrepancies) → shared ASN detail drawer + Create ASN.
 */

import { useMemo, useState } from "react";
import {
  ArrowDownToLine, Truck, Package, AlertTriangle, Search, Plus, CheckCircle2,
  RefreshCw, X, ClipboardList, Building2, LayoutDashboard, PackageCheck,
  CalendarClock, AlertCircle, ChevronRight, Clock, Boxes, Thermometer, Flame,
  Hash, MapPin, User, Weight, Layers, ScanLine, FileDown, TimerReset, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useSkuStore } from "@/lib/sku-store";
import {
  useInboundStore, ASN_STATUS_META, PRIORITY_META,
  type ASN, type AsnStatus, type AsnLine, type DockDoor, type ReceivingLineStatus,
} from "@/lib/inbound-store";
import { PageHeader, KPICard } from "@/components/wms/Primitives";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtNum = (n: number) => n.toLocaleString();
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Returns a human "late by" / "in" label relative to now. */
function etaLabel(iso: string): { text: string; tone: "ok" | "warn" | "late" } {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (diffMin >= 0) {
    if (diffMin < 60) return { text: `in ${diffMin}m`, tone: "ok" };
    return { text: `in ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`, tone: "ok" };
  }
  const late = -diffMin;
  const tone = late < 120 ? "warn" : "late";
  if (late < 60) return { text: `${late}m late`, tone };
  return { text: `${Math.floor(late / 60)}h ${late % 60}m late`, tone };
}

const LINE_STATUS_META: Record<ReceivingLineStatus, { label: string; cls: string }> = {
  PENDING:       { label: "Pending",      cls: "text-slate-400 bg-slate-500/10 border-slate-500/30" },
  IN_PROGRESS:   { label: "In Progress",  cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  RECEIVED:      { label: "Received",     cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  OVER_RECEIPT:  { label: "Over Receipt", cls: "text-orange-400 bg-orange-500/10 border-orange-500/30" },
  SHORT_RECEIPT: { label: "Short",        cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" },
  DAMAGED:       { label: "Damaged",      cls: "text-red-400 bg-red-500/10 border-red-500/30" },
  REJECTED:      { label: "Rejected",     cls: "text-red-400 bg-red-500/10 border-red-500/30" },
};

const DOCK_STATUS_COLORS: Record<DockDoor["status"], string> = {
  AVAILABLE:   "border-emerald-500/40 bg-emerald-500/5 text-emerald-400",
  OCCUPIED:    "border-amber-500/40 bg-amber-500/5 text-amber-400",
  MAINTENANCE: "border-red-500/40 bg-red-500/5 text-red-400",
  RESERVED:    "border-blue-500/40 bg-blue-500/5 text-blue-400",
};

// ─── Tiny shared atoms ────────────────────────────────────────────────────────

function AsnStatusBadge({ status }: { status: AsnStatus }) {
  const m = ASN_STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wide", m.color, m.bg, m.border)}>
      {m.label}
    </span>
  );
}

function PriorityTag({ p }: { p: ASN["priority"] }) {
  const m = PRIORITY_META[p];
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide", m.color, m.bg)}>{m.label}</span>;
}

function LineStatusTag({ status }: { status: ReceivingLineStatus }) {
  const m = LINE_STATUS_META[status];
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold border tracking-wide", m.cls)}>{m.label}</span>;
}

/** A compact framed section used across views. */
function Section({ title, sub, actions, children, className }: {
  title: string; sub?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("panel rounded-md flex flex-col", className)}>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60">
        <div className="min-w-0">
          <h3 className="text-[11px] font-bold tracking-wider uppercase truncate">{title}</h3>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

/** Mini metric used in dense rows (label left, value right, mono numerals). */
function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-3 py-2 rounded border border-border/60 bg-card/40">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-bold font-mono tabular-nums", tone)}>{value}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  OVERVIEW
// ════════════════════════════════════════════════════════════════════════════

function ReceivingVolumeChart() {
  const data = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({
      hour: `${String((6 + i) % 24).padStart(2, "0")}:00`,
      units: Math.floor(180 + Math.abs(Math.sin(i)) * 760),
    })),
    [],
  );
  return (
    <Section title="Receiving Volume" sub="Units received — last 12 hours" className="lg:col-span-2 h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} interval={1} />
            <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={36} />
            <Tooltip
              cursor={{ fill: "var(--color-accent)", opacity: 0.08 }}
              contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }}
            />
            <Bar dataKey="units" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function DockUtilizationCard() {
  const util = useInboundStore((s) => s.dockUtilization)();
  const segs = [
    { label: "Occupied", n: util.occupied, c: "bg-amber-500" },
    { label: "Reserved", n: util.reserved, c: "bg-blue-500" },
    { label: "Available", n: util.available, c: "bg-emerald-500" },
    { label: "Maintenance", n: util.maintenance, c: "bg-red-500" },
  ];
  return (
    <Section title="Dock Utilization" sub={`${util.pct}% of ${util.total} doors in use`} className="h-[240px]">
      <div className="p-4 flex flex-col gap-3 h-full">
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-secondary">
          {segs.map((s) => s.n > 0 && (
            <div key={s.label} className={s.c} style={{ width: `${(s.n / util.total) * 100}%` }} title={`${s.label}: ${s.n}`} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {segs.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-sm", s.c)} /> {s.label}
              </span>
              <span className="font-mono font-bold tabular-nums">{s.n}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto pt-2 border-t border-border/60 flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total doors</span>
          <span className="text-lg font-bold font-mono tabular-nums">{util.total}</span>
        </div>
      </div>
    </Section>
  );
}

function AppointmentAgingChart() {
  const buckets = useInboundStore((s) => s.agingBuckets)();
  const colors = ["var(--color-success)", "var(--color-warning)", "#fb923c", "var(--color-destructive)"];
  return (
    <Section title="Appointment Aging" sub="Open ASNs vs. scheduled arrival" className="h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} allowDecimals={false} />
            <YAxis type="category" dataKey="label" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={66} />
            <Tooltip
              cursor={{ fill: "var(--color-accent)", opacity: 0.08 }}
              contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }}
            />
            <Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={18}>
              {buckets.map((_, i) => <Cell key={i} fill={colors[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function ActivityFeed() {
  const asns = useInboundStore((s) => s.asns);
  const events = useMemo(() => {
    return asns
      .flatMap((a) => {
        const list: { t: string; ts: string; icon: typeof Truck; tone: string }[] = [];
        if (a.actualArrival) list.push({ t: `${a.asnNumber.slice(-8)} arrived — ${a.vendor}`, ts: a.actualArrival, icon: Truck, tone: "text-cyan-400" });
        if (a.completedAt) list.push({ t: `${a.asnNumber.slice(-8)} receipt completed`, ts: a.completedAt, icon: CheckCircle2, tone: "text-emerald-400" });
        a.discrepancies.forEach((d) => list.push({ t: `${d.type.replace(/_/g, " ").toLowerCase()} on ${a.asnNumber.slice(-8)}`, ts: d.reportedAt, icon: AlertTriangle, tone: "text-red-400" }));
        return list;
      })
      .sort((x, y) => y.ts.localeCompare(x.ts))
      .slice(0, 9);
  }, [asns]);
  return (
    <Section title="Live Activity" sub="Most recent dock & receiving events" className="h-full">
      <div className="divide-y divide-border/40 overflow-y-auto max-h-[300px]">
        {events.map((e, i) => {
          const Icon = e.icon;
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <Icon className={cn("h-4 w-4 shrink-0", e.tone)} />
              <span className="text-xs flex-1 min-w-0 truncate capitalize">{e.t}</span>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0 tabular-nums">{fmtTime(e.ts)}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function OverviewView({ onOpenAsn }: { onOpenAsn: (a: ASN) => void }) {
  const kpis = useInboundStore((s) => s.kpis)();
  const worklist = useInboundStore((s) => s.receivingWorklist)();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPICard label="OPEN ASNs" value={kpis.openAsns} tone="primary" sub="awaiting completion" />
        <KPICard label="RECEIVED TODAY" value={kpis.receivedToday} tone="success" delta="↑ 12% vs avg" />
        <KPICard label="DOCKED NOW" value={kpis.dockedNow} tone="info" sub="active at door" />
        <KPICard label="DISCREPANCIES" value={kpis.discrepancies} tone="destructive" sub="open exceptions" />
        <KPICard label="URGENT PENDING" value={kpis.urgentPending} tone="warning" sub="priority queue" />
        <KPICard label="AVG RECV TIME" value={kpis.avgReceivingTime} tone="info" sub="dock to close" />
        <KPICard label="PENDING PUTAWAY" value={kpis.pendingPutaway} tone="warning" sub="lines staged" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ReceivingVolumeChart />
        <DockUtilizationCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AppointmentAgingChart />
        <ActivityFeed />
      </div>

      <Section
        title="On The Floor Now"
        sub="ASNs currently docked or receiving — sorted by priority"
        actions={<span className="text-[10px] text-muted-foreground font-mono">{worklist.length} active</span>}
      >
        <div className="divide-y divide-border/40">
          {worklist.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground">No trucks at the dock right now.</div>
          )}
          {worklist.map((a) => {
            const pct = a.totalUnits > 0 ? Math.round((a.receivedUnits / a.totalUnits) * 100) : 0;
            return (
              <button key={a.id} onClick={() => onOpenAsn(a)} className="w-full text-left flex items-center gap-4 px-4 py-3 hover:bg-accent/20 transition-colors">
                <div className="font-mono text-xs text-primary w-24 shrink-0">{a.asnNumber.slice(-8)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{a.vendor}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{a.dockCode ? `Dock ${a.dockCode}` : "Unassigned"} · {a.carrierName}</div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 w-40 shrink-0">
                  <Progress value={pct} className="h-1.5 flex-1" />
                  <span className="text-[11px] font-mono tabular-nums w-9 text-right">{pct}%</span>
                </div>
                <PriorityTag p={a.priority} />
                <AsnStatusBadge status={a.status} />
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ASN QUEUE
// ════════════════════════════════════════════════════════════════════════════

const STATUS_OPTIONS: AsnStatus[] = ["PENDING","SCHEDULED","ARRIVED","DOCKED","RECEIVING","PARTIAL","RECEIVED","DISCREPANCY","CLOSED","CANCELLED"];

function AsnQueueView({ onOpenAsn }: { onOpenAsn: (a: ASN) => void }) {
  const { filters, setFilters, resetFilters, page, setPage } = useInboundStore();
  const filtered = useInboundStore((s) => s.filteredAsns)();
  const vendors = useInboundStore((s) => s.vendorList)();
  const carriers = useInboundStore((s) => s.carrierList)();

  const pageSize = 14;
  const total = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeFilters = filters.search || filters.status || filters.vendor || filters.priority || filters.hazmat || filters.dateFrom || filters.dateTo;

  return (
    <Section
      title="ASN Queue"
      sub={`${filtered.length} advance shipping notices matched`}
      actions={
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
          <FileDown className="h-3.5 w-3.5" /> Export
        </Button>
      }
    >
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border/60">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search ASN, vendor, carrier or PO…"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as AsnStatus })}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{ASN_STATUS_META[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.vendor || "all"} onValueChange={(v) => setFilters({ vendor: v === "all" ? "" : v })}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Vendor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vendors</SelectItem>
            {vendors.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.priority || "all"} onValueChange={(v) => setFilters({ priority: v === "all" ? "" : v })}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priority</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="NORMAL">Normal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.hazmat || "all"} onValueChange={(v) => setFilters({ hazmat: v === "all" ? "" : v as "true" | "false" })}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Hazmat" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any cargo</SelectItem>
            <SelectItem value="true">Hazmat</SelectItem>
            <SelectItem value="false">Standard</SelectItem>
          </SelectContent>
        </Select>
        {activeFilters ? (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs">
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        ) : null}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-semibold py-2.5 px-3 whitespace-nowrap">ASN #</th>
              <th className="text-left font-semibold py-2.5 px-3 whitespace-nowrap">Vendor</th>
              <th className="text-left font-semibold py-2.5 px-3 whitespace-nowrap">Carrier</th>
              <th className="text-center font-semibold py-2.5 px-3 whitespace-nowrap">Dock</th>
              <th className="text-left font-semibold py-2.5 px-3 whitespace-nowrap">Scheduled ETA</th>
              <th className="text-right font-semibold py-2.5 px-3 whitespace-nowrap">Lines</th>
              <th className="text-right font-semibold py-2.5 px-3 whitespace-nowrap">Units</th>
              <th className="text-left font-semibold py-2.5 px-3 whitespace-nowrap w-36">Receipt</th>
              <th className="text-center font-semibold py-2.5 px-3 whitespace-nowrap">Flags</th>
              <th className="text-left font-semibold py-2.5 px-3 whitespace-nowrap">Priority</th>
              <th className="text-left font-semibold py-2.5 px-3 whitespace-nowrap">Status</th>
              <th className="py-2.5 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paged.map((a) => {
              const pct = a.totalUnits > 0 ? Math.round((a.receivedUnits / a.totalUnits) * 100) : 0;
              const eta = etaLabel(a.scheduledArrival);
              const isOpen = !["RECEIVED", "CLOSED", "CANCELLED"].includes(a.status);
              return (
                <tr key={a.id} className="hover:bg-accent/20 cursor-pointer transition-colors" onClick={() => onOpenAsn(a)}>
                  <td className="py-2 px-3 font-mono text-primary text-xs whitespace-nowrap">{a.asnNumber.slice(-8)}</td>
                  <td className="py-2 px-3 whitespace-nowrap max-w-44 truncate">{a.vendor}</td>
                  <td className="py-2 px-3 text-muted-foreground text-xs whitespace-nowrap">{a.carrierName}</td>
                  <td className="py-2 px-3 text-center font-mono text-xs">{a.dockCode ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <div className="text-xs font-mono tabular-nums">{fmtDateTime(a.scheduledArrival)}</div>
                    {isOpen && (
                      <div className={cn("text-[10px]", eta.tone === "ok" ? "text-muted-foreground" : eta.tone === "warn" ? "text-amber-400" : "text-red-400")}>{eta.text}</div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{a.totalLines}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{fmtNum(a.totalUnits)}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-1.5 w-16 shrink-0" />
                      <span className="text-[11px] font-mono tabular-nums w-8 text-right">{pct}%</span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-center gap-1">
                      {a.hazmat && <Flame className="h-3.5 w-3.5 text-red-400" />}
                      {a.temperatureRequired && <Thermometer className="h-3.5 w-3.5 text-cyan-400" />}
                      {a.discrepancies.some((d) => d.status === "OPEN") && <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                      {!a.hazmat && !a.temperatureRequired && !a.discrepancies.length && <span className="text-muted-foreground text-xs">—</span>}
                    </div>
                  </td>
                  <td className="py-2 px-3"><PriorityTag p={a.priority} /></td>
                  <td className="py-2 px-3"><AsnStatusBadge status={a.status} /></td>
                  <td className="py-2 px-2"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
                </tr>
              );
            })}
            {paged.length === 0 && (
              <tr><td colSpan={12} className="text-center py-12 text-sm text-muted-foreground">No ASNs match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 text-xs text-muted-foreground">
        <span className="font-mono">Showing {paged.length} of {filtered.length}</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</Button>
          <span className="px-3 font-mono tabular-nums">{page} / {total}</span>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page >= total} onClick={() => setPage(page + 1)}>Next ›</Button>
        </div>
      </div>
    </Section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  RECEIVING
// ════════════════════════════════════════════════════════════════════════════

function ReceiveLineRow({ asn, line }: { asn: ASN; line: AsnLine }) {
  const receiveLine = useInboundStore((s) => s.receiveLine);
  const [open, setOpen] = useState(false);
  const [good, setGood] = useState("");
  const [damaged, setDamaged] = useState("");
  const [lot, setLot] = useState(line.lotNumber ?? "");
  const [expiry, setExpiry] = useState(line.expiryDate ?? "");

  const remaining = Math.max(0, line.expectedQty - line.receivedQty);
  const pct = line.expectedQty > 0 ? Math.min(100, Math.round((line.receivedQty / line.expectedQty) * 100)) : 0;
  const done = ["RECEIVED", "OVER_RECEIPT", "REJECTED"].includes(line.status);

  const submit = () => {
    const g = parseInt(good) || 0;
    const d = parseInt(damaged) || 0;
    if (g + d <= 0) return;
    receiveLine(asn.id, line.id, g, { damagedQty: d, lotNumber: lot || null, expiryDate: expiry || null });
    setOpen(false); setGood(""); setDamaged("");
  };

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-primary">{line.skuCode}</span>
            <span className="text-xs text-muted-foreground truncate">{line.skuName}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
            <span>PO <span className="font-mono text-foreground">{line.poNumber}</span></span>
            <span>Lot <span className="font-mono text-foreground">{line.lotNumber ?? "—"}</span></span>
            {line.expiryDate && <span>Exp <span className="font-mono text-foreground">{line.expiryDate}</span></span>}
          </div>
        </div>
        <LineStatusTag status={line.status} />
      </div>

      <div className="grid grid-cols-4 gap-2 mt-3">
        <MiniStat label="Expected" value={`${line.expectedQty}`} />
        <MiniStat label="Received" value={`${line.receivedQty}`} tone="text-emerald-400" />
        <MiniStat label="Damaged" value={`${line.damagedQty}`} tone={line.damagedQty ? "text-red-400" : undefined} />
        <MiniStat label="Remaining" value={`${remaining}`} tone={remaining ? "text-amber-400" : "text-emerald-400"} />
      </div>

      <div className="flex items-center gap-2 mt-2">
        <Progress value={pct} className="h-1.5 flex-1" />
        <span className="text-[11px] font-mono tabular-nums w-9 text-right">{pct}%</span>
      </div>

      {!done && (
        open ? (
          <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty good ({line.uom})</span>
                <Input type="number" value={good} onChange={(e) => setGood(e.target.value)} placeholder={`${remaining}`} className="h-8 text-sm mt-1" />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty damaged</span>
                <Input type="number" value={damaged} onChange={(e) => setDamaged(e.target.value)} placeholder="0" className="h-8 text-sm mt-1" />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Lot / batch</span>
                <Input value={lot} onChange={(e) => setLot(e.target.value)} placeholder="LOT-…" className="h-8 text-sm mt-1 font-mono" />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Expiry date</span>
                <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="h-8 text-sm mt-1" />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={submit}><ScanLine className="h-3.5 w-3.5" /> Confirm receipt</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs mt-3 w-full" onClick={() => setOpen(true)}>
            Receive line
          </Button>
        )
      )}
    </div>
  );
}

function ReceivingView({ onOpenAsn }: { onOpenAsn: (a: ASN) => void }) {
  const worklist = useInboundStore((s) => s.receivingWorklist)();
  const updateAsnStatus = useInboundStore((s) => s.updateAsnStatus);
  const [activeId, setActiveId] = useState<string | null>(worklist[0]?.id ?? null);
  const active = worklist.find((a) => a.id === activeId) ?? worklist[0] ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
      {/* Worklist rail */}
      <Section title="Receiving Worklist" sub={`${worklist.length} trucks at the dock`} className="h-fit">
        <div className="divide-y divide-border/40 max-h-[70vh] overflow-y-auto">
          {worklist.length === 0 && <div className="text-center py-10 text-sm text-muted-foreground px-4">Nothing to receive. Assign a docked ASN to begin.</div>}
          {worklist.map((a) => {
            const pct = a.totalUnits > 0 ? Math.round((a.receivedUnits / a.totalUnits) * 100) : 0;
            return (
              <button
                key={a.id}
                onClick={() => setActiveId(a.id)}
                className={cn("w-full text-left px-4 py-3 transition-colors", active?.id === a.id ? "bg-accent/30" : "hover:bg-accent/15")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-primary">{a.asnNumber.slice(-8)}</span>
                  <PriorityTag p={a.priority} />
                </div>
                <div className="text-sm mt-1 truncate">{a.vendor}</div>
                <div className="text-[11px] text-muted-foreground">{a.dockCode ? `Dock ${a.dockCode}` : "No dock"}</div>
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={pct} className="h-1 flex-1" />
                  <span className="text-[10px] font-mono tabular-nums w-8 text-right">{pct}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Active ASN receipt detail */}
      {active ? (
        <Section
          title={`Receiving · ${active.asnNumber.slice(-8)}`}
          sub={`${active.vendor} · ${active.carrierName} · ${active.dockCode ? `Dock ${active.dockCode}` : "Unassigned"}`}
          actions={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOpenAsn(active)}>Full detail</Button>
              {active.status === "DOCKED" && <Button size="sm" className="h-7 text-xs gap-1" onClick={() => updateAsnStatus(active.id, "RECEIVING")}><ClipboardList className="h-3.5 w-3.5" /> Start</Button>}
              {/* Guarded on receivedUnits > 0 — without this, an ASN could be marked
                  "Received" (and thus eligible for Putaway) without a single unit ever
                  actually being received on any line, silently faking a 0%-received ASN. */}
              {["RECEIVING", "PARTIAL"].includes(active.status) && (
                <Button
                  size="sm" variant="outline" className="h-7 text-xs gap-1"
                  disabled={active.receivedUnits <= 0}
                  title={active.receivedUnits <= 0 ? "Receive at least one line before completing" : undefined}
                  onClick={() => updateAsnStatus(active.id, "RECEIVED")}
                ><CheckCircle2 className="h-3.5 w-3.5" /> Complete</Button>
              )}
            </div>
          }
        >
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <MiniStat label="Lines" value={`${active.totalLines}`} />
              <MiniStat label="Total units" value={fmtNum(active.totalUnits)} />
              <MiniStat label="Received" value={fmtNum(active.receivedUnits)} tone="text-emerald-400" />
              <MiniStat label="Pallets" value={`${active.palletCount}`} />
            </div>
            <div className="space-y-2 pt-1">
              {active.lines.map((l) => <ReceiveLineRow key={l.id} asn={active} line={l} />)}
            </div>
          </div>
        </Section>
      ) : (
        <Section title="Receiving" className="h-[400px]">
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <PackageCheck className="h-10 w-10 opacity-30" />
            <span className="text-sm">Select a truck from the worklist to start receiving.</span>
          </div>
        </Section>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  DOCKS & APPOINTMENTS
// ════════════════════════════════════════════════════════════════════════════

function DocksView({ onOpenAsn }: { onOpenAsn: (a: ASN) => void }) {
  const dockDoors = useInboundStore((s) => s.dockDoors);
  const asns = useInboundStore((s) => s.asns);
  const updateDockStatus = useInboundStore((s) => s.updateDockStatus);

  const appointments = useMemo(
    () => asns
      .filter((a) => ["PENDING", "SCHEDULED", "ARRIVED", "DOCKED"].includes(a.status))
      .sort((a, b) => a.scheduledArrival.localeCompare(b.scheduledArrival))
      .slice(0, 12),
    [asns],
  );

  return (
    <div className="space-y-5">
      <Section title="Dock Door Board" sub={`${dockDoors.length} inbound doors`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 p-4">
          {dockDoors.map((dock) => {
            const asn = dock.assignedAsnId ? asns.find((a) => a.id === dock.assignedAsnId) : null;
            return (
              <div key={dock.id} className={cn("rounded-lg border p-3 flex flex-col gap-1.5 min-h-[104px]", DOCK_STATUS_COLORS[dock.status])}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm font-mono">{dock.code}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider opacity-80">{dock.status}</span>
                </div>
                <span className="text-[9px] uppercase tracking-wide opacity-50">{dock.type}</span>
                {asn ? (
                  <button onClick={() => onOpenAsn(asn)} className="text-[11px] opacity-90 truncate text-left hover:underline">
                    {asn.asnNumber.slice(-6)} · {asn.vendor.split(" ")[0]}
                  </button>
                ) : <span className="text-[11px] opacity-40">— vacant —</span>}
                {dock.occupiedSince && <span className="text-[10px] opacity-60 font-mono">Since {fmtTime(dock.occupiedSince)}</span>}
                <div className="mt-auto pt-1">
                  {dock.status === "OCCUPIED" && <button onClick={() => updateDockStatus(dock.id, "AVAILABLE")} className="text-[10px] underline opacity-70 hover:opacity-100">Release</button>}
                  {dock.status === "AVAILABLE" && <button onClick={() => updateDockStatus(dock.id, "MAINTENANCE")} className="text-[10px] underline opacity-50 hover:opacity-100">Block</button>}
                  {dock.status === "MAINTENANCE" && <button onClick={() => updateDockStatus(dock.id, "AVAILABLE")} className="text-[10px] underline opacity-70 hover:opacity-100">Reopen</button>}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Appointment Schedule" sub="Upcoming inbound appointments, earliest first">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left font-semibold py-2.5 px-4">Window</th>
                <th className="text-left font-semibold py-2.5 px-3">ASN #</th>
                <th className="text-left font-semibold py-2.5 px-3">Vendor</th>
                <th className="text-left font-semibold py-2.5 px-3">Carrier</th>
                <th className="text-center font-semibold py-2.5 px-3">Dock</th>
                <th className="text-right font-semibold py-2.5 px-3">Pallets</th>
                <th className="text-left font-semibold py-2.5 px-3">Punctuality</th>
                <th className="text-left font-semibold py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {appointments.map((a) => {
                const eta = etaLabel(a.scheduledArrival);
                return (
                  <tr key={a.id} className="hover:bg-accent/20 cursor-pointer" onClick={() => onOpenAsn(a)}>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs whitespace-nowrap">{fmtDateTime(a.scheduledArrival)}</td>
                    <td className="py-2.5 px-3 font-mono text-primary text-xs">{a.asnNumber.slice(-8)}</td>
                    <td className="py-2.5 px-3 max-w-44 truncate">{a.vendor}</td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs">{a.carrierName}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-xs">{a.dockCode ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">{a.palletCount}</td>
                    <td className={cn("py-2.5 px-3 text-xs", eta.tone === "ok" ? "text-emerald-400" : eta.tone === "warn" ? "text-amber-400" : "text-red-400")}>{eta.text}</td>
                    <td className="py-2.5 px-3"><AsnStatusBadge status={a.status} /></td>
                  </tr>
                );
              })}
              {appointments.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-sm text-muted-foreground">No upcoming appointments.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  DISCREPANCIES
// ════════════════════════════════════════════════════════════════════════════

function DiscrepanciesView({ onOpenAsn }: { onOpenAsn: (a: ASN) => void }) {
  const all = useInboundStore((s) => s.allDiscrepancies)();
  const asns = useInboundStore((s) => s.asns);
  const resolveDiscrepancy = useInboundStore((s) => s.resolveDiscrepancy);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = all.filter((d) => statusFilter === "all" || d.status === statusFilter);
  const counts = {
    open: all.filter((d) => d.status === "OPEN").length,
    review: all.filter((d) => d.status === "UNDER_REVIEW").length,
    resolved: all.filter((d) => d.status === "RESOLVED").length,
    escalated: all.filter((d) => d.status === "ESCALATED").length,
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="OPEN" value={counts.open} tone="destructive" sub="awaiting action" />
        <KPICard label="UNDER REVIEW" value={counts.review} tone="warning" sub="being investigated" />
        <KPICard label="ESCALATED" value={counts.escalated} tone="warning" sub="vendor / QA" />
        <KPICard label="RESOLVED" value={counts.resolved} tone="success" sub="closed out" />
      </div>

      <Section
        title="Discrepancy Register"
        sub={`${filtered.length} records`}
        actions={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="UNDER_REVIEW">Under review</SelectItem>
              <SelectItem value="ESCALATED">Escalated</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <div className="divide-y divide-border/40">
          {filtered.map((d) => {
            const isOpen = d.status === "OPEN" || d.status === "UNDER_REVIEW";
            const asn = asns.find((a) => a.id === d.asnId);
            return (
              <div key={d.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0", isOpen ? "text-red-400" : "text-emerald-400")} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm capitalize">{d.type.replace(/_/g, " ").toLowerCase()}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold border",
                          d.status === "OPEN" ? "text-red-400 bg-red-500/10 border-red-500/30" :
                          d.status === "RESOLVED" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" :
                          d.status === "ESCALATED" ? "text-orange-400 bg-orange-500/10 border-orange-500/30" :
                          "text-amber-400 bg-amber-500/10 border-amber-500/30")}>
                          {d.status.replace(/_/g, " ")}
                        </span>
                        <button onClick={() => asn && onOpenAsn(asn)} className="font-mono text-xs text-primary hover:underline">{d.asnNumber.slice(-8)}</button>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        <span className="font-mono text-foreground">{d.skuCode}</span> · {d.skuName}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px] text-muted-foreground font-mono">
                        <span>Expected {d.expectedQty}</span>
                        <span>Actual {d.actualQty}</span>
                        <span className={d.variance < 0 ? "text-red-400" : "text-orange-400"}>Var {d.variance} ({d.variancePct}%)</span>
                        <span>by {d.reportedBy}</span>
                        <span>{fmtDateTime(d.reportedAt)}</span>
                      </div>
                      {d.resolution && <div className="text-[11px] text-emerald-400 mt-1">Resolution: {d.resolution}</div>}
                    </div>
                  </div>
                  {isOpen && (
                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => resolveDiscrepancy(d.asnId, d.id, "Current User", "Vendor credit issued; inventory adjusted")}>
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/40" />
              No discrepancies in this view.
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ASN DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════

function DetailRow({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-border/60 bg-card/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-sm font-medium mt-1 font-mono tabular-nums break-words">{value}</div>
    </div>
  );
}

function AsnDetailDrawer({ asnId, onClose }: { asnId: string | null; onClose: () => void }) {
  const asn = useInboundStore((s) => s.asns.find((a) => a.id === asnId)) ?? null;
  const updateAsnStatus = useInboundStore((s) => s.updateAsnStatus);
  const [tab, setTab] = useState("lines");

  if (!asn) return null;
  const pct = asn.totalUnits > 0 ? Math.round((asn.receivedUnits / asn.totalUnits) * 100) : 0;
  const openDisc = asn.discrepancies.filter((d) => d.status === "OPEN").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-primary">{asn.asnNumber}</span>
            <AsnStatusBadge status={asn.status} />
            <PriorityTag p={asn.priority} />
            {asn.hazmat && <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded"><Flame className="h-3 w-3" /> Hazmat</span>}
            {asn.temperatureRequired && <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded"><Thermometer className="h-3 w-3" /> Temp</span>}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{asn.vendor} · {asn.carrierName}</div>
        </div>
      </div>

      {/* Summary + progress */}
      <div className="p-5 border-b border-border space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <MiniStat label="Lines" value={`${asn.totalLines}`} />
          <MiniStat label="Units" value={fmtNum(asn.totalUnits)} />
          <MiniStat label="Received" value={fmtNum(asn.receivedUnits)} tone="text-emerald-400" />
          <MiniStat label="Dock" value={asn.dockCode ?? "—"} />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
            <span>Receiving progress</span><span className="font-mono">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
        {/* Workflow actions */}
        <div className="flex flex-wrap gap-2">
          {asn.status === "PENDING" && <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => updateAsnStatus(asn.id, "SCHEDULED")}><CalendarClock className="h-3.5 w-3.5" /> Schedule</Button>}
          {asn.status === "SCHEDULED" && <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => updateAsnStatus(asn.id, "ARRIVED")}><Truck className="h-3.5 w-3.5" /> Mark arrived</Button>}
          {asn.status === "ARRIVED" && <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => updateAsnStatus(asn.id, "DOCKED")}><Building2 className="h-3.5 w-3.5" /> Dock truck</Button>}
          {["DOCKED", "PARTIAL"].includes(asn.status) && <Button size="sm" className="h-8 text-xs gap-1" onClick={() => updateAsnStatus(asn.id, "RECEIVING")}><ClipboardList className="h-3.5 w-3.5" /> Start receiving</Button>}
          {asn.status === "RECEIVING" && (
            <Button
              size="sm" variant="outline" className="h-8 text-xs gap-1"
              disabled={asn.receivedUnits <= 0}
              title={asn.receivedUnits <= 0 ? "Receive at least one line (Receiving tab) before completing" : undefined}
              onClick={() => updateAsnStatus(asn.id, "RECEIVED")}
            ><CheckCircle2 className="h-3.5 w-3.5" /> Complete receipt</Button>
          )}
          {asn.status === "RECEIVED" && asn.receivedUnits > 0 && <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => updateAsnStatus(asn.id, "CLOSED")}>Close ASN</Button>}
          {/* Recovery path for ASNs that got marked Received before any line was
              actually received (possible before the Complete-receipt guard above
              existed) — lets them be reopened instead of being permanently stuck. */}
          {asn.status === "RECEIVED" && asn.receivedUnits <= 0 && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-amber-500/40 text-amber-400" onClick={() => updateAsnStatus(asn.id, "RECEIVING")}>
              <ClipboardList className="h-3.5 w-3.5" /> Reopen for receiving
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="mx-5 mt-3 w-fit">
          <TabsTrigger value="lines" className="text-xs">Lines · {asn.totalLines}</TabsTrigger>
          <TabsTrigger value="disc" className="text-xs">
            Discrepancies{openDisc > 0 && <span className="ml-1.5 bg-destructive text-destructive-foreground text-[9px] px-1 rounded-full">{openDisc}</span>}
          </TabsTrigger>
          <TabsTrigger value="info" className="text-xs">Shipment</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <TabsContent value="lines" className="mt-3 space-y-2">
            {asn.lines.map((l) => (
              <div key={l.id} className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-muted-foreground">#{l.lineNo}</span>
                      <span className="font-mono text-xs text-primary">{l.skuCode}</span>
                      <span className="text-xs text-muted-foreground truncate">{l.skuName}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px] text-muted-foreground font-mono">
                      <span>PO {l.poNumber}</span>
                      <span>Lot {l.lotNumber ?? "—"}</span>
                      {l.expiryDate && <span>Exp {l.expiryDate}</span>}
                      {l.putawayTaskId && <span className="text-cyan-400">{l.putawayTaskId}</span>}
                    </div>
                  </div>
                  <LineStatusTag status={l.status} />
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2.5 text-center">
                  {[["Exp", l.expectedQty, ""], ["Recv", l.receivedQty, "text-emerald-400"], ["Dmg", l.damagedQty, l.damagedQty ? "text-red-400" : ""], ["Rej", l.rejectedQty, l.rejectedQty ? "text-red-400" : ""]].map(([lbl, val, tone]) => (
                    <div key={lbl as string} className="rounded border border-border/60 bg-background/30 py-1.5">
                      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{lbl}</div>
                      <div className={cn("text-sm font-bold font-mono tabular-nums", tone as string)}>{val} <span className="text-[9px] text-muted-foreground font-normal">{lbl === "Exp" ? l.uom : ""}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="disc" className="mt-3 space-y-2">
            {asn.discrepancies.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/40" /> No discrepancies on this ASN.
              </div>
            ) : asn.discrepancies.map((d) => (
              <div key={d.id} className={cn("rounded-lg border p-3", d.status === "OPEN" ? "border-red-500/30 bg-red-500/5" : "border-emerald-500/30 bg-emerald-500/5")}>
                <div className="flex items-center gap-2">
                  <AlertCircle className={cn("h-3.5 w-3.5", d.status === "OPEN" ? "text-red-400" : "text-emerald-400")} />
                  <span className="font-semibold text-sm capitalize">{d.type.replace(/_/g, " ").toLowerCase()}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto font-mono">{fmtDateTime(d.reportedAt)}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 font-mono">{d.skuCode} · Exp {d.expectedQty} · Act {d.actualQty} · Var {d.variance} ({d.variancePct}%)</div>
                {d.notes && <div className="text-[11px] text-muted-foreground mt-1">{d.notes}</div>}
                {d.resolution && <div className="text-[11px] text-emerald-400 mt-1">Resolution: {d.resolution}</div>}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="info" className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              <DetailRow icon={Hash} label="ASN number" value={asn.asnNumber} />
              <DetailRow icon={Building2} label="Vendor code" value={asn.vendorCode} />
              <DetailRow icon={Truck} label="Truck / trailer" value={`${asn.truckNumber ?? "—"} / ${asn.trailerNumber ?? "—"}`} />
              <DetailRow icon={MapPin} label="Dock door" value={asn.dockCode ?? "Unassigned"} />
              <DetailRow icon={Layers} label="PO numbers" value={asn.poNumbers.join(", ")} />
              <DetailRow icon={Boxes} label="Pallets" value={asn.palletCount} />
              <DetailRow icon={Weight} label="Gross weight" value={`${fmtNum(asn.grossWeight)} kg`} />
              <DetailRow icon={CalendarClock} label="Scheduled" value={fmtDateTime(asn.scheduledArrival)} />
              <DetailRow icon={Clock} label="Actual arrival" value={asn.actualArrival ? fmtDateTime(asn.actualArrival) : "—"} />
              <DetailRow icon={CheckCircle2} label="Completed" value={asn.completedAt ? fmtDateTime(asn.completedAt) : "—"} />
              <DetailRow icon={User} label="Created by" value={asn.createdBy} />
              <DetailRow icon={TimerReset} label="Created" value={fmtDateTime(asn.createdAt)} />
            </div>
            {asn.notes && <div className="mt-3 rounded border border-border/60 bg-card/30 px-3 py-2 text-xs text-muted-foreground">{asn.notes}</div>}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  CREATE ASN MODAL
// ════════════════════════════════════════════════════════════════════════════

interface DraftLine { skuCode: string; skuName: string; uom: string; orderedQty: number; poNumber: string; }

function CreateAsnModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createAsn = useInboundStore((s) => s.createAsn);
  const addLine = useInboundStore((s) => s.addLine);
  const skus = useSkuStore((s) => s.skus);
  const [vendor, setVendor] = useState("");
  const [carrier, setCarrier] = useState("");
  const [po, setPo] = useState("");
  const [priority, setPriority] = useState<ASN["priority"]>("NORMAL");
  const [scheduled, setScheduled] = useState("");
  const [pallets, setPallets] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [draftSku, setDraftSku] = useState("");
  const [draftQty, setDraftQty] = useState("");

  const reset = () => {
    setVendor(""); setCarrier(""); setPo(""); setPriority("NORMAL"); setScheduled(""); setPallets("");
    setLines([]); setDraftSku(""); setDraftQty("");
  };
  const canSubmit = vendor.trim() && carrier.trim() && scheduled && lines.length > 0;

  const addDraftLine = () => {
    const sku = skus.find((s) => s.skuCode === draftSku);
    const qty = parseInt(draftQty);
    if (!sku || !qty || qty <= 0) return;
    setLines((prev) => [
      ...prev,
      { skuCode: sku.skuCode, skuName: sku.itemName, uom: sku.uom, orderedQty: qty, poNumber: po.split(",")[0]?.trim() || "—" },
    ]);
    setDraftSku(""); setDraftQty("");
  };
  const removeDraftLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const submit = () => {
    if (!canSubmit) return;
    const asn = createAsn({
      status: "PENDING",
      vendor: vendor.trim(),
      vendorCode: vendor.trim().slice(0, 4).toUpperCase(),
      poNumbers: po.split(",").map((p) => p.trim()).filter(Boolean),
      carrierName: carrier.trim(),
      truckNumber: null, trailerNumber: null, dockId: null, dockCode: null,
      scheduledArrival: new Date(scheduled).toISOString(),
      actualArrival: null, completedAt: null,
      priority, totalLines: 0, totalUnits: 0, receivedUnits: 0,
      notes: null, createdBy: "Current User", warehouseId: "TRILO-DC-01",
      temperatureRequired: false, hazmat: false,
      palletCount: parseInt(pallets) || 0, grossWeight: 0,
    });
    for (const l of lines) {
      addLine(asn.id, { skuCode: l.skuCode, skuName: l.skuName, poNumber: l.poNumber, orderedQty: l.orderedQty, uom: l.uom });
    }
    reset(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="text-base">Create Advance Shipping Notice</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-1">
          <label className="block col-span-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Vendor *</span>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Globex Industrial" className="h-9 mt-1 text-sm" />
          </label>
          <label className="block col-span-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Carrier *</span>
            <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="DHL Freight" className="h-9 mt-1 text-sm" />
          </label>
          <label className="block col-span-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">PO numbers (comma separated)</span>
            <Input value={po} onChange={(e) => setPo(e.target.value)} placeholder="PO-78001, PO-78002" className="h-9 mt-1 text-sm font-mono" />
          </label>
          <label className="block col-span-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Scheduled arrival *</span>
            <Input type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} className="h-9 mt-1 text-sm" />
          </label>
          <label className="block col-span-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Pallet count</span>
            <Input type="number" value={pallets} onChange={(e) => setPallets(e.target.value)} placeholder="0" className="h-9 mt-1 text-sm" />
          </label>
          <div className="block col-span-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Priority</span>
            <Select value={priority} onValueChange={(v) => setPriority(v as ASN["priority"])}>
              <SelectTrigger className="h-9 mt-1 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border-t border-border/60 pt-3">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Line items *</span>
          <div className="mt-1.5 space-y-2">
            <Select value={draftSku} onValueChange={setDraftSku}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select SKU" /></SelectTrigger>
              <SelectContent>
                {skus.map((s) => (
                  <SelectItem key={s.id} value={s.skuCode}>{s.skuCode} — {s.itemName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                type="number" value={draftQty} onChange={(e) => setDraftQty(e.target.value)}
                placeholder="Qty" className="h-9 flex-1 min-w-0 text-sm"
              />
              <Button type="button" variant="outline" className="h-9 shrink-0 gap-1.5 text-xs" onClick={addDraftLine} disabled={!draftSku || !draftQty}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>

          {lines.length > 0 && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center justify-between rounded border border-border/60 bg-card/30 px-2 py-1 text-xs">
                  <span className="font-mono">{l.skuCode}</span>
                  <span className="flex-1 truncate px-2 text-muted-foreground">{l.skuName}</span>
                  <span className="tabular-nums">{l.orderedQty} {l.uom}</span>
                  <button type="button" onClick={() => removeDraftLine(i)} className="ml-2 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {lines.length === 0 && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">Add at least one line item to create this ASN.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button disabled={!canSubmit} onClick={submit}>Create ASN</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

type Tab = "overview" | "queue" | "receiving" | "docks" | "discrepancies";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview",      label: "Overview",            icon: LayoutDashboard },
  { id: "queue",         label: "ASN Queue",           icon: ClipboardList },
  { id: "receiving",     label: "Receiving",           icon: PackageCheck },
  { id: "docks",         label: "Docks & Appointments", icon: CalendarClock },
  { id: "discrepancies", label: "Discrepancies",       icon: AlertTriangle },
];

export function InboundPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [openAsnId, setOpenAsnId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const kpis = useInboundStore((s) => s.kpis)();

  const openAsn = (a: ASN) => setOpenAsnId(a.id);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={ArrowDownToLine}
        title="Inbound"
        subtitle="ASN management · appointment scheduling · receiving · discrepancy resolution"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" /> New ASN</Button>
          </>
        }
      />

      {/* Sub-tab bar */}
      <div className="flex items-center gap-0 border-b border-border bg-sidebar shrink-0 px-2 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => {
          const badge = id === "discrepancies" && kpis.discrepancies > 0 ? kpis.discrepancies
            : id === "receiving" && kpis.dockedNow > 0 ? kpis.dockedNow : null;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {badge != null && (
                <span className={cn("ml-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded tabular-nums",
                  id === "discrepancies" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "overview"      && <OverviewView onOpenAsn={openAsn} />}
        {tab === "queue"         && <AsnQueueView onOpenAsn={openAsn} />}
        {tab === "receiving"     && <ReceivingView onOpenAsn={openAsn} />}
        {tab === "docks"         && <DocksView onOpenAsn={openAsn} />}
        {tab === "discrepancies" && <DiscrepanciesView onOpenAsn={openAsn} />}
      </div>

      {/* ASN detail drawer */}
      <Sheet open={!!openAsnId} onOpenChange={(o) => !o && setOpenAsnId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 overflow-hidden">
          <AsnDetailDrawer asnId={openAsnId} onClose={() => setOpenAsnId(null)} />
        </SheetContent>
      </Sheet>

      <CreateAsnModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
