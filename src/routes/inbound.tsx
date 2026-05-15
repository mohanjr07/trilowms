import { createFileRoute } from "@tanstack/react-router";
import { ModulePage, MODULE_CONFIGS } from "@/components/wms/ModulePage";

export const Route = createFileRoute("/inbound")({
  head: () => ({ meta: [{ title: `${MODULE_CONFIGS.inbound.title} — TriloWMS` }, { name: "description", content: MODULE_CONFIGS.inbound.subtitle }] }),
  component: () => <ModulePage cfg={MODULE_CONFIGS.inbound} />,
});
