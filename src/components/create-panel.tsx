"use client";

import { useEffect, useState, useRef } from "react";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  UploadCloudIcon,
  SparklesIcon,
  FilmIcon,
  ScissorsIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  DownloadIcon,
  CalendarClockIcon,
  PlayIcon,
  CheckCircleIcon,
  LoaderIcon,
  FileTextIcon,
  Wand2Icon,
  YoutubeIcon,
} from "lucide-react";
import { FileUploader, type UploadedFile } from "@/components/file-uploader";
import { YouTubeAccountSelector } from "@/components/youtube-account-selector";
import { StepProgress, type Step } from "@/components/step-progress";
import { useDashboardStore } from "@/lib/store";
import { BEAT_LABELS } from "@/lib/beats";
import { SUBTITLE_STYLES, type SubtitleStyle } from "@/lib/video-processor-shared";

type Mode = "long-form" | "shorts";

type GeneratedShort = {
  id: string;
  beat: string;
  title: string;
  header: string;
  sourceStart: number;
  sourceEnd: number;
  duration: number;
  fileSize: number;
  subtitleStyle: string;
  status: string;
};

type LongForm = {
  id: string;
  title: string;
  duration: number;
  _count?: { shorts: number };
  account?: { displayName: string; color: string } | null;
};

/**
 * Dedicated Create tab — the full video-to-shorts pipeline.
 *
 * Shorts mode:
 *   1. Upload a video file (drag-and-drop)
 *   2. Optionally auto-generate SRT via Whisper, or paste an SRT
 *   3. Pick subtitle style + on/off toggle
 *   4. Click "Generate shorts" → LLM finds ALL viable moments (1-15+)
 *   5. Each moment is cut, converted to 9:16, subtitled, titled
 *   6. Preview each short with a video player
 *   7. Select which shorts to schedule, or download individually / all
 */
export function CreatePanel() {
  const [mode, setMode] = useState<Mode>("shorts");
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Create</h2>
        <p className="text-sm text-muted-foreground">
          Upload a long-form video to turn into shorts, or schedule a long-form video directly.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
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
            <p className="text-xs text-muted-foreground">Upload → analyze → cut → subtitle → preview</p>
          </div>
        </button>
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
            <p className="text-sm font-medium">Long-form</p>
            <p className="text-xs text-muted-foreground">Upload + schedule on YouTube</p>
          </div>
        </button>
      </div>

      {mode === "shorts" ? <ShortsWizard /> : <LongFormWizard />}
    </div>
  );
}

