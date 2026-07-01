"use client";

import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScissorsIcon, ExternalLinkIcon } from "lucide-react";
import { youtubeShortUrl } from "@/lib/youtube-shared";
import { BEAT_LABELS } from "@/lib/beats";
import { useDashboardStore } from "@/lib/store";

type Row = {
  id: string;
  title: string;
  header: string | null;
  beat: string;
  sourceStart: number;
  sourceEnd: number;
  duration: number;
  scheduledTime: string | null;
  status: string;
  youtubeId: string | null;
  longForm: { title: string } | null;
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtSec(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function statusVariant(s: string) {
  if (s === "failed") return "destructive";
  if (s === "uploaded" || s === "scheduled") return "default";
  if (s === "ready") return "secondary";
  return "outline";
}

export function ShortsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const refreshKey = useDashboardStore((s) => s.refreshKey);

  useEffect(() => {
    fetch("/api/shorts")
      .then((r) => r.json())
      .then((d) => setRows(d.items ?? []));
  }, [refreshKey]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Shorts</h2>
        <p className="text-sm text-muted-foreground">
          Auto-generated from long-form moments. Max 3/day with ≥2h spacing (configurable).
        </p>
      </div>
      <Card className="shadow-none dark:ring-0">
        <CardHeader className="border-b">
          <CardTitle>All shorts</CardTitle>
          <CardDescription>
            Each short is tagged with one of 6 narrative beats and scheduled natively on YouTube.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Header</TableHead>
                <TableHead className="hidden md:table-cell">Beat</TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <TableHead className="hidden md:table-cell">Parent</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="pr-6 text-right">YouTube</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="h-16 hover:bg-transparent">
                  <TableCell colSpan={7} className="text-center text-muted-foreground text-sm">
                    No shorts yet. Generate them from a long-form video.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className="h-14">
                    <TableCell className="max-w-64 pl-6">
                      <div className="flex items-center gap-2">
                        <ScissorsIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {r.header || r.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {r.title}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {(BEAT_LABELS as any)[r.beat] ?? r.beat}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm tabular-nums">
                      {fmtSec(r.sourceStart)}–{fmtSec(r.sourceEnd)} ({r.duration}s)
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-40 truncate text-muted-foreground text-sm">
                      {r.longForm?.title ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm tabular-nums">
                      {fmt(r.scheduledTime)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={statusVariant(r.status)} className="capitalize">
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      {r.youtubeId ? (
                        <Button asChild size="sm" variant="ghost">
                          <a
                            href={youtubeShortUrl(r.youtubeId)}
                            target="_blank"
                            rel="noreferrer"
                            className="gap-1"
                          >
                            <ExternalLinkIcon className="size-3.5" />
                            View
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
