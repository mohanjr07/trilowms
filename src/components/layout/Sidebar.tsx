import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Boxes, PackageSearch, PackageOpen, PackageCheck,
  Truck, Warehouse, Forklift, ShieldCheck, RotateCcw, Users, BarChart3, Settings, ArrowDownToLine, ArrowUpFromLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { WarehouseSwitcher } from "@/components/builder/WarehouseSwitcher";

const modules: { to: string; label: string; icon: typeof LayoutDashboard; highlight?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/builder", label: "Warehouse Builder", icon: Warehouse, highlight: true },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/inbound", label: "Inbound", icon: ArrowDownToLine },
  { to: "/putaway", label: "Putaway", icon: PackageOpen },
  { to: "/picking", label: "Picking", icon: PackageSearch },
  { to: "/packing", label: "Packing", icon: PackageCheck },
  { to: "/outbound", label: "Outbound", icon: ArrowUpFromLine },
  { to: "/yard", label: "Yard & Dock", icon: Truck },
  { to: "/qc", label: "QC", icon: ShieldCheck },
  { to: "/returns", label: "Returns", icon: RotateCcw },
  { to: "/labor", label: "Labor", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin", label: "Admin", icon: Settings },
];

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "panel flex flex-col border-r bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[64px]" : "w-[244px]",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border/60">
        <div className="relative h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold glow-amber shrink-0">
          <Forklift className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="font-bold tracking-wider text-sm">TRILO<span className="text-primary">WMS</span></span>
            <span className="text-[10px] text-mono text-muted-foreground">v4.2.1</span>
          </div>
        )}
      </div>

      {/* Warehouse Switcher */}
      {!collapsed && (
        <div className="px-2 py-2 border-b border-border/60">
          <WarehouseSwitcher />
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {modules.map((m) => {
          const active = path === m.to || (m.to !== "/" && path.startsWith(m.to));
          const Icon = m.icon;
          return (
            <Link
              key={m.to}
              to={m.to}
              className={cn(
                "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                active && "bg-sidebar-accent text-sidebar-foreground border border-border/60",
                m.highlight && !active && "text-primary/90",
              )}
              title={m.label}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
              {!collapsed && <span className="truncate">{m.label}</span>}
              {!collapsed && active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary pulse-dot text-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent text-left"
      >
        {collapsed ? "›" : "‹  Collapse"}
      </button>
    </aside>
  );
}
