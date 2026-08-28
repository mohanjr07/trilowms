/**
 * TriloWMS — Inventory · Stock Levels
 * Real on-hand truth from the stock ledger: stock levels, low-stock/reorder
 * alerts, and cycle count (count → variance → adjustment back into the ledger).
 */

import { useMemo, useState } from "react";
import {
  Boxes, Search, X, AlertTriangle, TrendingDown, ClipboardCheck, ChevronRight,
  CheckCircle2, Package, FileDown, ScanLine, Layers, MapPin, ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { KPICard } from "@/components/wms/Primitives";
import { useStockStore, type StockRecord } from "@/lib/stock-store";
import { useSkuStore } from "@/lib/sku-store";
import { useInboundStore } from "@/lib/inbound-store";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString();
const DEFAULT_REORDER = 100;

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

function useReorderMap() {
  const skus = useSkuStore((s) => s.skus);
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const s of skus) m.set(s.skuCode, s.reorderLevel ?? DEFAULT_REORDER);
    return m;
  }, [skus]);
}

// ── Stock Levels ──────────────────────────────────────────────────────────────

function StockLevelsView() {
  const records = useStockStore((s) => s.list)();
  const reorder = useReorderMap();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"sku" | "onHand" | "available">("sku");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = records.filter((r) => !q || r.skuCode.toLowerCase().includes(q) || r.skuName.toLowerCase().includes(q));
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "onHand") return b.onHand - a.onHand;
      if (sort === "available") return (b.onHand - b.reserved) - (a.onHand - a.reserved);
      return a.skuCode.localeCompare(b.skuCode);
    });
    return sorted;
  }, [records, search, sort]);

  return (
    <Section title="Stock Levels" sub={`${records.length} SKUs on hand`} actions={
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setSort(sort === "onHand" ? "available" : sort === "available" ? "sku" : "onHand")}><ArrowUpDown className="h-3.5 w-3.5" /> {sort === "sku" ? "SKU" : sort === "onHand" ? "On hand" : "Available"}</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><FileDown className="h-3.5 w-3.5" /> Export</Button>
      </div>
    }>
      <div className="px-4 py-3 border-b border-border/60">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search SKU or description…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-semibold py-2.5 px-3">SKU</th>
              <th className="text-left font-semibold py-2.5 px-3">Description</th>
              <th className="text-right font-semibold py-2.5 px-3">On Hand</th>
              <th className="text-right font-semibold py-2.5 px-3">Reserved</th>
              <th className="text-right font-semibold py-2.5 px-3">Available</th>
              <th className="text-right font-semibold py-2.5 px-3">Reorder</th>
              <th className="text-left font-semibold py-2.5 px-3">Bins</th>
              <th className="py-2.5 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((r) => {
              const avail = Math.max(0, r.onHand - r.reserved);
              const ro = reorder.get(r.skuCode) ?? DEFAULT_REORDER;
              const low = avail <= ro;
              const out = avail === 0;
              const binList = Object.entries(r.bins).filter(([, q]) => q > 0);
              const isOpen = expanded === r.skuCode;
              return (
                <>
                  <tr key={r.skuCode} className={cn("hover:bg-accent/20 transition-colors", out ? "border-l-2 border-l-red-500" : low ? "border-l-2 border-l-amber-500" : "")}>
                    <td className="py-2 px-3 font-mono text-primary text-xs whitespace-nowrap">{r.skuCode}</td>
                    <td className="py-2 px-3 max-w-48 truncate text-xs">{r.skuName}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-xs">{fmt(r.onHand)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-xs text-amber-400">{fmt(r.reserved)}</td>
                    <td className={cn("py-2 px-3 text-right font-mono tabular-nums text-xs font-bold", out ? "text-red-400" : low ? "text-amber-400" : "text-emerald-400")}>{fmt(avail)}{out && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-red-500/15 text-red-400">OUT</span>}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-xs text-muted-foreground">{ro}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{binList.length} {binList.length === 1 ? "bin" : "bins"}</td>
                    <td className="py-2 px-2">{binList.length > 0 && <button onClick={() => setExpanded(isOpen ? null : r.skuCode)}><ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isOpen && "rotate-90")} /></button>}</td>
                  </tr>
                  {isOpen && binList.map(([bin, q]) => (
                    <tr key={r.skuCode + bin} className="bg-background/40 text-[11px]">
                      <td className="py-1.5 px-3" />
                      <td className="py-1.5 px-3 text-muted-foreground" colSpan={1}><span className="inline-flex items-center gap-1 font-mono"><MapPin className="h-3 w-3" /> {bin}</span></td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums" colSpan={5}>{fmt(q)} units</td>
                      <td />
                    </tr>
                  ))}
                </>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-sm text-muted-foreground"><Package className="h-8 w-8 mx-auto mb-2 opacity-30" />No stock yet. Complete putaway tasks to build on-hand inventory.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ── Create PO ─────────────────────────────────────────────────────────────────
