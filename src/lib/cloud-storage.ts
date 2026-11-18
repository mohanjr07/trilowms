/**
 * Supabase-backed storage for the zustand `persist` stores.
 *
 * - Every write goes to the browser immediately (so a refresh never loses work)
 *   and is pushed to Supabase a moment later (debounced, one row per store).
 * - On load, the Supabase copy wins when it exists. If Supabase has nothing yet,
 *   this browser's data is uploaded as the starting point.
 * - If Supabase is not configured or unreachable, everything keeps working from
 *   the browser copy only.
 *
 * Table: public.wms_store_snapshots (see supabase/migrations/002_wms_store_snapshots.sql).
 * Conflict rule: last write wins per store. Two people editing the same store at
 * the same moment will overwrite each other; each browser re-reads when its tab
 * becomes visible again.
 */
import { createJSONStorage, type StateStorage } from "zustand/middleware";
import { supabase, supabaseConfigured } from "./supabase";

/** Set by the auth layer: true once a Supabase session exists. Until then everything stays in this browser. */
let signedIn = false;
const signInListeners = new Set<() => void>();
export function setCloudSignedIn(v: boolean) {
  const changed = signedIn !== v;
  signedIn = v;
  if (changed && v) signInListeners.forEach((fn) => fn());
}
/** Called when a session appears (after login or on reload) so stores re-read from Supabase. */
export function onCloudSignIn(fn: () => void) { signInListeners.add(fn); return () => { signInListeners.delete(fn); }; }

const TABLE = "wms_store_snapshots";
const PUSH_DELAY_MS = 1200;
const LOAD_TIMEOUT_MS = 6000;

const local = {
  get(name: string): string | null {
    try { return typeof window === "undefined" ? null : window.localStorage.getItem(name); } catch { return null; }
  },
  set(name: string, value: string) {
    try { if (typeof window !== "undefined") window.localStorage.setItem(name, value); } catch { /* quota / private mode */ }
  },
  remove(name: string) {
    try { if (typeof window !== "undefined") window.localStorage.removeItem(name); } catch { /* ignore */ }
  },
};

/** JSON with sorted keys. Postgres jsonb reorders object keys, so a plain string compare says "changed"
 *  for data that is identical, which made every page load re-upload every store. */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}
const canonOf = (raw: string): string => { try { return canon(JSON.parse(raw)); } catch { return raw; } };

const lastSynced = new Map<string, string>();   // canonical form of the last value known to be in Supabase
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const queued = new Map<string, string>();       // latest value waiting to be pushed
let pushErrors = 0;

export const cloudSync = {
  /** True while local changes have not reached Supabase yet. */
  hasPending: () => queued.size > 0,
  /** Number of failed pushes since load (shown nowhere yet; useful in the console). */
  errors: () => pushErrors,
};

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function push(name: string) {
  const value = queued.get(name);
  if (value === undefined) return;
  if (!signedIn) return;
  const canonical = canonOf(value);
  if (lastSynced.get(name) === canonical) { queued.delete(name); return; }
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ name, state: JSON.parse(value), updated_at: new Date().toISOString() }, { onConflict: "name" });
    if (error) throw error;
    lastSynced.set(name, canonical);
    if (queued.get(name) === value) queued.delete(name);
  } catch {
    pushErrors++;
    // keep it queued; retry on the next write or when the tab becomes visible
  }
}

function schedule(name: string, value: string) {
  queued.set(name, value);
  const t = timers.get(name);
  if (t) clearTimeout(t);
  timers.set(name, setTimeout(() => { timers.delete(name); void push(name); }, PUSH_DELAY_MS));
}

/** Push anything still waiting (used when the tab is hidden or closing). */
export function flushCloudSync() {
  for (const name of [...queued.keys()]) {
    const t = timers.get(name);
    if (t) { clearTimeout(t); timers.delete(name); }
    void push(name);
  }
}

const cloudStateStorage: StateStorage = {
  getItem: async (name) => {
    const localValue = local.get(name);
    if (!supabaseConfigured || !signedIn) return localValue;
    // Don't replace newer local edits with an older remote copy.
    if (queued.has(name)) return localValue;
    try {
      const { data, error } = await withTimeout(
        supabase.from(TABLE).select("state").eq("name", name).maybeSingle(),
        LOAD_TIMEOUT_MS,
      );
      if (error) throw error;
      if (data?.state) {
        const s = JSON.stringify(data.state);
        lastSynced.set(name, canon(data.state));
        local.set(name, s);
        return s;
      }
      // Nothing in Supabase yet: this browser's data becomes the starting copy.
      if (localValue) schedule(name, localValue);
      return localValue;
    } catch {
      return localValue;
    }
  },
  setItem: (name, value) => {
    local.set(name, value);
    if (supabaseConfigured && signedIn) schedule(name, value);
  },
  removeItem: (name) => {
    local.remove(name);
    lastSynced.delete(name);
    queued.delete(name);
  },
};

/** Drop-in `storage` option for zustand `persist`. */
export const cloudJSONStorage = createJSONStorage(() => cloudStateStorage);

if (typeof window !== "undefined" && supabaseConfigured) {
  const flush = () => { if (document.visibilityState === "hidden") flushCloudSync(); };
  document.addEventListener("visibilitychange", flush);
  window.addEventListener("pagehide", flushCloudSync);
}
