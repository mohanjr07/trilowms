import { createFileRoute } from "@tanstack/react-router";
import { ModulePage, MODULE_CONFIGS } from "@/components/wms/ModulePage";

export const Route = createFileRoute("/qc")({
  head: () => ({ meta: [{ title: `${MODULE_CONFIGS.qc.title} — TriloWMS` }, { name: "description", content: MODULE_CONFIGS.qc.subtitle }] }),
  component: () => <ModulePage cfg={MODULE_CONFIGS.qc} />,
});
