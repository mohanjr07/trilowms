/**
 * TriloWMS — Handheld · Scan-to-Putaway
 * Mobile-first putaway. Surfaces the AI slotting suggestion per task, then
 * scan item → scan bin → confirm qty, depositing stock on-hand. Reuses the
 * device-frame pattern from Scan-to-Pick; reads/writes real stores.
 */

import { useMemo, useState, useEffect } from "react";
import {
  ScanLine, Check, X, ChevronRight, Package, MapPin, AlertTriangle, Battery,
  Wifi, SignalHigh, Minus, Plus, ArrowLeft, Sparkles, Boxes, PartyPopper, RefreshCw,
} from "lucide-react";
import { usePutawayStore, type PutawayTask } from "@/lib/putaway-store";
import { useSlottingStore } from "@/lib/slotting-store";
import { cn } from "@/lib/utils";

type Step = "tasks" | "suggest" | "item" | "bin" | "qty" | "done";
const OPEN = (t: PutawayTask) => ["PENDING", "ASSIGNED", "IN_PROGRESS"].includes(t.status);

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-full flex items-center justify-center p-4 bg-[radial-gradient(circle_at_center,_var(--color-sidebar),_var(--color-background))] overflow-auto">
      <div className="relative w-[400px] max-w-full h-[760px] max-h-full rounded-[2.2rem] border-[10px] border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden flex flex-col">
        <div className="absolute top-0 inset-x-0 h-6 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-28 h-5 bg-neutral-800 rounded-b-2xl" />
        </div>
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
const PRIO_CLS: Record<string, string> = { URGENT: "text-red-400 bg-red-500/15", HIGH: "text-amber-400 bg-amber-500/15", NORMAL: "text-neutral-400 bg-neutral-700/40", LOW: "text-neutral-500 bg-neutral-800" };

