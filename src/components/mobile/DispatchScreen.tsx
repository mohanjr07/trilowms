/** Mobile · Dispatch — outbound shipments: stage → load cartons → seal → dispatch. */
import { useMemo, useState } from "react";
import { Send, ScanLine } from "lucide-react";
import { useOutboundStore, type Shipment, type ShipmentStatus } from "@/lib/outbound-store";
import { Card, Chip, BigButton, Segmented, Sheet, Field, Row, Empty, SearchBox, type Tone } from "./ui";

type Tab = "plan" | "loading" | "gone";
const TAB_OF: Record<ShipmentStatus, Tab> = {
  PLANNED: "plan", STAGED: "plan", LOADING: "loading", LOADED: "loading",
  DISPATCHED: "gone", IN_TRANSIT: "gone", DELIVERED: "gone", EXCEPTION: "loading", RETURNED: "gone",
};
const TONE: Record<ShipmentStatus, Tone> = {
  PLANNED: "neutral", STAGED: "info", LOADING: "warning", LOADED: "primary", DISPATCHED: "success",
  IN_TRANSIT: "success", DELIVERED: "success", EXCEPTION: "danger", RETURNED: "danger",
};

export function DispatchScreen() {
  const shipments = useOutboundStore((s) => s.shipments);
  const syncFromPacking = useOutboundStore((s) => s.syncFromPacking);
  const [tab, setTab] = useState<Tab>("loading");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { plan: 0, loading: 0, gone: 0 };
    shipments.forEach((s) => { c[TAB_OF[s.status]]++; });
    return c;
  }, [shipments]);

  const list = shipments
    .filter((s) => TAB_OF[s.status] === tab)
    .filter((s) => !q.trim() || `${s.shipmentNumber} ${s.carrier} ${s.orders.map((o) => o.customer).join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.scheduledDispatch.localeCompare(b.scheduledDispatch));

  return (
    <div className="p-3 space-y-3">
      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { id: "plan", label: "To stage", count: counts.plan },
        { id: "loading", label: "Loading", count: counts.loading },
        { id: "gone", label: "Dispatched", count: counts.gone },
      ]} />
      <SearchBox value={q} onChange={setQ} placeholder="Search shipment, carrier, customer" />
      <BigButton tone="ghost" className="w-full" onClick={() => syncFromPacking()}>Pull packed orders</BigButton>
      {list.length === 0 && <Empty title="Nothing here" hint="No shipments in this stage." />}
      {list.map((s) => (
        <Card key={s.id} onClick={() => setOpenId(s.id)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-sm font-bold text-primary">{s.shipmentNumber}</div>
              <div className="text-sm font-semibold truncate">{s.carrier} · {s.serviceLevel}</div>
            </div>
            <Chip tone={TONE[s.status]}>{s.status.replace("_", " ")}</Chip>
          </div>
          <div className="mt-1 text-xs text-muted-foreground truncate">{s.orders.map((o) => o.customer).filter((v, i, a) => a.indexOf(v) === i).join(", ") || "—"}</div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>{s.loadedCartons}/{s.totalCartons} cartons · {s.totalOrders} orders</span>
            <span>Due {new Date(s.scheduledDispatch).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </Card>
      ))}
      <ShipmentSheet shipmentId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function ShipmentSheet({ shipmentId, onClose }: { shipmentId: string | null; onClose: () => void }) {
  const s: Shipment | null = useOutboundStore((st) => st.shipments.find((x) => x.id === shipmentId)) ?? null;
  const { updateStatus, recordCartonLoad, sealAndConfirmDispatch } = useOutboundStore();
  const [seal, setSeal] = useState("");
  const remaining = s ? s.totalCartons - s.loadedCartons : 0;

  return (
    <Sheet open={!!s} onClose={onClose} title={s ? s.shipmentNumber : ""}>
      {s && (
        <>
          <div className="rounded-xl border border-border bg-card/40 px-3 py-1">
            <Row label="Carrier" value={`${s.carrier} · ${s.serviceLevel}`} />
            <Row label="Status" value={<Chip tone={TONE[s.status]}>{s.status}</Chip>} />
            <Row label="Dock" value={s.dockCode ?? "—"} />
            <Row label="Cartons" value={`${s.loadedCartons} / ${s.totalCartons}`} />
            <Row label="Weight" value={`${s.totalWeight} kg`} />
            {s.sealNumber && <Row label="Seal" value={s.sealNumber} />}
          </div>
          <div className="grid gap-2">
            {s.status === "PLANNED" && <BigButton onClick={() => updateStatus(s.id, "STAGED")}>Stage at dock</BigButton>}
            {s.status === "STAGED" && <BigButton onClick={() => updateStatus(s.id, "LOADING")}>Start loading</BigButton>}
            {s.status === "LOADING" && remaining > 0 && (
              <>
                <BigButton onClick={() => recordCartonLoad(s.id, 1)}><ScanLine className="h-5 w-5" /> Scan carton (+1)</BigButton>
                <BigButton tone="ghost" onClick={() => recordCartonLoad(s.id, remaining)}>Load all {remaining} remaining</BigButton>
              </>
            )}
            {["LOADING", "LOADED"].includes(s.status) && (
              <div className="space-y-2 pt-1">
                <Field label="Seal number" value={seal} onChange={setSeal} placeholder="Enter seal #" />
                <BigButton tone="success" className="w-full" disabled={!seal.trim() || remaining > 0} onClick={() => { if (sealAndConfirmDispatch(s.id, seal.trim())) { setSeal(""); onClose(); } }}>
                  <Send className="h-5 w-5" /> Confirm dispatch
                </BigButton>
                {remaining > 0 && (
                  <BigButton tone="ghost" className="w-full" disabled={!seal.trim()} onClick={() => { if (sealAndConfirmDispatch(s.id, seal.trim(), true)) { setSeal(""); onClose(); } }}>
                    Dispatch with partial load
                  </BigButton>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
