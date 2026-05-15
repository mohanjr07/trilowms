import { Bell, Search, Activity, Wifi, User } from "lucide-react";

export function TopBar() {
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
        <KPIPill label="ORDERS" value="1,284" tone="info" />
        <KPIPill label="OPEN PICKS" value="217" tone="warning" />
        <KPIPill label="DOCK UTIL" value="78%" tone="success" />
        <button className="p-2 rounded-md hover:bg-secondary"><Activity className="h-4 w-4" /></button>
        <button className="p-2 rounded-md hover:bg-secondary"><Wifi className="h-4 w-4" /></button>
        <button className="p-2 rounded-md hover:bg-secondary relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
        </button>
        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="text-left leading-tight">
            <div className="font-medium">M. Reyes</div>
            <div className="text-[10px] text-muted-foreground">Warehouse Manager</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function KPIPill({ label, value, tone }: { label: string; value: string; tone: "info" | "warning" | "success" }) {
  const colors = {
    info: "text-info border-info/30 bg-info/10",
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
