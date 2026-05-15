import { createFileRoute } from "@tanstack/react-router";
import { ModulePage, MODULE_CONFIGS } from "@/components/wms/ModulePage";

export const Route = createFileRoute("/returns")({
  head: () => ({ meta: [{ title: `${MODULE_CONFIGS.returns.title} — TriloWMS` }, { name: "description", content: MODULE_CONFIGS.returns.subtitle }] }),
  component: () => <ModulePage cfg={MODULE_CONFIGS.returns} />,
});
