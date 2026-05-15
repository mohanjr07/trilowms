import { createFileRoute } from "@tanstack/react-router";
import { ModulePage, MODULE_CONFIGS } from "@/components/wms/ModulePage";

export const Route = createFileRoute("/outbound")({
  head: () => ({ meta: [{ title: `${MODULE_CONFIGS.outbound.title} — TriloWMS` }, { name: "description", content: MODULE_CONFIGS.outbound.subtitle }] }),
  component: () => <ModulePage cfg={MODULE_CONFIGS.outbound} />,
});
