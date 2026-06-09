import { createFileRoute } from "@tanstack/react-router";
import { QCPage } from "@/components/qc/QCPage";

export const Route = createFileRoute("/qc")({
  head: () => ({ meta: [{ title: "Quality Control — TriloWMS" }, { name: "description", content: "QC inspections, AQL sampling, holds & disposition" }] }),
  component: QCPage,
});
