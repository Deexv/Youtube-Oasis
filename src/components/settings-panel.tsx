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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  SettingsIcon,
  YoutubeIcon,
  SparklesIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  XCircleIcon,
  RepeatIcon,
  PlusIcon,
  Trash2Icon,
  StarIcon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { PROVIDER_LABELS, type ProviderName } from "@/lib/llm-shared";
import { YouTubeSetupWizard } from "@/components/youtube-setup-wizard";

type Settings = {
  longFormPerDay: number;
  shortsPerDay: number;
  shortsMinSpacingMinutes: number;
  longFormWindowStart: string;
  longFormWindowEnd: string;
  uploadLimitMb: number;
};

const DEFAULTS: Settings = {
  longFormPerDay: 1,
  shortsPerDay: 3,
  shortsMinSpacingMinutes: 120,
  longFormWindowStart: "09:00",
  longFormWindowEnd: "17:00",
  uploadLimitMb: 2048,
};

type Account = {
  id: string;
  displayName: string;
  channelId?: string | null;
  avatarUrl?: string | null;
  color: string;
  isDefault: boolean;
  createdAt: string;
};

type Status = {
  youtubeMockMode: boolean;
  youtubeConfigured: boolean;
  youtubeLabel: string;
  llm: { configured: ProviderName[]; rotate: boolean };
  llmModels: Record<
    ProviderName,
    { model: string; configured: boolean }
  >;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

export function SettingsPanel() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [oauthConfigured, setOauthConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setS({ ...DEFAULTS, ...(d.settings ?? {}) }));
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => setStatus(d));
    refreshAccounts();
    refreshOAuthConfig();
  }, []);

  function refreshAccounts() {
    fetch("/api/youtube/accounts")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []))
      .catch(() => undefined);
  }

  function refreshOAuthConfig() {
    fetch("/api/youtube/oauth-config")
      .then((r) => r.json())
      .then((d) => setOauthConfigured(d.configured))
      .catch(() => setOauthConfigured(false));
  }

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

  async function setDefault(id: string) {
    const r = await fetch("/api/youtube/accounts-default", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (r.ok) {
      toast.success("Default account updated");
      refreshAccounts();
    } else {
      toast.error("Failed to set default");
    }
  }

  async function disconnect(id: string, name: string) {
    if (!confirm(`Disconnect "${name}"? Scheduled posts already on YouTube are not affected.`)) return;
    const r = await fetch(`/api/youtube/accounts?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      toast.success(`Disconnected ${name}`);
      refreshAccounts();
    } else {
      toast.error("Failed to disconnect");
    }
  }

  return (
    <div className="space-y-4">
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
              <Label htmlFor="uploadLimit">Upload limit (MB)</Label>
              <Input
                id="uploadLimit"
                type="number"
                min={100}
                step={100}
                value={s.uploadLimitMb}
                onChange={(e) => update("uploadLimitMb", Number(e.target.value) || 2048)}
              />
              <p className="text-xs text-muted-foreground">Max file size for video uploads.</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
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

        {/* API keys (LLM providers) */}
        <Card className="shadow-none dark:ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SparklesIcon className="size-4" />
              API keys
            </CardTitle>
            <CardDescription>
              Moment detection + short header generation. Set ≥2 to enable rotation. Override the default model with <code className="rounded bg-muted px-1">*_MODEL</code> env vars.
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
                      <span className="ml-1 text-[10px] opacity-70">
                        {status.llmModels?.[p]?.model}
                      </span>
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
              {(["zai", "groq", "gemini", "anthropic"] as ProviderName[]).map((p) => {
                const isConfigured = status?.llmModels?.[p]?.configured;
                const model = status?.llmModels?.[p]?.model || "—";
                const envKey = p.toUpperCase() + "_API_KEY";
                const envModel = p.toUpperCase() + "_MODEL";
                return (
                  <div
                    key={p}
                    className={`space-y-1.5 rounded-md border p-2.5 ${
                      isConfigured ? "border-emerald-500/30 bg-emerald-500/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`key-${p}`} className="text-xs font-medium">
                        {PROVIDER_LABELS[p]}
                      </Label>
                      {isConfigured && (
                        <CheckCircleIcon className="size-3 text-emerald-600" />
                      )}
                    </div>
                    <Input
                      id={`key-${p}`}
                      type="password"
                      placeholder={envKey}
                      defaultValue=""
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Model: <code className="rounded bg-muted px-1">{model}</code> — override via{" "}
                      <code className="rounded bg-muted px-1">{envModel}</code>
                    </p>
                  </div>
                );
              })}
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
      </div>

      {/* YouTube accounts */}
      <Card className="shadow-none dark:ring-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <YoutubeIcon className="size-4" />
            YouTube accounts
          </CardTitle>
          <CardDescription>
            Connect one or more YouTube accounts. Each gets a distinct color to prevent posting to the wrong channel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status banner */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={status?.youtubeMockMode ? "secondary" : oauthConfigured ? "default" : "destructive"}
              className="gap-1"
            >
              {status?.youtubeMockMode
                ? "Mock mode"
                : oauthConfigured
                  ? "Live mode"
                  : "Not configured"}
            </Badge>
            {oauthConfigured && !status?.youtubeMockMode && (
              <Badge variant="outline" className="gap-1">
                <CheckCircleIcon className="size-3" />
                OAuth ready
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {status?.youtubeMockMode
                ? "Mock mode returns fake video IDs without uploading."
                : oauthConfigured
                  ? "Real uploads via YouTube Data API v3. Click \"Add YouTube account\" below to connect a channel."
                  : "Complete the one-time setup below to enable \"Login with Google\"."}
            </span>
          </div>

          <Separator />

          {/* Setup wizard (shows when OAuth not configured) */}
          {oauthConfigured === false && (
            <YouTubeSetupWizard onConfigured={() => { refreshOAuthConfig(); refreshAccounts(); }} />
          )}

          {/* Accounts list (shows when OAuth IS configured) */}
          {oauthConfigured && accounts.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center">
              <YoutubeIcon className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No YouTube accounts connected yet</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Click below to log in with Google and connect your YouTube channel.
              </p>
              <Button asChild size="sm" className="gap-1.5">
                <Link href="/api/youtube/auth?returnTo=/settings">
                  <PlusIcon className="size-4" />
                  Connect with Google
                </Link>
              </Button>
            </div>
          ) : oauthConfigured && accounts.length > 0 ? (
            <ul className="divide-y divide-border rounded-md border">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-3">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: a.color }}
                  />
                  <Avatar className="size-8">
                    <AvatarImage src={a.avatarUrl || undefined} alt={a.displayName} />
                    <AvatarFallback className="text-xs">{getInitials(a.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.channelId || "No channel ID"}
                    </p>
                  </div>
                  {a.isDefault && (
                    <Badge variant="outline" className="gap-1">
                      <StarIcon className="size-3" />
                      default
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDefault(a.id)}
                    disabled={a.isDefault}
                  >
                    Set default
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => disconnect(a.id, a.displayName)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {oauthConfigured && accounts.length > 0 && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/api/youtube/auth?returnTo=/settings">
                <PlusIcon className="size-4" />
                Connect another Google account
              </Link>
            </Button>
          )}

          <div className="rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">How login works:</p>
            <p className="mt-1">
              Click "Add YouTube account" → you'll be redirected to Google's OAuth consent screen.
              Grant the <code className="rounded bg-muted px-1">youtube.upload</code> scope.
              Google redirects back here with a refresh token stored automatically — no manual copy/paste.
              You can connect multiple Google accounts, each with its own YouTube channel.
            </p>
            <p className="mt-2 font-medium text-foreground">Revoke access:</p>
            <p className="mt-1">
              Visit <Link href="https://myaccount.google.com/permissions" target="_blank" className="underline">myaccount.google.com/permissions</Link> to revoke any connected account.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
