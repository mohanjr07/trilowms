import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, icon: Icon, actions }: {
  title: string; subtitle?: string; icon?: LucideIcon; actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b panel">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="h-10 w-10 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <div>
          <h1 className="text-lg font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}

export function KPICard({ label, value, delta, tone = "primary", icon: Icon, sub }: {
  label: string; value: string | number; delta?: string; tone?: "primary" | "success" | "warning" | "info" | "destructive";
  icon?: LucideIcon; sub?: string;
}) {
  const toneClass = {
    primary: "text-primary border-primary/30 bg-primary/5",
    success: "text-success border-success/30 bg-success/5",
    warning: "text-warning border-warning/30 bg-warning/5",
    info: "text-info border-info/30 bg-info/5",
    destructive: "text-destructive border-destructive/30 bg-destructive/5",
  }[tone];
  return (
    <div className={cn("panel rounded-md p-4 relative overflow-hidden", toneClass)}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold mt-1 text-mono text-foreground">{value}</div>
          {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
        {Icon && <Icon className="h-5 w-5 opacity-60" />}
      </div>
      {delta && <div className="text-[11px] mt-2 text-mono font-medium">{delta}</div>}
      <div className="absolute inset-0 pointer-events-none scanline opacity-30" />
    </div>
  );
}

export function Panel({ title, children, actions, className }: {
  title?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("panel rounded-md flex flex-col", className)}>
      {title && (
        <div className="px-4 py-2.5 border-b border-border/60 flex items-center justify-between">
          <h3 className="text-xs font-bold tracking-wider">{title}</h3>
          {actions}
        </div>
      )}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

export function StatusBadge({ status, color }: { status: string; color?: string }) {
  const map: Record<string, string> = {
    Active: "text-success bg-success/10 border-success/30",
    Pending: "text-warning bg-warning/10 border-warning/30",
    Complete: "text-info bg-info/10 border-info/30",
    Failed: "text-destructive bg-destructive/10 border-destructive/30",
    "In Progress": "text-primary bg-primary/10 border-primary/30",
    Hold: "text-warning bg-warning/10 border-warning/30",
    Pass: "text-success bg-success/10 border-success/30",
    Fail: "text-destructive bg-destructive/10 border-destructive/30",
  };
  const cls = color ? "" : map[status] ?? "text-muted-foreground bg-secondary border-border";
  return (
    <span
      className={cn("text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded border text-mono", cls)}
      style={color ? { color, borderColor: color + "60", background: color + "15" } : undefined}
    >
      {status.toUpperCase()}
    </span>
  );
}

export function DataTable<T>({ columns, rows }: {
  columns: { key: keyof T | string; label: string; render?: (row: T) => React.ReactNode; w?: string }[];
  rows: T[];
}) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead className="bg-background/40 sticky top-0">
          <tr className="text-left text-[10px] font-bold tracking-wider text-muted-foreground border-b border-border">
            {columns.map((c) => (
              <th key={String(c.key)} className="px-4 py-2.5" style={{ width: c.w }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/40 hover:bg-secondary/40">
              {columns.map((c) => (
                <td key={String(c.key)} className="px-4 py-2.5 text-mono">
                  {c.render ? c.render(row) : String((row as any)[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
