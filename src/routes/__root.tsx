import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary text-mono">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The route you're looking for doesn't exist.</p>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 px-4 py-2 rounded bg-primary text-primary-foreground"
        >Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TriloWMS — Enterprise Warehouse Management" },
      { name: "description", content: "TriloWMS — enterprise warehouse management platform with 3D digital twin, inventory, picking, packing, and dispatch operations." },
      { property: "og:title", content: "TriloWMS — Enterprise Warehouse Management" },
      { name: "twitter:title", content: "TriloWMS — Enterprise Warehouse Management" },
      { property: "og:description", content: "TriloWMS — enterprise warehouse management platform with 3D digital twin, inventory, picking, packing, and dispatch operations." },
      { name: "twitter:description", content: "TriloWMS — enterprise warehouse management platform with 3D digital twin, inventory, picking, packing, and dispatch operations." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1a6c6cf4-a1f2-498d-a818-a834db660257/id-preview-6a1b05c7--eabd7844-8e6e-4e63-82b6-4cc034ce3ee0.lovable.app-1778821342430.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1a6c6cf4-a1f2-498d-a818-a834db660257/id-preview-6a1b05c7--eabd7844-8e6e-4e63-82b6-4cc034ce3ee0.lovable.app-1778821342430.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: () => {
    const { queryClient } = Route.useRouteContext();
    return (
      <QueryClientProvider client={queryClient}>
        <AppShell />
      </QueryClientProvider>
    );
  },
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}
