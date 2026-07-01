"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, useEffect, useState } from "react";
import { LabelList, Pie, PieChart } from "recharts";
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
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";

type Kind = "long" | "short";

type Datum = {
  channel: Kind;
  share: number;
  fill: string;
};

const chartConfig = {
  share: { label: "Share" },
  long: { label: "Long-form", color: "var(--chart-2)" },
  short: { label: "Shorts", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function ChannelBreakdownChart({
  className,
  ...props
}: ComponentProps<typeof Card>) {
  const [data, setData] = useState<Datum[]>([
    { channel: "long", share: 50, fill: "var(--color-long)" },
    { channel: "short", share: 50, fill: "var(--color-short)" },
  ]);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((sched) => {
        const items: any[] = sched.items ?? [];
        const long = items.filter((i) => i.type === "long").length;
        const short = items.filter((i) => i.type === "short").length;
        const total = long + short;
        if (total === 0) return;
        setData([
          {
            channel: "long",
            share: Math.round((long / total) * 100),
            fill: "var(--color-long)",
          },
          {
            channel: "short",
            share: Math.round((short / total) * 100),
            fill: "var(--color-short)",
          },
        ]);
      })
      .catch(() => undefined);
  }, []);

  const longShare = data.find((d) => d.channel === "long")?.share ?? 0;
  const shortShare = 100 - longShare;
  const delta = longShare - 50;

  return (
    <Card
      className={cn("flex flex-col shadow-none dark:ring-0", className)}
      {...props}
    >
      <CardHeader className="items-center space-y-1 pb-0 sm:items-start">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <CardTitle>Long vs Shorts split</CardTitle>
          <Delta value={delta} variant="badge">
            <DeltaIcon variant="trend" />
            <DeltaValue suffix="pp" />
          </Delta>
        </div>
        <CardDescription>
          Share of scheduled posts across the upcoming queue
        </CardDescription>
      </CardHeader>
      <CardContent className="my-auto">
        <ChartContainer
          className="mx-auto aspect-square max-h-72 w-full"
          config={chartConfig}
        >
          <PieChart accessibilityLayer>
            <Pie
              cornerRadius={8}
              data={data}
              dataKey="share"
              innerRadius={36}
              nameKey="channel"
              outerRadius="88%"
              stroke="var(--card)"
              strokeWidth={4}
            >
              <LabelList
                className="fill-background font-medium"
                dataKey="share"
                fill="currentColor"
                fontWeight={500}
                formatter={(label) => {
                  const n = Number(label);
                  return Number.isFinite(n) ? `${n}%` : String(label ?? "");
                }}
                position="inside"
                stroke="none"
              />
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="channel" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
