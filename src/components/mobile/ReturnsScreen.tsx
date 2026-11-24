/** Mobile · Returns — approve, receive, inspect and complete customer returns (RMAs). */
import { useState } from "react";
import { useReturnsStore, type RMA, type RmaStatus, type RmaLine, type DispositionType } from "@/lib/returns-store";
import { useAuthStore } from "@/lib/auth-store";
import { Card, Chip, Segmented, Sheet, Row, Empty, SearchBox, BigButton, Field, type Tone } from "./ui";

type Tab = "approve" | "incoming" | "inspect" | "done";
const TAB_OF = (s: RmaStatus): Tab => (s === "REQUESTED" ? "approve" : s === "APPROVED" || s === "IN_TRANSIT" ? "incoming" : s === "RECEIVED" || s === "INSPECTING" || s === "INSPECTED" || s === "PROCESSING" ? "inspect" : "done");
const TONE: Record<RmaStatus, Tone> = { REQUESTED: "neutral", APPROVED: "info", IN_TRANSIT: "info", RECEIVED: "primary", INSPECTING: "warning", INSPECTED: "warning", PROCESSING: "warning", COMPLETED: "success", REJECTED: "danger", CANCELLED: "neutral" };
const CONDITIONS: NonNullable<RmaLine["condition"]>[] = ["NEW", "OPENED", "DAMAGED", "DEFECTIVE", "EXPIRED"];
const DISPOSITIONS: { id: DispositionType; label: string }[] = [
  { id: "RESTOCK", label: "Restock" }, { id: "REPAIR", label: "Repair" }, { id: "SCRAP", label: "Scrap" },
  { id: "RETURN_TO_VENDOR", label: "To vendor" }, { id: "QUARANTINE", label: "Quarantine" },
];
const pretty = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export function ReturnsScreen() {
  const rmas = useReturnsStore((s) => s.rmas);
  const [tab, setTab] = useState<Tab>("approve");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const count = (t: Tab) => rmas.filter((r) => TAB_OF(r.status) === t).length;
  const list = rmas
    .filter((r) => TAB_OF(r.status) === tab)
    .filter((r) => !q.trim() || `${r.rmaNumber} ${r.customer}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-3 space-y-3">
      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { id: "approve", label: "To approve", count: count("approve") },
        { id: "incoming", label: "Incoming", count: count("incoming") },
        { id: "inspect", label: "Inspect", count: count("inspect") },
        { id: "done", label: "Closed", count: count("done") },
      ]} />
      <SearchBox value={q} onChange={setQ} placeholder="Search RMA or customer" />
      {list.length === 0 && <Empty title="No returns" hint="Nothing in this list." />}
      {list.map((r) => (
        <Card key={r.id} onClick={() => setOpenId(r.id)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-sm font-bold text-primary">{r.rmaNumber}</div>
              <div className="text-sm truncate">{r.customer}</div>
            </div>
            <Chip tone={TONE[r.status]}>{pretty(r.status)}</Chip>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{r.totalLines} lines · {r.totalReturnQty} units{r.priority !== "NORMAL" ? ` · ${r.priority}` : ""}</div>
        </Card>
      ))}
      <RmaSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function RmaSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const r: RMA | null = useReturnsStore((s) => s.rmas.find((x) => x.id === id)) ?? null;
  const st = useReturnsStore();
  const me = useAuthStore((s) => s.session?.user.name ?? "mobile");
  const [dock, setDock] = useState("");
  const [reason, setReason] = useState("");
  const [cond, setCond] = useState<Record<string, RmaLine["condition"]>>({});
  const [disp, setDisp] = useState<Record<string, DispositionType>>({});

  return (
    <Sheet open={!!r} onClose={onClose} title={r ? r.rmaNumber : ""}>
      {r && (
        <>
          <div className="rounded-xl border border-border bg-card/40 px-3 py-1">
            <Row label="Customer" value={r.customer} />
            <Row label="Order" value={r.orderId} />
            <Row label="Status" value={<Chip tone={TONE[r.status]}>{pretty(r.status)}</Chip>} />
            <Row label="Carrier" value={r.carrier || "—"} />
          </div>

          {r.status === "REQUESTED" && (
            <div className="space-y-2">
              <BigButton className="w-full" onClick={() => st.approveRma(r.id, me)}>Approve return</BigButton>
              <Field label="Reject reason" value={reason} onChange={setReason} placeholder="Why is it rejected?" />
              <BigButton tone="danger" className="w-full" disabled={!reason.trim()} onClick={() => { st.rejectRma(r.id, reason.trim()); onClose(); }}>Reject</BigButton>
            </div>
          )}

          {(r.status === "APPROVED" || r.status === "IN_TRANSIT") && (
            <div className="space-y-2">
              <Field label="Receiving dock" value={dock} onChange={setDock} placeholder="e.g. IN-01" />
              <BigButton className="w-full" disabled={!dock.trim()} onClick={() => st.receiveRma(r.id, dock.trim())}>Mark received at dock</BigButton>
            </div>
          )}

          <div className="text-[13px] font-bold tracking-wide text-muted-foreground uppercase">Lines</div>
          {r.lines.map((l) => {
            const canInspect = r.status === "RECEIVED" || r.status === "INSPECTING";
            const c = cond[l.id] ?? l.condition;
            const d = disp[l.id] ?? l.disposition;
            return (
              <div key={l.id} className="rounded-xl border border-border bg-card/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold text-primary">{l.skuCode}</div>
                    <div className="text-sm truncate">{l.skuName}</div>
                  </div>
                  <Chip>{l.returnQty} {l.uom}</Chip>
                </div>
                {canInspect && l.status !== "INSPECTED" && l.status !== "DISPOSED" ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">{CONDITIONS.map((x) => (
                      <button key={x} type="button" onClick={() => setCond((p) => ({ ...p, [l.id]: x }))} className={"h-9 px-3 rounded-full text-xs font-semibold border " + (c === x ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground")}>{pretty(x)}</button>
                    ))}</div>
                    <div className="flex flex-wrap gap-1.5">{DISPOSITIONS.map((x) => (
                      <button key={x.id} type="button" onClick={() => setDisp((p) => ({ ...p, [l.id]: x.id }))} className={"h-9 px-3 rounded-full text-xs font-semibold border " + (d === x.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground")}>{x.label}</button>
                    ))}</div>
                    <BigButton className="w-full" disabled={!c || !d} onClick={() => st.inspectLine(r.id, l.id, c!, d!)}>Save inspection</BigButton>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">{l.condition ? pretty(l.condition) : "Not inspected"}{l.disposition ? ` · ${pretty(l.disposition)}` : ""}</div>
                )}
              </div>
            );
          })}

          {(r.status === "INSPECTED" || r.status === "PROCESSING") && (
            <BigButton tone="success" className="w-full" onClick={() => { st.completeRma(r.id, me); onClose(); }}>Complete return</BigButton>
          )}
        </>
      )}
    </Sheet>
  );
}
