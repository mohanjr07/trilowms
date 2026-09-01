import {
  Eye, Flame, Activity, Truck, Forklift, Tag, Save, RotateCcw, Maximize, Layers3, PencilRuler, Check, Clock, AlertCircle,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useWMSStore, type ViewMode } from "@/lib/wms-store";
import { useEditorStore } from "@/lib/wms-editor-store";
import { EditLayoutModal } from "./WarehouseEditorModals";
import { cn } from "@/lib/utils";

const modes: { id: ViewMode; label: string; icon: typeof Flame; color: string }[] = [
  { id: "default", label: "Default", icon: Eye, color: "var(--color-foreground)" },
  { id: "occupancy", label: "Occupancy", icon: Layers3, color: "#16a34a" },
  { id: "picking", label: "Picking Density", icon: Activity, color: "#f97316" },
  { id: "congestion", label: "Congestion", icon: Flame, color: "#dc2626" },
  { id: "activity", label: "Activity", icon: Activity, color: "#eab308" },
  { id: "movement", label: "Movement", icon: Truck, color: "#0ea5e9" },
];

function useAutoSave() {
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const syncError = useEditorStore((s) => s.syncError);
  const _saveToCloud = useEditorStore((s) => s._saveToCloud);
  const [justSaved, setJustSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave 2 seconds after last change
  useEffect(() => {
    if (!isDirty) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await _saveToCloud();
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    }, 2000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isDirty, _saveToCloud]);

  const saveNow = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await _saveToCloud();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  return { isDirty, isSaving, lastSavedAt, justSaved, syncError, saveNow };
}

function formatSavedAt(ts: number | null) {
  if (!ts) return null;
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function BuilderToolbar() {
  const { viewMode, setViewMode, showForklifts, showDocks, showLabels, toggle } = useWMSStore();
  const { resetToDefault, warehouse } = useEditorStore();
  const [showEditLayout, setShowEditLayout] = useState(false);
  const { isDirty, isSaving, lastSavedAt, justSaved, syncError, saveNow } = useAutoSave();
  const [, tick] = useState(0);

  // Re-render every 15s so "Xs ago" label stays fresh
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const handleReset = () => {
    if (confirm("Reset warehouse to default layout? All your changes will be lost.")) {
      resetToDefault();
    }
  };

  const savedLabel = formatSavedAt(lastSavedAt);

  return (
    <>
    <div className="h-12 panel border-b flex items-center px-3 gap-2 text-xs overflow-x-auto overflow-y-hidden">
      <div className="flex items-center gap-1 pr-3 border-r border-border/60 shrink-0">
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

      <div className="flex items-center gap-1 pr-3 border-r border-border/60 shrink-0">
        <span className="text-[10px] font-bold tracking-wider text-muted-foreground mr-2">LAYERS</span>
        <ToggleBtn active={showForklifts} onClick={() => toggle("showForklifts")} icon={Forklift} label="Forklifts" />
        <ToggleBtn active={showDocks} onClick={() => toggle("showDocks")} icon={Truck} label="Docks" />
        <ToggleBtn active={showLabels} onClick={() => toggle("showLabels")} icon={Tag} label="Labels" />
      </div>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        {/* Cloud save status pill */}
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium transition-all duration-500 border",
          syncError
            ? "text-destructive bg-destructive/10 border-destructive/30"
            : justSaved
            ? "text-success bg-success/10 border-success/30"
            : isSaving || isDirty
            ? "text-warning bg-warning/10 border-warning/30"
            : savedLabel
            ? "text-muted-foreground border-border/40"
            : "text-muted-foreground border-border/20 opacity-40",
        )}>
          {syncError ? (
            <><AlertCircle className="h-3 w-3" /> Save failed</>
          ) : justSaved ? (
            <><Check className="h-3 w-3" /> Saved to cloud</>
          ) : isSaving ? (
            <><Clock className="h-3 w-3 animate-spin" /> Saving…</>
          ) : isDirty ? (
            <><Clock className="h-3 w-3 animate-pulse" /> Saving…</>
          ) : savedLabel ? (
            <><Check className="h-3 w-3" /> Saved {savedLabel}</>
          ) : (
            <><Save className="h-3 w-3" /> No changes</>
          )}
        </div>

        <button
          onClick={handleReset}
          className="px-2.5 py-1.5 rounded border border-border hover:bg-secondary flex items-center gap-1.5 text-muted-foreground hover:text-destructive whitespace-nowrap"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
        <button className="px-2.5 py-1.5 rounded border border-border hover:bg-secondary flex items-center gap-1.5 whitespace-nowrap">
          <Maximize className="h-3.5 w-3.5" /> Fullscreen
        </button>
        <button
          onClick={() => setShowEditLayout(true)}
          className="px-2.5 py-1.5 rounded border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1.5 font-medium whitespace-nowrap"
        >
          <PencilRuler className="h-3.5 w-3.5" /> Edit Layout
        </button>
        <button
          onClick={saveNow}
          disabled={!isDirty || isSaving}
          className={cn(
            "px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition-all whitespace-nowrap",
            isDirty && !isSaving
              ? "bg-primary text-primary-foreground hover:opacity-90 glow-amber cursor-pointer"
              : "bg-primary/30 text-primary-foreground/50 cursor-default",
          )}
        >
          <Save className="h-3.5 w-3.5" /> Save Layout
        </button>
      </div>
    </div>
    {showEditLayout && (
      <EditLayoutModal warehouse={warehouse} onClose={() => setShowEditLayout(false)} />
    )}
    </>
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
