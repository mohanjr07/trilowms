/**
 * TriloWMS — Returns (RMA) Module
 * Reverse logistics: RMA intake & approval, return receipt, line inspection &
 * disposition, restock/scrap routing, credit memos and reason analytics.
 */

import { useMemo, useState } from "react";
import {
  Undo2, Search, X, ChevronRight, CheckCircle2, XCircle, AlertTriangle, LayoutDashboard,
  ClipboardList, PackageCheck, Recycle, Hash, User, MapPin, Boxes, Clock, FileDown,
  DollarSign, Microscope, RotateCcw, Trash2, Wrench, Building2, Layers, BadgeCheck, Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  useReturnsStore, RMA_STATUS_META,
  type RMA, type RmaStatus, type RmaLine, type ReturnReason, type DispositionType,
} from "@/lib/returns-store";
import { PageHeader, KPICard } from "@/components/wms/Primitives";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

// ─── Helpers & meta ───────────────────────────────────────────────────────────

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" });
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const PRIORITY_META: Record<RMA["priority"], { label: string; cls: string }> = {
  URGENT: { label: "Urgent", cls: "text-red-400 bg-red-500/10" },
  HIGH:   { label: "High",   cls: "text-orange-400 bg-orange-500/10" },
  NORMAL: { label: "Normal", cls: "text-slate-400 bg-slate-500/10" },
};

const REASON_META: Record<ReturnReason, { label: string; color: string }> = {
  DAMAGED_IN_TRANSIT:   { label: "Damaged in Transit", color: "var(--color-destructive)" },
  WRONG_ITEM:           { label: "Wrong Item",         color: "var(--color-warning)" },
  QUALITY_DEFECT:       { label: "Quality Defect",     color: "#fb923c" },
  CUSTOMER_CHANGE_MIND: { label: "Changed Mind",       color: "var(--color-info)" },
  OVERSHIPMENT:         { label: "Overshipment",       color: "#a78bfa" },
  EXPIRED:              { label: "Expired",            color: "#f472b6" },
  WARRANTY_CLAIM:       { label: "Warranty Claim",     color: "var(--color-primary)" },
  VENDOR_RECALL:        { label: "Vendor Recall",      color: "var(--color-success)" },
};

