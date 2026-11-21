/** Mobile · Receive — inbound ASNs: arrive → dock → receive lines → complete. */
import { useMemo, useState } from "react";
import { Truck, PackageCheck } from "lucide-react";
import { useInboundStore, type ASN, type AsnLine, type AsnStatus } from "@/lib/inbound-store";
import { useAuthStore } from "@/lib/auth-store";
import { Card, Chip, BigButton, Segmented, Sheet, Field, Row, Empty, SearchBox, timeAgo, type Tone } from "./ui";

type Tab = "expected" | "gate" | "receiving" | "done";
const TAB_OF: Record<AsnStatus, Tab> = {
  PENDING: "expected", SCHEDULED: "expected", ARRIVED: "gate", DOCKED: "receiving", RECEIVING: "receiving",
  PARTIAL: "receiving", RECEIVED: "done", DISCREPANCY: "receiving", CLOSED: "done", CANCELLED: "done",
};
const STATUS_TONE: Record<AsnStatus, Tone> = {
  PENDING: "neutral", SCHEDULED: "info", ARRIVED: "warning", DOCKED: "primary", RECEIVING: "primary",
  PARTIAL: "warning", RECEIVED: "success", DISCREPANCY: "danger", CLOSED: "success", CANCELLED: "neutral",
};

