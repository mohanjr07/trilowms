import { useState, useRef, useEffect } from "react";
import { Bell, Search, Activity, Wifi, LogOut, User, ChevronDown, Shield } from "lucide-react";
import { useAuthStore, ROLE_DEFINITIONS } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

export function TopBar() {
  const { session, logout, role } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const roleDef = role();

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-14 border-b bg-panel/80 backdrop-blur flex items-center px-4 gap-4">
      <div className="flex items-center gap-2 text-xs text-mono text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-success pulse-dot text-success" />
        <span>SYSTEM ONLINE</span>
        <span className="text-border">|</span>
        <span>SHIFT B</span>
        <span className="text-border">|</span>
        <span>{new Date().toLocaleDateString()}</span>
      </div>

      <div className="flex-1 max-w-md ml-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            placeholder="Search SKUs, orders, bins, trucks..."
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md bg-input/50 border border-border focus:outline-none focus:border-primary/60 focus:bg-input"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3 text-xs">
        <KPIPill label="ORDERS"    value="1,284" tone="info"    />
        <KPIPill label="OPEN PICKS" value="217"  tone="warning" />
        <KPIPill label="DOCK UTIL" value="78%"   tone="success" />
        <button className="p-2 rounded-md hover:bg-secondary"><Activity className="h-4 w-4" /></button>
        <button className="p-2 rounded-md hover:bg-secondary"><Wifi className="h-4 w-4" /></button>
        <button className="p-2 rounded-md hover:bg-secondary relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
        </button>

        {/* User profile dropdown */}
        <div className="relative pl-3 border-l border-border" ref={dropRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2 hover:bg-secondary rounded-md px-2 py-1.5 transition-colors"
          >
            <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0", roleDef?.bgColor ?? "border-border")}>
              {session?.user.avatar ?? <User className="h-3.5 w-3.5" />}
            </div>
            <div className="text-left leading-tight hidden md:block">
              <div className="font-medium text-xs">{session?.user.name ?? "Unknown"}</div>
              <div className={cn("text-[10px]", roleDef?.color ?? "text-muted-foreground")}>{roleDef?.label ?? ""}</div>
            </div>
            <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", profileOpen && "rotate-180")} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-[#0d1724]/98 backdrop-blur border border-border/60 rounded-xl shadow-2xl z-50 overflow-hidden">
              {/* Profile header */}
              <div className="px-4 py-3 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold border", roleDef?.bgColor)}>
                    {session?.user.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-bold">{session?.user.name}</div>
                    <div className="text-[10px] text-muted-foreground">{session?.user.email}</div>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="px-4 py-3 space-y-2 text-xs border-b border-border/60">
                <ProfileRow label="Role" value={roleDef?.label ?? ""} valueClass={roleDef?.color} />
                <ProfileRow label="Warehouse" value={session?.user.warehouse ?? ""} />
                <ProfileRow label="Shift" value={session?.user.shift ?? ""} />
                <ProfileRow label="Employee ID" value={session?.user.employeeId ?? ""} />
                <ProfileRow label="Session" value="Active — 8h" />
              </div>

              {/* Actions */}
              <div className="p-2">
                <button
                  onClick={() => { setProfileOpen(false); logout(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function KPIPill({ label, value, tone }: { label: string; value: string; tone: "info" | "warning" | "success" }) {
  const colors = {
    info:    "text-info border-info/30 bg-info/10",
    warning: "text-warning border-warning/30 bg-warning/10",
    success: "text-success border-success/30 bg-success/10",
  };
  return (
    <div className={`px-2.5 py-1 rounded border text-mono ${colors[tone]}`}>
      <span className="opacity-70 text-[10px]">{label}</span>
      <span className="ml-1.5 font-bold">{value}</span>
    </div>
  );
}

function ProfileRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", valueClass)}>{value}</span>
    </div>
  );
}
