import { createFileRoute } from "@tanstack/react-router";
import { HandheldPackScreen } from "@/components/handheld/HandheldPackScreen";

export const Route = createFileRoute("/scan-pack")({
  head: () => ({ meta: [{ title: "Scan Pack — TriloWMS" }, { name: "description", content: "Handheld scan-to-pack" }] }),
  component: HandheldPackScreen,
});
