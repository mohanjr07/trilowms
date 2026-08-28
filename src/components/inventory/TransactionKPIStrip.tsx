/**
 * TransactionKPIStrip — Real-time transaction analytics
 * Shows throughput, type distribution, pending queue.
 */

import { useMemo } from "react";
import {
  Activity, CheckCircle2, AlertCircle, Clock,
  TrendingUp, ArrowRight, Package,
} from "lucide-react";
import { useTransactionStore, TXN_TYPE_META, type TransactionType } from "@/lib/transaction-store";
import { useInvBinStore } from "@/lib/inventory-bin-store";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function TxnKPICard({
  label, value, sub, tone, icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone: "primary" | "success" | "warning" | "danger" | "info";
  icon: typeof Activity;
}) {
  const colors = {
    primary:  { text: "text-primary",     bg: "bg-primary/10",     border: "border-primary/20"     },
    success:  { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    warning:  { text: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20"   },
    danger:   { text: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20"     },
    info:     { text: "text-sky-400",     bg: "bg-sky-500/10",     border: "border-sky-500/20"     },
  }[tone];

  return (
    // min-w-0 on the card itself (not just the text wrapper) — as a grid item its
    // default min-width is "auto", which ignores the grid track's minmax(0,1fr) and
    // lets long sub-text (e.g. "100% success rate") force the whole card wider than
    // its column, spilling the card's border/background past the section.
    <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 min-w-0 overflow-hidden ${colors.bg} ${colors.border}`}>
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${colors.bg} border ${colors.border}`}>
        <Icon className={`h-4 w-4 ${colors.text}`} />
      </div>
      <div className="min-w-0 flex-1 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</div>
          {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
        </div>
        <div className={`text-xl font-black tabular-nums shrink-0 ${colors.text}`}>{value}</div>
      </div>
    </div>
  );
}

// ─── Type distribution mini-bar ───────────────────────────────────────────────

function TypeDistribution({ byType }: { byType: Record<TransactionType, number> }) {
  const data = (Object.entries(byType) as [TransactionType, number][])
    .filter(([, v]) => v > 0)
    .map(([type, count]) => ({
      name: TXN_TYPE_META[type].label.split(" ")[0],
      fullName: TXN_TYPE_META[type].label,
      count,
      color: type === "RECEIVED" ? "#22c55e" :
             type === "MOVED" ? "#38bdf8" :
             type === "RACK_TRANSFER" ? "#a78bfa" :
             type === "WH_TRANSFER" ? "#818cf8" :
             type === "ADJUSTMENT" ? "#f59e0b" :
             type === "BLOCKED" ? "#f97316" :
             type === "DAMAGED" ? "#ef4444" : "#2dd4bf",
    }));

  if (data.length === 0) return null;

  return (
    <div className="border border-border/50 rounded-xl bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Transaction Mix</span>
      </div>
      <div className="p-3 h-[130px] w-full">
        {/* width="99%" (not 100%) — inside a flex/grid sidebar column, a
            ResponsiveContainer at exactly 100% can measure a 0px box on first
            paint and never recover, rendering as a couple of tiny stray bars
            instead of a real chart. 99% forces it to actually re-measure. */}
        <ResponsiveContainer width="99%" height="100%" minWidth={0}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#94a3b8" }} stroke="transparent" interval={0} />
            <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} stroke="transparent" />
            <Tooltip
              contentStyle={{ background: "var(--color-card, #1e293b)", border: "1px solid var(--color-border, #334155)", borderRadius: 6, fontSize: 11 }}
              formatter={(v: number, _: string, props: { payload: { fullName: string } }) => [v, props.payload.fullName]}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Recent activity feed ─────────────────────────────────────────────────────

function RecentFeed() {
  const recentFn = useTransactionStore((s) => s.recentTransactions);
  const recent = useMemo(() => recentFn(6), [recentFn]);

  return (
    <div className="border border-border/50 rounded-xl bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30">
        <Clock className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Recent Activity</span>
      </div>
      <div className="divide-y divide-border/20">
        {recent.map((txn) => {
          const meta = TXN_TYPE_META[txn.type];
          const ts = new Date(txn.timestamp);
          const elapsed = Math.round((Date.now() - ts.getTime()) / 60000);
          const timeLabel = elapsed < 1 ? "now" : elapsed < 60 ? `${elapsed}m ago` : `${Math.round(elapsed / 60)}h ago`;

          return (
            <div key={txn.id} className="flex items-center gap-3 px-4 py-2 hover:bg-sidebar/40 transition-colors">
              <span className={`h-2 w-2 rounded-full shrink-0 ${meta.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold ${meta.color}`}>{meta.label}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{txn.skuCode}</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5">
                  <Package className="h-2.5 w-2.5" />
                  {txn.quantity} {txn.uom}
                  {txn.sourceBinCode && (
                    <>
                      <span className="mx-0.5">·</span>
                      <span className="font-mono">{txn.sourceBinCode}</span>
                      {txn.destBinCode && (
                        <>
                          <ArrowRight className="h-2 w-2" />
                          <span className="font-mono">{txn.destBinCode}</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="text-[9px] text-muted-foreground/60 shrink-0">{timeLabel}</div>
            </div>
          );
        })}
        {recent.length === 0 && (
          <div className="px-4 py-6 text-center text-[10px] text-muted-foreground">No activity yet</div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TransactionKPIStrip() {
  const activeWarehouseName = useInvBinStore((s) => s.activeWarehouseName);
  const kpisFn = useTransactionStore((s) => s.kpis);
  const transactions = useTransactionStore((s) => s.transactions);

  const kpis = useMemo(
    () => kpisFn(activeWarehouseName ?? undefined),
    [transactions, activeWarehouseName] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="space-y-4 p-4">
      {/* KPI Cards — single column: this sidebar (280px) is too narrow for two
          columns without labels like "TOTAL TRANSACTIONS" wrapping mid-word. */}
      <div className="grid grid-cols-1 gap-2.5">
        <TxnKPICard
          label="Total Transactions"
          value={kpis.total.toLocaleString()}
          sub={`${kpis.today} today`}
          tone="primary"
          icon={Activity}
        />
        <TxnKPICard
          label="Completed"
          value={kpis.completed.toLocaleString()}
          sub={kpis.total ? `${Math.round((kpis.completed / kpis.total) * 100)}% success rate` : "—"}
          tone="success"
          icon={CheckCircle2}
        />
        <TxnKPICard
          label="Pending / Active"
          value={kpis.pending}
          sub="Awaiting execution"
          tone={kpis.pending > 5 ? "warning" : "info"}
          icon={Clock}
        />
        <TxnKPICard
          label="Failed"
          value={kpis.failed}
          sub={kpis.failed > 0 ? "Needs review" : "None"}
          tone={kpis.failed > 0 ? "danger" : "success"}
          icon={AlertCircle}
        />
      </div>

      {/* 24h throughput */}
      <div className="rounded-xl border border-border/50 bg-card px-4 py-3 flex items-center gap-3">
        <TrendingUp className="h-4 w-4 text-primary shrink-0" />
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">24h Throughput</div>
          <div className="text-lg font-black text-primary">{kpis.throughput24h} <span className="text-xs font-normal text-muted-foreground">transactions</span></div>
        </div>
      </div>

      {/* Type distribution chart */}
      <TypeDistribution byType={kpis.byType} />

      {/* Recent feed */}
      <RecentFeed />
    </div>
  );
}
