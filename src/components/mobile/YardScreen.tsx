/** Mobile · Yard — gate in, assign dock, move through the yard flow, gate out. */
import { useMemo, useState } from "react";
import { LogIn, LogOut, Flame } from "lucide-react";
import { useYardStore, type YardTruck, type YardTruckStatus } from "@/lib/yard-store";
import { Card, Chip, BigButton, Segmented, Sheet, Field, Row, Empty, SearchBox, type Tone } from "./ui";

type Tab = "waiting" | "docked" | "all";
const WAIT: YardTruckStatus[] = ["GATE_IN", "WAITING", "DOCKING"];
const DOCKED: YardTruckStatus[] = ["DOCKED_IN", "DOCKED_OUT", "LOADING", "UNLOADING", "LOADED"];
const TONE = (s: YardTruckStatus): Tone => (WAIT.includes(s) ? "warning" : DOCKED.includes(s) ? "primary" : "neutral");
const LABEL = (s: YardTruckStatus) => s.replace(/_/g, " ");

export function YardScreen() {
  const trucks = useYardStore((s) => s.trucks);
  const [tab, setTab] = useState<Tab>("waiting");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  const active = useMemo(() => trucks.filter((t) => !["GATE_OUT", "DEPARTED"].includes(t.status)), [trucks]);
  const list = active
    .filter((t) => (tab === "waiting" ? WAIT.includes(t.status) : tab === "docked" ? DOCKED.includes(t.status) : true))
    .filter((t) => !q.trim() || `${t.truckNumber} ${t.plateNumber} ${t.carrier} ${t.driver}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-3 space-y-3">
      <BigButton className="w-full" onClick={() => setGateOpen(true)}><LogIn className="h-5 w-5" /> Gate in a truck</BigButton>
      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { id: "waiting", label: "Waiting", count: active.filter((t) => WAIT.includes(t.status)).length },
        { id: "docked", label: "At dock", count: active.filter((t) => DOCKED.includes(t.status)).length },
        { id: "all", label: "All", count: active.length },
      ]} />
      <SearchBox value={q} onChange={setQ} placeholder="Search truck, plate, driver" />
      {list.length === 0 && <Empty title="No trucks" hint="Nothing in this list." />}
      {list.map((t) => (
        <Card key={t.id} onClick={() => setOpenId(t.id)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-sm font-bold text-primary flex items-center gap-1.5">{t.truckNumber}{t.hazmat && <Flame className="h-3.5 w-3.5 text-red-400" />}</div>
              <div className="text-sm truncate">{t.carrier} · {t.plateNumber}</div>
            </div>
            <Chip tone={TONE(t.status)}>{LABEL(t.status)}</Chip>
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>{t.direction === "INBOUND" ? "Inbound" : "Outbound"}{t.dockCode ? ` · Dock ${t.dockCode}` : ""}</span>
            <span className={t.dwellAlert ? "text-red-400 font-semibold" : ""}>Dwell {Math.floor(t.dwellMinutes / 60)}h {t.dwellMinutes % 60}m</span>
          </div>
        </Card>
      ))}
      <TruckSheet truckId={openId} onClose={() => setOpenId(null)} />
      <GateInSheet open={gateOpen} onClose={() => setGateOpen(false)} />
    </div>
  );
}

function TruckSheet({ truckId, onClose }: { truckId: string | null; onClose: () => void }) {
  const truck: YardTruck | null = useYardStore((s) => s.trucks.find((t) => t.id === truckId)) ?? null;
  const docks = useYardStore((s) => s.docks);
  const { updateTruckStatus, assignDock, gateOut } = useYardStore();
  const [pick, setPick] = useState(false);
  if (!truck) return <Sheet open={false} onClose={onClose} title="" children={null} />;

  const flow: YardTruckStatus[] = ["GATE_IN", "WAITING", "DOCKING", truck.direction === "INBOUND" ? "DOCKED_IN" : "DOCKED_OUT", truck.direction === "INBOUND" ? "UNLOADING" : "LOADING", "LOADED", "GATE_OUT"];
  const idx = flow.indexOf(truck.status);
  const next = idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
  const free = docks.filter((d) => d.status === "AVAILABLE" && (truck.direction === "INBOUND" ? d.type !== "OUTBOUND" : d.type !== "INBOUND"));

  return (
    <Sheet open onClose={() => { setPick(false); onClose(); }} title={truck.truckNumber}>
      <div className="rounded-xl border border-border bg-card/40 px-3 py-1">
        <Row label="Carrier" value={truck.carrier} />
        <Row label="Driver" value={`${truck.driver}${truck.driverMobile && truck.driverMobile !== "—" ? " · " + truck.driverMobile : ""}`} />
        <Row label="Direction" value={truck.direction} />
        <Row label="Status" value={<Chip tone={TONE(truck.status)}>{LABEL(truck.status)}</Chip>} />
        <Row label="Dock" value={truck.dockCode ?? "—"} />
        <Row label="Spot" value={truck.spotNumber ?? "—"} />
      </div>
      <div className="grid gap-2">
        {!truck.dockCode && !pick && free.length > 0 && <BigButton onClick={() => setPick(true)}>Assign dock door</BigButton>}
        {!truck.dockCode && pick && (
          <div className="grid grid-cols-3 gap-2">
            {free.map((d) => <BigButton key={d.id} tone="ghost" onClick={() => { assignDock(truck.id, d.id); setPick(false); }}>{d.code}</BigButton>)}
          </div>
        )}
        {!truck.dockCode && free.length === 0 && <div className="text-sm text-amber-400">No free dock door for this truck.</div>}
        {next && next !== "GATE_OUT" && <BigButton tone="ghost" onClick={() => updateTruckStatus(truck.id, next)}>Move to: {LABEL(next)}</BigButton>}
        <BigButton tone="success" onClick={() => { gateOut(truck.id); onClose(); }}><LogOut className="h-5 w-5" /> Gate out</BigButton>
      </div>
    </Sheet>
  );
}

function GateInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const gateIn = useYardStore((s) => s.gateIn);
  const [truckNumber, setTruckNumber] = useState("");
  const [plate, setPlate] = useState("");
  const [carrier, setCarrier] = useState("");
  const [driver, setDriver] = useState("");
  const [mobile, setMobile] = useState("");
  const [dir, setDir] = useState<"INBOUND" | "OUTBOUND">("INBOUND");
  const [hazmat, setHazmat] = useState(false);
  const ok = truckNumber.trim() && carrier.trim() && driver.trim();

  const submit = () => {
    if (!ok) return;
    gateIn({
      truckNumber: truckNumber.trim(), plateNumber: plate.trim() || "—", carrier: carrier.trim(), direction: dir,
      driver: driver.trim(), driverMobile: mobile.trim() || "—", status: "GATE_IN", yardPosition: "STAGING", spotNumber: null,
      dockId: null, dockCode: null, appointmentId: null, asnId: null, shipmentId: null, dockAssignedTime: null, departureTime: null,
      dwellThresholdMinutes: 120, seals: [], hazmat, priority: "NORMAL", notes: null,
    });
    setTruckNumber(""); setPlate(""); setCarrier(""); setDriver(""); setMobile(""); setHazmat(false);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Gate in">
      <Segmented<"INBOUND" | "OUTBOUND"> value={dir} onChange={setDir} options={[{ id: "INBOUND", label: "Inbound" }, { id: "OUTBOUND", label: "Outbound" }]} />
      <Field label="Truck # *" value={truckNumber} onChange={setTruckNumber} placeholder="TRK-4021" />
      <Field label="Plate" value={plate} onChange={setPlate} />
      <Field label="Carrier *" value={carrier} onChange={setCarrier} />
      <Field label="Driver *" value={driver} onChange={setDriver} />
      <Field label="Driver mobile" value={mobile} onChange={setMobile} type="tel" />
      <label className="flex items-center gap-3 py-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={hazmat} onChange={(e) => setHazmat(e.target.checked)} /> Hazmat load</label>
      <BigButton className="w-full" disabled={!ok} onClick={submit}>Gate in</BigButton>
    </Sheet>
  );
}
