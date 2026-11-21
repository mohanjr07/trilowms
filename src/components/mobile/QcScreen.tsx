/** Mobile · QC — inspections (checkpoints → disposition) and quality holds. */
import { useMemo, useState } from "react";
import { Check, X, Minus } from "lucide-react";
import { useQCStore, type QCInspection, type DispositionType, type InspectionStatus } from "@/lib/qc-store";
import { useAuthStore } from "@/lib/auth-store";
import { Card, Chip, BigButton, Segmented, Sheet, Field, Row, Empty, timeAgo, type Tone } from "./ui";

type Tab = "todo" | "active" | "done" | "holds";
const TAB_OF = (s: InspectionStatus): Tab =>
  s === "QUEUED" ? "todo" : s === "IN_PROGRESS" || s === "SAMPLED" ? "active" : "done";
const TONE: Record<InspectionStatus, Tone> = {
  QUEUED: "neutral", IN_PROGRESS: "primary", PASSED: "success", FAILED: "danger", CONDITIONAL_PASS: "warning",
  PENDING_REVIEW: "warning", SAMPLED: "info", HOLD: "danger", DISPOSED: "neutral",
};
const DISPOSITIONS: { id: DispositionType; label: string; tone: "success" | "ghost" | "danger" }[] = [
  { id: "ACCEPT", label: "Accept", tone: "success" },
  { id: "CONDITIONAL_RELEASE", label: "Conditional release", tone: "ghost" },
  { id: "REWORK", label: "Rework", tone: "ghost" },
  { id: "QUARANTINE", label: "Quarantine", tone: "danger" },
  { id: "REJECT", label: "Reject", tone: "danger" },
];

export function QcScreen() {
  const inspections = useQCStore((s) => s.inspections);
  const holds = useQCStore((s) => s.activeHolds)();
  const [tab, setTab] = useState<Tab>("todo");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = { todo: 0, active: 0, done: 0 };
    inspections.forEach((i) => { c[TAB_OF(i.status) as "todo" | "active" | "done"]++; });
    return c;
  }, [inspections]);
  const list = inspections.filter((i) => TAB_OF(i.status) === tab).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 60);

  return (
    <div className="p-3 space-y-3">
      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { id: "todo", label: "To inspect", count: counts.todo },
        { id: "active", label: "In progress", count: counts.active },
        { id: "done", label: "Done", count: counts.done },
        { id: "holds", label: "Holds", count: holds.length },
      ]} />
      {tab !== "holds" && list.length === 0 && <Empty title="No inspections" hint="Nothing in this list." />}
      {tab !== "holds" && list.map((i) => (
        <Card key={i.id} onClick={() => setOpenId(i.id)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-sm font-bold text-primary">{i.inspectionNumber}</div>
              <div className="text-sm truncate">{i.skuCode} · {i.skuName}</div>
            </div>
            <Chip tone={TONE[i.status]}>{i.status.replace("_", " ")}</Chip>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground flex justify-between">
            <span>{i.type.replace("_", " ")}{i.sourceRef ? ` · ${i.sourceRef}` : ""}</span>
            <span>{timeAgo(i.createdAt)}</span>
          </div>
        </Card>
      ))}
      {tab === "holds" && <HoldList />}
      <InspectionSheet inspectionId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function HoldList() {
  const holds = useQCStore((s) => s.activeHolds)();
  const resolveHold = useQCStore((s) => s.resolveHold);
  const user = useAuthStore((s) => s.session?.user);
  if (holds.length === 0) return <Empty title="No active holds" hint="Everything is released." />;
  return (
    <>
      {holds.map((h) => (
        <Card key={h.id}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-sm font-bold text-primary">{h.holdNumber}</div>
              <div className="text-sm truncate">{h.skuCode}{h.lotNumber ? ` · lot ${h.lotNumber}` : ""}</div>
            </div>
            <Chip tone="danger">{h.type.replace("_", " ")}</Chip>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{h.reason} · {h.quantity} units</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <BigButton tone="success" onClick={() => resolveHold(h.id, user?.name ?? "QC", "ACCEPT")}>Release</BigButton>
            <BigButton tone="danger" onClick={() => resolveHold(h.id, user?.name ?? "QC", "REJECT")}>Reject</BigButton>
          </div>
        </Card>
      ))}
    </>
  );
}

function InspectionSheet({ inspectionId, onClose }: { inspectionId: string | null; onClose: () => void }) {
  const insp: QCInspection | null = useQCStore((s) => s.inspections.find((i) => i.id === inspectionId)) ?? null;
  const { startInspection, updateCheckpoint, completeInspection } = useQCStore();
  const [findings, setFindings] = useState("");
  if (!insp) return <Sheet open={false} onClose={onClose} title="" children={null} />;

  const mandatoryOpen = insp.checkpoints.filter((c) => c.mandatory && c.result === null).length;
  const running = insp.status === "IN_PROGRESS" || insp.status === "SAMPLED";

  return (
    <Sheet open onClose={onClose} title={insp.inspectionNumber}>
      <div className="rounded-xl border border-border bg-card/40 px-3 py-1">
        <Row label="SKU" value={`${insp.skuCode} · ${insp.skuName}`} />
        <Row label="Type" value={insp.type.replace("_", " ")} />
        <Row label="Status" value={<Chip tone={TONE[insp.status]}>{insp.status.replace("_", " ")}</Chip>} />
        {insp.lotNumber && <Row label="Lot" value={insp.lotNumber} />}
        {insp.disposition && <Row label="Disposition" value={insp.disposition} />}
      </div>

      {insp.status === "QUEUED" && <BigButton className="w-full" onClick={() => startInspection(insp.id)}>Start inspection</BigButton>}

      {running && (
        <>
          <div className="text-[13px] font-bold tracking-wide text-muted-foreground uppercase">Checkpoints</div>
          {insp.checkpoints.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card/40 p-3">
              <div className="text-sm font-semibold">{c.name}{c.mandatory && <span className="text-red-400"> *</span>}</div>
              <div className="text-xs text-muted-foreground">{c.description}</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => updateCheckpoint(insp.id, c.id, "PASS")} className={`h-11 rounded-xl border flex items-center justify-center gap-1 text-sm font-semibold ${c.result === "PASS" ? "bg-emerald-500 text-black border-emerald-500" : "border-border"}`}><Check className="h-4 w-4" />Pass</button>
                <button type="button" onClick={() => updateCheckpoint(insp.id, c.id, "FAIL")} className={`h-11 rounded-xl border flex items-center justify-center gap-1 text-sm font-semibold ${c.result === "FAIL" ? "bg-red-500 text-white border-red-500" : "border-border"}`}><X className="h-4 w-4" />Fail</button>
                <button type="button" onClick={() => updateCheckpoint(insp.id, c.id, "N/A")} className={`h-11 rounded-xl border flex items-center justify-center gap-1 text-sm font-semibold ${c.result === "N/A" ? "bg-secondary border-primary/50" : "border-border"}`}><Minus className="h-4 w-4" />N/A</button>
              </div>
            </div>
          ))}
          <Field label="Findings" value={findings} onChange={setFindings} placeholder="Optional notes" />
          {mandatoryOpen > 0 && <div className="text-sm text-amber-400">{mandatoryOpen} required checkpoint{mandatoryOpen === 1 ? "" : "s"} still open.</div>}
          <div className="grid gap-2">
            {DISPOSITIONS.map((d) => (
              <BigButton key={d.id} tone={d.tone} disabled={mandatoryOpen > 0} onClick={() => { completeInspection(insp.id, d.id, findings); setFindings(""); onClose(); }}>
                {d.label}
              </BigButton>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
