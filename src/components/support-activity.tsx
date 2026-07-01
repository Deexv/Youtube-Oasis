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
  SparklesIcon,
  FilmIcon,
  ArrowRightIcon,
} from "lucide-react";

type Activity = {
  title: string;
  time: string;
  icon: React.ReactNode;
};

export function SupportActivity({
  className,
  ...props
}: ComponentProps<typeof Card>) {
  const [items, setItems] = useState<Activity[]>([]);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((d) => {
        const arr: any[] = d.items ?? [];
        const out: Activity[] = arr.slice(0, 5).map((it) => ({
          title:
            it.type === "long"
              ? `Long-form scheduled: ${it.title}`
              : `Short scheduled: ${it.header || it.title}`,
          time: formatRelative(it.scheduledTime),
          icon: it.type === "long" ? <FilmIcon /> : <SparklesIcon />,
        }));
        // Always include the most recent scheduling event at the top
        if (arr.length > 0) {
          out.unshift(arr[0]);
        }
        setItems(out);
      })
      .catch(() => setItems([]));
  }, []);

  return (
    <Card className={cn("gap-0 shadow-none dark:ring-0", className)} {...props}>
      <CardHeader className="border-b">
        <CardTitle>Workspace activity</CardTitle>
        <CardDescription>Latest scheduling signals.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="flex flex-col divide-y divide-border">
          {items.length === 0 ? (
            <li className="p-6 text-center text-muted-foreground text-sm">
              No activity yet.
            </li>
          ) : (
            items.map((item, i) => (
              <li className="flex h-18 items-center gap-3 px-3" key={i}>
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center [&_svg]:size-4"
                >
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="line-clamp-2 text-pretty text-foreground text-xs leading-snug">
                    {item.title}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {item.time}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </CardContent>
      <div className="flex items-center justify-center">
        <Button asChild size="sm" variant="ghost">
          <a href="#upcoming">
            View schedule
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
          </a>
        </Button>
      </div>
    </Card>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60000);
  if (min < 60) return diff >= 0 ? `in ${min}m` : `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return diff >= 0 ? `in ${hr}h` : `${hr}h ago`;
  const day = Math.round(hr / 24);
  return diff >= 0 ? `in ${day}d` : `${day}d ago`;
}
