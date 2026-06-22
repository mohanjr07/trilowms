/**
 * TriloWMS — Handheld · Scan-to-Pack
 * Mobile/tablet packing. Open a carton, scan each item in, capture weight,
 * close & complete — driving the real packing store (createCarton /
 * scanCartonItem / closeCarton / completeOrder). Completes the handheld trio.
 */

import { useMemo, useState, useEffect } from "react";
import {
  ScanLine, Check, Package, MapPin, AlertTriangle, Battery, Wifi, SignalHigh,
  Minus, Plus, ArrowLeft, Boxes, PartyPopper, RefreshCw, Weight, Box, ChevronRight,
} from "lucide-react";
import { usePackingStore, type PackOrder, type Carton } from "@/lib/packing-store";
import { cn } from "@/lib/utils";

type Step = "queue" | "pack" | "weigh" | "done";
const OPEN_ORDER = (o: PackOrder) => ["QUEUED", "ASSIGNED", "PACKING"].includes(o.status);
const PRIO_CLS: Record<string, string> = { OVERNIGHT: "text-red-400 bg-red-500/15", SAME_DAY: "text-red-400 bg-red-500/15", RUSH: "text-amber-400 bg-amber-500/15", STANDARD: "text-neutral-400 bg-neutral-700/40" };

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-full flex items-center justify-center p-4 bg-[radial-gradient(circle_at_center,_var(--color-sidebar),_var(--color-background))] overflow-auto">
      <div className="relative w-[400px] max-w-full h-[760px] max-h-full rounded-[2.2rem] border-[10px] border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden flex flex-col">
        <div className="absolute top-0 inset-x-0 h-6 flex items-center justify-center z-20 pointer-events-none"><div className="w-28 h-5 bg-neutral-800 rounded-b-2xl" /></div>
        {children}
      </div>
    </div>
  );
}
function StatusBar({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between px-5 pt-2.5 pb-1 text-[11px] text-neutral-400 shrink-0">
      <span className="font-mono">{label}</span>
      <div className="flex items-center gap-1.5"><SignalHigh className="h-3.5 w-3.5" /><Wifi className="h-3.5 w-3.5" /><Battery className="h-4 w-4" /></div>
    </div>
  );
}
const bigBtn = (extra?: string) => cn("w-full min-h-[60px] rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition", extra);