const DISPOSITION_META: Record<DispositionType, { label: string; cls: string; icon: typeof RotateCcw }> = {
  RESTOCK:          { label: "Restock",        cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: RotateCcw },
  REPAIR:           { label: "Repair",         cls: "text-amber-400 bg-amber-500/10 border-amber-500/30",       icon: Wrench },
  SCRAP:            { label: "Scrap",          cls: "text-red-400 bg-red-500/10 border-red-500/30",             icon: Trash2 },
  RETURN_TO_VENDOR: { label: "Return Vendor",  cls: "text-orange-400 bg-orange-500/10 border-orange-500/30",    icon: Truck },
  DONATE:           { label: "Donate",         cls: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",          icon: BadgeCheck },
  QUARANTINE:       { label: "Quarantine",     cls: "text-purple-400 bg-purple-500/10 border-purple-500/30",    icon: AlertTriangle },
  PENDING_REVIEW:   { label: "Pending Review", cls: "text-slate-400 bg-slate-500/10 border-slate-500/30",       icon: Clock },
};

const CONDITION_META: Record<NonNullable<RmaLine["condition"]>, string> = {
  NEW: "text-emerald-400", OPENED: "text-blue-400", DAMAGED: "text-red-400", DEFECTIVE: "text-orange-400", EXPIRED: "text-purple-400",
};

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RmaStatus }) {
  const m = RMA_STATUS_META[status];
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wide", m.color, m.bg, m.border)}>{m.label}</span>;
}
function PriorityTag({ p }: { p: RMA["priority"] }) {
  const m = PRIORITY_META[p];
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide", m.cls)}>{m.label}</span>;
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

function ReturnsTrendChart() {
  const data = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({
      day: `D${i + 1}`,
      received: Math.floor(3 + Math.abs(Math.sin(i + 1)) * 11),
      processed: Math.floor(2 + Math.abs(Math.cos(i)) * 9),
    })),
    [],
  );
  return (
    <Section title="Returns Trend" sub="Received vs processed — last 14 days" className="lg:col-span-2 h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} />
            <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={28} allowDecimals={false} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="received" fill="var(--color-info)" radius={[3, 3, 0, 0]} name="Received" />
            <Bar dataKey="processed" fill="var(--color-primary)" radius={[3, 3, 0, 0]} name="Processed" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function ReasonMixCard() {
  const mix = useReturnsStore((s) => s.reasonMix)();
  const total = mix.reduce((s, m) => s + m.count, 0) || 1;
  return (
    <Section title="Return Reasons" sub="Lines by reason code" className="h-[240px]">
      <div className="p-4 space-y-2 overflow-y-auto max-h-[200px]">
        {mix.map((m) => {
          const meta = REASON_META[m.reason];
          return (
            <div key={m.reason}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 truncate"><span className="h-2 w-2 rounded-sm shrink-0" style={{ background: meta.color }} /> {meta.label}</span>
                <span className="font-mono tabular-nums text-muted-foreground shrink-0">{m.count}</span>
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

function DispositionMixChart() {
  const mix = useReturnsStore((s) => s.dispositionMix)();
  const data = mix.map((m) => ({ name: DISPOSITION_META[m.disposition].label, count: m.count }));
  return (
    <Section title="Disposition Outcomes" sub="Inspected lines by disposition" className="h-[240px]">
      <div className="h-[190px] px-2 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" tick={{ fontSize: 9 }} width={86} />
            <Tooltip cursor={{ fill: "var(--color-accent)", opacity: 0.08 }} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 11 }} />
            <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 3, 3, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function InspectionAlerts({ onOpen }: { onOpen: (r: RMA) => void }) {
  const worklist = useReturnsStore((s) => s.inspectionWorklist)();
  return (
    <Section title="Awaiting Inspection" sub={`${worklist.length} returns received & queued`} className="h-full">
      <div className="divide-y divide-border/40 overflow-y-auto max-h-[300px]">
        {worklist.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2"><CheckCircle2 className="h-8 w-8 text-emerald-500/40" /><span className="text-sm">Inspection queue is clear.</span></div>
        )}
        {worklist.slice(0, 9).map((r) => (
          <button key={r.id} onClick={() => onOpen(r)} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-accent/20">
            <Microscope className="h-4 w-4 text-amber-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="font-mono text-xs text-primary">{r.rmaNumber}</span><span className="text-xs text-muted-foreground truncate">{r.customer}</span></div>
              <div className="text-[11px] text-muted-foreground">{r.totalLines} lines · {r.totalReceivedQty} units</div>
            </div>
            <PriorityTag p={r.priority} />
          </button>
        ))}
      </div>
    </Section>
  );
}

function OverviewView({ onOpen }: { onOpen: (r: RMA) => void }) {
  const kpis = useReturnsStore((s) => s.kpis)();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPICard label="OPEN RMAs" value={kpis.openRmas} tone="primary" sub="in progress" />
        <KPICard label="RECEIVED" value={kpis.received} tone="info" sub="at dock" />
        <KPICard label="RESTOCKED" value={kpis.restocked} tone="success" sub="lines back to stock" />
        <KPICard label="SCRAPPED" value={kpis.scrapped} tone="destructive" sub="lines disposed" />
        <KPICard label="CREDIT PENDING" value={kpis.creditPending} tone="warning" sub="to be issued" />
        <KPICard label="AVG CYCLE" value={kpis.avgProcessingDays} tone="info" sub="request to close" />
        <KPICard label="TO INSPECT" value={kpis.pendingInspection} tone="warning" sub="queued" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ReturnsTrendChart />
        <ReasonMixCard />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DispositionMixChart />
        <InspectionAlerts onOpen={onOpen} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  RMA QUEUE
// ════════════════════════════════════════════════════════════════════════════

function RmaQueueView({ onOpen }: { onOpen: (r: RMA) => void }) {
  const { filters, setFilters, resetFilters, page, setPage, pageSize } = useReturnsStore();
  const all = useReturnsStore((s) => s.filteredRmas)();
  const customers = useReturnsStore((s) => s.customerList)();

  const total = Math.max(1, Math.ceil(all.length / pageSize));
  const paged = all.slice((page - 1) * pageSize, page * pageSize);
  const hasFilters = filters.search || filters.status || filters.customer || filters.priority;

  return (
    <Section title="RMA Queue" sub={`${all.length} return authorizations matched`} actions={<Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><FileDown className="h-3.5 w-3.5" /> Export</Button>}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border/60">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search RMA, customer or order…" value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ status: v === "all" ? "" : v as RmaStatus })}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(RMA_STATUS_META) as RmaStatus[]).map((s) => <SelectItem key={s} value={s}>{RMA_STATUS_META[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.customer || "all"} onValueChange={(v) => setFilters({ customer: v === "all" ? "" : v })}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Customer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            {customers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.priority || "all"} onValueChange={(v) => setFilters({ priority: v === "all" ? "" : v })}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priority</SelectItem>
            {(Object.keys(PRIORITY_META) as RMA["priority"][]).map((p) => <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters ? <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs"><X className="h-3.5 w-3.5 mr-1" /> Clear</Button> : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-semibold py-2.5 px-3">RMA #</th>
              <th className="text-left font-semibold py-2.5 px-3">Customer</th>
              <th className="text-left font-semibold py-2.5 px-3">Order</th>
              <th className="text-right font-semibold py-2.5 px-3">Lines</th>
              <th className="text-right font-semibold py-2.5 px-3">Return</th>
              <th className="text-right font-semibold py-2.5 px-3">Recvd</th>
              <th className="text-right font-semibold py-2.5 px-3">Credit</th>
              <th className="text-left font-semibold py-2.5 px-3">Requested</th>
              <th className="text-left font-semibold py-2.5 px-3">Priority</th>
              <th className="text-left font-semibold py-2.5 px-3">Status</th>
              <th className="py-2.5 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paged.map((r) => (
              <tr key={r.id} className="hover:bg-accent/20 cursor-pointer transition-colors" onClick={() => onOpen(r)}>
                <td className="py-2 px-3 font-mono text-primary text-xs whitespace-nowrap">{r.rmaNumber}</td>
                <td className="py-2 px-3 whitespace-nowrap max-w-40 truncate">{r.customer}</td>
                <td className="py-2 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{r.orderId}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{r.totalLines}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{r.totalReturnQty}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-xs text-emerald-400">{r.totalReceivedQty}</td>
                <td className={cn("py-2 px-3 text-right font-mono tabular-nums text-xs", r.totalCreditAmount > 0 ? "text-amber-400" : "text-muted-foreground")}>{r.totalCreditAmount > 0 ? money(r.totalCreditAmount) : "—"}</td>
                <td className="py-2 px-3 text-xs font-mono tabular-nums whitespace-nowrap">{fmtDate(r.requestedAt)}</td>
                <td className="py-2 px-3"><PriorityTag p={r.priority} /></td>
                <td className="py-2 px-3"><StatusBadge status={r.status} /></td>
                <td className="py-2 px-2"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
              </tr>
            ))}
            {paged.length === 0 && <tr><td colSpan={11} className="text-center py-12 text-sm text-muted-foreground">No RMAs match the current filters.</td></tr>}
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
//  INSPECTION
// ════════════════════════════════════════════════════════════════════════════

function InspectLineRow({ rmaId, line }: { rmaId: string; line: RmaLine }) {
  const inspectLine = useReturnsStore((s) => s.inspectLine);
  const [open, setOpen] = useState(false);
  const [condition, setCondition] = useState<NonNullable<RmaLine["condition"]>>("OPENED");
  const [disposition, setDisposition] = useState<DispositionType>("RESTOCK");
  const [notes, setNotes] = useState("");
  const done = line.status === "INSPECTED" || line.status === "DISPOSED";

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-muted-foreground">#{line.lineNo}</span>
            <span className="font-mono text-xs text-primary">{line.skuCode}</span>
            <span className="text-xs text-muted-foreground truncate">{line.skuName}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px] text-muted-foreground font-mono">
            <span>Qty {line.receivedQty} {line.uom}</span>
            <span>Reason {REASON_META[line.reason].label}</span>
            <span>Lot {line.lotNumber ?? "—"}</span>
            {line.condition && <span className={CONDITION_META[line.condition]}>{titleCase(line.condition)}</span>}
          </div>
        </div>
        {done ? (line.disposition && <DispositionTag d={line.disposition} />) : <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">Pending</span>}
      </div>

      {!done && (
        open ? (
          <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Condition</span>
                <Select value={condition} onValueChange={(v) => setCondition(v as NonNullable<RmaLine["condition"]>)}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(CONDITION_META) as NonNullable<RmaLine["condition"]>[]).map((c) => <SelectItem key={c} value={c}>{titleCase(c)}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Disposition</span>
                <Select value={disposition} onValueChange={(v) => setDisposition(v as DispositionType)}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(DISPOSITION_META) as DispositionType[]).map((d) => <SelectItem key={d} value={d}>{DISPOSITION_META[d].label}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            </div>
            <Input placeholder="Inspection notes…" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-8 text-sm" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { inspectLine(rmaId, line.id, condition, disposition, notes || undefined); setOpen(false); }}><CheckCircle2 className="h-3.5 w-3.5" /> Confirm disposition</Button>
            </div>
          </div>
        ) : <Button size="sm" variant="outline" className="h-7 text-xs mt-3 w-full" onClick={() => setOpen(true)}>Inspect line</Button>
      )}
    </div>
  );
}

function InspectionView({ onOpen }: { onOpen: (r: RMA) => void }) {
  const worklist = useReturnsStore((s) => s.inspectionWorklist)();
  const completeRma = useReturnsStore((s) => s.completeRma);
  const [activeId, setActiveId] = useState<string | null>(worklist[0]?.id ?? null);
  const active = worklist.find((r) => r.id === activeId) ?? worklist[0] ?? null;
  const allInspected = active?.lines.every((l) => l.status === "INSPECTED" || l.status === "DISPOSED");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
      <Section title="Inspection Worklist" sub={`${worklist.length} returns to inspect`} className="h-fit">
        <div className="divide-y divide-border/40 max-h-[70vh] overflow-y-auto">
          {worklist.length === 0 && <div className="text-center py-10 text-sm text-muted-foreground px-4">Nothing to inspect. Receive a return to begin.</div>}
          {worklist.map((r) => {
            const inspected = r.lines.filter((l) => l.status === "INSPECTED" || l.status === "DISPOSED").length;
            const pct = r.lines.length > 0 ? Math.round((inspected / r.lines.length) * 100) : 0;
            return (
              <button key={r.id} onClick={() => setActiveId(r.id)} className={cn("w-full text-left px-4 py-3 transition-colors", active?.id === r.id ? "bg-accent/30" : "hover:bg-accent/15")}>
                <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-primary">{r.rmaNumber}</span><PriorityTag p={r.priority} /></div>
                <div className="text-sm mt-1 truncate">{r.customer}</div>
                <div className="flex items-center gap-2 mt-2"><Progress value={pct} className="h-1 flex-1" /><span className="text-[10px] font-mono tabular-nums w-8 text-right">{pct}%</span></div>
              </button>
            );
          })}
        </div>
      </Section>

      {active ? (
        <Section
          title={`Inspecting · ${active.rmaNumber}`}
          sub={`${active.customer} · ${active.totalReceivedQty} units received`}
          actions={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOpen(active)}>Full detail</Button>
              {allInspected && <Button size="sm" className="h-7 text-xs gap-1" onClick={() => completeRma(active.id, "Current User")}><CheckCircle2 className="h-3.5 w-3.5" /> Complete & credit</Button>}
            </div>
          }
        >
          <div className="p-4 space-y-2">
            {active.lines.map((l) => <InspectLineRow key={l.id} rmaId={active.id} line={l} />)}
          </div>
        </Section>
      ) : (
        <Section title="Inspection" className="h-[400px]">
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2"><Microscope className="h-10 w-10 opacity-30" /><span className="text-sm">Select a return to inspect.</span></div>
        </Section>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  DISPOSITIONS
// ════════════════════════════════════════════════════════════════════════════

function DispositionsView() {
  const rmas = useReturnsStore((s) => s.rmas);
  const [filter, setFilter] = useState("all");
  const lines = useMemo(
    () => rmas.flatMap((r) => r.lines.filter((l) => l.disposition).map((l) => ({ ...l, rmaNumber: r.rmaNumber, customer: r.customer }))),
    [rmas],
  );
  const filtered = lines.filter((l) => filter === "all" || l.disposition === filter);
  const mix = useReturnsStore((s) => s.dispositionMix)();
  const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="DISPOSITIONED" value={lines.length} tone="primary" sub="lines processed" />
        <KPICard label="RESTOCK" value={mix.find((m) => m.disposition === "RESTOCK")?.count ?? 0} tone="success" sub="back to stock" />
        <KPICard label="SCRAP" value={mix.find((m) => m.disposition === "SCRAP")?.count ?? 0} tone="destructive" sub="disposed" />
        <KPICard label="TOTAL CREDIT" value={money(totalCredit)} tone="warning" sub="issued / pending" />
      </div>

      <Section
        title="Disposition Ledger"
        sub={`${filtered.length} inspected lines`}
        actions={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dispositions</SelectItem>
              {(Object.keys(DISPOSITION_META) as DispositionType[]).map((d) => <SelectItem key={d} value={d}>{DISPOSITION_META[d].label}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left font-semibold py-2.5 px-3">RMA</th>
                <th className="text-left font-semibold py-2.5 px-3">SKU</th>
                <th className="text-left font-semibold py-2.5 px-3">Customer</th>
                <th className="text-right font-semibold py-2.5 px-3">Qty</th>
                <th className="text-left font-semibold py-2.5 px-3">Reason</th>
                <th className="text-left font-semibold py-2.5 px-3">Condition</th>
                <th className="text-left font-semibold py-2.5 px-3">Restock Bin</th>
                <th className="text-right font-semibold py-2.5 px-3">Credit</th>
                <th className="text-left font-semibold py-2.5 px-3">Disposition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.slice(0, 60).map((l) => (
                <tr key={l.id} className="hover:bg-accent/15">
                  <td className="py-2.5 px-3 font-mono text-primary text-xs">{l.rmaNumber}</td>
                  <td className="py-2.5 px-3 font-mono text-xs">{l.skuCode}</td>
                  <td className="py-2.5 px-3 max-w-32 truncate text-xs">{l.customer}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">{l.receivedQty}</td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{REASON_META[l.reason].label}</td>
                  <td className={cn("py-2.5 px-3 text-xs", l.condition ? CONDITION_META[l.condition] : "text-muted-foreground")}>{l.condition ? titleCase(l.condition) : "—"}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{l.restockBinCode ?? "—"}</td>
                  <td className={cn("py-2.5 px-3 text-right font-mono tabular-nums text-xs", l.creditAmount > 0 ? "text-amber-400" : "text-muted-foreground")}>{l.creditAmount > 0 ? money(l.creditAmount) : "—"}</td>
                  <td className="py-2.5 px-3">{l.disposition && <DispositionTag d={l.disposition} />}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-sm text-muted-foreground">No dispositioned lines in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  RMA DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════════════

function DetailRow({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-border/60 bg-card/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide"><Icon className="h-3 w-3" /> {label}</div>
      <div className="text-sm font-medium mt-1 font-mono tabular-nums break-words">{value}</div>
    </div>
  );
}

function RmaDetailDrawer({ rmaId, onClose }: { rmaId: string | null; onClose: () => void }) {
  const rma = useReturnsStore((s) => s.rmas.find((r) => r.id === rmaId)) ?? null;
  const { approveRma, receiveRma, completeRma, rejectRma } = useReturnsStore();
  const [tab, setTab] = useState("lines");
  if (!rma) return null;

  const inspected = rma.lines.filter((l) => l.status === "INSPECTED" || l.status === "DISPOSED").length;
  const pct = rma.lines.length > 0 ? Math.round((inspected / rma.lines.length) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-primary">{rma.rmaNumber}</span>
            <StatusBadge status={rma.status} />
            <PriorityTag p={rma.priority} />
            {rma.creditIssued && <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded"><DollarSign className="h-3 w-3" /> Credited</span>}
          </div>
          <div className="text-sm text-muted-foreground mt-1">{rma.customer} · Order {rma.orderId}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0"><X className="h-4 w-4" /></Button>
      </div>

      <div className="p-5 border-b border-border space-y-3">
        <div className="grid grid-cols-4 gap-2">
          <MiniStat label="Lines" value={`${rma.totalLines}`} />
          <MiniStat label="Return qty" value={`${rma.totalReturnQty}`} />
          <MiniStat label="Received" value={`${rma.totalReceivedQty}`} tone="text-emerald-400" />
          <MiniStat label="Credit" value={money(rma.totalCreditAmount)} tone={rma.totalCreditAmount > 0 ? "text-amber-400" : undefined} />
        </div>
        {["RECEIVED", "INSPECTING"].includes(rma.status) && (
          <div><div className="flex justify-between text-[11px] text-muted-foreground mb-1"><span>Inspection progress</span><span className="font-mono">{pct}%</span></div><Progress value={pct} className="h-2" /></div>
        )}
        <div className="flex flex-wrap gap-2">
          {rma.status === "REQUESTED" && <><Button size="sm" className="h-8 text-xs gap-1" onClick={() => approveRma(rma.id, "Current User")}><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button><Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-red-400 border-red-500/30" onClick={() => { rejectRma(rma.id, "Rejected — outside return window"); }}><XCircle className="h-3.5 w-3.5" /> Reject</Button></>}
          {["APPROVED", "IN_TRANSIT"].includes(rma.status) && <Button size="sm" className="h-8 text-xs gap-1" onClick={() => receiveRma(rma.id, "IN-01")}><PackageCheck className="h-3.5 w-3.5" /> Receive at dock</Button>}
          {["INSPECTED", "PROCESSING"].includes(rma.status) && <Button size="sm" className="h-8 text-xs gap-1" onClick={() => completeRma(rma.id, "Current User")}><DollarSign className="h-3.5 w-3.5" /> Complete & issue credit</Button>}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="mx-5 mt-3 w-fit">
          <TabsTrigger value="lines" className="text-xs">Lines · {rma.totalLines}</TabsTrigger>
          <TabsTrigger value="info" className="text-xs">Details</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <TabsContent value="lines" className="mt-3 space-y-2">
            {rma.lines.map((l) => (
              <div key={l.id} className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap"><span className="text-[10px] font-mono text-muted-foreground">#{l.lineNo}</span><span className="font-mono text-xs text-primary">{l.skuCode}</span><span className="text-xs text-muted-foreground truncate">{l.skuName}</span></div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px] text-muted-foreground font-mono">
                      <span>Reason {REASON_META[l.reason].label}</span>
                      <span>Lot {l.lotNumber ?? "—"}</span>
                      {l.condition && <span className={CONDITION_META[l.condition]}>{titleCase(l.condition)}</span>}
                      {l.restockBinCode && <span className="text-emerald-400">→ {l.restockBinCode}</span>}
                    </div>
                    {l.inspectionNotes && <div className="text-[11px] text-amber-400/90 mt-1">{l.inspectionNotes}</div>}
                  </div>
                  {l.disposition && <DispositionTag d={l.disposition} />}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
                  <div className="rounded border border-border/60 bg-background/30 py-1.5"><div className="text-[9px] uppercase tracking-wide text-muted-foreground">Return</div><div className="text-sm font-bold font-mono tabular-nums">{l.returnQty}</div></div>
                  <div className="rounded border border-border/60 bg-background/30 py-1.5"><div className="text-[9px] uppercase tracking-wide text-muted-foreground">Received</div><div className="text-sm font-bold font-mono tabular-nums text-emerald-400">{l.receivedQty}</div></div>
                  <div className="rounded border border-border/60 bg-background/30 py-1.5"><div className="text-[9px] uppercase tracking-wide text-muted-foreground">Credit</div><div className="text-sm font-bold font-mono tabular-nums text-amber-400">{l.creditAmount > 0 ? money(l.creditAmount) : "—"}</div></div>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="info" className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              <DetailRow icon={Hash} label="RMA" value={rma.rmaNumber} />
              <DetailRow icon={User} label="Customer code" value={rma.customerCode} />
              <DetailRow icon={Hash} label="Order" value={rma.orderId} />
              <DetailRow icon={Clock} label="Order date" value={rma.orderDate} />
              <DetailRow icon={Truck} label="Carrier" value={rma.carrier} />
              <DetailRow icon={Hash} label="Return tracking" value={rma.returnTrackingNumber ?? "—"} />
              <DetailRow icon={Building2} label="Receipt dock" value={rma.receiptDockCode ?? "—"} />
              <DetailRow icon={BadgeCheck} label="Credit memo" value={rma.creditMemoNumber ?? "—"} />
              <DetailRow icon={Clock} label="Requested" value={fmtDateTime(rma.requestedAt)} />
              <DetailRow icon={CheckCircle2} label="Approved" value={rma.approvedAt ? fmtDateTime(rma.approvedAt) : "—"} />
              <DetailRow icon={PackageCheck} label="Received" value={rma.receivedAt ? fmtDateTime(rma.receivedAt) : "—"} />
              <DetailRow icon={CheckCircle2} label="Completed" value={rma.completedAt ? fmtDateTime(rma.completedAt) : "—"} />
              <DetailRow icon={User} label="Approved by" value={rma.approvedBy ?? "—"} />
              <DetailRow icon={User} label="Processed by" value={rma.processedBy ?? "—"} />
            </div>
            {rma.notes && <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">{rma.notes}</div>}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

type Tab = "overview" | "rmas" | "inspection" | "dispositions";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview",     label: "Overview",     icon: LayoutDashboard },
  { id: "rmas",         label: "RMA Queue",    icon: ClipboardList },
  { id: "inspection",   label: "Inspection",   icon: Microscope },
  { id: "dispositions", label: "Dispositions", icon: Recycle },
];

export function ReturnsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [openId, setOpenId] = useState<string | null>(null);
  const kpis = useReturnsStore((s) => s.kpis)();

  const open = (r: RMA) => setOpenId(r.id);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon={Undo2}
        title="Returns"
        subtitle="RMA intake · return receipt · inspection & disposition · credit memos"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"><FileDown className="h-3.5 w-3.5" /> Report</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5"><Undo2 className="h-3.5 w-3.5" /> New RMA</Button>
          </>
        }
      />

      <div className="flex items-center gap-0 border-b border-border bg-sidebar shrink-0 px-2 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => {
          const badge = id === "inspection" && kpis.pendingInspection > 0 ? kpis.pendingInspection : id === "rmas" && kpis.openRmas > 0 ? kpis.openRmas : null;
          return (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border")}>
              <Icon className="h-4 w-4" />
              {label}
              {badge != null && <span className={cn("ml-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded tabular-nums", id === "inspection" ? "bg-amber-500/15 text-amber-400" : "bg-primary/15 text-primary")}>{badge}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "overview"     && <OverviewView onOpen={open} />}
        {tab === "rmas"         && <RmaQueueView onOpen={open} />}
        {tab === "inspection"   && <InspectionView onOpen={open} />}
        {tab === "dispositions" && <DispositionsView />}
      </div>

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 overflow-hidden">
          <RmaDetailDrawer rmaId={openId} onClose={() => setOpenId(null)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