function ShortsWizard() {
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [title, setTitle] = useState("");
  const [srtContent, setSrtContent] = useState("");
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>("pop");
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [uploadLimitMb, setUploadLimitMb] = useState(2048);
  const [busy, setBusy] = useState(false);
  const [generatingSrt, setGeneratingSrt] = useState(false);
  const [srtProgress, setSrtProgress] = useState(0);
  const [srtStage, setSrtStage] = useState("");
  const [srtMessage, setSrtMessage] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [generatedShorts, setGeneratedShorts] = useState<GeneratedShort[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [longFormId, setLongFormId] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
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

  async function autoGenerateSrt() {
    if (!longFormId) {
      toast.error("Upload a video first");
      return;
    }
    setGeneratingSrt(true);
    setSrtProgress(0);
    setSrtStage("starting");
    setSrtMessage("Starting…");

    try {
      const response = await fetch("/api/srt/generate-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ longFormId, model: "base" }),
      });

      if (!response.ok) {
        const d = await response.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) throw new Error("No response stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              setSrtProgress(data.progress);
              setSrtStage(data.stage);
              setSrtMessage(data.message);

              if (data.stage === "done") {
                setSrtContent(data.srtContent);
                toast.success(`SRT generated — ${data.segmentCount} segments`);
              } else if (data.stage === "error") {
                throw new Error(data.message);
              }
            } catch (e: any) {
              if (e.message && !e.message.includes("JSON")) {
                toast.error(e.message);
                setGeneratingSrt(false);
                return;
              }
            }
          }
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "SRT generation failed");
    } finally {
      setGeneratingSrt(false);
      setSrtProgress(0);
      setSrtStage("");
      setSrtMessage("");
    }
  }

  async function generate() {
    if (!uploaded || !longFormId) {
      toast.error("Upload a video file first");
      return;
    }

    setBusy(true);
    setGeneratedShorts([]);
    setSelectedIds(new Set());

    const stepList: Step[] = [
      { label: "Upload video file", status: "done" },
      { label: "Analyze transcript with LLM (6-beat pattern — finds ALL moments)", status: "active" },
      { label: "Cut + convert each moment to 9:16 vertical", status: "pending" },
      { label: "Burn viral subtitles + title header", status: "pending" },
      { label: "Save shorts for preview", status: "pending" },
    ];
    setSteps([...stepList]);
    const t = toast.loading("Analyzing video with LLM…");

    try {
      // Step 1: LLM analysis (simulated progress while the API runs)
      setTimeout(() => {
        stepList[1].status = "done";
        stepList[2].status = "active";
        setSteps([...stepList]);
        toast.loading("Cutting + converting to vertical (FFmpeg)…", { id: t });
      }, 2000);
      setTimeout(() => {
        stepList[2].status = "done";
        stepList[3].status = "active";
        setSteps([...stepList]);
        toast.loading("Burning subtitles + adding title overlay…", { id: t });
      }, 8000);

      const r = await fetch("/api/shorts/generate-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          longFormId,
          srtContent: srtContent || undefined,
          subtitleStyle,
          subtitlesEnabled,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");

      stepList.forEach((s) => (s.status = "done"));
      setSteps([...stepList]);

      setGeneratedShorts(d.created);
      // Select all by default
      setSelectedIds(new Set(d.created.map((s: GeneratedShort) => s.id)));

      toast.success(
        `Created ${d.created.length} shorts (${d.totalFound} moments found, ${d.totalProcessed} processed)`,
        { id: t },
      );
      setSteps([]);
      bump();
    } catch (e: any) {
      toast.error(e?.message || "Failed", { id: t });
      const activeIdx = stepList.findIndex((s) => s.status === "active");
      if (activeIdx >= 0) stepList[activeIdx].status = "error";
      setSteps([...stepList]);
    } finally {
      setBusy(false);
    }
  }

  async function uploadFirst() {
    if (!uploaded) return;
    setBusy(true);
    const t = toast.loading("Saving uploaded video…");
    try {
      // Create the long-form record first (without scheduling)
      const r = await fetch("/api/long-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          filePath: uploaded.filePath,
          fileSize: uploaded.fileSize,
          mimeType: uploaded.mimeType,
          duration: 0,
          transcript: srtContent || undefined,
          scheduleNow: false,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setLongFormId(d.item.id);
      toast.success("Video saved — ready to generate shorts", { id: t });
    } catch (e: any) {
      toast.error(e?.message || "Upload failed", { id: t });
    } finally {
      setBusy(false);
    }
  }

  async function scheduleSelected() {
    if (selectedIds.size === 0) {
      toast.error("Select at least one short to schedule");
      return;
    }
    setScheduling(true);
    const t = toast.loading(`Scheduling ${selectedIds.size} shorts on YouTube…`);
    try {
      const r = await fetch("/api/shorts/schedule-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortIds: Array.from(selectedIds) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      toast.success(`Scheduled ${d.scheduled} shorts on YouTube`, { id: t });
      bump();
    } catch (e: any) {
      toast.error(e?.message || "Scheduling failed", { id: t });
    } finally {
      setScheduling(false);
    }
  }

  function downloadShort(id: string) {
    window.open(`/api/shorts/serve?id=${id}&download=1`, "_blank");
  }

  function downloadAll() {
    generatedShorts.forEach((s) => {
      setTimeout(() => window.open(`/api/shorts/serve?id=${s.id}&download=1`, "_blank"), 200);
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card className="shadow-none dark:ring-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScissorsIcon className="size-4" />
          Generate shorts from a video
        </CardTitle>
        <CardDescription>
          Upload a video, analyze it with AI, get vertical shorts with viral subtitles. The AI finds ALL viable moments — could be 1, could be 15.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: Upload */}
        {!longFormId ? (
          <>
            <FileUploader
              onUploaded={(f) => {
                setUploaded(f);
                setTitle(f.title);
              }}
              onCleared={() => setUploaded(null)}
              maxFileSizeMb={uploadLimitMb}
            />
            {uploaded && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="s-title">Title</Label>
                  <Input
                    id="s-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <Button onClick={uploadFirst} disabled={busy || !uploaded} className="w-full gap-2">
                  <ArrowRightIcon className="size-4" />
                  Save video & continue
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            {/* Step 2: SRT + options */}
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="size-5 text-emerald-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Video saved: {uploaded?.fileName || title}</p>
                  <p className="text-xs text-muted-foreground">
                    Now add subtitles (SRT) for accurate timing, then generate shorts.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLongFormId(null);
                    setUploaded(null);
                    setTitle("");
                    setSrtContent("");
                    setGeneratedShorts([]);
                  }}
                >
                  <ArrowLeftIcon className="size-4 mr-1" />
                  Change video
                </Button>
              </div>
            </div>

            <Separator />

            {/* SRT options */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileTextIcon className="size-4" />
                Subtitles / SRT (for accurate timing)
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={autoGenerateSrt}
                  disabled={generatingSrt}
                  className="gap-1.5"
                >
                  {generatingSrt ? (
                    <LoaderIcon className="size-3.5 animate-spin" />
                  ) : (
                    <Wand2Icon className="size-3.5" />
                  )}
                  Auto-generate via Whisper
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("srt-file")?.click()}
                  className="gap-1.5"
                >
                  <UploadCloudIcon className="size-3.5" />
                  Upload .srt file
                </Button>
                <input
                  id="srt-file"
                  type="file"
                  accept=".srt,.vtt,.txt"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const text = await file.text();
                      setSrtContent(text);
                      toast.success(`Loaded ${file.name}`);
                    }
                  }}
                />
              </div>
              {generatingSrt && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <LoaderIcon className="size-4 animate-spin" />
                      {srtMessage || "Working…"}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{srtProgress}%</span>
                  </div>
                  <Progress value={srtProgress} className="h-2" />
                </div>
              )}
              <Textarea
                rows={6}
                value={srtContent}
                onChange={(e) => setSrtContent(e.target.value)}
                placeholder="Paste SRT content here, or click 'Auto-generate via Whisper' above…"
                className="font-mono text-xs"
              />
              {srtContent && (
                <p className="text-xs text-muted-foreground">
                  SRT loaded — {srtContent.split("\n\n").filter(Boolean).length} segments
                </p>
              )}
            </div>

            <Separator />

            {/* Subtitle style options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Viral subtitle style</Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="sub-toggle" className="text-xs text-muted-foreground">
                    Burn subtitles
                  </Label>
                  <Switch
                    id="sub-toggle"
                    checked={subtitlesEnabled}
                    onCheckedChange={setSubtitlesEnabled}
                  />
                </div>
              </div>
              <Select
                value={subtitleStyle}
                onValueChange={(v) => setSubtitleStyle(v as SubtitleStyle)}
                disabled={!subtitlesEnabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBTITLE_STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="font-medium">{s.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{s.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Generate button */}
            {steps.length > 0 && <StepProgress steps={steps} />}

            <Button
              onClick={generate}
              disabled={busy}
              className="w-full gap-2"
              size="lg"
            >
              {busy ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <SparklesIcon className="size-4" />
              )}
              {busy ? "Generating…" : "Generate shorts"}
              {!busy && <ArrowRightIcon className="size-4" />}
            </Button>

            {/* Results */}
            {generatedShorts.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {generatedShorts.length} shorts created — preview & select
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedIds.size} selected for scheduling
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={downloadAll} className="gap-1.5">
                        <DownloadIcon className="size-3.5" />
                        Download all
                      </Button>
                      <Button
                        size="sm"
                        onClick={scheduleSelected}
                        disabled={scheduling || selectedIds.size === 0}
                        className="gap-1.5"
                      >
                        {scheduling ? (
                          <LoaderIcon className="size-3.5 animate-spin" />
                        ) : (
                          <CalendarClockIcon className="size-3.5" />
                        )}
                        Schedule selected ({selectedIds.size})
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {generatedShorts.map((s, i) => (
                      <ShortPreviewCard
                        key={s.id}
                        short={s}
                        index={i}
                        selected={selectedIds.has(s.id)}
                        onToggle={() => toggleSelect(s.id)}
                        onDownload={() => downloadShort(s.id)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ShortPreviewCard({
  short,
  index,
  selected,
  onToggle,
  onDownload,
}: {
  short: GeneratedShort;
  index: number;
  selected: boolean;
  onToggle: () => void;
  onDownload: () => void;
}) {
  const beatLabel = (BEAT_LABELS as any)[short.beat] || short.beat;
  const fmtSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`overflow-hidden rounded-md border transition-colors ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      }`}
    >
      {/* Video preview */}
      <div className="relative aspect-[9/16] bg-black">
        <video
          src={`/api/shorts/serve?id=${short.id}`}
          className="h-full w-full"
          controls
          playsInline
          preload="metadata"
        />
        {/* Checkbox overlay */}
        <button
          onClick={onToggle}
          className="absolute left-2 top-2 z-10 flex size-7 items-center justify-center rounded-md border-2 bg-black/60 backdrop-blur"
          aria-label={selected ? "Deselect" : "Select"}
        >
          {selected && <CheckCircleIcon className="size-5 text-primary" />}
        </button>
        {/* Beat badge */}
        <Badge
          variant="secondary"
          className="absolute right-2 top-2 gap-1 bg-black/60 text-white backdrop-blur"
        >
          {beatLabel}
        </Badge>
      </div>

      {/* Info */}
      <div className="space-y-1.5 p-3">
        <p className="line-clamp-2 text-sm font-medium">{short.header}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            {fmtSec(short.sourceStart)}–{fmtSec(short.sourceEnd)} · {short.duration}s
          </span>
          <span>{(short.fileSize / 1024 / 1024).toFixed(1)} MB</span>
        </div>
        <Button variant="outline" size="sm" onClick={onDownload} className="w-full gap-1.5">
          <DownloadIcon className="size-3.5" />
          Download
        </Button>
      </div>
    </div>
  );
}

// Long-form wizard (unchanged from before)
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
      await new Promise((r) => setTimeout(r, 200));
      stepList[1].status = "done";
      stepList[2].status = "active";
      setSteps([...stepList]);
      toast.loading("Uploading to YouTube — this may take a few minutes…", { id: t });

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
        toast.error("YouTube upload failed — check OAuth config in Settings. Saved as failed.", { id: t });
      } else if (scheduleNow) {
        toast.success(`Long-form scheduled on YouTube · ${d.item.scheduledTime.slice(11, 16)}`, { id: t });
      } else {
        toast.success("Long-form saved as draft", { id: t });
      }

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
          <Input id="lf-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lf-desc">Description</Label>
          <Textarea id="lf-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lf-tr">Transcript (used for shorts moment detection)</Label>
          <Textarea id="lf-tr" rows={5} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="lf-dur">Duration (sec)</Label>
            <Input id="lf-dur" type="number" min={60} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lf-ws">Window start</Label>
            <Input id="lf-ws" type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lf-we">Window end</Label>
            <Input id="lf-we" type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
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
            <Label htmlFor="lf-now" className="text-sm font-medium">Schedule on YouTube now</Label>
            <p className="text-xs text-muted-foreground">Random time inside your window is chosen. Otherwise saved as a draft.</p>
          </div>
          <Switch id="lf-now" checked={scheduleNow} onCheckedChange={setScheduleNow} />
        </div>
        {steps.length > 0 && <StepProgress steps={steps} />}
        <Button onClick={submit} disabled={busy || !uploaded} className="w-full gap-2">
          {busy ? <SparklesIcon className="size-4 animate-pulse" /> : <CalendarClockIcon className="size-4" />}
          {busy ? "Working…" : scheduleNow ? "Schedule on YouTube" : "Save draft"}
          {!busy && <ArrowRightIcon className="size-4" />}
        </Button>
      </CardContent>
    </Card>
  );
}
