import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { SkuMasterPage } from "@/components/sku/SkuMasterPage";
import { InventoryBinMapPage } from "@/components/inventory/InventoryBinMapPage";
import { Boxes, Map } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  tab: z.enum(["sku", "binmap"]).optional().default("sku"),
});

export const Route = createFileRoute("/inventory")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Inventory — TriloWMS" },
      { name: "description", content: "SKU Master & Live Bin Mapping" },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { tab } = useSearch({ from: "/inventory" });
  const navigate = useNavigate({ from: "/inventory" });

  const setTab = (t: "sku" | "binmap") => {
    navigate({ search: { tab: t }, replace: true });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border bg-sidebar shrink-0">
        <button
          onClick={() => setTab("sku")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === "sku"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          <Boxes className="h-4 w-4" />
          SKU Master
        </button>
        <button
          onClick={() => setTab("binmap")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === "binmap"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          <Map className="h-4 w-4" />
          Bin Map
          <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-primary/10 text-primary rounded uppercase tracking-wider">Live</span>
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === "sku" && <SkuMasterPage />}
        {tab === "binmap" && <InventoryBinMapPage />}
      </div>
    </div>
  );
}