export function HandheldPackScreen() {
  const orders = usePackingStore((s) => s.orders);
  const { syncFromConsolidation, createCarton, scanCartonItem, closeCarton, completeOrder } = usePackingStore();

  const [orderId, setOrderId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("queue");
  const [scan, setScan] = useState("");
  const [flash, setFlash] = useState<"none" | "ok" | "err">("none");
  const [weight, setWeight] = useState(0);

  const order = useMemo(() => orders.find((o) => o.id === orderId) ?? null, [orders, orderId]);
  const queue = useMemo(() => orders.filter(OPEN_ORDER), [orders]);
  const carton: Carton | null = order?.cartons.find((c) => c.status === "OPEN") ?? null;

  useEffect(() => { if (flash !== "none") { const t = setTimeout(() => setFlash("none"), 450); return () => clearTimeout(t); } }, [flash]);

  const openOrder = (o: PackOrder) => {
    if (!o.cartons.some((c) => c.status === "OPEN")) createCarton(o.id);
    setOrderId(o.id); setStep("pack"); setScan("");
  };

  const packLine = (lineId: string) => {
    if (!order || !carton) return;
    const it = carton.items.find((i) => i.lineId === lineId);
    if (!it || it.qtyPacked >= it.qtyRequired) { setFlash("err"); return; }
    scanCartonItem(order.id, carton.id, lineId);
    setFlash("ok"); setScan("");
  };
  const scanByCode = () => {
    if (!carton) return;
    const v = scan.trim().toUpperCase();
    const line = carton.items.find((i) => i.skuCode.toUpperCase() === v && i.qtyPacked < i.qtyRequired);
    if (line) packLine(line.lineId); else setFlash("err");
  };

  const cartonDone = carton ? carton.items.every((i) => i.qtyPacked >= i.qtyRequired) : false;
  const packedUnits = carton ? carton.items.reduce((s, i) => s + i.qtyPacked, 0) : 0;
  const reqUnits = carton ? carton.items.reduce((s, i) => s + i.qtyRequired, 0) : 0;

  const closeAndComplete = () => {
    if (!order || !carton) return;
    closeCarton(order.id, carton.id, weight);
    const fresh = usePackingStore.getState().orders.find((o) => o.id === order.id);
    const stillOpen = fresh?.lines.some((l) => l.qtyPacked < l.qtyRequired);
    if (stillOpen) { createCarton(order.id); setWeight(0); setStep("pack"); setFlash("ok"); }
    else { completeOrder(order.id); setOrderId(null); setWeight(0); setStep(queue.filter((o) => o.id !== order.id).length > 0 ? "queue" : "done"); }
  };

  // ── QUEUE ─────────────────────────────────────────────────────────────────
  if (step === "queue" || !order) {
    return (
      <Frame>
        <StatusBar label="TriloWMS · Packing" />
        <div className="px-5 pt-3 pb-2 shrink-0 flex items-end justify-between">
          <div><h1 className="text-white text-2xl font-bold">Packing</h1><p className="text-neutral-400 text-sm">{queue.length} orders to pack</p></div>
          <button onClick={() => syncFromConsolidation()} className="h-10 w-10 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center active:scale-95"><RefreshCw className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
          {queue.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2 pt-20"><Boxes className="h-10 w-10 opacity-30" /><span>No orders to pack.</span><span className="text-xs">Tap refresh to pull from Consolidation.</span></div>
          )}
          {queue.map((o) => (
            <button key={o.id} onClick={() => openOrder(o)} className="w-full text-left rounded-2xl bg-neutral-900 border border-neutral-800 p-4 active:scale-[0.99] transition">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-amber-400">{o.orderNumber}</span>
                <span className={cn("text-[11px] px-2 py-0.5 rounded-full", PRIO_CLS[o.priority] ?? PRIO_CLS.STANDARD)}>{o.priority}</span>
              </div>
              <div className="text-white text-base font-medium mt-1 leading-tight">{o.customer}</div>
              <div className="flex items-center justify-between mt-2 text-[12px] text-neutral-400">
                <span className="flex items-center gap-1"><Package className="h-4 w-4" /> {o.totalLines} lines · {o.totalUnits} units</span>
                <span className="flex items-center gap-1 text-neutral-300">{o.carrier} <ChevronRight className="h-4 w-4" /></span>
              </div>
            </button>
          ))}
        </div>
      </Frame>
    );
  }

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <Frame>
        <StatusBar label="Packing" />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-4">
          <div className="h-20 w-20 rounded-full bg-emerald-500/15 flex items-center justify-center"><PartyPopper className="h-10 w-10 text-emerald-400" /></div>
          <h1 className="text-white text-2xl font-bold">Order packed</h1>
          <p className="text-neutral-400">Ready for manifest &amp; dispatch.</p>
        </div>
        <div className="p-5 shrink-0"><button onClick={() => setStep("queue")} className={bigBtn("bg-neutral-800 text-neutral-200")}>Back to queue</button></div>
      </Frame>
    );
  }

  const flashCls = flash === "ok" ? "ring-4 ring-emerald-500" : flash === "err" ? "ring-4 ring-red-500" : "";

  // ── WEIGH ─────────────────────────────────────────────────────────────────
  if (step === "weigh") {
    return (
      <Frame>
        <StatusBar label={order.orderNumber} />
        <div className="px-5 pt-1 shrink-0"><button onClick={() => setStep("pack")} className="text-neutral-400 text-xs flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Carton</button></div>
        <div className="flex-1 overflow-y-auto px-5 pt-3 pb-3">
          <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 mb-4">
            <div className="flex items-center gap-2 text-emerald-400 text-xs"><Check className="h-4 w-4" /> All items packed</div>
            <div className="text-white text-lg font-semibold mt-1">{carton?.cartonCode}</div>
            <div className="text-neutral-400 text-xs">{reqUnits} units · {order.customer}</div>
          </div>
          <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
            <div className="text-neutral-300 text-sm mb-3 text-center flex items-center justify-center gap-2"><Weight className="h-4 w-4 text-amber-400" /> Capture carton weight (kg)</div>
            <div className="flex items-center justify-center gap-5">
              <button onClick={() => setWeight((w) => Math.max(0, +(w - 0.5).toFixed(1)))} className="h-14 w-14 rounded-full bg-neutral-800 text-white flex items-center justify-center active:scale-95"><Minus className="h-6 w-6" /></button>
              <span className="text-white text-5xl font-bold font-mono w-24 text-center">{weight.toFixed(1)}</span>
              <button onClick={() => setWeight((w) => +(w + 0.5).toFixed(1))} className="h-14 w-14 rounded-full bg-neutral-800 text-white flex items-center justify-center active:scale-95"><Plus className="h-6 w-6" /></button>
            </div>
            <div className="text-neutral-500 text-[11px] text-center mt-3">Reads from integrated scale where available</div>
          </div>
        </div>
        <div className="p-5 shrink-0 border-t border-neutral-900">
          <button onClick={closeAndComplete} disabled={weight <= 0} className={bigBtn(weight <= 0 ? "bg-neutral-800 text-neutral-500" : "bg-emerald-500 text-white")}><Check className="h-5 w-5" /> Close carton &amp; label</button>
        </div>
      </Frame>
    );
  }

  // ── PACK ──────────────────────────────────────────────────────────────────
  return (
    <Frame>
      <div className={cn("absolute inset-0 pointer-events-none transition", flash === "ok" && "bg-emerald-500/10", flash === "err" && "bg-red-500/15")} />
      <StatusBar label={order.orderNumber} />
      <div className="px-5 pt-1 shrink-0 flex items-center justify-between">
        <button onClick={() => { setOrderId(null); setStep("queue"); }} className="text-neutral-400 text-xs flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Queue</button>
        <span className="text-[11px] text-neutral-400 flex items-center gap-1"><Box className="h-3.5 w-3.5" /> {carton?.cartonCode}</span>
      </div>

      <div className="px-5 pt-2 shrink-0">
        <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1"><span>{order.customer}</span><span>{packedUnits}/{reqUnits} units</span></div>
        <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${reqUnits ? (packedUnits / reqUnits) * 100 : 0}%` }} /></div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-3 pb-3 space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">Scan each item into the box</div>
        {carton?.items.map((it) => {
          const full = it.qtyPacked >= it.qtyRequired;
          return (
            <button key={it.lineId} onClick={() => packLine(it.lineId)} disabled={full}
              className={cn("w-full text-left rounded-xl border p-3 flex items-center gap-3 transition active:scale-[0.99]", full ? "border-emerald-500/40 bg-emerald-500/10" : "border-neutral-800 bg-neutral-900")}>
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", full ? "bg-emerald-500/20 text-emerald-400" : "bg-neutral-800 text-neutral-400")}>
                {full ? <Check className="h-5 w-5" /> : <Package className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-amber-400 text-sm">{it.skuCode}</div>
                <div className="text-neutral-300 text-xs truncate">{it.skuName}</div>
              </div>
              <div className="text-right shrink-0"><span className={cn("font-mono font-bold", full ? "text-emerald-400" : "text-white")}>{it.qtyPacked}</span><span className="text-neutral-500 font-mono">/{it.qtyRequired}</span></div>
            </button>
          );
        })}
      </div>

      <div className="p-5 space-y-2.5 shrink-0 border-t border-neutral-900">
        <div className={cn("rounded-xl bg-neutral-900 border border-neutral-800 p-2.5 flex items-center gap-2", flashCls)}>
          <ScanLine className="h-4 w-4 text-amber-400 shrink-0" />
          <input value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scanByCode()} placeholder="Scan item barcode"
            className="flex-1 bg-transparent text-white font-mono text-sm focus:outline-none placeholder:text-neutral-600" />
          <button onClick={scanByCode} className="text-amber-400 text-xs font-semibold px-2">Scan</button>
        </div>
        {flash === "err" && <div className="text-red-400 text-[11px] text-center">Item not on this carton, or already fully packed</div>}
        <button onClick={() => setStep("weigh")} disabled={!cartonDone} className={bigBtn(!cartonDone ? "bg-neutral-800 text-neutral-500" : "bg-amber-400 text-neutral-950")}><Weight className="h-5 w-5" /> Weigh &amp; close carton</button>
      </div>
    </Frame>
  );
}
