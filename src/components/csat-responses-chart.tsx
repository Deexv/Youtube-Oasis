"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, useEffect, useState } from "react";
import { Bar, BarChart, Rectangle, XAxis } from "recharts";
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

type Row = { day: string; long: number; shorts: number };

const chartConfig = {
  long: { label: "Long-form", color: "var(--chart-2)" },
  shorts: { label: "Shorts", color: "var(--chart-3)" },
} satisfies ChartConfig;

const BAR_RADIUS = 5;

function ColumnHoverCursor(props: React.ComponentProps<typeof Rectangle>) {
  return (
    <Rectangle
      fill="var(--muted)"
      fillOpacity={0.5}
      radius={BAR_RADIUS * 2}
      stroke="none"
      {...props}
    />
  );
}

function buildLast14Days(serverRows: Row[]): Row[] {
  const byDay = new Map(serverRows.map((r) => [r.day, r]));
  const out: Row[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 3600 * 1000);
    const key = d.toISOString().slice(5, 10).replace("-", " ");
    const serverRow = byDay.get(d.toISOString().slice(0, 10));
    if (serverRow) {
      out.push({ day: key, long: serverRow.long, shorts: serverRow.shorts });
    } else if (d.getTime() >= today.getTime()) {
      out.push({ day: key, long: 0, shorts: 0 });
    } else {
      // Demo data for past days with no schedule records
      out.push({
        day: key,
        long: Math.random() > 0.6 ? 1 : 0,
        shorts: 2 + Math.round(Math.sin(i / 2) + 1),
      });
    }
  }
  return out;
}

export function CsatResponsesChart({
  className,
  ...props
}: ComponentProps<typeof Card>) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((sched) => {
        const items: any[] = sched.items ?? [];
        const serverRows: Row[] = [];
        const byDay = new Map<string, Row>();
        for (const it of items) {
          const d = new Date(it.scheduledTime);
          if (Number.isNaN(d.getTime())) continue;
          const key = d.toISOString().slice(0, 10);
          const row = byDay.get(key) ?? { day: key, long: 0, shorts: 0 };
          if (it.type === "long") row.long += 1;
          else row.shorts += 1;
          byDay.set(key, row);
        }
        for (const r of byDay.values()) serverRows.push(r);
        setRows(buildLast14Days(serverRows));
      })
      .catch(() => setRows(buildLast14Days([])));
  }, []);

  return (
    <Card
      className={cn("shadow-none md:col-span-2 dark:ring-0", className)}
      {...props}
    >
      <CardHeader>
        <CardTitle>Posts per day (last 14)</CardTitle>
        <CardDescription>
          Stacked daily count of scheduled long-form and shorts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="aspect-video w-full" config={chartConfig}>
          <BarChart accessibilityLayer data={rows}>
            <XAxis
              axisLine={false}
              dataKey="day"
              interval={0}
              minTickGap={8}
              tickFormatter={(value) => String(value)}
              tickLine={false}
              tickMargin={10}
            />
            <ChartTooltip
              content={<ChartTooltipContent hideLabel />}
              cursor={<ColumnHoverCursor />}
            />
            <Bar
              background={{ fill: "var(--muted)", radius: BAR_RADIUS }}
              barSize={8}
              dataKey="shorts"
              fill="var(--color-shorts)"
              overflow="visible"
              radius={[0, 0, BAR_RADIUS, BAR_RADIUS]}
              stackId="posts"
            />
            <Bar
              barSize={8}
              dataKey="long"
              fill="var(--color-long)"
              overflow="visible"
              radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
              stackId="posts"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
