import { createFileRoute } from "@tanstack/react-router";
import { ModulePage, MODULE_CONFIGS } from "@/components/wms/ModulePage";

export const Route = createFileRoute("/putaway")({
  head: () => ({ meta: [{ title: `${MODULE_CONFIGS.putaway.title} — TriloWMS` }, { name: "description", content: MODULE_CONFIGS.putaway.subtitle }] }),
  component: () => <ModulePage cfg={MODULE_CONFIGS.putaway} />,
});
