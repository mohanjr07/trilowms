import { createFileRoute } from "@tanstack/react-router";
import { PTLPage } from "@/components/ptl/PTLPage";

export const Route = createFileRoute("/ptl")({
  head: () => ({
    meta: [
      { title: "PTL Calling — TriloWMS" },
      { name: "description", content: "Pick Flow Bridge integration: PTL order calling and pick feedback receiving, inside TriloWMS." },
    ],
  }),
  component: PTLPage,
});
