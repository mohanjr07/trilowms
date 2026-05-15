import { createFileRoute } from "@tanstack/react-router";
import { type LucideIcon } from "lucide-react";
import {
  ArrowDownToLine, ArrowUpFromLine, PackageOpen, PackageSearch, PackageCheck,
  Truck, ShieldCheck, RotateCcw, Users, BarChart3, Settings,
} from "lucide-react";
import { PageHeader, KPICard, Panel, DataTable, StatusBadge } from "@/components/wms/Primitives";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, LineChart, Line } from "recharts";

export interface ModuleConfig {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  kpis: { label: string; value: string; tone?: "primary" | "success" | "warning" | "info" | "destructive"; sub?: string; delta?: string }[];
  rows: Record<string, string>[];
  columns: { key: string; label: string; status?: boolean; accent?: boolean }[];
  chartTitle: string;
}

export function ModulePage({ cfg }: { cfg: ModuleConfig }) {
  const data = Array.from({ length: 12 }, (_, i) => ({ t: `${i + 1}h`, v: Math.floor(40 + Math.random() * 160) }));
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader icon={cfg.icon} title={cfg.title} subtitle={cfg.subtitle} />
      <div className="p-6 space-y-6 overflow-y-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cfg.kpis.map((k) => <KPICard key={k.label} {...k} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={cfg.chartTitle} className="lg:col-span-2 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="t" stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="v" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
          <Panel title="EFFICIENCY TREND" className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="t" stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
                <Line type="monotone" dataKey="v" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        </div>
        <Panel title="ACTIVE TASKS">
          <DataTable
            rows={cfg.rows}
            columns={cfg.columns.map((c) => ({
              key: c.key,
              label: c.label,
              render: c.status
                ? (r: any) => <StatusBadge status={r[c.key]} />
                : c.accent
                ? (r: any) => <span className="text-primary">{r[c.key]}</span>
                : undefined,
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}

// Helpers
const STATUSES = ["Active", "Pending", "Complete", "In Progress", "Hold"];
const rndStatus = () => STATUSES[Math.floor(Math.random() * STATUSES.length)];
const rndRows = (n: number, prefix: string, extra: (i: number) => Record<string, string>) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${1000 + i}`, status: rndStatus(), ...extra(i) }));

export const MODULE_CONFIGS = {
  inbound: {
    title: "Inbound", subtitle: "ASN, receiving, and dock door scheduling", icon: ArrowDownToLine,
    chartTitle: "RECEIVING VOLUME (LAST 12H)",
    kpis: [
      { label: "OPEN ASNS", value: "47", tone: "primary" as const },
      { label: "RECEIVED TODAY", value: "318", tone: "success" as const, delta: "▲ 12%" },
      { label: "DOCK QUEUE", value: "5", tone: "warning" as const },
      { label: "DISCREPANCIES", value: "8", tone: "destructive" as const },
    ],
    rows: rndRows(12, "ASN", (i) => ({
      vendor: ["Globex", "Initech", "Acme Co", "Stark Ind."][i % 4],
      po: `PO-${78000 + i}`, dock: `IN-${(i % 5) + 1}`, eta: `${10 + i}:${(15 + i * 3) % 60}0`, lines: String(2 + i),
    })),
    columns: [
      { key: "id", label: "ASN", accent: true }, { key: "vendor", label: "Vendor" }, { key: "po", label: "PO" },
      { key: "dock", label: "Dock" }, { key: "eta", label: "ETA" }, { key: "lines", label: "Lines" },
      { key: "status", label: "Status", status: true },
    ],
  },
  putaway: {
    title: "Putaway", subtitle: "Directed putaway tasks and pallet routing", icon: PackageOpen,
    chartTitle: "PUTAWAY THROUGHPUT",
    kpis: [
      { label: "OPEN TASKS", value: "84", tone: "primary" as const },
      { label: "COMPLETED", value: "412", tone: "success" as const },
      { label: "AVG CYCLE", value: "2.4m", tone: "info" as const },
      { label: "BLOCKED", value: "3", tone: "warning" as const },
    ],
    rows: rndRows(12, "PTW", (i) => ({
      pallet: `PLT-${50000 + i}`, from: `IN-${(i % 5) + 1}`, to: `BU-A${(i % 3) + 1}-R${(i % 6) + 1}`, op: ["M.Reyes", "K.Wong", "T.Hill"][i % 3],
    })),
    columns: [
      { key: "id", label: "Task", accent: true }, { key: "pallet", label: "Pallet" }, { key: "from", label: "From" },
      { key: "to", label: "To Bin" }, { key: "op", label: "Operator" }, { key: "status", label: "Status", status: true },
    ],
  },
  picking: {
    title: "Picking", subtitle: "Wave picking, batch picking, and zone routing", icon: PackageSearch,
    chartTitle: "PICKS PER HOUR BY ZONE",
    kpis: [
      { label: "OPEN PICKS", value: "217", tone: "primary" as const },
      { label: "PICKED TODAY", value: "5,847", tone: "success" as const, delta: "▲ 6%" },
      { label: "PICK ACCURACY", value: "98.7%", tone: "info" as const },
      { label: "SHORTS", value: "14", tone: "destructive" as const },
    ],
    rows: rndRows(12, "WAVE", (i) => ({
      lines: String(20 + i * 3), units: String(120 + i * 8), zone: ["Fast Pick", "Bulk", "Cold"][i % 3], op: ["A.Ng", "P.Ortiz", "L.Singh"][i % 3],
    })),
    columns: [
      { key: "id", label: "Wave", accent: true }, { key: "lines", label: "Lines" }, { key: "units", label: "Units" },
      { key: "zone", label: "Zone" }, { key: "op", label: "Picker" }, { key: "status", label: "Status", status: true },
    ],
  },
  packing: {
    title: "Packing", subtitle: "Pack stations, cartonization, manifests", icon: PackageCheck,
    chartTitle: "PACK STATION OUTPUT",
    kpis: [
      { label: "STATIONS ACTIVE", value: "8/10", tone: "info" as const },
      { label: "CARTONS PACKED", value: "1,902", tone: "success" as const },
      { label: "AVG PACK TIME", value: "1.8m", tone: "primary" as const },
      { label: "REWORK", value: "11", tone: "warning" as const },
    ],
    rows: rndRows(12, "CTN", (i) => ({
      order: `ORD-${30000 + i}`, station: `PS-${(i % 8) + 1}`, items: String(2 + (i % 7)), weight: `${(2 + Math.random() * 10).toFixed(1)} kg`,
    })),
    columns: [
      { key: "id", label: "Carton", accent: true }, { key: "order", label: "Order" }, { key: "station", label: "Station" },
      { key: "items", label: "Items" }, { key: "weight", label: "Weight" }, { key: "status", label: "Status", status: true },
    ],
  },
  outbound: {
    title: "Outbound", subtitle: "Shipping waves, manifest, and dispatch", icon: ArrowUpFromLine,
    chartTitle: "DISPATCH VOLUME",
    kpis: [
      { label: "DISPATCHED", value: "284", tone: "success" as const, delta: "▲ 4%" },
      { label: "STAGED", value: "126", tone: "info" as const },
      { label: "TRUCKS LOADING", value: "5", tone: "primary" as const },
      { label: "DELAYED", value: "9", tone: "warning" as const },
    ],
    rows: rndRows(12, "SHIP", (i) => ({
      truck: `TRK-${2000 + i}`, carrier: ["UPS", "FedEx", "DHL", "USPS"][i % 4], dock: `OUT-${(i % 5) + 1}`, pallets: String(8 + (i % 14)), eta: `${12 + i}:00`,
    })),
    columns: [
      { key: "id", label: "Shipment", accent: true }, { key: "truck", label: "Truck" }, { key: "carrier", label: "Carrier" },
      { key: "dock", label: "Dock" }, { key: "pallets", label: "Pallets" }, { key: "status", label: "Status", status: true },
    ],
  },
  yard: {
    title: "Yard & Dock", subtitle: "Yard map, gate-in/out, dock door assignment", icon: Truck,
    chartTitle: "DOCK UTILIZATION",
    kpis: [
      { label: "DOCKS OCCUPIED", value: "7/10", tone: "info" as const },
      { label: "TRUCKS IN YARD", value: "14", tone: "primary" as const },
      { label: "AVG DWELL", value: "47m", tone: "warning" as const },
      { label: "GATE MOVES", value: "62", tone: "success" as const },
    ],
    rows: rndRows(12, "TRK", (i) => ({
      carrier: ["UPS", "FedEx", "DHL", "Maersk"][i % 4], type: i % 2 ? "Outbound" : "Inbound", dock: `D-${(i % 10) + 1}`, dwell: `${20 + i * 5}m`, gate: `G-${(i % 3) + 1}`,
    })),
    columns: [
      { key: "id", label: "Truck", accent: true }, { key: "carrier", label: "Carrier" }, { key: "type", label: "Direction" },
      { key: "dock", label: "Dock" }, { key: "dwell", label: "Dwell" }, { key: "status", label: "Status", status: true },
    ],
  },
  qc: {
    title: "Quality Control", subtitle: "Inspection holds, sampling, and disposition", icon: ShieldCheck,
    chartTitle: "QC INSPECTIONS",
    kpis: [
      { label: "OPEN HOLDS", value: "23", tone: "warning" as const },
      { label: "PASS RATE", value: "96.4%", tone: "success" as const },
      { label: "REJECTED", value: "12", tone: "destructive" as const },
      { label: "INSPECTORS", value: "6", tone: "info" as const },
    ],
    rows: rndRows(12, "QC", (i) => ({
      sku: `SKU-${10000 + i * 7}`, lot: `LOT-${5000 + i}`, qty: String(20 + i * 4), inspector: ["R.Park", "S.Diaz"][i % 2], result: i % 5 === 0 ? "Fail" : "Pass",
    })),
    columns: [
      { key: "id", label: "Inspection", accent: true }, { key: "sku", label: "SKU" }, { key: "lot", label: "Lot" },
      { key: "qty", label: "Qty" }, { key: "inspector", label: "Inspector" }, { key: "result", label: "Result", status: true },
    ],
  },
  returns: {
    title: "Returns", subtitle: "RMA processing, disposition, and restock", icon: RotateCcw,
    chartTitle: "RETURNS BY REASON",
    kpis: [
      { label: "OPEN RMAS", value: "94", tone: "primary" as const },
      { label: "PROCESSED", value: "187", tone: "success" as const },
      { label: "RESTOCKED", value: "142", tone: "info" as const },
      { label: "SCRAPPED", value: "28", tone: "destructive" as const },
    ],
    rows: rndRows(12, "RMA", (i) => ({
      order: `ORD-${30000 + i * 11}`, reason: ["Damaged", "Wrong item", "Customer change", "Defect"][i % 4], qty: String(1 + (i % 5)), disposition: ["Restock", "Scrap", "Repair"][i % 3],
    })),
    columns: [
      { key: "id", label: "RMA", accent: true }, { key: "order", label: "Order" }, { key: "reason", label: "Reason" },
      { key: "qty", label: "Qty" }, { key: "disposition", label: "Disposition" }, { key: "status", label: "Status", status: true },
    ],
  },
  labor: {
    title: "Labor Management", subtitle: "Workforce, productivity, and assignments", icon: Users,
    chartTitle: "PRODUCTIVITY BY OPERATOR",
    kpis: [
      { label: "ON SHIFT", value: "42", tone: "primary" as const },
      { label: "AVG UPH", value: "184", tone: "success" as const, delta: "▲ 3.2%" },
      { label: "IDLE TIME", value: "6.4%", tone: "warning" as const },
      { label: "OVERTIME", value: "2.1h", tone: "info" as const },
    ],
    rows: Array.from({ length: 12 }, (_, i) => ({
      id: `EMP-${200 + i}`, name: ["M.Reyes", "K.Wong", "T.Hill", "A.Ng", "P.Ortiz", "L.Singh"][i % 6],
      role: ["Picker", "Packer", "Forklift", "QC", "Supervisor"][i % 5], uph: String(140 + i * 8),
      shift: ["A", "B", "C"][i % 3], status: ["Active", "Active", "Active", "Hold"][i % 4],
    })),
    columns: [
      { key: "id", label: "ID", accent: true }, { key: "name", label: "Name" }, { key: "role", label: "Role" },
      { key: "uph", label: "UPH" }, { key: "shift", label: "Shift" }, { key: "status", label: "Status", status: true },
    ],
  },
  reports: {
    title: "Reports & Analytics", subtitle: "Operational reports, exports, and scheduled analytics", icon: BarChart3,
    chartTitle: "DAILY OPERATIONS SUMMARY",
    kpis: [
      { label: "REPORTS RUN", value: "248", tone: "primary" as const },
      { label: "SCHEDULED", value: "32", tone: "info" as const },
      { label: "EXPORTS", value: "94", tone: "success" as const },
      { label: "FAILURES", value: "1", tone: "destructive" as const },
    ],
    rows: Array.from({ length: 12 }, (_, i) => ({
      id: `RPT-${800 + i}`, name: ["Inventory Aging", "Pick Accuracy", "Dock Util.", "SLA Compliance", "Labor Productivity"][i % 5],
      schedule: ["Daily 6am", "Weekly Mon", "Hourly", "On demand"][i % 4], owner: ["Ops", "Finance", "QC"][i % 3],
      lastRun: `${10 + i % 12}:00`, status: ["Complete", "Complete", "In Progress", "Failed"][i % 4],
    })),
    columns: [
      { key: "id", label: "Report", accent: true }, { key: "name", label: "Name" }, { key: "schedule", label: "Schedule" },
      { key: "owner", label: "Owner" }, { key: "lastRun", label: "Last Run" }, { key: "status", label: "Status", status: true },
    ],
  },
  admin: {
    title: "Administration", subtitle: "Users, roles, permissions, and system settings", icon: Settings,
    chartTitle: "SYSTEM ACTIVITY",
    kpis: [
      { label: "USERS", value: "187", tone: "primary" as const },
      { label: "ROLES", value: "12", tone: "info" as const },
      { label: "ACTIVE SESSIONS", value: "64", tone: "success" as const },
      { label: "ALERTS", value: "3", tone: "warning" as const },
    ],
    rows: Array.from({ length: 12 }, (_, i) => ({
      id: `USR-${1000 + i}`, name: ["M.Reyes", "K.Wong", "T.Hill", "A.Ng", "P.Ortiz"][i % 5],
      role: ["Manager", "Supervisor", "Operator", "Admin", "Read-only"][i % 5],
      lastLogin: `${(i + 1)}h ago`, mfa: i % 3 ? "Enabled" : "Disabled", status: ["Active", "Active", "Active", "Hold"][i % 4],
    })),
    columns: [
      { key: "id", label: "User", accent: true }, { key: "name", label: "Name" }, { key: "role", label: "Role" },
      { key: "lastLogin", label: "Last Login" }, { key: "mfa", label: "MFA" }, { key: "status", label: "Status", status: true },
    ],
  },
} satisfies Record<string, ModuleConfig>;
