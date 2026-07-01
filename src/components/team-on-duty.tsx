"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusIndicator } from "@/components/indicator";
import {
  EllipsisIcon,
  ScissorsIcon,
  SparklesIcon,
  YoutubeIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboardStore } from "@/lib/store";

type LongRow = {
  id: string;
  title: string;
  status: string;
  scheduledTime: string | null;
  _count?: { shorts: number };
  shortsCount?: number;
};

function statusColor(s: string): "emerald" | "amber" | "rose" | "sky" {
  if (s === "scheduled" || s === "uploaded") return "emerald";
  if (s === "failed") return "rose";
  if (s === "draft") return "amber";
  return "sky";
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Not scheduled";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TeamOnDuty({
  className,
  ...props
}: ComponentProps<typeof Card>) {
  const [rows, setRows] = useState<LongRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const bump = useDashboardStore((s) => s.bumpRefresh);

  async function refresh() {
    const r = await fetch("/api/long-form");
    const d = await r.json();
    setRows(
      (d.items ?? []).map((it: any) => ({
        id: it.id,
        title: it.title,
        status: it.status,
        scheduledTime: it.scheduledTime,
        shortsCount: it._count?.shorts ?? 0,
      })),
    );
  }

  useEffect(() => {
    refresh();
  }, []);

  async function generateShorts(id: string, title: string) {
    setBusy(id);
    const t = toast.loading(`Analyzing "${title}" with Z.AI…`);
    try {
      const r = await fetch("/api/shorts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ longFormId: id, autoSchedule: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      toast.success(
        `Created ${d.created.length} shorts · ${d.scheduledCount} scheduled on YouTube`,
        { id: t },
      );
      bump();
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Shorts generation failed", { id: t });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className={cn("shadow-none dark:ring-0", className)} {...props}>
      <CardHeader className="border-b">
        <CardTitle>Long-form queue</CardTitle>
        <CardDescription>
          Each video can spawn up to 6 shorts (one per narrative beat)
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="flex flex-col divide-y divide-border">
          {rows.length === 0 ? (
            <li className="p-6 text-center text-muted-foreground text-sm">
              No long-form videos yet. Use the &quot;New long-form&quot; button
              in the sidebar.
            </li>
          ) : (
            rows.map((r) => (
              <li
                className="flex items-center gap-2 p-3 first:pt-0 last:pb-0 sm:gap-3"
                key={r.id}
              >
                <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                  <YoutubeIcon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1 pr-1">
                  <p className="truncate font-medium text-foreground text-sm leading-snug">
                    {r.title}
                  </p>
                  <p className="flex items-center gap-2 text-[10px] leading-snug">
                    <span className="flex shrink-0 items-center gap-1">
                      <StatusIndicator
                        color={statusColor(r.status)}
                        pulse={r.status === "scheduled"}
                      />
                      <span className="capitalize">{r.status}</span>
                    </span>
                    <span className="inline-flex size-1 rounded-full bg-foreground/80" />
                    <span className="tabular-nums">
                      {r.shortsCount ?? 0} shorts
                    </span>
                    <span className="inline-flex size-1 rounded-full bg-foreground/80" />
                    <span className="truncate text-muted-foreground">
                      {formatWhen(r.scheduledTime)}
                    </span>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === r.id}
                  onClick={() => generateShorts(r.id, r.title)}
                  className="gap-1.5"
                >
                  {busy === r.id ? (
                    <SparklesIcon className="size-3.5 animate-pulse" />
                  ) : (
                    <ScissorsIcon className="size-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {busy === r.id ? "Working…" : "Generate shorts"}
                  </span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={`Actions for ${r.title}`}
                      size="icon-xs"
                      variant="ghost"
                    >
                      <EllipsisIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-52">
                    <DropdownMenuLabel className="font-normal text-muted-foreground text-xs">
                      {r.title}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="gap-2"
                      onSelect={() => generateShorts(r.id, r.title)}
                    >
                      <ScissorsIcon className="size-4 opacity-70" />
                      Regenerate shorts
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
