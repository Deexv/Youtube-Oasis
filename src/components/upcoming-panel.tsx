"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClockIcon, FilmIcon, ScissorsIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { useDashboardStore } from "@/lib/store";

type Row = {
  id: string;
  type: "long" | "short";
  title: string;
  header?: string;
  beat?: string;
  scheduledTime: string;
  status: string;
  youtubeId?: string;
};

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UpcomingPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [seeding, setSeeding] = useState(false);
  const refreshKey = useDashboardStore((s) => s.refreshKey);
  const bump = useDashboardStore((s) => s.bumpRefresh);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((d) => setRows(d.items ?? []));
  }, [refreshKey]);

  // Group by day
  const byDay = new Map<string, Row[]>();
  for (const r of rows) {
    const k = dayKey(r.scheduledTime);
    const arr = byDay.get(k) ?? [];
    arr.push(r);
    byDay.set(k, arr);
  }

  async function seed() {
    setSeeding(true);
    const t = toast.loading("Seeding demo data…");
    try {
      const r = await fetch("/api/seed", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      toast.success(`Seeded ${d.seeded} long-form videos`, { id: t });
      bump();
    } catch (e: any) {
      toast.error(e?.message || "Failed", { id: t });
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Upcoming schedule</h2>
          <p className="text-sm text-muted-foreground">
            Every post is scheduled natively on YouTube with publishAt.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={seed} disabled={seeding} className="gap-1.5">
          <SparklesIcon className="size-3.5" />
          {seeding ? "Seeding…" : "Seed demo data"}
        </Button>
      </div>

      {byDay.size === 0 ? (
        <Card className="shadow-none dark:ring-0">
          <CardContent className="py-12 text-center">
            <CalendarClockIcon className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No posts scheduled yet. Seed demo data or add a long-form video to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        Array.from(byDay.entries()).map(([k, items]) => {
          const longs = items.filter((i) => i.type === "long").length;
          const shorts = items.filter((i) => i.type === "short").length;
          return (
            <Card key={k} className="shadow-none dark:ring-0">
              <CardHeader className="border-b py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{dayLabel(items[0].scheduledTime)}</CardTitle>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="gap-1">
                      <FilmIcon className="size-3" />
                      {longs} long
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <ScissorsIcon className="size-3" />
                      {shorts} shorts
                    </Badge>
                  </div>
                </div>
                <CardDescription className="sr-only">
                  Scheduled posts for {dayLabel(items[0].scheduledTime)}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {items.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 px-6 py-3"
                    >
                      <div className="w-16 shrink-0 text-sm font-medium tabular-nums">
                        {timeLabel(r.scheduledTime)}
                      </div>
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        {r.type === "long" ? (
                          <FilmIcon className="size-4 text-muted-foreground" />
                        ) : (
                          <ScissorsIcon className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {r.header || r.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.type === "long"
                            ? "Long-form video"
                            : `Short · ${r.beat ?? ""} beat`}
                        </p>
                      </div>
                      <Badge
                        variant={r.status === "scheduled" ? "default" : "outline"}
                        className="capitalize"
                      >
                        {r.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
