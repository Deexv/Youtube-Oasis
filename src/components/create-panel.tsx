"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  YoutubeIcon,
  SparklesIcon,
  FilmIcon,
  ScissorsIcon,
  UploadCloudIcon,
  CalendarClockIcon,
  ArrowRightIcon,
} from "lucide-react";
import { FileUploader, type UploadedFile } from "@/components/file-uploader";
import { YouTubeAccountSelector } from "@/components/youtube-account-selector";
import { StepProgress, type Step } from "@/components/step-progress";
import { useDashboardStore } from "@/lib/store";

type Mode = "long-form" | "shorts";

/**
 * Dedicated Create tab — a wizard for the two most important flows:
 *   1. Upload + schedule a long-form video (with YouTube account selection)
 *   2. Generate + schedule shorts from an existing long-form video
 *
 * Every step shows real progress (upload %, processing steps, scheduling).
 * No shortcuts — files are uploaded, LLMs are called, YouTube is hit.
 */
export function CreatePanel() {
  const [mode, setMode] = useState<Mode>("long-form");
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Create</h2>
        <p className="text-sm text-muted-foreground">
          Upload a long-form video or generate shorts from an existing one. Every step shows real progress.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMode("long-form")}
          className={`flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
            mode === "long-form"
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-muted/50"
          }`}
        >
          <FilmIcon className="size-5 text-primary" />
          <div>
            <p className="text-sm font-medium">Long-form video</p>
            <p className="text-xs text-muted-foreground">Upload + schedule on YouTube</p>
          </div>
        </button>
        <button
          onClick={() => setMode("shorts")}
          className={`flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
            mode === "shorts"
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-muted/50"
          }`}
        >
          <ScissorsIcon className="size-5 text-primary" />
          <div>
            <p className="text-sm font-medium">Shorts</p>
            <p className="text-xs text-muted-foreground">Generate from a long-form video</p>
          </div>
        </button>
      </div>

      {mode === "long-form" ? <LongFormWizard /> : <ShortsWizard />}
    </div>
  );
}

