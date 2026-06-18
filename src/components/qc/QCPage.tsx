/**
 * TriloWMS — Quality Control Module
 * Inbound/returns inspection, checkpoint capture, AQL sampling, disposition,
 * quarantine holds and inspector performance.
 */

import { useMemo, useState } from "react";
import {
  ShieldCheck, Search, X, ChevronRight, CheckCircle2, XCircle, AlertTriangle, Play,
  LayoutDashboard, ClipboardList, Lock, Users, Hash, User, MapPin, Boxes, Clock,
  FileDown, FlaskConical, Gauge, Layers, Microscope, Ban, ShieldAlert, MinusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  useQCStore, QC_STATUS_META,
  type QCInspection, type InspectionStatus, type QCHold, type DispositionType, type InspectionCheckpoint,
} from "@/lib/qc-store";
import { PageHeader, KPICard } from "@/components/wms/Primitives";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

// ─── Helpers & meta ───────────────────────────────────────────────────────────

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const initials = (name: string) => name.split(/[\s.]+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const TYPE_META: Record<QCInspection["type"], { label: string; color: string }> = {
  INBOUND:     { label: "Inbound",     color: "var(--color-info)" },
  PUTAWAY:     { label: "Putaway",     color: "var(--color-primary)" },
  CYCLE_COUNT: { label: "Cycle Count", color: "#a78bfa" },
  RETURNS:     { label: "Returns",     color: "var(--color-warning)" },
  OUTBOUND:    { label: "Outbound",    color: "var(--color-success)" },
  AD_HOC:      { label: "Ad-hoc",      color: "#fb923c" },
};

const DISPOSITION_META: Record<DispositionType, { label: string; cls: string }> = {
  ACCEPT:              { label: "Accept",            cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  REJECT:              { label: "Reject",            cls: "text-red-400 bg-red-500/10 border-red-500/30" },
  REWORK:              { label: "Rework",            cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  RETURN_TO_VENDOR:    { label: "Return to Vendor",  cls: "text-orange-400 bg-orange-500/10 border-orange-500/30" },
  SCRAP:               { label: "Scrap",             cls: "text-red-400 bg-red-500/10 border-red-500/30" },
  QUARANTINE:          { label: "Quarantine",        cls: "text-purple-400 bg-purple-500/10 border-purple-500/30" },
  CONDITIONAL_RELEASE: { label: "Conditional",       cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" },
};

const HOLD_TYPE_LABEL: Record<QCHold["type"], string> = {
  QC_HOLD: "QC Hold", VENDOR_HOLD: "Vendor Hold", RECALL_HOLD: "Recall", DAMAGE_HOLD: "Damage", EXPIRY_HOLD: "Expiry", REGULATORY_HOLD: "Regulatory",
};

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InspectionStatus }) {
  const m = QC_STATUS_META[status];
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wide", m.color, m.bg, m.border)}>{m.label}</span>;
}
function TypeTag({ t }: { t: QCInspection["type"] }) {
  const m = TYPE_META[t];
  return <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide border" style={{ color: m.color, borderColor: m.color + "55", background: m.color + "15" }}>{m.label}</span>;
}
function DispositionTag({ d }: { d: DispositionType }) {
  const m = DISPOSITION_META[d];
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold border tracking-wide", m.cls)}>{m.label}</span>;
}

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

function PassFailChart() {
  const data = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({
      hour: `${String((6 + i) % 24).padStart(2, "0")}:00`,
      passed: Math.floor(6 + Math.abs(Math.sin(i + 1)) * 14),
      failed: i % 3 === 0 ? Math.floor(1 + Math.random() * 3) : Math.floor(Math.random() * 2),
    })),
    [],
  );
  return (
    <Section title="Inspection Outcomes" sub="Passed vs failed — last 12 hours" className="lg:col-span-2 h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} interval={1} />
            <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={28} allowDecimals={false} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="passed" stackId="a" fill="var(--color-success)" name="Passed" />
            <Bar dataKey="failed" stackId="a" fill="var(--color-destructive)" radius={[3, 3, 0, 0]} name="Failed" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function TypeMixCard() {
  const mix = useQCStore((s) => s.typeMix)();
  const total = mix.reduce((s, m) => s + m.count, 0) || 1;
  return (
    <Section title="Inspection Types" sub="Inspections by trigger source" className="h-[240px]">
      <div className="p-4 space-y-2.5">
        {mix.map((m) => {
          const meta = TYPE_META[m.type];
          return (
            <div key={m.type}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: meta.color }} /> {meta.label}</span>
                <span className="font-mono tabular-nums text-muted-foreground">{m.count}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(m.count / total) * 100}%`, background: meta.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function StatusFunnelChart() {
  const funnel = useQCStore((s) => s.statusFunnel)();
  const data = funnel.map((f) => ({ status: QC_STATUS_META[f.status].label, count: f.count }));
  return (
    <Section title="Inspection Funnel" sub="Inspections by status" className="h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} allowDecimals={false} />
            <YAxis type="category" dataKey="status" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={86} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 3, 3, 0]} barSize={13} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function HoldAlerts() {
  const holds = useQCStore((s) => s.activeHolds)();
  return (
    <Section title="Active Holds" sub={`${holds.length} lots in quarantine / hold`} className="h-full">
      <div className="divide-y divide-border/40 overflow-y-auto max-h-[300px]">
        {holds.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2"><CheckCircle2 className="h-8 w-8 text-emerald-500/40" /><span className="text-sm">No active holds.</span></div>
        )}
        {holds.slice(0, 9).map((h) => (
          <div key={h.id} className="flex items-start gap-3 px-4 py-3">
            <Lock className={cn("h-4 w-4 shrink-0 mt-0.5", h.status === "ESCALATED" ? "text-orange-400" : "text-red-400")} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="font-mono text-xs text-primary">{h.skuCode}</span><span className="text-[10px] px-1 rounded bg-secondary text-muted-foreground">{HOLD_TYPE_LABEL[h.type]}</span></div>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{h.reason} · {h.quantity} units</div>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">{fmtTime(h.raisedAt)}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function OverviewView() {
  const kpis = useQCStore((s) => s.kpis)();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPICard label="PASS RATE" value={kpis.passRate} tone="success" sub="completed inspections" />
        <KPICard label="IN PROGRESS" value={kpis.inProgress} tone="warning" sub="being inspected" />
        <KPICard label="FAILED" value={kpis.failed} tone="destructive" sub="rejected lots" />
        <KPICard label="OPEN HOLDS" value={kpis.openHolds} tone="destructive" sub="quarantined" />
        <KPICard label="AVG DEFECT RATE" value={kpis.avgDefectRate} tone="info" sub="across samples" />
        <KPICard label="PENDING REVIEW" value={kpis.pendingReview} tone="warning" sub="awaiting QA" />
        <KPICard label="INSPECTORS ACTIVE" value={kpis.inspectorsActive} tone="primary" sub="on shift" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PassFailChart />
        <TypeMixCard />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <StatusFunnelChart />
        <HoldAlerts />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  INSPECTIONS
// ════════════════════════════════════════════════════════════════════════════

function InspectionsView({ onOpen }: { onOpen: (i: QCInspection) => void }) {
  const { filters, setFilters, resetFilters, page, setPage, pageSize } = useQCStore();
  const all = useQCStore((s) => s.filteredInspections)();
  const inspectors = useQCStore((s) => s.inspectorList)();

  const total = Math.max(1, Math.ceil(all.length / pageSize));
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const hasFilters = filters.search || filters.status || filters.type || filters.inspector;

  return (
    <Section title="Inspection Queue" sub={`${all.length} inspections matched`} actions={<Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><FileDown className="h-3.5 w-3.5" /> Export</Button>}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border/60">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search inspection or SKU…" value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as InspectionStatus })}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(QC_STATUS_META) as InspectionStatus[]).map((s) => <SelectItem key={s} value={s}>{QC_STATUS_META[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.type || "all"} onValueChange={(v) => setFilters({ type: v === "all" ? "" : v })}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(Object.keys(TYPE_META) as QCInspection["type"][]).map((t) => <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.inspector || "all"} onValueChange={(v) => setFilters({ inspector: v === "all" ? "" : v })}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Inspector" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All inspectors</SelectItem>
            {inspectors.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters ? <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs"><X className="h-3.5 w-3.5 mr-1" /> Clear</Button> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-semibold py-2.5 px-3">Inspection</th>
              <th className="text-left font-semibold py-2.5 px-3">Type</th>
              <th className="text-left font-semibold py-2.5 px-3">SKU</th>
              <th className="text-left font-semibold py-2.5 px-3">Lot</th>
              <th className="text-right font-semibold py-2.5 px-3">Sample</th>
              <th className="text-right font-semibold py-2.5 px-3">Defect %</th>
              <th className="text-left font-semibold py-2.5 px-3">AQL</th>
              <th className="text-left font-semibold py-2.5 px-3">Inspector</th>
              <th className="text-left font-semibold py-2.5 px-3">Disposition</th>
              <th className="text-left font-semibold py-2.5 px-3">Status</th>
              <th className="py-2.5 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paged.map((i) => (
              <tr key={i.id} className="hover:bg-accent/20 cursor-pointer transition-colors" onClick={() => onOpen(i)}>
                <td className="py-2 px-3 font-mono text-primary text-xs whitespace-nowrap">{i.inspectionNumber}</td>
                <td className="py-2 px-3"><TypeTag t={i.type} /></td>
                <td className="py-2 px-3">
                  <div className="text-xs font-mono text-primary">{i.skuCode}</div>
                  <div className="text-[11px] text-muted-foreground truncate max-w-40">{i.skuName}</div>
                </td>
                <td className="py-2 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{i.lotNumber ?? "—"}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{i.sampleSize}</td>
                <td className={cn("py-2 px-3 text-right font-mono tabular-nums text-xs", i.defectRate > 5 ? "text-red-400" : i.defectRate > 0 ? "text-amber-400" : "text-emerald-400")}>{i.defectRate}%</td>
                <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{i.aqlLevel.replace("AQL_", "AQL ").replace("_", ".").replace("100_PCT", "100%")}</td>
                <td className="py-2 px-3 text-xs whitespace-nowrap">{i.inspectorName}</td>
                <td className="py-2 px-3">{i.disposition ? <DispositionTag d={i.disposition} /> : <span className="text-muted-foreground text-xs">—</span>}</td>
                <td className="py-2 px-3"><StatusBadge status={i.status} /></td>
                <td className="py-2 px-2"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
              </tr>
            ))}
            {paged.length === 0 && <tr><td colSpan={11} className="text-center py-12 text-sm text-muted-foreground">No inspections match the current filters.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 text-xs text-muted-foreground">
        <span className="font-mono">Showing {paged.length} of {all.length}</span>
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
//  HOLDS
// ════════════════════════════════════════════════════════════════════════════

function HoldsView() {
  const holds = useQCStore((s) => s.holds);
  const resolveHold = useQCStore((s) => s.resolveHold);
  const [filter, setFilter] = useState("all");
  const filtered = holds.filter((h) => filter === "all" || h.status === filter).sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));

  const counts = {
    active: holds.filter((h) => h.status === "ACTIVE").length,
    escalated: holds.filter((h) => h.status === "ESCALATED").length,
    resolved: holds.filter((h) => h.status === "RESOLVED").length,
    units: holds.filter((h) => h.status !== "RESOLVED").reduce((s, h) => s + h.quantity, 0),
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="ACTIVE HOLDS" value={counts.active} tone="destructive" sub="quarantined" />
        <KPICard label="ESCALATED" value={counts.escalated} tone="warning" sub="QA / vendor" />
        <KPICard label="RESOLVED" value={counts.resolved} tone="success" sub="dispositioned" />
        <KPICard label="UNITS HELD" value={counts.units} tone="info" sub="awaiting decision" />
      </div>

      <Section
        title="Hold & Quarantine Register"
        sub={`${filtered.length} records`}
        actions={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="ESCALATED">Escalated</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <div className="divide-y divide-border/40">
          {filtered.map((h) => {
            const open = h.status !== "RESOLVED";
            return (
              <div key={h.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <Lock className={cn("h-4 w-4 mt-0.5 shrink-0", h.status === "ESCALATED" ? "text-orange-400" : open ? "text-red-400" : "text-emerald-400")} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-primary">{h.holdNumber}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-semibold">{HOLD_TYPE_LABEL[h.type]}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold border",
                          h.status === "ACTIVE" ? "text-red-400 bg-red-500/10 border-red-500/30" :
                          h.status === "ESCALATED" ? "text-orange-400 bg-orange-500/10 border-orange-500/30" :
                          "text-emerald-400 bg-emerald-500/10 border-emerald-500/30")}>{titleCase(h.status)}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1"><span className="font-mono text-foreground">{h.skuCode}</span> · {h.skuName}</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px] text-muted-foreground font-mono">
                        <span>{h.quantity} units</span>
                        <span>Lot {h.lotNumber ?? "—"}</span>
                        <span>Bin {h.binCode ?? "—"}</span>
                        <span>by {h.raisedBy}</span>
                        <span>{fmtDateTime(h.raisedAt)}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">{h.reason}</div>
                      {h.resolution && <div className="text-[11px] text-emerald-400 mt-0.5">Disposition: {DISPOSITION_META[h.resolution].label}{h.resolvedBy ? ` · ${h.resolvedBy}` : ""}</div>}
                    </div>
                  </div>
                  {open && (
                    <Select onValueChange={(v) => resolveHold(h.id, "Current User", v as DispositionType, "Dispositioned from QC desk")}>
                      <SelectTrigger className="w-32 h-7 text-xs shrink-0"><SelectValue placeholder="Disposition" /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(DISPOSITION_META) as DispositionType[]).map((d) => <SelectItem key={d} value={d}>{DISPOSITION_META[d].label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="text-center py-12 text-sm text-muted-foreground"><CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/40" />No holds in this view.</div>}
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  INSPECTORS
// ════════════════════════════════════════════════════════════════════════════

function InspectorsView() {
  const workload = useQCStore((s) => s.inspectorWorkload)();
  const maxTotal = Math.max(1, ...workload.map((w) => w.total));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="INSPECTORS" value={workload.length} tone="primary" sub="on roster" />
        <KPICard label="TOTAL INSPECTIONS" value={workload.reduce((s, w) => s + w.total, 0)} tone="info" sub="all-time" />
        <KPICard label="IN PROGRESS" value={workload.reduce((s, w) => s + w.inProgress, 0)} tone="warning" sub="active now" />
        <KPICard label="AVG PASS RATE" value={`${Math.round(workload.reduce((s, w) => s + w.passRate, 0) / (workload.length || 1))}%`} tone="success" sub="quality" />
      </div>
      <Section title="Inspector Performance" sub="Throughput and pass rate by inspector">
        <div className="divide-y divide-border/40">
          {workload.map((w) => (
            <div key={w.id} className="flex items-center gap-4 px-4 py-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shrink-0">{initials(w.name)}</div>
              <div className="w-36 shrink-0 min-w-0">
                <div className="text-sm font-medium truncate">{w.name}</div>
                <div className="text-[11px] text-muted-foreground">{w.inProgress > 0 ? `${w.inProgress} in progress` : "idle"}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex h-2 w-full rounded-full overflow-hidden bg-secondary">
                  <div className="bg-emerald-500" style={{ width: `${(w.passed / maxTotal) * 100}%` }} />
                  <div className="bg-red-500" style={{ width: `${(w.failed / maxTotal) * 100}%` }} />
                  <div className="bg-amber-500" style={{ width: `${(w.inProgress / maxTotal) * 100}%` }} />
                </div>
                <div className="flex gap-4 mt-1.5 text-[11px]">
                  <span className="text-emerald-400">Passed {w.passed}</span>
                  <span className="text-red-400">Failed {w.failed}</span>
                  <span className="text-amber-400">Active {w.inProgress}</span>
                </div>
              </div>
              <div className="text-right shrink-0 w-16">
                <div className={cn("text-lg font-bold font-mono tabular-nums", w.passRate >= 95 ? "text-emerald-400" : w.passRate >= 85 ? "text-amber-400" : "text-red-400")}>{w.passRate}%</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">pass</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  INSPECTION DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════

function CheckpointRow({ inspId, cp, editable }: { inspId: string; cp: InspectionCheckpoint; editable: boolean }) {
  const updateCheckpoint = useQCStore((s) => s.updateCheckpoint);
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{cp.name}</span>
            {cp.mandatory && <span className="text-[9px] text-red-400 bg-red-500/10 px-1 rounded">required</span>}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{cp.description}</p>
          <div className="flex flex-wrap gap-x-4 mt-1 text-[11px] text-muted-foreground font-mono">
            {cp.tolerance && <span>Tol {cp.tolerance}</span>}
            {cp.value && <span>Reading {cp.value}</span>}
          </div>
        </div>
        {!editable && cp.result && (
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold border shrink-0",
            cp.result === "PASS" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" :
            cp.result === "FAIL" ? "text-red-400 bg-red-500/10 border-red-500/30" :
            "text-slate-400 bg-slate-500/10 border-slate-500/30")}>{cp.result}</span>
        )}
      </div>
      {editable && (
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant={cp.result === "PASS" ? "default" : "outline"} className="h-7 text-xs flex-1 gap-1" onClick={() => updateCheckpoint(inspId, cp.id, "PASS")}><CheckCircle2 className="h-3 w-3" /> Pass</Button>
          <Button size="sm" variant={cp.result === "FAIL" ? "destructive" : "outline"} className="h-7 text-xs flex-1 gap-1" onClick={() => updateCheckpoint(inspId, cp.id, "FAIL")}><XCircle className="h-3 w-3" /> Fail</Button>
          <Button size="sm" variant={cp.result === "N/A" ? "secondary" : "outline"} className="h-7 text-xs gap-1" onClick={() => updateCheckpoint(inspId, cp.id, "N/A")}><MinusCircle className="h-3 w-3" /> N/A</Button>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-border/60 bg-card/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide"><Icon className="h-3 w-3" /> {label}</div>
      <div className="text-sm font-medium mt-1 font-mono tabular-nums break-words">{value}</div>
    </div>
  );
}

function InspectionDrawer({ inspId, onClose }: { inspId: string | null; onClose: () => void }) {
  const insp = useQCStore((s) => s.inspections.find((i) => i.id === inspId)) ?? null;
  const { startInspection, completeInspection } = useQCStore();
  const [tab, setTab] = useState("checks");
  const [disposition, setDisposition] = useState<DispositionType>("ACCEPT");
  const [findings, setFindings] = useState("");

  if (!insp) return null;
  const editable = insp.status === "IN_PROGRESS";
  const done = ["PASSED", "FAILED", "CONDITIONAL_PASS", "DISPOSED"].includes(insp.status);
  const checkedCount = insp.checkpoints.filter((c) => c.result !== null).length;
  const cpProgress = insp.checkpoints.length > 0 ? Math.round((checkedCount / insp.checkpoints.length) * 100) : 0;
  const allMandatoryDone = insp.checkpoints.filter((c) => c.mandatory).every((c) => c.result !== null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-primary">{insp.inspectionNumber}</span>
            <StatusBadge status={insp.status} />
            <TypeTag t={insp.type} />
            {insp.disposition && <DispositionTag d={insp.disposition} />}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{insp.skuCode} · {insp.skuName}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0"><X className="h-4 w-4" /></Button>
      </div>

      <div className="p-5 border-b border-border space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <MiniStat label="Sample" value={`${insp.sampleSize}`} />
          <MiniStat label="Passed" value={`${insp.passedQty}`} tone="text-emerald-400" />
          <MiniStat label="Failed" value={`${insp.failedQty}`} tone={insp.failedQty ? "text-red-400" : undefined} />
          <MiniStat label="Defect" value={`${insp.defectRate}%`} tone={insp.defectRate > 5 ? "text-red-400" : undefined} />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1"><span>Checkpoints completed</span><span className="font-mono">{checkedCount}/{insp.checkpoints.length}</span></div>
          <Progress value={cpProgress} className="h-2" />
        </div>
        {insp.status === "QUEUED" && <Button size="sm" className="h-8 text-xs gap-1 w-full" onClick={() => startInspection(insp.id)}><Play className="h-3.5 w-3.5" /> Start inspection</Button>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="mx-5 mt-3 w-fit">
          <TabsTrigger value="checks" className="text-xs">Checkpoints · {insp.checkpoints.length}</TabsTrigger>
          <TabsTrigger value="info" className="text-xs">Details</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <TabsContent value="checks" className="mt-3 space-y-2">
            {insp.checkpoints.map((cp) => <CheckpointRow key={cp.id} inspId={insp.id} cp={cp} editable={editable} />)}

            {editable && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 mt-3">
                <div className="text-sm font-semibold">Complete & disposition</div>
                <Select value={disposition} onValueChange={(v) => setDisposition(v as DispositionType)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(DISPOSITION_META) as DispositionType[]).map((d) => <SelectItem key={d} value={d}>{DISPOSITION_META[d].label}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Findings / notes…" value={findings} onChange={(e) => setFindings(e.target.value)} className="h-8 text-sm" />
                <Button size="sm" className="h-8 text-xs w-full gap-1" disabled={!allMandatoryDone} onClick={() => { completeInspection(insp.id, disposition, findings || "Inspection completed"); onClose(); }}>
                  <ShieldCheck className="h-3.5 w-3.5" /> {allMandatoryDone ? "Submit disposition" : "Complete required checks first"}
                </Button>
              </div>
            )}

            {insp.findings && !editable && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 mt-2">
                <div className="text-[10px] uppercase tracking-wide text-amber-400 mb-1">Findings</div>
                <p className="text-xs text-muted-foreground">{insp.findings}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="info" className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              <DetailRow icon={Hash} label="Inspection" value={insp.inspectionNumber} />
              <DetailRow icon={FlaskConical} label="AQL plan" value={insp.aqlLevel.replace("_", " ")} />
              <DetailRow icon={Layers} label="Lot" value={insp.lotNumber ?? "—"} />
              <DetailRow icon={Layers} label="Batch" value={insp.batchNumber ?? "—"} />
              <DetailRow icon={Clock} label="Expiry" value={insp.expiryDate ?? "—"} />
              <DetailRow icon={MapPin} label="Bin" value={insp.binCode ?? "—"} />
              <DetailRow icon={Hash} label="Source ref" value={insp.sourceRef ?? "—"} />
              <DetailRow icon={User} label="Inspector" value={insp.inspectorName} />
              <DetailRow icon={Clock} label="Started" value={insp.startedAt ? fmtDateTime(insp.startedAt) : "—"} />
              <DetailRow icon={CheckCircle2} label="Completed" value={insp.completedAt ? fmtDateTime(insp.completedAt) : "—"} />
              <DetailRow icon={User} label="Reviewed by" value={insp.reviewedBy ?? "—"} />
              <DetailRow icon={Boxes} label="Inspected qty" value={`${insp.inspectedQty}`} />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

type Tab = "overview" | "inspections" | "holds" | "inspectors";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview",    label: "Overview",    icon: LayoutDashboard },
  { id: "inspections", label: "Inspections", icon: ClipboardList },
  { id: "holds",       label: "Holds",       icon: Lock },
  { id: "inspectors",  label: "Inspectors",  icon: Users },
];

export function QCPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [openId, setOpenId] = useState<string | null>(null);
  const kpis = useQCStore((s) => s.kpis)();

  const open = (i: QCInspection) => setOpenId(i.id);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={ShieldCheck}
        title="Quality Control"
        subtitle="Inspection · AQL sampling · disposition · quarantine holds · inspector QA"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"><Microscope className="h-3.5 w-3.5" /> New inspection</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Raise hold</Button>
          </>
        }
      />

      <div className="flex items-center gap-0 border-b border-border bg-sidebar shrink-0 px-2 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => {
          const badge = id === "holds" && kpis.openHolds > 0 ? kpis.openHolds : id === "inspections" && kpis.inProgress > 0 ? kpis.inProgress : null;
          return (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border")}>
              <Icon className="h-4 w-4" />
              {label}
              {badge != null && <span className={cn("ml-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded tabular-nums", id === "holds" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}>{badge}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "overview"    && <OverviewView />}
        {tab === "inspections" && <InspectionsView onOpen={open} />}
        {tab === "holds"       && <HoldsView />}
        {tab === "inspectors"  && <InspectorsView />}
      </div>

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 overflow-hidden">
          <InspectionDrawer inspId={openId} onClose={() => setOpenId(null)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
