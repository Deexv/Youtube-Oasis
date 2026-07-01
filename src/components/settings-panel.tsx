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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  SettingsIcon,
  KeyIcon,
  YoutubeIcon,
  SparklesIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  XCircleIcon,
  RepeatIcon,
} from "lucide-react";
import { PROVIDER_LABELS, type ProviderName } from "@/lib/llm-shared";

type Settings = {
  longFormPerDay: number;
  shortsPerDay: number;
  shortsMinSpacingMinutes: number;
  longFormWindowStart: string;
  longFormWindowEnd: string;
};

const DEFAULTS: Settings = {
  longFormPerDay: 1,
  shortsPerDay: 3,
  shortsMinSpacingMinutes: 120,
  longFormWindowStart: "09:00",
  longFormWindowEnd: "17:00",
};

export function SettingsPanel() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    youtubeMockMode: boolean;
    youtubeConfigured: boolean;
    youtubeLabel: string;
    llm: { configured: ProviderName[]; rotate: boolean };
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setS({ ...DEFAULTS, ...(d.settings ?? {}) }));
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => setStatus(d));
  }, []);

  function update<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      if (!r.ok) throw new Error("Failed");
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Daily limits & spacing */}
      <Card className="shadow-none dark:ring-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="size-4" />
            Daily limits &amp; spacing
          </CardTitle>
          <CardDescription>
            Caps enforced when scheduling natively on YouTube.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="longFormPerDay">Long-form / day</Label>
            <Input
              id="longFormPerDay"
              type="number"
              min={0}
              max={10}
              value={s.longFormPerDay}
              onChange={(e) => update("longFormPerDay", Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shortsPerDay">Shorts / day</Label>
            <Input
              id="shortsPerDay"
              type="number"
              min={0}
              max={20}
              value={s.shortsPerDay}
              onChange={(e) => update("shortsPerDay", Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spacing">Min spacing between shorts (min)</Label>
            <Input
              id="spacing"
              type="number"
              min={120}
              step={15}
              value={s.shortsMinSpacingMinutes}
              onChange={(e) =>
                update("shortsMinSpacingMinutes", Number(e.target.value) || 120)
              }
            />
            <p className="text-xs text-muted-foreground">Minimum 120 minutes (2 hours).</p>
          </div>
          <div className="space-y-1.5">
            <Label>Long-form scheduling window</Label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={s.longFormWindowStart}
                onChange={(e) => update("longFormWindowStart", e.target.value)}
                aria-label="Window start"
              />
              <span className="text-muted-foreground">→</span>
              <Input
                type="time"
                value={s.longFormWindowEnd}
                onChange={(e) => update("longFormWindowEnd", e.target.value)}
                aria-label="Window end"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Random time within this window is picked for each long-form post.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Z.AI API key */}
      <Card className="shadow-none dark:ring-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4" />
            LLM providers
          </CardTitle>
          <CardDescription>
            Moment detection + short header generation. Set ≥2 to enable rotation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {status?.llm?.configured && status.llm.configured.length > 0 ? (
              <>
                {status.llm.configured.map((p) => (
                  <Badge key={p} variant="default" className="gap-1">
                    <CheckCircleIcon className="size-3" />
                    {PROVIDER_LABELS[p]}
                  </Badge>
                ))}
                {status.llm.rotate && (
                  <Badge variant="outline" className="gap-1">
                    <RepeatIcon className="size-3" />
                    Round-robin
                  </Badge>
                )}
              </>
            ) : (
              <Badge variant="outline" className="gap-1">
                <XCircleIcon className="size-3" />
                No provider configured — using fallback splitter
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["zai", "groq", "gemini", "anthropic"] as ProviderName[]).map((p) => (
              <div key={p} className="space-y-1.5">
                <Label htmlFor={`key-${p}`} className="text-xs">
                  {PROVIDER_LABELS[p]}
                </Label>
                <Input
                  id={`key-${p}`}
                  type="password"
                  placeholder={`${p.toUpperCase()}_API_KEY`}
                  defaultValue=""
                />
              </div>
            ))}
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">6-beat pattern used:</p>
            <p className="mt-1">
              hook/problem → rising-action/assess → conflict/isolate → comeback/process →
              build tension → reveal
            </p>
            <p className="mt-2 font-medium text-foreground">Rotation:</p>
            <p className="mt-1">
              Set <code className="rounded bg-muted px-1 py-0.5">LLM_ROTATE=true</code> (default when ≥2 keys set)
              to cycle evenly. Set <code className="rounded bg-muted px-1 py-0.5">LLM_ROTATE=false</code> to always use the first provider.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* YouTube */}
      <Card className="shadow-none dark:ring-0 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <YoutubeIcon className="size-4" />
            YouTube integration
          </CardTitle>
          <CardDescription>
            All scheduling happens natively on YouTube via the Data API v3.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={status?.youtubeMockMode ? "secondary" : status?.youtubeConfigured ? "default" : "destructive"}
                className="gap-1"
              >
                {status?.youtubeMockMode
                  ? "Mock mode"
                  : status?.youtubeConfigured
                    ? "Live mode"
                    : "Not configured"}
              </Badge>
              {status?.youtubeConfigured && !status.youtubeMockMode && (
                <Badge variant="outline" className="gap-1">
                  <CheckCircleIcon className="size-3" />
                  OAuth ready
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.youtubeMockMode
                ? "Mock mode returns fake video IDs without uploading. Set YOUTUBE_MOCK_MODE=false after configuring OAuth to go live."
                : status?.youtubeConfigured
                  ? "Real uploads via YouTube Data API v3 (videos.insert + publishAt). Videos stay private until the scheduled time."
                  : "Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and YOUTUBE_REFRESH_TOKEN in .env to enable real uploads. Or set YOUTUBE_MOCK_MODE=true for local dev."}
            </p>
          </div>
          <Separator className="md:hidden" />
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyIcon className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">OAuth credentials</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ytClientId" className="text-xs">
                YOUTUBE_CLIENT_ID
              </Label>
              <Input id="ytClientId" type="password" placeholder="Set in .env" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ytClientSecret" className="text-xs">
                YOUTUBE_CLIENT_SECRET
              </Label>
              <Input id="ytClientSecret" type="password" placeholder="Set in .env" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ytRefresh" className="text-xs">
                YOUTUBE_REFRESH_TOKEN
              </Label>
              <Input id="ytRefresh" type="password" placeholder="Set in .env" />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.location.reload()}>
              <RefreshCwIcon className="size-3.5" />
              Refresh status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
