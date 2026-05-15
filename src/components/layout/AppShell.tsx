import { useEffect, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useEditorStore } from "@/lib/wms-editor-store";

export function AppShell() {
  const _loadFromCloud = useEditorStore((s) => s._loadFromCloud);
  // Start as true so we never flash stale localStorage data before Supabase responds
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Load from Supabase first, then show the UI regardless of outcome
    _loadFromCloud().finally(() => setReady(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-xs tracking-wider font-medium">LOADING WAREHOUSES…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
