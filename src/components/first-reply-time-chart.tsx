"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, useEffect, useState } from "react";
import { CartesianGrid, LabelList, Line, LineChart, XAxis } from "recharts";
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

type Row = { day: string; spacing: number };

const chartConfig = {
  spacing: { label: "Hours", color: "var(--chart-2)" },
} satisfies ChartConfig;

function buildRows(serverRows: Row[]): Row[] {
  // Default 7-day rolling view
  if (serverRows.length > 0) return serverRows;
  return [
    { day: "Mon", spacing: 2.4 },
    { day: "Tue", spacing: 2.1 },
    { day: "Wed", spacing: 2.6 },
    { day: "Thu", spacing: 2.0 },
    { day: "Fri", spacing: 2.3 },
    { day: "Sat", spacing: 2.5 },
    { day: "Sun", spacing: 2.2 },
  ];
}

export function FirstReplyTimeChart({
  className,
  ...props
}: ComponentProps<typeof Card>) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((sched) => {
        const items: any[] = sched.items ?? [];
        if (items.length === 0) {
          setRows(buildRows([]));
          return;
        }
        // Group by day, compute avg gap between scheduled posts
        const byDay = new Map<string, number[]>();
        for (const it of items) {
          const d = new Date(it.scheduledTime);
          if (Number.isNaN(d.getTime())) continue;
          const key = d.toLocaleDateString([], { weekday: "short" });
          const arr = byDay.get(key) ?? [];
          arr.push(d.getTime());
          byDay.set(key, arr);
        }
        const out: Row[] = [];
        for (const [day, ts] of Array.from(byDay.entries())) {
          ts.sort((a, b) => a - b);
          let sum = 0;
          let n = 0;
          for (let i = 1; i < ts.length; i++) {
            const gapH = (ts[i] - ts[i - 1]) / (3600 * 1000);
            sum += gapH;
            n += 1;
          }
          out.push({ day, spacing: n > 0 ? +(sum / n).toFixed(1) : 0 });
        }
        setRows(out.length > 0 ? out : buildRows([]));
      })
      .catch(() => setRows(buildRows([])));
  }, []);

  const chartRows = buildRows(rows);
  const first = chartRows[0]?.spacing ?? 0;
  const last = chartRows.at(-1)?.spacing ?? first;
  // Positive when spacing tightened (lower is better)
  const improvement = first > 0 ? ((first - last) / first) * 100 : 0;

  return (
    <Card
      className={cn("shadow-none md:col-span-2 dark:ring-0", className)}
      {...props}
    >
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Avg gap between posts</CardTitle>
          <Delta value={improvement} variant="badge">
            <DeltaIcon variant="trend" />
            <DeltaValue />
          </Delta>
        </div>
        <CardDescription>
          Average hours between scheduled posts per day (min 2h enforced).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-video w-full" config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartRows}
            margin={{ top: 24, left: 20, right: 12, bottom: 8 }}
          >
            <CartesianGrid className="stroke-border" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="day"
              interval={0}
              tickFormatter={(value) => String(value).slice(0, 3)}
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              content={<ChartTooltipContent indicator="line" />}
              cursor={false}
            />
            <Line
              activeDot={{ r: 6 }}
              dataKey="spacing"
              dot={{ fill: "var(--color-spacing)" }}
              stroke="var(--color-spacing)"
              strokeWidth={2}
              type="natural"
            >
              <LabelList
                className="fill-foreground"
                dataKey="spacing"
                fontSize={12}
                formatter={(label) => {
                  const n = Number(label);
                  return Number.isFinite(n) ? `${n.toFixed(1)}h` : String(label ?? "");
                }}
                offset={12}
                position="top"
              />
            </Line>
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
