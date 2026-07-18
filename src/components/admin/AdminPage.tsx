/**
 * TriloWMS — Admin Module Page
 */

import { useState } from "react";
import { Settings, Users, Shield, Warehouse, Key, ChevronRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEMO_USERS, ROLE_DEFINITIONS, type DemoUser, type UserRole } from "@/lib/auth-store";
import { PageHeader, KPICard, Panel } from "@/components/wms/Primitives";
import { cn } from "@/lib/utils";

function AdminKPIs() {
  const roleCount = new Set(DEMO_USERS.map((u) => u.role)).size;
  const activeUsers = DEMO_USERS.length;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KPICard label="TOTAL USERS" value={String(activeUsers)} tone="primary" />
      <KPICard label="ROLES DEFINED" value={String(roleCount)} tone="info" />
      <KPICard label="WAREHOUSES" value="1" tone="success" />
      <KPICard label="SYSTEM STATUS" value="Healthy" tone="success" />
    </div>
  );
}

function UserDetail({ user, onClose }: { user: DemoUser; onClose: () => void }) {
  const [showPw, setShowPw] = useState(false);
  const role = ROLE_DEFINITIONS[user.role];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {user.avatar}
          </div>
          <div>
            <div className="font-semibold">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className={cn("text-xs px-3 py-1 rounded-full border font-semibold", role.color, role.bgColor)}>
            {role.label}
          </span>
          <span className="text-xs text-muted-foreground font-mono">{user.employeeId}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            ["Warehouse", user.warehouse],
            ["Shift", user.shift],
            ["User ID", user.id],
            ["Dashboard", role.dashboardType],
          ].map(([l, v]) => (
            <div key={l} className="rounded border border-border bg-card/30 p-2">
              <div className="text-[10px] text-muted-foreground uppercase">{l}</div>
              <div className="text-xs font-mono mt-0.5">{v}</div>
            </div>
          ))}
        </div>

        <div className="rounded border border-border bg-card/30 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] text-muted-foreground uppercase">Demo Password</div>
            <Button variant="ghost" size="sm" className="h-5 px-1" onClick={() => setShowPw(!showPw)}>
              {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
          </div>
          <div className="text-xs font-mono mt-0.5">{showPw ? user.password : "••••••••"}</div>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Allowed Routes</div>
          <div className="flex flex-wrap gap-1.5">
            {role.allowedRoutes.map((r) => (
              <span key={r} className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">{r || "/"}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersPanel() {
  const [selected, setSelected] = useState<DemoUser | null>(null);
  const [search, setSearch] = useState("");
  const filtered = DEMO_USERS.filter((u) =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Panel title={`SYSTEM USERS (${DEMO_USERS.length})`}>
        <div className="relative mb-3">
          <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wide">
                {["User","Email","Role","Warehouse","Shift","Emp ID",""].map((h) => (
                  <th key={h} className="text-left py-2 px-2 whitespace-nowrap font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((u) => {
                const role = ROLE_DEFINITIONS[u.role];
                return (
                  <tr key={u.id} className="hover:bg-accent/30 cursor-pointer" onClick={() => setSelected(u)}>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                          {u.avatar}
                        </div>
                        <span className="text-xs font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">{u.email}</td>
                    <td className="py-2 px-2">
                      <span className={cn("text-[11px] px-2 py-0.5 rounded border font-semibold", role.color, role.bgColor)}>
                        {role.label}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-xs">{u.warehouse}</td>
                    <td className="py-2 px-2 text-xs">{u.shift}</td>
                    <td className="py-2 px-2 font-mono text-xs">{u.employeeId}</td>
                    <td className="py-2 px-2"><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 gap-0">
          {selected && <UserDetail user={selected} onClose={() => setSelected(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RolesPanel() {
  const roles = Object.values(ROLE_DEFINITIONS);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {roles.map((role) => {
        const usersInRole = DEMO_USERS.filter((u) => u.role === role.id);
        return (
          <div key={role.id} className={cn("rounded-lg border p-4", role.bgColor)}>
            <div className="flex items-center justify-between mb-3">
              <span className={cn("font-semibold text-sm", role.color)}>{role.label}</span>
              <span className="text-xs text-muted-foreground bg-background/40 px-2 py-0.5 rounded font-mono">
                {usersInRole.length} user{usersInRole.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground uppercase mb-1.5">Access</div>
            <div className="flex flex-wrap gap-1">
              {role.allowedRoutes.map((r) => (
                <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-background/30 font-mono">{r || "/"}</span>
              ))}
            </div>
            {usersInRole.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {usersInRole.map((u) => (
                  <span key={u.id} className="text-[10px] bg-background/40 px-2 py-0.5 rounded">{u.name.split(" ")[0]}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WarehouseConfig() {
  const config = {
    id: "TRILO-DC-01",
    name: "Trilo Distribution Center 01",
    address: "123 Warehouse Ave, Industrial Park, TX 75001",
    timezone: "America/Chicago",
    currency: "USD",
    units: "Imperial",
    zones: ["Fast Pick", "Bulk Zone", "Cold Storage", "Mezzanine", "Docks", "Staging"],
    dockDoors: { inbound: 6, outbound: 5 },
    shifts: ["A (06:00–14:00)", "B (14:00–22:00)", "C (22:00–06:00)", "FLEX"],
    operatingDays: "Mon–Sat",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel title="WAREHOUSE CONFIGURATION">
        <div className="space-y-2">
          {[
            ["Warehouse ID", config.id],
            ["Name", config.name],
            ["Address", config.address],
            ["Timezone", config.timezone],
            ["Currency", config.currency],
            ["Unit System", config.units],
            ["Dock Doors", `${config.dockDoors.inbound} Inbound · ${config.dockDoors.outbound} Outbound`],
            ["Operating Days", config.operatingDays],
          ].map(([l, v]) => (
            <div key={l} className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
              <span className="text-xs text-muted-foreground shrink-0">{l}</span>
              <span className="text-xs text-right">{v}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="WAREHOUSE ZONES">
          <div className="flex flex-wrap gap-2">
            {config.zones.map((z) => (
              <span key={z} className="text-xs px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-primary font-medium">{z}</span>
            ))}
          </div>
        </Panel>

        <Panel title="SHIFT SCHEDULE">
          <div className="space-y-2">
            {config.shifts.map((s) => (
              <div key={s} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                <span className="text-[11px] px-2 py-0.5 rounded bg-muted font-mono font-bold">
                  {s.split(" ")[0]}
                </span>
                <span className="text-xs text-muted-foreground">{s.split(" ").slice(1).join(" ")}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SystemInfo() {
  const checks = [
    { name: "Database Connection", status: "OK", detail: "Supabase - latency 12ms" },
    { name: "Auth Service", status: "OK", detail: "JWT tokens active" },
    { name: "3D Builder Engine", status: "OK", detail: "Three.js r154" },
    { name: "State Persistence", status: "OK", detail: "Zustand localStorage" },
    { name: "API Gateway", status: "OK", detail: "Cloudflare Workers" },
    { name: "Session Store", status: "OK", detail: "Active sessions: 1" },
  ];

  return (
    <Panel title="SYSTEM HEALTH">
      <div className="space-y-2">
        {checks.map((c) => (
          <div key={c.name} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm">{c.name}</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-emerald-400 font-semibold">{c.status}</div>
              <div className="text-[10px] text-muted-foreground">{c.detail}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg bg-muted/30 border border-border p-3">
        <div className="text-xs font-semibold mb-2">System Version</div>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <span>TriloWMS</span><span className="font-mono">v2.0.0</span>
          <span>React</span><span className="font-mono">19.x</span>
          <span>TanStack Router</span><span className="font-mono">1.x</span>
          <span>Zustand</span><span className="font-mono">5.x</span>
        </div>
      </div>
    </Panel>
  );
}

export function AdminPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader icon={Settings} title="Administration" subtitle="User management, roles & permissions, warehouse configuration & system health" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <AdminKPIs />
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1.5" />Users</TabsTrigger>
            <TabsTrigger value="roles"><Shield className="h-3.5 w-3.5 mr-1.5" />Roles</TabsTrigger>
            <TabsTrigger value="warehouse"><Warehouse className="h-3.5 w-3.5 mr-1.5" />Warehouse</TabsTrigger>
            <TabsTrigger value="system"><Key className="h-3.5 w-3.5 mr-1.5" />System</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-4"><UsersPanel /></TabsContent>
          <TabsContent value="roles" className="mt-4"><RolesPanel /></TabsContent>
          <TabsContent value="warehouse" className="mt-4"><WarehouseConfig /></TabsContent>
          <TabsContent value="system" className="mt-4"><SystemInfo /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
