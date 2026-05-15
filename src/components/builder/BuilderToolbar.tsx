import {
  Eye, Flame, Activity, Truck, Forklift, Tag, Save, RotateCcw, Maximize, Layers3,
} from "lucide-react";
import { useWMSStore, type ViewMode } from "@/lib/wms-store";
import { cn } from "@/lib/utils";

const modes: { id: ViewMode; label: string; icon: typeof Flame; color: string }[] = [
  { id: "default", label: "Default", icon: Eye, color: "var(--color-foreground)" },
  { id: "occupancy", label: "Occupancy", icon: Layers3, color: "#16a34a" },
  { id: "picking", label: "Picking Density", icon: Activity, color: "#f97316" },
  { id: "congestion", label: "Congestion", icon: Flame, color: "#dc2626" },
  { id: "activity", label: "Activity", icon: Activity, color: "#eab308" },
  { id: "movement", label: "Movement", icon: Truck, color: "#0ea5e9" },
];

export function BuilderToolbar() {
  const { viewMode, setViewMode, showForklifts, showDocks, showLabels, toggle } = useWMSStore();

  return (
    <div className="h-12 panel border-b flex items-center px-3 gap-2 text-xs">
      <div className="flex items-center gap-1 pr-3 border-r border-border/60">
        <span className="text-[10px] font-bold tracking-wider text-muted-foreground mr-2">VIEW MODE</span>
        {modes.map((m) => {
          const Icon = m.icon;
          const active = viewMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setViewMode(m.id)}
              className={cn(
                "px-2.5 py-1.5 rounded flex items-center gap-1.5 border transition-colors",
                active
                  ? "bg-primary/15 border-primary/50 text-primary"
                  : "border-transparent hover:bg-secondary text-muted-foreground hover:text-foreground",
              )}
              style={active ? { boxShadow: `0 0 12px -2px ${m.color}80` } : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1 pr-3 border-r border-border/60">
        <span className="text-[10px] font-bold tracking-wider text-muted-foreground mr-2">LAYERS</span>
        <ToggleBtn active={showForklifts} onClick={() => toggle("showForklifts")} icon={Forklift} label="Forklifts" />
        <ToggleBtn active={showDocks} onClick={() => toggle("showDocks")} icon={Truck} label="Docks" />
        <ToggleBtn active={showLabels} onClick={() => toggle("showLabels")} icon={Tag} label="Labels" />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button className="px-2.5 py-1.5 rounded border border-border hover:bg-secondary flex items-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Reset View
        </button>
        <button className="px-2.5 py-1.5 rounded border border-border hover:bg-secondary flex items-center gap-1.5">
          <Maximize className="h-3.5 w-3.5" /> Fullscreen
        </button>
        <button className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 flex items-center gap-1.5 glow-amber">
          <Save className="h-3.5 w-3.5" /> Save Layout
        </button>
      </div>
    </div>
  );
}

function ToggleBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Truck; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-1.5 rounded flex items-center gap-1.5 border transition-colors",
        active
          ? "bg-accent/15 border-accent/40 text-accent"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
