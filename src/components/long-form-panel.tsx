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
import { FilmIcon, ScissorsIcon, SparklesIcon } from "lucide-react";
import { NewLongFormDialog } from "@/components/new-long-form-dialog";
import { useDashboardStore } from "@/lib/store";
import { toast } from "sonner";

type Row = {
  id: string;
  title: string;
  status: string;
  scheduledTime: string | null;
  windowStart: string;
  windowEnd: string;
  duration: number;
  _count?: { shorts: number };
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

function statusVariant(s: string) {
  if (s === "failed") return "destructive";
  if (s === "uploaded" || s === "scheduled") return "default";
  return "secondary";
}

export function LongFormPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const refreshKey = useDashboardStore((s) => s.refreshKey);

  async function refresh() {
    const r = await fetch("/api/long-form");
    const d = await r.json();
    setRows(d.items ?? []);
  }

  useEffect(() => {
    refresh();
  }, [refreshKey]);

  async function genShorts(id: string, title: string) {
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
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed", { id: t });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Long-form videos</h2>
          <p className="text-sm text-muted-foreground">
            Upload long-form content and schedule it natively on YouTube.
          </p>
        </div>
        <NewLongFormDialog />
      </div>
      <Card className="shadow-none dark:ring-0">
        <CardHeader className="border-b">
          <CardTitle>All long-form videos</CardTitle>
          <CardDescription>
            Max 1 post per day (configurable in Settings). Each video can spawn up to 6 shorts.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Title</TableHead>
                <TableHead className="hidden md:table-cell">Duration</TableHead>
                <TableHead className="hidden md:table-cell">Window</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead className="hidden sm:table-cell">Shorts</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="h-16 hover:bg-transparent">
                  <TableCell colSpan={7} className="text-center text-muted-foreground text-sm">
                    No long-form videos yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className="h-14">
                    <TableCell className="max-w-72 truncate pl-6 font-medium">
                      <span className="inline-flex items-center gap-2">
                        <FilmIcon className="size-3.5 text-muted-foreground" />
                        {r.title}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm tabular-nums">
                      {Math.floor(r.duration / 60)}m {r.duration % 60}s
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm tabular-nums">
                      {r.windowStart}–{r.windowEnd}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm tabular-nums">
                      {fmt(r.scheduledTime)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm tabular-nums">
                      {r._count?.shorts ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={statusVariant(r.status)} className="capitalize">
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === r.id}
                        onClick={() => genShorts(r.id, r.title)}
                        className="gap-1.5"
                      >
                        {busy === r.id ? (
                          <SparklesIcon className="size-3.5 animate-pulse" />
                        ) : (
                          <ScissorsIcon className="size-3.5" />
                        )}
                        Generate shorts
                      </Button>
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
