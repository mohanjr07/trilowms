/**
 * TriloWMS — Handheld · Scan-to-Pick
 * Mobile-first, scan-driven picking. Walks a wave in the AI-optimized route
 * order: scan bin → scan item → confirm qty → auto-advance to the next stop.
 * Reads/writes the real picking store; rendered in a device frame in-console.
 */

import { useMemo, useState, useEffect } from "react";
import {
  ScanLine, Check, X, ChevronRight, Package, MapPin, AlertTriangle, Battery,
  Wifi, SignalHigh, CheckCircle2, Minus, Plus, ArrowLeft, Sparkles, Boxes, PartyPopper,
} from "lucide-react";
import { usePickingStore, type Wave, type PickTask, type Shortage } from "@/lib/picking-store";
import { usePickPathStore } from "@/lib/pickpath-store";
import { cn } from "@/lib/utils";

type Step = "waves" | "bin" | "item" | "qty" | "short" | "done";
const OPEN = (t: PickTask) => !["PICKED", "SHORT", "SKIPPED", "SUBSTITUTED"].includes(t.status);
const SHORT_REASONS: { id: Shortage["reason"]; label: string }[] = [
  { id: "OUT_OF_STOCK", label: "Out of stock" },
  { id: "BIN_EMPTY", label: "Bin empty" },
  { id: "DAMAGED", label: "Damaged" },
  { id: "WRONG_LOCATION", label: "Wrong location" },
];

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

function bigBtn(extra?: string) {
  return cn("w-full min-h-[60px] rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition", extra);
}

