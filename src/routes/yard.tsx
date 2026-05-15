import { createFileRoute } from "@tanstack/react-router";
import { ModulePage, MODULE_CONFIGS } from "@/components/wms/ModulePage";

export const Route = createFileRoute("/yard")({
  head: () => ({ meta: [{ title: `${MODULE_CONFIGS.yard.title} — TriloWMS` }, { name: "description", content: MODULE_CONFIGS.yard.subtitle }] }),
  component: () => <ModulePage cfg={MODULE_CONFIGS.yard} />,
});