// TriloWMS has no standalone Purchasing/PO module — the real mechanism by which
// replenishment stock enters the warehouse is an Inbound ASN. So "Create PO"
// raises a real ASN (with a generated PO number attached) pre-filled with the
// low-stock SKU and suggested quantity, which shows up in Inbound ready to be
// scheduled and received — rather than being a dead button with no real effect.
let _poSeq = 5000;
function nextPoNumber() {
  return `PO-${++_poSeq}`;
}

function CreatePoModal({
  open, onClose, skuCode, skuName, suggestedQty,
}: { open: boolean; onClose: () => void; skuCode: string; skuName: string; suggestedQty: number }) {
  const createAsn = useInboundStore((s) => s.createAsn);
  const addLine = useInboundStore((s) => s.addLine);
  const skus = useSkuStore((s) => s.skus);
  const currentUserName = useAuthStore((s) => s.session?.user.name);
  const [vendor, setVendor] = useState("Globex Industrial");
  const [qty, setQty] = useState(String(suggestedQty));
  const [result, setResult] = useState<string | null>(null);

  const sku = skus.find((s) => s.skuCode === skuCode);
  const uom = sku?.uom ?? "EA";

  const reset = () => { setVendor("Globex Industrial"); setQty(String(suggestedQty)); setResult(null); };
  const canSubmit = vendor.trim().length > 0 && Number(qty) > 0;

  const submit = () => {
    const poNumber = nextPoNumber();
    const asn = createAsn({
      status: "PENDING",
      vendor: vendor.trim(),
      vendorCode: vendor.trim().slice(0, 4).toUpperCase(),
      poNumbers: [poNumber],
      carrierName: "TBD",
      truckNumber: null,
      trailerNumber: null,
      dockId: null,
      dockCode: null,
      scheduledArrival: new Date(Date.now() + 3 * 86400000).toISOString(),
      actualArrival: null,
      completedAt: null,
      priority: "NORMAL",
      totalLines: 0,
      totalUnits: 0,
      receivedUnits: 0,
      notes: `Auto-created from Low Stock alert for ${skuCode}`,
      createdBy: currentUserName ?? "Unknown",
      warehouseId: "TRILO-DC-01",
      temperatureRequired: false,
      hazmat: false,
      palletCount: 0,
      grossWeight: 0,
    });
    addLine(asn.id, { skuCode, skuName, poNumber, orderedQty: Number(qty), uom });
    setResult(`Created ${poNumber} on ASN ${asn.asnNumber} — visible in Inbound.`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create PO — {skuCode}</DialogTitle></DialogHeader>
        {result ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-400">{result}</p>
            <DialogFooter>
              <Button size="sm" onClick={() => { reset(); onClose(); }}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{skuName}</p>
              <div>
                <Label className="text-xs">Vendor</Label>
                <Input value={vendor} onChange={(e) => setVendor(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Order quantity ({uom})</Label>
                <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="h-9" />
              </div>
              <p className="text-[10px] text-muted-foreground">
                This creates an ASN with a new PO number, ready to be scheduled and received in Inbound.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>Cancel</Button>
              <Button size="sm" disabled={!canSubmit} onClick={submit}>Create PO</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Low Stock ─────────────────────────────────────────────────────────────────

function LowStockView() {
  const records = useStockStore((s) => s.list)();
  const reorder = useReorderMap();
  const [poTarget, setPoTarget] = useState<{ skuCode: string; skuName: string; qty: number } | null>(null);

  const alerts = useMemo(() => {
    return records
      .map((r) => {
        const avail = Math.max(0, r.onHand - r.reserved);
        const ro = reorder.get(r.skuCode) ?? DEFAULT_REORDER;
        return { ...r, avail, ro, deficit: ro - avail };
      })
      .filter((r) => r.avail <= r.ro)
      .sort((a, b) => b.deficit - a.deficit);
  }, [records, reorder]);

  const out = alerts.filter((a) => a.avail === 0).length;
  const suggested = (r: { ro: number; avail: number }) => Math.max(r.ro * 2 - r.avail, r.ro);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="LOW STOCK" value={alerts.length} tone="warning" sub="at/below reorder" />
        <KPICard label="OUT OF STOCK" value={out} tone="destructive" sub="zero available" />
        <KPICard label="TOTAL SKUs" value={records.length} tone="primary" sub="tracked" />
        <KPICard label="HEALTHY" value={records.length - alerts.length} tone="success" sub="above reorder" />
      </div>

      <Section title="Low Stock Alerts" sub={`${alerts.length} SKUs need replenishment · most urgent first`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left font-semibold py-2.5 px-3">SKU</th>
                <th className="text-left font-semibold py-2.5 px-3">Description</th>
                <th className="text-right font-semibold py-2.5 px-3">Available</th>
                <th className="text-right font-semibold py-2.5 px-3">Reorder Lvl</th>
                <th className="text-right font-semibold py-2.5 px-3">Deficit</th>
                <th className="text-right font-semibold py-2.5 px-3">Suggested PO</th>
                <th className="text-right font-semibold py-2.5 px-3 w-32">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {alerts.map((r) => (
                <tr key={r.skuCode} className={cn("hover:bg-accent/15", r.avail === 0 ? "border-l-2 border-l-red-500" : "border-l-2 border-l-amber-500")}>
                  <td className="py-2.5 px-3 font-mono text-primary text-xs whitespace-nowrap">{r.skuCode}</td>
                  <td className="py-2.5 px-3 max-w-48 truncate text-xs">{r.skuName}</td>
                  <td className={cn("py-2.5 px-3 text-right font-mono tabular-nums text-xs font-bold", r.avail === 0 ? "text-red-400" : "text-amber-400")}>{fmt(r.avail)}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-muted-foreground">{r.ro}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-red-400">-{fmt(Math.max(0, r.deficit))}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-emerald-400">{fmt(suggested(r))}</td>
                  <td className="py-2.5 px-3 text-right">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPoTarget({ skuCode: r.skuCode, skuName: r.skuName, qty: suggested(r) })}>Create PO</Button>
                  </td>
                </tr>
              ))}
              {alerts.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground"><CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/40" />All stock is above reorder level.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
      {poTarget && (
        <CreatePoModal
          open={!!poTarget}
          onClose={() => setPoTarget(null)}
          skuCode={poTarget.skuCode}
          skuName={poTarget.skuName}
          suggestedQty={poTarget.qty}
        />
      )}
    </div>
  );
}

// ── Cycle Count ───────────────────────────────────────────────────────────────

function CycleCountView() {
  const records = useStockStore((s) => s.list)();
  const adjustments = useStockStore((s) => s.adjustments);
  const applyCount = useStockStore((s) => s.applyCount);

  const [skuCode, setSkuCode] = useState("");
  const [bin, setBin] = useState("");
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("Cycle Count");
  const [blind, setBlind] = useState(true);

  const rec = records.find((r) => r.skuCode === skuCode);
  const expected = rec?.onHand ?? 0;
  const countedNum = parseInt(counted);
  const hasCount = !isNaN(countedNum) && countedNum >= 0;
  const variance = hasCount ? countedNum - expected : 0;
  const binOptions = rec ? Object.keys(rec.bins) : [];

  const submit = () => {
    if (!skuCode || !hasCount) return;
    applyCount(skuCode, countedNum, reason, bin || null);
    setCounted(""); setBin("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Section title="Cycle Count" sub="Scan a SKU, enter the physical count, variance posts to the ledger">
        <div className="p-4 space-y-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">SKU to count</span>
            <Select value={skuCode} onValueChange={(v) => { setSkuCode(v); setBin(""); setCounted(""); }}>
              <SelectTrigger className="h-9 mt-1 text-sm"><SelectValue placeholder="Select a stocked SKU…" /></SelectTrigger>
              <SelectContent>{records.map((r) => <SelectItem key={r.skuCode} value={r.skuCode}>{r.skuCode} · {r.skuName}</SelectItem>)}</SelectContent>
            </Select>
          </label>

          {rec && (
            <>
              {binOptions.length > 0 && (
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Bin (optional)</span>
                  <Select value={bin || "all"} onValueChange={(v) => setBin(v === "all" ? "" : v)}>
                    <SelectTrigger className="h-9 mt-1 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All bins (SKU total)</SelectItem>{binOptions.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
              )}

              <div className="flex items-center justify-between rounded-md border border-border/60 bg-card/40 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Expected (system)</span>
                <div className="flex items-center gap-2">
                  {!blind && <span className="text-sm font-bold font-mono tabular-nums">{fmt(expected)}</span>}
                  <button onClick={() => setBlind(!blind)} className="text-[10px] text-primary hover:underline">{blind ? "Show expected" : "Hide (blind)"}</button>
                </div>
              </div>

              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><ScanLine className="h-3 w-3" /> Counted quantity</span>
                <Input type="number" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="Enter physical count" className="h-10 mt-1 text-base font-mono" />
              </label>

              {hasCount && (
                <div className={cn("rounded-md border px-3 py-2 text-sm flex items-center justify-between", variance === 0 ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-amber-500/30 bg-amber-500/5 text-amber-400")}>
                  <span>Variance</span>
                  <span className="font-mono font-bold tabular-nums">{variance > 0 ? "+" : ""}{fmt(variance)}{variance === 0 ? " · match" : ""}</span>
                </div>
              )}

              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Reason</span>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="h-9 mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Cycle Count", "Damage", "Loss / Shrinkage", "Found", "Correction", "Other"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </label>

              <Button className="w-full gap-1" disabled={!hasCount} onClick={submit}><ClipboardCheck className="h-4 w-4" /> Post count &amp; adjust</Button>
            </>
          )}
        </div>
      </Section>

      <Section title="Adjustment History" sub={`${adjustments.length} posted adjustments`}>
        <div className="divide-y divide-border/40 overflow-y-auto max-h-[460px]">
          {adjustments.length === 0 && <div className="text-center py-12 text-sm text-muted-foreground"><TrendingDown className="h-8 w-8 mx-auto mb-2 opacity-30" />No adjustments posted yet.</div>}
          {adjustments.map((a) => (
            <div key={a.id} className="px-4 py-2.5 flex items-center gap-3">
              <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0", a.variance === 0 ? "bg-slate-500/10 text-slate-400" : a.variance > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
                <Layers className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-mono text-xs text-primary">{a.skuCode}</span><span className="text-[10px] px-1 rounded bg-secondary text-muted-foreground">{a.reason}</span></div>
                <div className="text-[11px] text-muted-foreground font-mono">{a.previousQty} → {a.newQty}{a.binCode ? ` · ${a.binCode}` : ""}</div>
              </div>
              <div className="text-right shrink-0">
                <div className={cn("text-sm font-bold font-mono tabular-nums", a.variance === 0 ? "text-muted-foreground" : a.variance > 0 ? "text-emerald-400" : "text-red-400")}>{a.variance > 0 ? "+" : ""}{fmt(a.variance)}</div>
                <div className="text-[9px] text-muted-foreground">{new Date(a.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

type Sub = "levels" | "low" | "count";
const SUBS: { id: Sub; label: string; icon: typeof Boxes }[] = [
  { id: "levels", label: "Stock Levels", icon: Boxes },
  { id: "low",    label: "Low Stock",    icon: AlertTriangle },
  { id: "count",  label: "Cycle Count",  icon: ClipboardCheck },
];

export function StockLevelsPage() {
  const [sub, setSub] = useState<Sub>("levels");
  const kpis = useStockStore((s) => s.kpis)();
  const records = useStockStore((s) => s.list)();
  const reorder = useReorderMap();
  const lowCount = records.filter((r) => Math.max(0, r.onHand - r.reserved) <= (reorder.get(r.skuCode) ?? DEFAULT_REORDER)).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-4 overflow-x-auto">
          {SUBS.map(({ id, label, icon: Icon }) => {
            const badge = id === "low" && lowCount > 0 ? lowCount : null;
            return (
              <button key={id} onClick={() => setSub(id)} className={cn("flex items-center gap-1.5 text-sm font-medium whitespace-nowrap pb-1 border-b-2 transition-colors", sub === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                <Icon className="h-4 w-4" /> {label}
                {badge != null && <span className="ml-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded tabular-nums bg-amber-500/15 text-amber-400">{badge}</span>}
              </button>
            );
          })}
        </div>
        <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground font-mono shrink-0">
          <span>On hand <span className="text-foreground font-bold">{fmt(kpis.totalOnHand)}</span></span>
          <span>Reserved <span className="text-amber-400 font-bold">{fmt(kpis.totalReserved)}</span></span>
          <span>Available <span className="text-emerald-400 font-bold">{fmt(kpis.totalAvailable)}</span></span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {sub === "levels" && <StockLevelsView />}
        {sub === "low"    && <LowStockView />}
        {sub === "count"  && <CycleCountView />}
      </div>
    </div>
  );
}
