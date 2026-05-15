import { createFileRoute } from "@tanstack/react-router";
import { ModulePage, MODULE_CONFIGS } from "@/components/wms/ModulePage";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: `${MODULE_CONFIGS.admin.title} — TriloWMS` }, { name: "description", content: MODULE_CONFIGS.admin.subtitle }] }),
  component: () => <ModulePage cfg={MODULE_CONFIGS.admin} />,
});