export function HandheldPutawayScreen() {
  const tasks = usePutawayStore((s) => s.tasks);
  const { syncFromInbound, startTask, completeTask, overrideBin } = usePutawayStore();
  const suggestFor = useSlottingStore((s) => s.suggestFor);
  const logOverride = useSlottingStore((s) => s.logOverride);
  const suggestions = useSlottingStore((s) => s.suggestions);

  const [taskId, setTaskId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("tasks");
  const [scan, setScan] = useState("");
  const [flash, setFlash] = useState<"none" | "ok" | "err">("none");
  const [qty, setQty] = useState(0);
  const [targetBin, setTargetBin] = useState<{ id: string; code: string } | null>(null);

  const task = useMemo(() => tasks.find((t) => t.id === taskId) ?? null, [tasks, taskId]);
  const queue = useMemo(() => [...tasks.filter(OPEN)].sort((a, b) => (b.priority === "URGENT" ? 1 : 0) - (a.priority === "URGENT" ? 1 : 0)), [tasks]);
  const suggestion = taskId ? suggestions[taskId] ?? null : null;

  useEffect(() => { if (flash !== "none") { const t = setTimeout(() => setFlash("none"), 450); return () => clearTimeout(t); } }, [flash]);
  useEffect(() => { if (task && step === "qty") setQty(task.quantity); }, [task, step]);

  const openTask = (t: PutawayTask) => {
    if (t.status === "PENDING") startTask(t.id);
    const r = suggestFor({ id: t.id, skuCode: t.skuCode, quantity: t.quantity, expiryDate: t.expiryDate });
    const tgt = r.primary ? { id: r.primary.binId, code: r.primary.binCode } : (t.suggestedBinCode ? { id: t.suggestedBinId ?? "bin", code: t.suggestedBinCode } : null);
    setTaskId(t.id); setTargetBin(tgt); setStep("suggest"); setScan("");
  };

  const tryScan = (expected: string | undefined, next: Step) => {
    const v = scan.trim().toUpperCase();
    if (!expected || !v || v === expected.toUpperCase()) { setFlash("ok"); setScan(""); setTimeout(() => setStep(next), 250); }
    else setFlash("err");
  };

  const confirmPutaway = () => {
    if (!task || !targetBin) return;
    completeTask(task.id, targetBin.id, targetBin.code, 2.4);
    setFlash("ok"); setScan(""); setTaskId(null); setTargetBin(null);
    setStep(queue.filter((t) => t.id !== task.id).length > 0 ? "tasks" : "done");
  };

  // ── TASK LIST ─────────────────────────────────────────────────────────────
  if (step === "tasks" || !task) {
    return (
      <Frame>
        <StatusBar label="TriloWMS · Putaway" />
        <div className="px-5 pt-3 pb-2 shrink-0 flex items-end justify-between">
          <div><h1 className="text-white text-2xl font-bold">Putaway</h1><p className="text-neutral-400 text-sm">{queue.length} tasks in your queue</p></div>
          <button onClick={() => syncFromInbound()} className="h-10 w-10 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center active:scale-95"><RefreshCw className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
          {queue.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2 pt-20"><Boxes className="h-10 w-10 opacity-30" /><span>No putaway tasks.</span><span className="text-xs">Tap refresh to pull from Inbound.</span></div>
          )}
          {queue.map((t) => (
            <button key={t.id} onClick={() => openTask(t)} className="w-full text-left rounded-2xl bg-neutral-900 border border-neutral-800 p-4 active:scale-[0.99] transition">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-amber-400">{t.id}</span>
                <span className={cn("text-[11px] px-2 py-0.5 rounded-full", PRIO_CLS[t.priority])}>{t.priority}</span>
              </div>
              <div className="text-white text-base font-medium mt-1 leading-tight">{t.skuName}</div>
              <div className="flex items-center justify-between mt-2 text-[12px] text-neutral-400">
                <span className="flex items-center gap-1"><Boxes className="h-4 w-4" /> {t.quantity} {t.uom}</span>
                <span className="flex items-center gap-1 font-mono text-neutral-300">{t.suggestedBinCode ?? "no bin"} <ChevronRight className="h-4 w-4" /></span>
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
        <StatusBar label="Putaway" />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-4">
          <div className="h-20 w-20 rounded-full bg-emerald-500/15 flex items-center justify-center"><PartyPopper className="h-10 w-10 text-emerald-400" /></div>
          <h1 className="text-white text-2xl font-bold">All tasks complete</h1>
          <p className="text-neutral-400">Stock is now on-hand and available.</p>
        </div>
        <div className="p-5 shrink-0"><button onClick={() => setStep("tasks")} className={bigBtn("bg-neutral-800 text-neutral-200")}>Back to queue</button></div>
      </Frame>
    );
  }

  const flashCls = flash === "ok" ? "ring-4 ring-emerald-500" : flash === "err" ? "ring-4 ring-red-500" : "";

  // ── ACTIVE TASK ───────────────────────────────────────────────────────────
  return (
    <Frame>
      <div className={cn("absolute inset-0 pointer-events-none transition", flash === "ok" && "bg-emerald-500/10", flash === "err" && "bg-red-500/15")} />
      <StatusBar label={task.id} />

      <div className="px-5 pt-1 shrink-0">
        <button onClick={() => { setTaskId(null); setStep("tasks"); }} className="text-neutral-400 text-xs flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Queue</button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-3 pb-3">
        {/* item card */}
        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 mb-4">
          <div className="flex items-center gap-2 text-neutral-400 text-[11px] uppercase tracking-wide"><Package className="h-4 w-4" /> Item</div>
          <div className="text-white text-lg font-semibold mt-1 leading-tight">{task.skuName}</div>
          <div className="flex items-center justify-between mt-2">
            <span className="font-mono text-amber-400">{task.skuCode}</span>
            <span className="text-neutral-300 text-sm">Qty <b className="text-white text-lg">{task.quantity}</b> {task.uom}</span>
          </div>
        </div>

        {/* AI suggestion */}
        {step === "suggest" && (
          <>
            <div className="rounded-2xl bg-primary/10 border border-primary/30 p-4 mb-4">
              <div className="flex items-center gap-2 text-amber-400 text-[11px] uppercase tracking-wide"><Sparkles className="h-4 w-4" /> AI suggested location</div>
              {suggestion?.primary || task.suggestedBinCode ? (
                <>
                  <div className="text-white text-3xl font-mono font-bold mt-1">{targetBin?.code ?? task.suggestedBinCode}</div>
                  <div className="text-neutral-400 text-xs mt-0.5">{suggestion?.primary?.reason ?? "Directed location"}</div>
                </>
              ) : <div className="text-neutral-400 text-sm mt-1">No suggestion — scan any open bin.</div>}
            </div>
            {suggestion && suggestion.alternates.length > 0 && (
              <div className="space-y-2 mb-2">
                <div className="text-[10px] uppercase tracking-wide text-neutral-500">Alternates</div>
                {suggestion.alternates.map((alt) => (
                  <button key={alt.binId} onClick={() => { if (alt.binCode !== task.suggestedBinCode) logOverride(task.id, task.skuCode, task.suggestedBinCode, alt.binCode); overrideBin(task.id, alt.binId, alt.binCode); setTargetBin({ id: alt.binId, code: alt.binCode }); }}
                    className={cn("w-full text-left rounded-xl border px-3 py-2 flex items-center justify-between", targetBin?.code === alt.binCode ? "border-amber-400 bg-amber-500/10" : "border-neutral-800 bg-neutral-950")}>
                    <span className="font-mono text-sm text-white">{alt.binCode}</span>
                    <span className="text-[11px] text-neutral-400 truncate ml-2">{alt.reason}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* scan steps */}
        {step === "item" && (
          <div className={cn("rounded-2xl bg-neutral-900 border border-neutral-800 p-4", flashCls)}>
            <div className="text-neutral-300 text-sm mb-2 flex items-center gap-2"><ScanLine className="h-4 w-4 text-amber-400" /> Scan item barcode</div>
            <input value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tryScan(task.skuCode, "bin")}
              placeholder={task.skuCode} className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-3 text-white font-mono text-center text-lg focus:outline-none focus:border-amber-400" />
            {flash === "err" && <div className="text-red-400 text-xs mt-2 text-center">Wrong item — expected {task.skuCode}</div>}
          </div>
        )}
        {step === "bin" && (
          <div className={cn("rounded-2xl bg-neutral-900 border border-neutral-800 p-4", flashCls)}>
            <div className="text-emerald-400 text-xs mb-2 flex items-center gap-1"><Check className="h-4 w-4" /> Item confirmed</div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 mb-3">
              <div className="flex items-center gap-1 text-amber-400 text-[11px] uppercase"><MapPin className="h-3.5 w-3.5" /> Place in bin</div>
              <div className="text-white text-2xl font-mono font-bold">{targetBin?.code ?? "—"}</div>
            </div>
            <div className="text-neutral-300 text-sm mb-2 flex items-center gap-2"><ScanLine className="h-4 w-4 text-amber-400" /> Scan bin barcode</div>
            <input value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tryScan(targetBin?.code, "qty")}
              placeholder={targetBin?.code ?? "bin"} className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-3 text-white font-mono text-center text-lg focus:outline-none focus:border-amber-400" />
            {flash === "err" && <div className="text-red-400 text-xs mt-2 text-center">Wrong bin — expected {targetBin?.code}</div>}
          </div>
        )}
        {step === "qty" && (
          <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
            <div className="text-neutral-300 text-sm mb-3 text-center">Confirm quantity stored</div>
            <div className="flex items-center justify-center gap-5">
              <button onClick={() => setQty((q) => Math.max(0, q - 1))} className="h-14 w-14 rounded-full bg-neutral-800 text-white flex items-center justify-center active:scale-95"><Minus className="h-6 w-6" /></button>
              <span className="text-white text-5xl font-bold font-mono w-20 text-center">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(task.quantity, q + 1))} className="h-14 w-14 rounded-full bg-neutral-800 text-white flex items-center justify-center active:scale-95"><Plus className="h-6 w-6" /></button>
            </div>
            <div className="text-neutral-500 text-xs mt-3 text-center font-mono">{targetBin?.code} · {task.skuCode}</div>
          </div>
        )}
      </div>

      {/* pinned actions */}
      <div className="p-5 space-y-2.5 shrink-0 border-t border-neutral-900">
        {step === "suggest" && <button onClick={() => setStep("item")} disabled={!targetBin} className={bigBtn(!targetBin ? "bg-neutral-800 text-neutral-500" : "bg-amber-400 text-neutral-950")}><Check className="h-5 w-5" /> Accept &amp; start</button>}
        {step === "item" && <button onClick={() => tryScan(task.skuCode, "bin")} className={bigBtn("bg-amber-400 text-neutral-950")}><ScanLine className="h-5 w-5" /> {scan ? "Confirm item" : "Tap to scan"}</button>}
        {step === "bin" && <button onClick={() => tryScan(targetBin?.code, "qty")} className={bigBtn("bg-amber-400 text-neutral-950")}><ScanLine className="h-5 w-5" /> {scan ? "Confirm bin" : "Tap to scan"}</button>}
        {step === "qty" && <button onClick={confirmPutaway} disabled={qty <= 0} className={bigBtn(qty <= 0 ? "bg-neutral-800 text-neutral-500" : "bg-emerald-500 text-white")}><Check className="h-5 w-5" /> Confirm putaway</button>}
      </div>
    </Frame>
  );
}
