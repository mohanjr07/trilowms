import { createFileRoute } from "@tanstack/react-router";
import { YardPage } from "@/components/yard/YardPage";

export const Route = createFileRoute("/yard")({
  head: () => ({ meta: [{ title: "Yard & Dock — TriloWMS" }, { name: "description", content: "Yard truck management, dock board & appointments" }] }),
  component: YardPage,
});
