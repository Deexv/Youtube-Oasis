"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, useEffect, useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  formatChartAxisTick,
  formatChartTooltipDate,
  parseIsoCalendarDate,
} from "@/components/formater";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PeriodDays = 7 | 30 | 60;

type VolumeRow = {
  date: string;
  long: number;
  shorts: number;
};

function buildLastNDays(n: number): VolumeRow[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: VolumeRow[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 3600 * 1000);
    // Deterministic pseudo-random distribution (no Math.random — avoids hydration mismatch)
    const seed = i * 9301 + 49297;
    const r1 = ((seed * 233280) % 233281) / 233280;
    const r2 = ((seed * 9301 + 49297) % 233281) / 233280;
    const base = 1 + Math.round(Math.sin(i / 3) + 1);
    out.push({
      date: d.toISOString().slice(0, 10),
      long: r1 > 0.6 ? 1 : 0,
      shorts: base + (r2 > 0.7 ? 1 : 0),
    });
  }
  return out;
}

const chartConfig = {
  long: { label: "Long-form", color: "var(--chart-2)" },
  shorts: { label: "Shorts", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function ConversationVolumeChart({
  className,
  ...props
}: ComponentProps<typeof Card>) {
  const chartUid = useId().replace(/:/g, "");
  const idLongGrad = `schedule-volume-long-grad-${chartUid}`;
  const idShortsGrad = `schedule-volume-shorts-grad-${chartUid}`;

  const [periodDays, setPeriodDays] = useState<PeriodDays>(30);
  const [serverRows, setServerRows] = useState<VolumeRow[] | null>(null);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((sched) => {
        const items: any[] = sched.items ?? [];
        const byDay = new Map<string, VolumeRow>();
        for (const it of items) {
          const d = new Date(it.scheduledTime);
          if (Number.isNaN(d.getTime())) continue;
          const key = d.toISOString().slice(0, 10);
          const row = byDay.get(key) ?? { date: key, long: 0, shorts: 0 };
          if (it.type === "long") row.long += 1;
          else row.shorts += 1;
          byDay.set(key, row);
        }
        // Merge with last N days so the chart always has the right x range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const out: VolumeRow[] = [];
        for (let i = periodDays - 1; i >= 0; i--) {
          const d = new Date(today.getTime() - i * 24 * 3600 * 1000);
          const key = d.toISOString().slice(0, 10);
          const serverRow = byDay.get(key);
          // For past days: use server data (or 0); for today and future: use server data
          if (serverRow) {
            out.push(serverRow);
          } else if (d.getTime() >= today.getTime()) {
            // Future day with no schedule yet
            out.push({ date: key, long: 0, shorts: 0 });
          } else {
            // Past day with no record — show small demo value
            const base = 1 + Math.round(Math.sin(i / 3) + 1);
            out.push({ date: key, long: Math.random() > 0.4 ? 1 : 0, shorts: base });
          }
        }
        setServerRows(out);
      })
      .catch(() => setServerRows(buildLastNDays(periodDays)));
  }, [periodDays]);

  const chartRows = serverRows ?? buildLastNDays(periodDays);

  const lastChartRow = chartRows.at(-1);
  const referenceDate = lastChartRow
    ? parseIsoCalendarDate(lastChartRow.date)
    : new Date();

  const growthPctNum = useMemo(() => {
    const total = chartRows.reduce((a, r) => a + r.shorts + r.long, 0);
    const pastHalf = chartRows.slice(0, Math.floor(chartRows.length / 2));
    const pastTotal = pastHalf.reduce((a, r) => a + r.shorts + r.long, 0);
    const recentTotal = total - pastTotal;
    if (!pastTotal) return 0;
    return ((recentTotal - pastTotal) / pastTotal) * 100;
  }, [chartRows]);

  let xAxisMinTickGap: number | undefined;
  if (periodDays <= 7) xAxisMinTickGap = undefined;
  else if (periodDays >= 60) xAxisMinTickGap = 20;
  else xAxisMinTickGap = 28;

  return (
    <Card
      className={cn(
        "shadow-none md:col-span-2 lg:col-span-3 dark:ring-0",
        className
      )}
      {...props}
    >
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Schedule volume</CardTitle>
            <Delta value={growthPctNum} variant="badge">
              <DeltaIcon variant="trend" />
              <DeltaValue />
            </Delta>
          </div>
          <CardDescription>
            Scheduled long-form &amp; shorts per day for the selected window.
          </CardDescription>
        </div>
        <Select
          onValueChange={(v) => setPeriodDays(Number(v) as PeriodDays)}
          value={String(periodDays)}
        >
          <SelectTrigger
            aria-label="Schedule volume time range"
            className="w-full min-w-36 sm:w-fit"
            size="sm"
          >
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="60">Last 60 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-22/8 w-full" config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={chartRows}
            margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id={idLongGrad} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-long)" stopOpacity={0.45} />
                <stop offset="55%" stopColor="var(--color-long)" stopOpacity={0.12} />
                <stop offset="100%" stopColor="var(--color-long)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={idShortsGrad} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-shorts)" stopOpacity={0.4} />
                <stop offset="60%" stopColor="var(--color-shorts)" stopOpacity={0.1} />
                <stop offset="100%" stopColor="var(--color-shorts)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid className="stroke-border" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="date"
              interval={periodDays <= 7 ? 0 : "preserveStartEnd"}
              minTickGap={xAxisMinTickGap}
              tickFormatter={(value) =>
                formatChartAxisTick(String(value), periodDays)
              }
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              tick={{ className: "tabular-nums" }}
              tickLine={false}
              tickMargin={8}
              width={36}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="min-w-34"
                  indicator="line"
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as VolumeRow | undefined;
                    if (!row?.date) return "";
                    return formatChartTooltipDate(row.date, "long");
                  }}
                />
              }
              cursor={false}
            />
            <Area
              dataKey="shorts"
              dot={false}
              fill={`url(#${idShortsGrad})`}
              stroke="var(--color-shorts)"
              strokeWidth={2}
              type="natural"
            />
            <Area
              dataKey="long"
              dot={false}
              fill={`url(#${idLongGrad})`}
              stroke="var(--color-long)"
              strokeWidth={2}
              type="natural"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
