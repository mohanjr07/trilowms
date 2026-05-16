import { useEditorStore } from "@/lib/wms-editor-store";
import { useWMSStore } from "@/lib/wms-store";
import { Box, Activity, AlertTriangle, Package } from "lucide-react";

export function PropertiesPanel() {
  const { selectedId, selectedKind } = useWMSStore();
  const warehouse = useEditorStore((s) => s.warehouses.find((w) => w.name === s.activeId) ?? s.warehouses[0]);

  if (!selectedId || !selectedKind) {
    return (
      <Wrapper>
        <div className="text-center text-xs text-muted-foreground py-8">
          <Box className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Select an object in the warehouse to inspect properties.
        </div>
        <SectionHeader>WAREHOUSE OVERVIEW</SectionHeader>
        <Stat label="Total Zones" value={warehouse.zones.length} />
        <Stat label="Total Aisles" value={warehouse.zones.reduce((s, z) => s + z.aisles.length, 0)} />
        <Stat
          label="Total Racks"
          value={warehouse.zones.reduce((s, z) => s + z.aisles.reduce((a, x) => a + x.racks.length, 0), 0)}
        />
        <Stat label="Active Forklifts" value={warehouse.forklifts.length} />
        <Stat label="Docks" value={warehouse.docks.length} />
      </Wrapper>
    );
  }

  if (selectedKind === "zone") {
    const z = warehouse.zones.find((x) => x.id === selectedId);
    if (!z) return null;
    const allBins = z.aisles.flatMap((a) => a.racks.flatMap((r) => r.bins));
    return (
      <Wrapper>
        <Header tag="ZONE" title={z.name} subtitle={z.type} color={z.color} />
        <Group>
          <Stat label="Type" value={z.type} />
          <Stat label="Aisles" value={z.aisles.length} />
          <Stat label="Racks" value={z.aisles.reduce((s, a) => s + a.racks.length, 0)} />
          <Stat label="Bins" value={allBins.length} />
          <Stat label="Utilization" value={`${(z.utilization * 100).toFixed(1)}%`} bar={z.utilization} />
          <Stat label="Activity" value={`${(z.activity * 100).toFixed(0)}%`} bar={z.activity} accent="accent" />
        </Group>
        <SectionHeader>BIN STATUS BREAKDOWN</SectionHeader>
        <BinBreakdown bins={allBins} />
      </Wrapper>
    );
  }

  if (selectedKind === "rack") {
    for (const z of warehouse.zones) {
      for (const a of z.aisles) {
        const r = a.racks.find((x) => x.id === selectedId);
        if (r) {
          const occ = r.bins.reduce((s, b) => s + b.occupancy, 0) / r.bins.length;
          return (
            <Wrapper>
              <Header tag="RACK" title={r.code} subtitle={`${z.name} · ${a.code}`} color={z.color} />
              <Group>
                <Stat label="Levels" value={r.levels} />
                <Stat label="Bins/Level" value={r.binsPerLevel} />
                <Stat label="Total Bins" value={r.bins.length} />
                <Stat label="Utilization" value={`${(occ * 100).toFixed(1)}%`} bar={occ} />
              </Group>
              <SectionHeader>BIN MAP</SectionHeader>
              <div className="grid grid-cols-4 gap-1 p-2 bg-background/40 rounded border border-border/60">
                {r.bins.slice().reverse().map((b) => {
                  const c = STATUS_COLOR[b.status];
                  return (
                    <div key={b.id} className="aspect-square rounded text-[8px] text-mono flex items-center justify-center font-bold"
                      style={{ background: c + "30", color: c, border: `1px solid ${c}60` }}>
                      {b.code.slice(-3)}
                    </div>
                  );
                })}
              </div>
            </Wrapper>
          );
        }
      }
    }
  }

  if (selectedKind === "bin") {
    for (const z of warehouse.zones) {
      for (const a of z.aisles) {
        for (const r of a.racks) {
          const b = r.bins.find((x) => x.id === selectedId);
          if (b) {
            return (
              <Wrapper>
                <Header tag="BIN" title={b.code} subtitle={`${z.name} · ${r.code}`} color={STATUS_COLOR[b.status]} />
                <Group>
                  <Stat label="Status" value={b.status} />
                  <Stat label="Occupancy" value={`${(b.occupancy * 100).toFixed(0)}%`} bar={b.occupancy} />
                  <Stat label="SKU" value={b.sku ?? "—"} />
                  <Stat label="Pallets" value={b.pallets} />
                  <Stat label="Zone Type" value={z.type} />
                </Group>
                <SectionHeader>RECENT MOVEMENTS</SectionHeader>
                <div className="space-y-1 text-xs">
                  {[
                    { t: "−12m", a: "Pick", q: "−4 EA", color: "text-warning" },
                    { t: "−1h", a: "Putaway", q: "+24 EA", color: "text-success" },
                    { t: "−3h", a: "Cycle Count", q: "OK", color: "text-info" },
                  ].map((m, i) => (
                    <div key={i} className="flex justify-between border-b border-border/40 py-1">
                      <span className="text-muted-foreground text-mono">{m.t}</span>
                      <span>{m.a}</span>
                      <span className={`text-mono ${m.color}`}>{m.q}</span>
                    </div>
                  ))}
                </div>
              </Wrapper>
            );
          }
        }
      }
    }
  }

  if (selectedKind === "dock") {
    const d = warehouse.docks.find((x) => x.id === selectedId);
    if (!d) return null;
    const color = d.kind === "Inbound" ? "#0891b2" : "#f97316";
    return (
      <Wrapper>
        <Header tag="DOCK" title={d.code} subtitle={d.kind} color={color} />
        <Group>
          <Stat label="Status" value={d.occupied ? "OCCUPIED" : "AVAILABLE"} />
          <Stat label="Truck" value={d.truckId ?? "—"} />
          <Stat label="ETA" value={d.occupied ? "On site" : "—"} />
          <Stat label="Door" value={d.code} />
        </Group>
      </Wrapper>
    );
  }

  return null;
}

