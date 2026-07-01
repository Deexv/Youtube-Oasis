"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { useDashboardStore } from "@/lib/store";

export function NewLongFormDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [filePath, setFilePath] = useState("/uploads/long-form-1.mp4");
  const [duration, setDuration] = useState(720);
  const [description, setDescription] = useState("");
  const [transcript, setTranscript] = useState("");
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("17:00");
  const [scheduleNow, setScheduleNow] = useState(true);
  const bump = useDashboardStore((s) => s.bumpRefresh);

  async function submit() {
    if (!title || !filePath) {
      toast.error("Title and file path are required");
      return;
    }
    setBusy(true);
    const t = toast.loading("Scheduling on YouTube…");
    try {
      const r = await fetch("/api/long-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          filePath,
          duration,
          description,
          transcript,
          windowStart,
          windowEnd,
          scheduleNow,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      if (d.item.status === "failed") {
        toast.error(
          scheduleNow
            ? "YouTube upload failed — check OAuth config in Settings. Saved as failed."
            : "Long-form saved as draft",
          { id: t },
        );
      } else {
        toast.success(
          scheduleNow
            ? `Long-form scheduled on YouTube · ${d.item.scheduledTime.slice(11, 16)}`
            : "Long-form saved as draft",
          { id: t },
        );
      }
      setOpen(false);
      setTitle("");
      setDescription("");
      setTranscript("");
      bump();
    } catch (e: any) {
      toast.error(e?.message || "Failed", { id: t });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <PlusIcon className="size-4" />
          New long-form
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a long-form video</DialogTitle>
          <DialogDescription>
            Optionally schedule it natively on YouTube with a random time inside your window.
            Long-form limit (1/day by default) is enforced.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="lf-title">Title</Label>
            <Input
              id="lf-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="How I built a YouTube scheduler in 48 hours"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lf-path">File path / URL</Label>
              <Input
                id="lf-path"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lf-dur">Duration (sec)</Label>
              <Input
                id="lf-dur"
                type="number"
                min={60}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lf-desc">Description</Label>
            <Textarea
              id="lf-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lf-tr">Transcript (used for shorts moment detection)</Label>
            <Textarea
              id="lf-tr"
              rows={5}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste the long-form video transcript here…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lf-ws">Window start</Label>
              <Input
                id="lf-ws"
                type="time"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lf-we">Window end</Label>
              <Input
                id="lf-we"
                type="time"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div>
              <Label htmlFor="lf-now" className="text-sm font-medium">
                Schedule on YouTube now
              </Label>
              <p className="text-xs text-muted-foreground">
                Random time inside your window is chosen. Otherwise saved as a draft.
              </p>
            </div>
            <Switch id="lf-now" checked={scheduleNow} onCheckedChange={setScheduleNow} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : scheduleNow ? "Schedule on YouTube" : "Save draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
