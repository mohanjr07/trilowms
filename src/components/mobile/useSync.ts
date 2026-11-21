/**
 * Keeps downstream queues filled on the phone the same way the desktop pages do, so nobody has to press a "Sync" button:
 * inbound/QC → putaway tasks, picking → consolidation → packing → outbound shipments.
 */
import { useEffect } from "react";
import { usePutawayStore } from "@/lib/putaway-store";
import { usePackingStore } from "@/lib/packing-store";
import { useInboundStore } from "@/lib/inbound-store";
import { useQCStore } from "@/lib/qc-store";
import { usePickingStore } from "@/lib/picking-store";
import { useConsolidationStore } from "@/lib/consolidation-store";
import { useOutboundStore } from "@/lib/outbound-store";

const safe = (fn: () => unknown) => { try { fn(); } catch { /* best effort */ } };

export function useConsolidationSync() {
  useEffect(() => {
    const toPutaway = () => safe(() => usePutawayStore.getState().syncFromInbound());
    const toConsolidation = () => safe(() => useConsolidationStore.getState().syncFromPicking());
    const toPacking = () => safe(() => usePackingStore.getState().syncFromConsolidation());
    const toOutbound = () => safe(() => useOutboundStore.getState().syncFromPacking());
    toPutaway(); toConsolidation(); toPacking(); toOutbound();
    const unsubs = [
      useInboundStore.subscribe(toPutaway),
      useQCStore.subscribe(toPutaway),
      usePickingStore.subscribe(toConsolidation),
      useConsolidationStore.subscribe(toPacking),
      usePackingStore.subscribe(toOutbound),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);
}
