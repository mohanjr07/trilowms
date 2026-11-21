/** Mobile · Insights — read-only live numbers across modules and open exceptions. */
import { useInboundStore } from "@/lib/inbound-store";
import { useOutboundStore } from "@/lib/outbound-store";
import { usePickingStore } from "@/lib/picking-store";
import { usePutawayStore } from "@/lib/putaway-store";
import { usePackingStore } from "@/lib/packing-store";
import { useYardStore } from "@/lib/yard-store";
import { useQCStore } from "@/lib/qc-store";
import { useOrdersStore } from "@/lib/orders-store";
import { Card, StatTile, SectionTitle, Chip } from "./ui";

export function InsightsScreen() {
  const inb = useInboundStore((s) => s.kpis)();
  const out = useOutboundStore((s) => s.kpis)();
  const pick = usePickingStore((s) => s.kpis)();
  const put = usePutawayStore((s) => s.kpis)();
  const pack = usePackingStore((s) => s.kpis)();
  const yard = useYardStore((s) => s.kpis)();
  const qc = useQCStore((s) => s.kpis)();
  const ord = useOrdersStore((s) => s.kpis)();

  const exceptions = [
    { label: "Inbound discrepancies", n: inb.discrepancies },
    { label: "Putaway blocked tasks", n: put.blocked },
    { label: "Order exceptions", n: ord.exceptions },
    { label: "Pick shortages", n: pick.shorts },
    { label: "Carton rework", n: pack.rework },
    { label: "Outbound exceptions", n: out.exceptionsOpen },
    { label: "Yard dwell alerts", n: yard.dwellAlerts },
    { label: "Active QC holds", n: qc.openHolds },
  ].filter((e) => e.n > 0).sort((a, b) => b.n - a.n);

  const modules = [
    { name: "Inbound", line: `${inb.openAsns} open ASNs · ${inb.receivedToday} received today` },
    { name: "Putaway", line: `${put.open + put.assigned} waiting · ${put.inProgress} in progress · ${put.completedToday} done today` },
    { name: "Orders", line: `${ord.newOrders} new · ${ord.inFulfillment} in fulfilment · fill rate ${ord.fulfillmentRate}` },
    { name: "Picking", line: `${pick.activeWaves} active waves · ${pick.openPicks} open picks · accuracy ${pick.pickAccuracy}` },
    { name: "Packing", line: `${pack.pendingLabel} to pack · ${pack.cartonsPacked} cartons` },
    { name: "Outbound", line: `${out.staged} staged · ${out.loading} loading · ${out.dispatched} dispatched · SLA ${out.slaCompliance}` },
    { name: "Yard", line: `${yard.inYard} trucks · ${yard.availableDocks} free docks · avg dwell ${yard.avgDwell}` },
    { name: "Quality", line: `pass rate ${qc.passRate} · ${qc.inProgress} in progress · ${qc.openHolds} holds` },
  ];

  return (
    <div className="p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile label="Orders in flight" value={ord.inFulfillment} sub={`${ord.newOrders} new`} tone="primary" />
        <StatTile label="Dispatched" value={out.dispatched} sub="today" tone="success" />
        <StatTile label="Pick accuracy" value={pick.pickAccuracy} sub="units vs short" />
        <StatTile label="Exceptions" value={exceptions.reduce((s, e) => s + e.n, 0)} sub="across modules" tone={exceptions.length ? "danger" : "success"} />
      </div>
      <SectionTitle>Open exceptions</SectionTitle>
      {exceptions.length === 0 ? (
        <Card><div className="text-sm text-emerald-400 font-semibold">All clear — no open exceptions.</div></Card>
      ) : exceptions.map((e) => (
        <Card key={e.label} className="flex items-center justify-between"><span className="text-sm font-semibold">{e.label}</span><Chip tone="danger">{e.n}</Chip></Card>
      ))}
      <SectionTitle>Module health</SectionTitle>
      {modules.map((m) => (
        <Card key={m.name}><div className="text-sm font-bold">{m.name}</div><div className="text-xs text-muted-foreground mt-0.5">{m.line}</div></Card>
      ))}
    </div>
  );
}