export function ReceiveScreen() {
  const asns = useInboundStore((s) => s.asns);
  const [tab, setTab] = useState<Tab>("receiving");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { expected: 0, gate: 0, receiving: 0, done: 0 };
    asns.forEach((a) => { c[TAB_OF[a.status]]++; });
    return c;
  }, [asns]);

  const list = asns
    .filter((a) => TAB_OF[a.status] === tab)
    .filter((a) => !q.trim() || `${a.asnNumber} ${a.vendor} ${a.truckNumber ?? ""} ${a.carrierName}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="p-3 space-y-3">
      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { id: "expected", label: "Expected", count: counts.expected },
        { id: "gate", label: "At gate", count: counts.gate },
        { id: "receiving", label: "Receiving", count: counts.receiving },
        { id: "done", label: "Done", count: counts.done },
      ]} />
      <SearchBox value={q} onChange={setQ} placeholder="Search ASN, vendor, truck" />
      {list.length === 0 && <Empty title="Nothing here" hint="No shipments in this stage." />}
      {list.map((a) => (
        <Card key={a.id} onClick={() => setOpenId(a.id)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-sm font-bold text-primary">{a.asnNumber}</div>
              <div className="text-sm font-semibold truncate">{a.vendor}</div>
            </div>
            <Chip tone={STATUS_TONE[a.status]}>{a.status}</Chip>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" />{a.carrierName}{a.truckNumber ? ` · ${a.truckNumber}` : ""}</span>
            {a.dockCode && <span>Dock {a.dockCode}</span>}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${a.totalUnits ? Math.min(100, Math.round((a.receivedUnits / a.totalUnits) * 100)) : 0}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>{a.receivedUnits}/{a.totalUnits} units · {a.totalLines} lines</span>
            <span>{a.actualArrival ? `arrived ${timeAgo(a.actualArrival)}` : new Date(a.scheduledArrival).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </Card>
      ))}
      <AsnSheet asnId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function AsnSheet({ asnId, onClose }: { asnId: string | null; onClose: () => void }) {
  const asn = useInboundStore((s) => s.asns.find((a) => a.id === asnId)) ?? null;
  const { updateAsnStatus, dockTruck } = useInboundStore();
  const docks = useInboundStore((s) => s.dockDoors);
  const free = docks.filter((d) => d.status === "AVAILABLE" && d.type !== "OUTBOUND");
  const [pickDock, setPickDock] = useState(false);

  return (
    <Sheet open={!!asn} onClose={() => { setPickDock(false); onClose(); }} title={asn ? asn.asnNumber : ""}>
      {asn && (
        <>
          <div className="rounded-xl border border-border bg-card/40 px-3 py-1">
            <Row label="Vendor" value={asn.vendor} />
            <Row label="Carrier" value={`${asn.carrierName}${asn.truckNumber ? " · " + asn.truckNumber : ""}`} />
            <Row label="Status" value={<Chip tone={STATUS_TONE[asn.status]}>{asn.status}</Chip>} />
            <Row label="Dock" value={asn.dockCode ?? "—"} />
            <Row label="Units" value={`${asn.receivedUnits} / ${asn.totalUnits}`} />
          </div>

          <div className="grid gap-2">
            {asn.status === "PENDING" && <BigButton tone="ghost" onClick={() => updateAsnStatus(asn.id, "SCHEDULED")}>Schedule</BigButton>}
            {asn.status === "SCHEDULED" && <BigButton onClick={() => updateAsnStatus(asn.id, "ARRIVED")}><Truck className="h-5 w-5" /> Mark truck arrived</BigButton>}
            {asn.status === "ARRIVED" && !pickDock && <BigButton onClick={() => setPickDock(true)}>Assign dock door</BigButton>}
            {asn.status === "ARRIVED" && pickDock && (
              free.length === 0 ? <div className="text-sm text-amber-400">No free inbound dock door right now.</div> :
              <div className="grid grid-cols-3 gap-2">
                {free.map((d) => (
                  <BigButton key={d.id} tone="ghost" onClick={() => { dockTruck(asn.id, d.id); setPickDock(false); }}>{d.code}</BigButton>
                ))}
              </div>
            )}
            {["DOCKED", "PARTIAL"].includes(asn.status) && <BigButton onClick={() => updateAsnStatus(asn.id, "RECEIVING")}>Start receiving</BigButton>}
            {["RECEIVING", "PARTIAL"].includes(asn.status) && (
              <BigButton tone="success" disabled={asn.receivedUnits <= 0} onClick={() => { updateAsnStatus(asn.id, "RECEIVED"); onClose(); }}>
                <PackageCheck className="h-5 w-5" /> Complete receiving
              </BigButton>
            )}
            {asn.status === "RECEIVED" && asn.receivedUnits > 0 && <BigButton tone="ghost" onClick={() => { updateAsnStatus(asn.id, "CLOSED"); onClose(); }}>Close ASN</BigButton>}
          </div>

          {["RECEIVING", "PARTIAL", "DISCREPANCY"].includes(asn.status) && (
            <div className="space-y-2 pt-1">
              <div className="text-[13px] font-bold tracking-wide text-muted-foreground uppercase">Lines</div>
              {asn.lines.map((l) => <LineCard key={l.id} asn={asn} line={l} />)}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

function LineCard({ asn, line }: { asn: ASN; line: AsnLine }) {
  const receiveLine = useInboundStore((s) => s.receiveLine);
  const user = useAuthStore((s) => s.session?.user);
  const [open, setOpen] = useState(false);
  const [good, setGood] = useState("");
  const [damaged, setDamaged] = useState("");
  const [lot, setLot] = useState(line.lotNumber ?? "");
  const [err, setErr] = useState<string | null>(null);
  const remaining = Math.max(0, line.expectedQty - line.receivedQty);
  const done = ["RECEIVED", "OVER_RECEIPT", "REJECTED"].includes(line.status);

  const submit = () => {
    const g = parseInt(good) || 0;
    const d = parseInt(damaged) || 0;
    if (g + d <= 0) { setErr("Enter a quantity."); return; }
    if (g > remaining) { setErr(`Only ${remaining} ${line.uom} left on this line.`); return; }
    setErr(null);
    receiveLine(asn.id, line.id, g, { damagedQty: d, lotNumber: lot || null, receivedBy: user?.name });
    setOpen(false); setGood(""); setDamaged("");
  };

  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-xs font-bold text-primary">{line.skuCode}</div>
          <div className="text-sm truncate">{line.skuName}</div>
        </div>
        <Chip tone={done ? "success" : "neutral"}>{line.receivedQty}/{line.expectedQty} {line.uom}</Chip>
      </div>
      {!done && !open && <BigButton tone="ghost" className="mt-2 w-full" onClick={() => { setOpen(true); setGood(String(remaining)); }}>Receive</BigButton>}
      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Good qty" value={good} onChange={setGood} inputMode="numeric" />
            <Field label="Damaged" value={damaged} onChange={setDamaged} inputMode="numeric" placeholder="0" />
          </div>
          <Field label="Lot / batch" value={lot} onChange={setLot} placeholder="optional" />
          {err && <div className="text-sm text-red-400">{err}</div>}
          <div className="grid grid-cols-2 gap-2">
            <BigButton tone="ghost" onClick={() => setOpen(false)}>Cancel</BigButton>
            <BigButton tone="success" onClick={submit}>Confirm</BigButton>
          </div>
        </div>
      )}
    </div>
  );
}
