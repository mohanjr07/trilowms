import { createFileRoute } from "@tanstack/react-router";
import { ModulePage, MODULE_CONFIGS } from "@/components/wms/ModulePage";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: `${MODULE_CONFIGS.reports.title} — TriloWMS` }, { name: "description", content: MODULE_CONFIGS.reports.subtitle }] }),
  component: () => <ModulePage cfg={MODULE_CONFIGS.reports} />,
});
