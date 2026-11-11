/**
 * TriloWMS — physical barcode scanner support.
 *
 * Keyboard-wedge scanners (USB, Bluetooth, and the built-in scanner on
 * Zebra/Honeywell Android handhelds in "keyboard output" mode) type the
 * barcode like a very fast keyboard and finish with Enter. Everything here
 * is built on that, so it works with any scanner and needs no driver.
 *
 *  - skuMatches / findSku  accept the SKU code OR the EAN/UPC printed on the
 *    goods (the SKU Master "Barcode" field).
 *  - binMatches            compares bin labels ignoring case and spaces.
 *  - useScanListener       catches a scan anywhere on a page, even when no
 *    input is focused.
 *  - scanBeep              audible good/bad confirmation for the floor.
 */
import { useEffect, useRef } from "react";
import { useSkuStore, type SKU } from "@/lib/sku-store";

/** Trim, drop control characters (scanner prefix/suffix), upper-case. */
export function normalizeScan(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().toUpperCase();
}

const squash = (s: string) => normalizeScan(s).replace(/\s+/g, "");

/** Find a SKU in the master by SKU code or by its printed barcode. */
export function findSku(raw: string): SKU | null {
  const v = squash(raw);
  if (!v) return null;
  const skus = useSkuStore.getState().skus;
  return skus.find((s) => squash(s.skuCode) === v || squash(s.barcode ?? "") === v) ?? null;
}

/** True when a scan identifies the given SKU code (by code or by barcode). */
export function skuMatches(raw: string, skuCode: string): boolean {
  const v = squash(raw);
  if (!v) return false;
  if (v === squash(skuCode)) return true;
  const sku = useSkuStore.getState().skus.find((s) => squash(s.skuCode) === squash(skuCode));
  return !!sku && !!sku.barcode && squash(sku.barcode) === v;
}

export function binMatches(raw: string, binCode: string): boolean {
  const v = squash(raw);
  return !!v && v === squash(binCode);
}

let audioCtx: AudioContext | null = null;
/** Short beep: high tone for a good scan, low double-tone for a bad one. */
export function scanBeep(ok: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx ?? new Ctx();
    const tone = (freq: number, start: number, dur: number) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(audioCtx!.currentTime + start);
      osc.stop(audioCtx!.currentTime + start + dur);
    };
    if (ok) tone(1800, 0, 0.09);
    else { tone(300, 0, 0.14); tone(300, 0.18, 0.14); }
  } catch { /* sound is a nicety, never block a scan */ }
}

/**
 * Calls onScan(code) for every barcode scanned while the page is open.
 * A scan is recognised as 3+ characters arriving less than 60 ms apart and
 * ended by Enter, which humans can't type, so normal typing is never
 * mistaken for a scan. Scans that land inside a text field are left to that
 * field's own Enter handling (set allowInInputs to also catch those).
 */
export function useScanListener(onScan: (code: string) => void, enabled = true, allowInInputs = false) {
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    let buf = "";
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (inField && !allowInInputs) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const now = performance.now();
      if (e.key === "Enter") {
        const code = buf;
        buf = "";
        if (code.length >= 3) { e.preventDefault(); cb.current(normalizeScan(code)); }
        return;
      }
      if (e.key.length !== 1) return;
      if (now - last > 60) buf = "";
      buf += e.key;
      last = now;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, allowInInputs]);
}
