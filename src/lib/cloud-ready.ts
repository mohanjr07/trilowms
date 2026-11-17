/**
 * Waits for every cloud-backed store to finish loading (from Supabase, or the browser copy
 * when Supabase is off or unreachable) before the app screens render, and re-reads them
 * when the tab becomes visible again so changes made elsewhere show up.
 */
import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { cloudSync, setCloudSignedIn } from "@/lib/cloud-storage";
import { useConsolidationStore } from "@/lib/consolidation-store";
import { useInboundStore } from "@/lib/inbound-store";
import { useInvBinStore } from "@/lib/inventory-bin-store";
import { useLaborStore } from "@/lib/labor-store";
import { useOrdersStore } from "@/lib/orders-store";
import { useOutboundStore } from "@/lib/outbound-store";
import { usePackingStore } from "@/lib/packing-store";
import { usePickingStore } from "@/lib/picking-store";
import { usePutawayStore } from "@/lib/putaway-store";
import { useQCStore } from "@/lib/qc-store";
import { useReturnsStore } from "@/lib/returns-store";
import { useSkuStore } from "@/lib/sku-store";
import { useSlottingStore } from "@/lib/slotting-store";
import { useStockStore } from "@/lib/stock-store";
import { useTransactionStore } from "@/lib/transaction-store";
import { useYardStore } from "@/lib/yard-store";

type Persisted = { persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void; rehydrate: () => Promise<void> | void } };

const STORES: Persisted[] = [
  useConsolidationStore, useInboundStore, useInvBinStore, useLaborStore, useOrdersStore, useOutboundStore,
  usePackingStore, usePickingStore, usePutawayStore, useQCStore, useReturnsStore, useSkuStore,
  useSlottingStore, useStockStore, useTransactionStore, useYardStore,
] as unknown as Persisted[];

const MAX_WAIT_MS = 9000;
let wasSignedIn = false;

export function useCloudReady(): boolean {
  const [ready, setReady] = useState(() => STORES.every((s) => s.persist.hasHydrated()));
  // True while stores are being re-read from Supabase right after sign-in.
  const [syncing, setSyncing] = useState(supabaseConfigured);

  // Follow the Supabase session: once signed in, allow cloud reads/writes and load the shared data.
  useEffect(() => {
    if (!supabaseConfigured) { setSyncing(false); return; }
    let alive = true;
    const apply = async (hasSession: boolean) => {
      const was = wasSignedIn;
      wasSignedIn = hasSession;
      if (!hasSession) { setCloudSignedIn(false); if (alive) setSyncing(false); return; }
      if (was) return;
      if (alive) setSyncing(true);
      setCloudSignedIn(true);
      await Promise.race([
        Promise.allSettled(STORES.map((s) => Promise.resolve(s.persist.rehydrate()))),
        new Promise((r) => setTimeout(r, MAX_WAIT_MS)),
      ]);
      // bin map follows the stock ledger (goods moved while the bin map was closed never reached it)
      try { useInvBinStore.getState().reconcileWithStock(); } catch { /* best-effort */ }
      if (alive) setSyncing(false);
    };
    void supabase.auth.getSession().then(({ data }) => apply(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { void apply(Boolean(session)); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (ready) return;
    let done = false;
    const finish = () => { if (!done) { done = true; setReady(true); } };
    const check = () => { if (STORES.every((s) => s.persist.hasHydrated())) finish(); };
    const offs = STORES.map((s) => s.persist.onFinishHydration(check));
    check();
    const t = setTimeout(finish, MAX_WAIT_MS);   // never block the app on a slow network
    return () => { offs.forEach((o) => o()); clearTimeout(t); };
  }, [ready]);

  // Pick up changes made on another device/tab when this tab comes back to the front.
  useEffect(() => {
    if (!supabaseConfigured) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible" || cloudSync.hasPending()) return;
      STORES.forEach((s) => { void s.persist.rehydrate(); });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return ready && !syncing;
}
