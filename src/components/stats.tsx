"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";

type Stat = {
  label: string;
  value: string;
  delta: number;
  footnote: string;
  lowerIsBetter: boolean;
};

type StatsResponse = {
  longScheduled: number;
  shortsScheduled: number;
  shortsToday: number;
  longToday: number;
  longLimit: number;
  shortsLimit: number;
  nextPost: string | null;
};

function buildStats(s: StatsResponse | null): Stat[] {
  if (!s) {
    return [
      { label: "Loading…", value: "—", delta: 0, footnote: "", lowerIsBetter: false },
      { label: " ", value: "—", delta: 0, footnote: "", lowerIsBetter: false },
      { label: "  ", value: "—", delta: 0, footnote: "", lowerIsBetter: false },
      { label: "   ", value: "—", delta: 0, footnote: "", lowerIsBetter: false },
    ];
  }
  return [
    {
      label: "Long-form scheduled",
      value: String(s.longScheduled),
      delta: s.longToday > 0 ? 100 : 0,
      footnote: `${s.longToday}/${s.longLimit} posted today`,
      lowerIsBetter: false,
    },
    {
      label: "Shorts scheduled",
      value: String(s.shortsScheduled),
      delta: s.shortsToday > 0 ? (s.shortsToday / s.shortsLimit) * 100 : 0,
      footnote: `${s.shortsToday}/${s.shortsLimit} posted today`,
      lowerIsBetter: false,
    },
    {
      label: "Daily shorts headroom",
      value: `${Math.max(0, s.shortsLimit - s.shortsToday)}`,
      delta: (s.shortsLimit - s.shortsToday) * 10,
      footnote: "slots remaining today",
      lowerIsBetter: false,
    },
    {
      label: "Next post",
      value: s.nextPost
        ? new Date(s.nextPost).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "—",
      delta: 0,
      footnote: s.nextPost
        ? new Date(s.nextPost).toLocaleDateString([], { month: "short", day: "numeric" })
        : "no upcoming posts",
      lowerIsBetter: false,
    },
  ];
}

export function DashboardStats() {
  const [data, setData] = useState<StatsResponse | null>(null);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((sched) => {
        const items: any[] = sched.items ?? [];
        const now = new Date();
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);

        const longToday = items.filter(
          (i) => i.type === "long" && new Date(i.scheduledTime) >= start && new Date(i.scheduledTime) <= end,
        ).length;
        const shortsToday = items.filter(
          (i) => i.type === "short" && new Date(i.scheduledTime) >= start && new Date(i.scheduledTime) <= end,
        ).length;
        const longScheduled = items.filter((i) => i.type === "long").length;
        const shortsScheduled = items.filter((i) => i.type === "short").length;

        fetch("/api/settings")
          .then((r) => r.json())
          .then((cfg) => {
            setData({
              longScheduled,
              shortsScheduled,
              longToday,
              shortsToday,
              longLimit: cfg.settings.longFormPerDay,
              shortsLimit: cfg.settings.shortsPerDay,
              nextPost: items[0]?.scheduledTime ?? null,
            });
          })
          .catch(() => setData(null));
      })
      .catch(() => setData(null));
  }, []);

  const stats = buildStats(data);

  return (
    <>
      {stats.map((s) => (
        <Card className={cn("shadow-none dark:ring-0")} key={s.label}>
          <CardHeader>
            <CardTitle className="font-normal text-muted-foreground text-xs">
              {s.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="font-semibold text-2xl tabular-nums">{s.value}</p>
            <div className="flex items-center gap-1 text-xs">
              <Delta value={s.delta}>
                <DeltaIcon />
                <DeltaValue />
              </Delta>
              <span className="text-muted-foreground">{s.footnote}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