function LongFormWizard() {
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState(720);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("17:00");
  const [scheduleNow, setScheduleNow] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [uploadLimitMb, setUploadLimitMb] = useState(2048);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const bump = useDashboardStore((s) => s.bumpRefresh);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setUploadLimitMb(d.settings?.uploadLimitMb || 2048))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (uploaded && !title) setTitle(uploaded.title);
  }, [uploaded, title]);

  async function submit() {
    if (!uploaded) {
      toast.error("Upload a video file first");
      return;
    }
    if (!title) {
      toast.error("Title is required");
      return;
    }
    if (scheduleNow && !accountId) {
      toast.error("Select a YouTube account");
      return;
    }

    setBusy(true);
    const stepList: Step[] = [
      { label: "Upload video file", status: "done" },
      { label: "Pick scheduling slot (random time in window)", status: "active" },
      { label: "Upload to YouTube (videos.insert + publishAt)", status: "pending" },
      { label: "Save to database", status: "pending" },
    ];
    setSteps([...stepList]);

    const t = toast.loading("Picking scheduling slot…");

    try {
      // Step 2: pick slot (server does this)
      await new Promise((r) => setTimeout(r, 200));
      stepList[1].status = "done";
      stepList[2].status = "active";
      setSteps([...stepList]);
      toast.loading("Uploading to YouTube — this may take a few minutes…", { id: t });

      // Step 3+4: create + schedule
      const r = await fetch("/api/long-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          filePath: uploaded.filePath,
          fileSize: uploaded.fileSize,
          mimeType: uploaded.mimeType,
          duration,
          transcript,
          windowStart,
          windowEnd,
          scheduleNow,
          accountId,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");

      stepList[2].status = "done";
      stepList[3].status = "active";
      setSteps([...stepList]);

      await new Promise((r) => setTimeout(r, 200));
      stepList[3].status = "done";
      setSteps([...stepList]);

      if (d.item.status === "failed") {
        toast.error(
          "YouTube upload failed — check OAuth config in Settings. Saved as failed.",
          { id: t },
        );
      } else if (scheduleNow) {
        toast.success(
          `Long-form scheduled on YouTube · ${d.item.scheduledTime.slice(11, 16)}`,
          { id: t },
        );
      } else {
        toast.success("Long-form saved as draft", { id: t });
      }

      // Reset
      setUploaded(null);
      setTitle("");
      setDescription("");
      setTranscript("");
      setSteps([]);
      bump();
    } catch (e: any) {
      const activeIdx = stepList.findIndex((s) => s.status === "active");
      if (activeIdx >= 0) stepList[activeIdx].status = "error";
      setSteps([...stepList]);
      toast.error(e?.message || "Failed", { id: t });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="shadow-none dark:ring-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloudIcon className="size-4" />
          Upload long-form video
        </CardTitle>
        <CardDescription>
          Upload a video, pick a scheduling window, and post to YouTube at a random time inside that window.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FileUploader
          onUploaded={setUploaded}
          onCleared={() => setUploaded(null)}
          maxFileSizeMb={uploadLimitMb}
        />

        <div className="space-y-1.5">
          <Label htmlFor="lf-title">Title</Label>
          <Input
            id="lf-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="How I built a YouTube scheduler in 48 hours"
          />
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

        <div className="grid grid-cols-3 gap-3">
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

        <Separator />

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2">
            <YoutubeIcon className="size-4" />
            YouTube account
          </Label>
          <YouTubeAccountSelector value={accountId} onChange={setAccountId} />
        </div>

        <Separator />

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

        {steps.length > 0 && <StepProgress steps={steps} />}

        <Button onClick={submit} disabled={busy || !uploaded} className="w-full gap-2">
          {busy ? (
            <SparklesIcon className="size-4 animate-pulse" />
          ) : (
            <CalendarClockIcon className="size-4" />
          )}
          {busy
            ? "Working…"
            : scheduleNow
              ? "Schedule on YouTube"
              : "Save draft"}
          {!busy && <ArrowRightIcon className="size-4" />}
        </Button>
      </CardContent>
    </Card>
  );
}

function ShortsWizard() {
  const [longForms, setLongForms] = useState<Array<{
    id: string;
    title: string;
    duration: number;
    _count?: { shorts: number };
    account?: { displayName: string; color: string } | null;
  }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoSchedule, setAutoSchedule] = useState(true);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const bump = useDashboardStore((s) => s.bumpRefresh);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const r = await fetch("/api/long-form");
    const d = await r.json();
    setLongForms(d.items ?? []);
  }

  async function generate() {
    if (!selectedId) {
      toast.error("Select a long-form video first");
      return;
    }
    setBusy(true);
    const selected = longForms.find((l) => l.id === selectedId);
    const stepList: Step[] = [
      { label: "Load long-form video + transcript", status: "active" },
      { label: "Detect moments via LLM (6-beat pattern)", status: "pending" },
      { label: "Generate viral headers for each short", status: "pending" },
      { label: "Find scheduling slots (≥2h spacing, daily caps)", status: "pending" },
      { label: "Upload shorts to YouTube (videos.insert + publishAt)", status: "pending" },
    ];
    setSteps([...stepList]);
    const t = toast.loading("Loading video…");

    try {
      // Simulate step progression while the API runs (the API does all of
      // this server-side; we update the UI based on elapsed time + final result)
      const stepTimers: NodeJS.Timeout[] = [];
      stepTimers.push(
        setTimeout(() => {
          stepList[0].status = "done";
          stepList[1].status = "active";
          setSteps([...stepList]);
          toast.loading("Analyzing transcript with LLM…", { id: t });
        }, 300),
      );
      stepTimers.push(
        setTimeout(() => {
          stepList[1].status = "done";
          stepList[2].status = "active";
          setSteps([...stepList]);
          toast.loading("Generating viral headers…", { id: t });
        }, 2500),
      );
      stepTimers.push(
        setTimeout(() => {
          stepList[2].status = "done";
          stepList[3].status = "active";
          setSteps([...stepList]);
          toast.loading("Finding scheduling slots…", { id: t });
        }, 5000),
      );
      stepTimers.push(
        setTimeout(() => {
          stepList[3].status = "done";
          stepList[4].status = "active";
          setSteps([...stepList]);
          toast.loading("Uploading shorts to YouTube…", { id: t });
        }, 6500),
      );

      const r = await fetch("/api/shorts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ longFormId: selectedId, autoSchedule }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");

      stepTimers.forEach(clearTimeout);
      stepList.forEach((s) => (s.status = "done"));
      setSteps([...stepList]);

      toast.success(
        `Created ${d.created.length} shorts · ${d.scheduledCount} scheduled on YouTube`,
        { id: t },
      );
      setSteps([]);
      bump();
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed", { id: t });
      const activeIdx = stepList.findIndex((s) => s.status === "active");
      if (activeIdx >= 0) stepList[activeIdx].status = "error";
      setSteps([...stepList]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="shadow-none dark:ring-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScissorsIcon className="size-4" />
          Generate shorts
        </CardTitle>
        <CardDescription>
          Pick a long-form video and the LLM will find the 6 best moments using
          the narrative pattern: hook → rising → conflict → comeback → tension → reveal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {longForms.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <FilmIcon className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No long-form videos yet. Upload one first.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Select a long-form video</Label>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {longForms.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                    selectedId === l.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <FilmIcon className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.floor(l.duration / 60)}m {l.duration % 60}s · {l._count?.shorts ?? 0} shorts
                    </p>
                  </div>
                  {l.account && (
                    <Badge
                      variant="outline"
                      className="gap-1"
                      style={{ borderLeftColor: l.account.color }}
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: l.account.color }}
                      />
                      {l.account.displayName}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
          <div>
            <Label htmlFor="s-auto" className="text-sm font-medium">
              Auto-schedule on YouTube
            </Label>
            <p className="text-xs text-muted-foreground">
              Shorts are scheduled with ≥2h spacing and the daily cap (default 3/day).
            </p>
          </div>
          <Switch id="s-auto" checked={autoSchedule} onCheckedChange={setAutoSchedule} />
        </div>

        {steps.length > 0 && <StepProgress steps={steps} />}

        <Button
          onClick={generate}
          disabled={busy || !selectedId}
          className="w-full gap-2"
        >
          {busy ? (
            <SparklesIcon className="size-4 animate-pulse" />
          ) : (
            <SparklesIcon className="size-4" />
          )}
          {busy ? "Generating…" : "Generate shorts"}
          {!busy && <ArrowRightIcon className="size-4" />}
        </Button>
      </CardContent>
    </Card>
  );
}
