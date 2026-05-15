import { createFileRoute } from "@tanstack/react-router";
import { ModulePage, MODULE_CONFIGS } from "@/components/wms/ModulePage";

export const Route = createFileRoute("/labor")({
  head: () => ({ meta: [{ title: `${MODULE_CONFIGS.labor.title} — TriloWMS` }, { name: "description", content: MODULE_CONFIGS.labor.subtitle }] }),
  component: () => <ModulePage cfg={MODULE_CONFIGS.labor} />,
});
