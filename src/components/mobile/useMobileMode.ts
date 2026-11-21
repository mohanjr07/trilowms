/**
 * Decides whether to show the phone app UI.
 *  - Admin and warehouse admin always get the desktop UI.
 *  - Everyone else gets the mobile app UI on a phone-sized screen (or when forced with ?mobile=1 / the "mobile" view mode).
 *  - "More → Use desktop layout" stores an override; ?mobile=1 or ?desktop=1 in the URL switch it back.
 */
import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { DESKTOP_ROLES } from "./nav";

const KEY = "trilowms-view";
type Mode = "mobile" | "desktop" | null;

function readMode(): Mode {
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.get("mobile") === "1") { localStorage.setItem(KEY, "mobile"); return "mobile"; }
    if (p.get("desktop") === "1") { localStorage.setItem(KEY, "desktop"); return "desktop"; }
    const v = localStorage.getItem(KEY);
    return v === "mobile" || v === "desktop" ? v : null;
  } catch { return null; }
}

export function setViewMode(m: "mobile" | "desktop" | null) {
  try { if (m) localStorage.setItem(KEY, m); else localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event("trilowms-view"));
}

/** True inside the Android/iOS app wrapper (Capacitor WebView). */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  try { if (w.Capacitor?.isNativePlatform?.()) return true; } catch { /* ignore */ }
  return /; wv\)|TriloWMSApp/.test(navigator.userAgent);
}

export function useMobileMode(): boolean {
  const role = useAuthStore((s) => s.session?.user.role);
  const [, bump] = useState(0);
  const [narrow, setNarrow] = useState(() => (typeof window === "undefined" ? false : window.innerWidth < 768));

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 768);
    const onView = () => bump((n) => n + 1);
    window.addEventListener("resize", onResize);
    window.addEventListener("trilowms-view", onView);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("trilowms-view", onView); };
  }, []);

  if (typeof window !== "undefined" && role && isNativeApp()) return true;
  if (typeof window === "undefined" || !role || DESKTOP_ROLES.includes(role)) return false;
  const mode = readMode();
  if (mode === "desktop") return false;
  if (mode === "mobile") return true;
  return narrow;
}