export function HandheldPickScreen() {
  const waves = usePickingStore((s) => s.waves);
  const { startWave, pickTask, reportShort, completeWave } = usePickingStore();
  const optimize = usePickPathStore((s) => s.optimize);

  const [waveId, setWaveId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("waves");
  const [scan, setScan] = useState("");
  const [flash, setFlash] = useState<"none" | "ok" | "err">("none");
  const [qty, setQty] = useState(0);

  const wave = useMemo(() => waves.find((w) => w.id === waveId) ?? null, [waves, waveId]);
  const availableWaves = waves.filter((w) => ["RELEASED", "IN_PROGRESS", "PARTIAL"].includes(w.status) && w.tasks.some(OPEN));
  const openTasks = wave ? wave.tasks.filter(OPEN) : [];
  const task = openTasks[0] ?? null;
  const doneCount = wave ? wave.tasks.filter((t) => !OPEN(t)).length : 0;

  useEffect(() => { if (flash !== "none") { const t = setTimeout(() => setFlash("none"), 450); return () => clearTimeout(t); } }, [flash]);
  useEffect(() => { if (task && step === "qty") setQty(task.qtyRequired - task.qtyPicked); }, [task, step]);
  useEffect(() => { if (wave && step !== "waves" && step !== "done" && !task) setStep("done"); }, [wave, task, step]);

  const enterWave = (w: Wave) => {
    if (w.status === "RELEASED") startWave(w.id);
    optimize(w.id, true);          // route-order the wave
    setWaveId(w.id); setStep("bin"); setScan("");
  };

  const tryScan = (expected: string, next: Step) => {
    const v = scan.trim().toUpperCase();
    if (!v || v === expected.toUpperCase()) { setFlash("ok"); setScan(""); setTimeout(() => setStep(next), 250); }
    else { setFlash("err"); }
  };

  const confirmPick = () => {
    if (!wave || !task) return;
    pickTask(wave.id, task.id, qty);
    setFlash("ok"); setScan(""); setStep("bin");
  };
  const doShort = (reason: Shortage["reason"]) => {
    if (!wave || !task) return;
    reportShort(wave.id, task.id, task.qtyPicked, reason);
    setScan(""); setStep("bin");
  };

  // ── WAVE SELECT ───────────────────────────────────────────────────────────
  if (step === "waves" || !wave) {
    return (
      <Frame>
        <StatusBar label="TriloWMS · Picker" />
        <div className="px-5 pt-3 pb-2 shrink-0">
          <h1 className="text-white text-2xl font-bold">Your waves</h1>
          <p className="text-neutral-400 text-sm">Tap a wave to start picking</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
          {availableWaves.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2 pt-20"><Boxes className="h-10 w-10 opacity-30" /><span>No released waves assigned.</span></div>
          )}
          {availableWaves.map((w) => {
            const open = w.tasks.filter(OPEN).length;
            return (
              <button key={w.id} onClick={() => enterWave(w)} className="w-full text-left rounded-2xl bg-neutral-900 border border-neutral-800 p-4 active:scale-[0.99] transition">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-amber-400 text-lg">{w.waveNumber}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{w.priority}</span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-neutral-300 text-sm">
                  <span className="flex items-center gap-1"><Package className="h-4 w-4" /> {open} picks</span>
                  <span className="flex items-center gap-1"><Boxes className="h-4 w-4" /> {w.totalUnits} units</span>
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-neutral-500">
                  <span>Bay {w.packingBay} · {w.carrier}</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </button>
            );
          })}
        </div>
      </Frame>
    );
  }

  const progress = wave.totalLines > 0 ? Math.round((doneCount / wave.totalLines) * 100) : 0;

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <Frame>
        <StatusBar label={wave.waveNumber} />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-4">
          <div className="h-20 w-20 rounded-full bg-emerald-500/15 flex items-center justify-center"><PartyPopper className="h-10 w-10 text-emerald-400" /></div>
          <h1 className="text-white text-2xl font-bold">Pick run complete</h1>
          <p className="text-neutral-400">{wave.tasks.filter((t) => t.status === "PICKED").length} picked · {wave.tasks.filter((t) => t.status === "SHORT").length} short</p>
        </div>
        <div className="p-5 space-y-3 shrink-0">
          <button onClick={() => { completeWave(wave.id); setWaveId(null); setStep("waves"); }} className={bigBtn("bg-emerald-500 text-white")}><Check className="h-5 w-5" /> Send to consolidation</button>
          <button onClick={() => { setWaveId(null); setStep("waves"); }} className={bigBtn("bg-neutral-800 text-neutral-200 text-base min-h-[48px]")}>Back to waves</button>
        </div>
      </Frame>
    );
  }

  if (!task) return null;
  const remaining = task.qtyRequired - task.qtyPicked;
  const flashCls = flash === "ok" ? "ring-4 ring-emerald-500" : flash === "err" ? "ring-4 ring-red-500" : "";

  // ── ACTIVE STOP (bin / item / qty / short) ────────────────────────────────
  return (
    <Frame>
      <div className={cn("absolute inset-0 pointer-events-none transition", flash === "ok" && "bg-emerald-500/10", flash === "err" && "bg-red-500/15")} />
      <StatusBar label={wave.waveNumber} />

      {/* progress + next-stop header */}
      <div className="px-5 pt-1 shrink-0">
        <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1"><span>Stop {doneCount + 1} of {wave.totalLines}</span><span>{progress}%</span></div>
        <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${progress}%` }} /></div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-3">
        {/* location banner */}
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 mb-4">
          <div className="flex items-center gap-2 text-amber-400 text-[11px] uppercase tracking-wide"><MapPin className="h-4 w-4" /> Go to bin</div>
          <div className="text-white text-3xl font-mono font-bold mt-1">{task.binCode}</div>
          <div className="text-neutral-400 text-xs mt-0.5">{task.zone} · Aisle {task.aisle}</div>
        </div>

        {/* item card */}
        <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4 mb-4">
          <div className="flex items-center gap-2 text-neutral-400 text-[11px] uppercase tracking-wide"><Package className="h-4 w-4" /> Pick item</div>
          <div className="text-white text-lg font-semibold mt-1 leading-tight">{task.skuName}</div>
          <div className="flex items-center justify-between mt-2">
            <span className="font-mono text-amber-400">{task.skuCode}</span>
            <span className="text-neutral-300 text-sm">Need <b className="text-white text-lg">{remaining}</b> {task.uom}</span>
          </div>
        </div>

        {/* step body */}
        {step === "bin" && (
          <div className={cn("rounded-2xl bg-neutral-900 border border-neutral-800 p-4", flashCls)}>
            <div className="text-neutral-300 text-sm mb-2 flex items-center gap-2"><ScanLine className="h-4 w-4 text-amber-400" /> Scan bin barcode</div>
            <input value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tryScan(task.binCode, "item")}
              placeholder={task.binCode} className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-3 text-white font-mono text-center text-lg focus:outline-none focus:border-amber-400" />
            {flash === "err" && <div className="text-red-400 text-xs mt-2 text-center">Wrong bin — expected {task.binCode}</div>}
          </div>
        )}
        {step === "item" && (
          <div className={cn("rounded-2xl bg-neutral-900 border border-neutral-800 p-4", flashCls)}>
            <div className="text-emerald-400 text-xs mb-2 flex items-center gap-1"><Check className="h-4 w-4" /> Bin confirmed</div>
            <div className="text-neutral-300 text-sm mb-2 flex items-center gap-2"><ScanLine className="h-4 w-4 text-amber-400" /> Scan item barcode</div>
            <input value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tryScan(task.skuCode, "qty")}
              placeholder={task.skuCode} className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-3 text-white font-mono text-center text-lg focus:outline-none focus:border-amber-400" />
            {flash === "err" && <div className="text-red-400 text-xs mt-2 text-center">Wrong item — expected {task.skuCode}</div>}
          </div>
        )}
        {step === "qty" && (
          <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
            <div className="text-neutral-300 text-sm mb-3 text-center">Confirm quantity picked</div>
            <div className="flex items-center justify-center gap-5">
              <button onClick={() => setQty((q) => Math.max(0, q - 1))} className="h-14 w-14 rounded-full bg-neutral-800 text-white flex items-center justify-center active:scale-95"><Minus className="h-6 w-6" /></button>
              <span className="text-white text-5xl font-bold font-mono w-20 text-center">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(remaining, q + 1))} className="h-14 w-14 rounded-full bg-neutral-800 text-white flex items-center justify-center active:scale-95"><Plus className="h-6 w-6" /></button>
            </div>
            {qty < remaining && <div className="text-amber-400 text-xs mt-3 text-center flex items-center justify-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Short pick — {remaining - qty} under required</div>}
          </div>
        )}
        {step === "short" && (
          <div className="rounded-2xl bg-neutral-900 border border-red-500/30 p-4">
            <div className="text-red-400 text-sm mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Why can't you pick this?</div>
            <div className="space-y-2">
              {SHORT_REASONS.map((r) => (
                <button key={r.id} onClick={() => doShort(r.id)} className="w-full text-left rounded-xl bg-neutral-950 border border-neutral-800 px-4 py-3 text-neutral-200 active:scale-[0.99]">{r.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* pinned actions */}
      <div className="p-5 space-y-2.5 shrink-0 border-t border-neutral-900">
        {step === "bin" && (
          <button onClick={() => tryScan(task.binCode, "item")} className={bigBtn("bg-amber-400 text-neutral-950")}><ScanLine className="h-5 w-5" /> {scan ? "Confirm bin" : "Tap to scan"}</button>
        )}
        {step === "item" && (
          <button onClick={() => tryScan(task.skuCode, "qty")} className={bigBtn("bg-amber-400 text-neutral-950")}><ScanLine className="h-5 w-5" /> {scan ? "Confirm item" : "Tap to scan"}</button>
        )}
        {step === "qty" && (
          <button onClick={confirmPick} disabled={qty <= 0} className={bigBtn(qty <= 0 ? "bg-neutral-800 text-neutral-500" : "bg-emerald-500 text-white")}><Check className="h-5 w-5" /> Confirm pick</button>
        )}
        {step !== "short" ? (
          <button onClick={() => setStep("short")} className={bigBtn("bg-neutral-800 text-neutral-300 text-base min-h-[48px]")}>Can't pick — short / skip</button>
        ) : (
          <button onClick={() => setStep("bin")} className={bigBtn("bg-neutral-800 text-neutral-300 text-base min-h-[48px]")}><ArrowLeft className="h-4 w-4" /> Back</button>
        )}
      </div>
    </Frame>
  );
}
