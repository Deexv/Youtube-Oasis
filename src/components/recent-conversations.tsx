"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilmIcon, ScissorsIcon, ArrowRightIcon } from "lucide-react";

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

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + time;
}

function statusVariant(state: string): ComponentProps<typeof Badge>["variant"] {
  if (state === "failed") return "destructive";
  if (state === "uploaded") return "default";
  if (state === "scheduled") return "secondary";
  return "outline";
}

function typeIcon(t: Row["type"]) {
  return t === "long" ? (
    <FilmIcon className="size-3.5 shrink-0" />
  ) : (
    <ScissorsIcon className="size-3.5 shrink-0" />
  );
}

export function RecentConversations({
  className,
  ...props
}: ComponentProps<typeof Card>) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((d) => setRows((d.items ?? []).slice(0, 6)))
      .catch(() => undefined);
  }, []);

  return (
    <Card
      className={cn("gap-0 shadow-none md:col-span-2 dark:ring-0", className)}
      {...props}
    >
      <CardHeader className="border-b">
        <CardTitle>Upcoming posts</CardTitle>
        <CardDescription>
          Next 6 videos scheduled natively on YouTube
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Title</TableHead>
              <TableHead className="hidden sm:table-cell">Type</TableHead>
              <TableHead>When</TableHead>
              <TableHead className="pr-6 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="h-14 hover:bg-transparent">
                <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                  No posts scheduled yet — seed demo data or add a long-form video.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow className="h-14 hover:bg-transparent" key={r.id}>
                  <TableCell className="max-w-44 truncate pl-6 font-medium">
                    {r.header || r.title}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="inline-flex items-center gap-2 font-medium text-sm capitalize">
                      {typeIcon(r.type)}
                      {r.type === "long" ? "Long" : "Short"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm tabular-nums">
                    {formatWhen(r.scheduledTime)}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Badge variant={statusVariant(r.status)} className="capitalize">
                      {r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex justify-center border-t py-3">
          <Button asChild size="sm" variant="ghost">
            <a href="#upcoming">
              View full schedule
              <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
