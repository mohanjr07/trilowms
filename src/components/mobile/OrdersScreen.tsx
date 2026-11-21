/** Mobile · Orders — read-only order tracking by stage. */
import { useState } from "react";
import { useOrdersStore, ORDER_STATUS_META, type Order, type OrderStatus } from "@/lib/orders-store";
import { Card, Chip, Segmented, Sheet, Row, Empty, SearchBox, type Tone } from "./ui";

type Tab = "open" | "moving" | "done";
const TAB_OF = (s: OrderStatus): Tab => (s === "NEW" || s === "ALLOCATED" || s === "EXCEPTION" ? "open" : s === "PICKING" || s === "PACKED" ? "moving" : "done");
const TONE: Record<OrderStatus, Tone> = { NEW: "neutral", ALLOCATED: "info", PICKING: "warning", PACKED: "primary", SHIPPED: "success", DELIVERED: "success", EXCEPTION: "danger", CANCELLED: "neutral" };

export function OrdersScreen() {
  const orders = useOrdersStore((s) => s.orders);
  const [tab, setTab] = useState<Tab>("open");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const count = (t: Tab) => orders.filter((o) => TAB_OF(o.status) === t).length;
  const list = orders
    .filter((o) => TAB_OF(o.status) === tab)
    .filter((o) => !q.trim() || `${o.orderNumber} ${o.customer}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.dueBy.localeCompare(b.dueBy));

  return (
    <div className="p-3 space-y-3">
      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { id: "open", label: "To do", count: count("open") },
        { id: "moving", label: "In process", count: count("moving") },
        { id: "done", label: "Shipped", count: count("done") },
      ]} />
      <SearchBox value={q} onChange={setQ} placeholder="Search order or customer" />
      {list.length === 0 && <Empty title="No orders" hint="Nothing in this list." />}
      {list.map((o) => (
        <Card key={o.id} onClick={() => setOpenId(o.id)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-sm font-bold text-primary">{o.orderNumber}</div>
              <div className="text-sm truncate">{o.customer}</div>
            </div>
            <Chip tone={TONE[o.status]}>{ORDER_STATUS_META[o.status].label}</Chip>
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>{o.totalLines} lines · {o.totalUnits} units{o.priority === "RUSH" ? " · RUSH" : ""}</span>
            <span>Due {new Date(o.dueBy).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </Card>
      ))}
      <OrderSheet orderId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function OrderSheet({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const o: Order | null = useOrdersStore((s) => s.orders.find((x) => x.id === orderId)) ?? null;
  return (
    <Sheet open={!!o} onClose={onClose} title={o ? o.orderNumber : ""}>
      {o && (
        <>
          <div className="rounded-xl border border-border bg-card/40 px-3 py-1">
            <Row label="Customer" value={o.customer} />
            <Row label="Status" value={<Chip tone={TONE[o.status]}>{ORDER_STATUS_META[o.status].label}</Chip>} />
            <Row label="Carrier" value={o.carrier ?? "—"} />
            <Row label="Wave" value={o.pickWaveNumber ?? "—"} />
            <Row label="Allocated" value={`${o.allocatedUnits} / ${o.totalUnits}`} />
            <Row label="Ship to" value={o.shipToAddress} />
          </div>
          <div className="text-[13px] font-bold tracking-wide text-muted-foreground uppercase">Lines</div>
          {o.lines.map((l) => (
            <div key={l.id} className="rounded-xl border border-border bg-card/40 p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-xs font-bold text-primary">{l.skuCode}</div>
                <div className="text-sm truncate">{l.skuName}</div>
              </div>
              <Chip tone={l.allocatedQty >= l.requestedQty ? "success" : "warning"}>{l.allocatedQty}/{l.requestedQty}</Chip>
            </div>
          ))}
        </>
      )}
    </Sheet>
  );
}
