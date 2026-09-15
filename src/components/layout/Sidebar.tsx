import {
  Link, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  LayoutDashboard, Boxes, PackageSearch, PackageOpen, PackageCheck,
  Truck, Warehouse, Forklift, ShieldCheck, RotateCcw, Users, BarChart3,
  Settings, ArrowDownToLine, ArrowUpFromLine, LogOut, Combine,
  ScanLine, Radio,
} from "lucide-react";
import {
  cn } from "@/lib/utils";
import {
  useState } from "react";
import {
  WarehouseSwitcher } from "@/components/builder/WarehouseSwitcher";
import {
  useAuthStore, ROLE_DEFINITIONS } from "@/lib/auth-store";

const ALL_MODULES: { to: string; label: string; icon: typeof LayoutDashboard; highlight?: boolean }[] = [
  { to: "/",         label: "Dashboard",        icon: LayoutDashboard },
  { to: "/builder",  label: "Warehouse Builder", icon: Warehouse, highlight: true },
  { to: "/inventory",label: "Inventory & Bins",    icon: Boxes },
  { to: "/orders",   label: "Orders",            icon: ClipboardList },
  { to: "/inbound",  label: "Inbound",           icon: ArrowDownToLine },
  { to: "/putaway",  label: "Putaway",           icon: PackageOpen },
  { to: "/scan-putaway", label: "Scan Putaway", icon: ScanLine, highlight: true },
  { to: "/picking",       label: "Picking",        icon: PackageSearch },
  { to: "/scan-pick", label: "Scan Pick", icon: ScanLine, highlight: true },
  { to: "/consolidation", label: "Consolidation", icon: Combine },
  { to: "/packing",       label: "Packing",       icon: PackageCheck },
  { to: "/scan-pack", label: "Scan Pack", icon: ScanLine, highlight: true },
  { to: "/outbound", label: "Outbound",          icon: ArrowUpFromLine },
  { to: "/ptl",      label: "PTL Calling",       icon: Radio, highlight: true },
  { to: "/yard",     label: "Yard & Dock",       icon: Truck },
  { to: "/qc",       label: "QC",                icon: ShieldCheck },
  { to: "/returns",  label: "Returns",           icon: RotateCcw },
  { to: "/labor",    label: "Labor",             icon: Users },
  { to: "/reports",  label: "Reports",           icon: BarChart3 },
  { to: "/admin",    label: "Admin",             icon: Settings },
];

export function Sidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const { session, logout, role } = useAuthStore();
  const roleDef = role();

  // Filter modules by what this role can access
  const allowedRoutes = roleDef?.allowedRoutes ?? [];
  const modules = ALL_MODULES.filter((m) =>
    allowedRoutes.some((r) => r === m.to || (r !== "/" && m.to.startsWith(r))),
  );

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

      {/* Warehouse Switcher — only for roles that can access builder/all */}
      {!collapsed && (allowedRoutes.includes("/builder") || session?.user.role === "super_admin") && (
        <div className="px-2 py-2 border-b border-border/60">
          <WarehouseSwitcher />
        </div>
      )}

      {/* Role badge */}
      {!collapsed && roleDef && (
        <div className={cn("mx-2 mt-2 mb-1 px-2.5 py-1.5 rounded-md border text-[10px] font-bold tracking-wider", roleDef.bgColor, roleDef.color)}>
          {roleDef.label.toUpperCase()}
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
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary pulse-dot" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      {session && (
        <div className={cn("border-t border-border/60 px-2 py-2", collapsed ? "flex justify-center" : "")}>
          {!collapsed ? (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent group">
              <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0", roleDef?.bgColor)}>
                {session.user.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{session.user.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{session.user.warehouse}</div>
              </div>
              <button
                onClick={logout}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                title="Logout"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={logout} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-sidebar-accent" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent text-left"
      >
        {collapsed ? "›" : "‹  Collapse"}
      </button>
    </aside>
  );
}
