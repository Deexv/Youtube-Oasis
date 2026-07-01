"use client";

import dynamic from "next/dynamic";
import { AppShell } from "@/components/app-shell";

// Disable SSR for the Dashboard to avoid hydration mismatches caused by
// browser extensions (e.g. DarkReader) that mutate the DOM before React
// hydrates. The dashboard is fully client-side anyway (charts, forms, etc).
const Dashboard = dynamic(
  () => import("@/components/dashboard").then((m) => m.Dashboard),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        Loading dashboard…
      </div>
    ),
  },
);

export default function Home() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}