const STATUS_COLOR = {
  Empty: "#3a4452", Partial: "#eab308", Full: "#16a34a",
  Reserved: "#0ea5e9", Blocked: "#dc2626", Damaged: "#737373",
} as const;

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[320px] panel border-l flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-border/60 text-xs font-bold tracking-wider flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-primary" /> PROPERTIES
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">{children}</div>
    </div>
  );
}

function Header({ tag, title, subtitle, color }: { tag: string; title: string; subtitle: string; color: string }) {
  return (
    <div className="rounded border p-3" style={{ borderColor: color + "60", background: color + "10" }}>
      <div className="text-[10px] text-mono font-bold tracking-wider" style={{ color }}>{tag}</div>
      <div className="text-base font-bold mt-0.5">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-bold tracking-wider text-muted-foreground pt-1">{children}</div>;
}

function Stat({ label, value, bar, accent }: { label: string; value: React.ReactNode; bar?: number; accent?: "accent" }) {
  return (
    <div className="text-xs">
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-mono font-medium">{value}</span>
      </div>
      {bar !== undefined && (
        <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full ${accent === "accent" ? "bg-accent" : "bg-primary"}`}
            style={{ width: `${Math.min(100, bar * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function BinBreakdown({ bins }: { bins: { status: keyof typeof STATUS_COLOR }[] }) {
  const counts = bins.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});
  const total = bins.length;
  return (
    <div className="space-y-1.5">
      {(Object.keys(STATUS_COLOR) as (keyof typeof STATUS_COLOR)[]).map((s) => {
        const n = counts[s] ?? 0;
        const pct = (n / total) * 100;
        return (
          <div key={s} className="text-xs">
            <div className="flex justify-between">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: STATUS_COLOR[s] }} />
                {s}
              </span>
              <span className="text-mono text-muted-foreground">{n} · {pct.toFixed(0)}%</span>
            </div>
            <div className="mt-0.5 h-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full" style={{ width: `${pct}%`, background: STATUS_COLOR[s] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
