import { createFileRoute } from "@tanstack/react-router";
import { ModulePage, MODULE_CONFIGS } from "@/components/wms/ModulePage";

export const Route = createFileRoute("/picking")({
  head: () => ({ meta: [{ title: `${MODULE_CONFIGS.picking.title} — TriloWMS` }, { name: "description", content: MODULE_CONFIGS.picking.subtitle }] }),
  component: () => <ModulePage cfg={MODULE_CONFIGS.picking} />,
});
