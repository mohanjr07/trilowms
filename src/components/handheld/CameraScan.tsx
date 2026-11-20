/**
 * Camera barcode scanning for phones (no hardware scanner needed).
 * Opens the rear camera, decodes the first barcode/QR it sees, then types the
 * value into the screen's active scan input and presses Enter for the user —
 * so it behaves exactly like a keyboard-wedge hardware scanner.
 */
import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";

function feedScanInput(value: string) {
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input")).filter((i) => i.offsetParent !== null && i.type !== "hidden");
  const target = inputs.find((i) => i.classList.contains("font-mono")) ?? inputs[0];
  if (!target) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(target, value);
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.focus();
  setTimeout(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
  }, 150);
}

export function CameraScanButton() {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    const reader = new BrowserMultiFormatReader();
    let controls: { stop: () => void } | undefined;
    let cancelled = false;
    reader
      .decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, videoRef.current!, (result) => {
        if (result && !cancelled) {
          cancelled = true;
          controls?.stop();
          if (navigator.vibrate) navigator.vibrate(60);
          setOpen(false);
          feedScanInput(result.getText());
        }
      })
      .then((c) => { controls = c; if (cancelled) c.stop(); })
      .catch(() => setErr("Camera not available. Allow camera access and try again."));
    return () => { cancelled = true; controls?.stop(); };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Scan with camera"
        className="absolute bottom-24 right-3 z-30 h-12 w-12 rounded-full bg-amber-400 text-neutral-950 shadow-lg flex items-center justify-center active:scale-95"
      >
        <Camera className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute inset-0 z-40 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 pt-8 pb-2 text-white text-sm">
            <span>Point the camera at a barcode</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close camera"><X className="h-5 w-5" /></button>
          </div>
          <video ref={videoRef} className="flex-1 w-full object-cover" muted playsInline />
          {err && <div className="absolute bottom-6 inset-x-4 text-center text-red-400 text-xs">{err}</div>}
        </div>
      )}
    </>
  );
}
