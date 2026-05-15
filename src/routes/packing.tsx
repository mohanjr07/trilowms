import { createFileRoute } from "@tanstack/react-router";
import { ModulePage, MODULE_CONFIGS } from "@/components/wms/ModulePage";

export const Route = createFileRoute("/packing")({
  head: () => ({ meta: [{ title: `${MODULE_CONFIGS.packing.title} — TriloWMS` }, { name: "description", content: MODULE_CONFIGS.packing.subtitle }] }),
  component: () => <ModulePage cfg={MODULE_CONFIGS.packing} />,
});
