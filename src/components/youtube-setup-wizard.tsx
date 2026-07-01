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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  YoutubeIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  CopyIcon,
  Trash2Icon,
  LoaderIcon,
} from "lucide-react";
import Link from "next/link";

/**
 * In-app setup wizard for Google OAuth credentials.
 *
 * Instead of forcing users to edit .env, this wizard:
 *   1. Shows step-by-step instructions for creating a Google Cloud OAuth client
 *   2. Provides a copy-paste redirect URI
 *   3. Lets the user paste their client ID + secret
 *   4. Saves to the DB (so the "Connect with Google" button works immediately)
 */
export function YouTubeSetupWizard({ onConfigured }: { onConfigured?: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [redirectUri, setRedirectUri] = useState<string>("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try {
      const r = await fetch("/api/youtube/oauth-config");
      const d = await r.json();
      setConfigured(d.configured);
      setRedirectUri(d.redirectUri);
    } catch {
      setConfigured(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  async function save() {
    if (!clientId || !clientSecret) {
      toast.error("Paste both the Client ID and Client Secret");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/youtube/oauth-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      toast.success("OAuth credentials saved — you can now connect your YouTube account");
      setConfigured(true);
      setClientId("");
      setClientSecret("");
      onConfigured?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Remove the saved OAuth credentials? You'll need to re-enter them to connect accounts.")) return;
    const r = await fetch("/api/youtube/oauth-config", { method: "DELETE" });
    if (r.ok) {
      toast.success("OAuth credentials removed");
      setConfigured(false);
    }
  }

  function copyRedirectUri() {
    navigator.clipboard.writeText(redirectUri);
    toast.success("Redirect URI copied to clipboard");
  }

  if (configured === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderIcon className="size-4 animate-spin" />
        Checking OAuth configuration…
      </div>
    );
  }

  if (configured) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3">
          <CheckCircleIcon className="size-5 text-emerald-600" />
          <div className="flex-1">
            <p className="text-sm font-medium">OAuth credentials configured</p>
            <p className="text-xs text-muted-foreground">
              You can connect YouTube accounts below. The "Add YouTube account" button will redirect to Google.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={remove} className="gap-1 text-muted-foreground">
            <Trash2Icon className="size-3.5" />
            Remove
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          One-time setup required
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          To connect your YouTube account, you need a Google OAuth client. Follow the 4 steps below — it takes about 3 minutes.
        </p>
      </div>

      <ol className="space-y-4">
        {/* Step 1 */}
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium">Open Google Cloud Console</p>
            <p className="text-xs text-muted-foreground">
              Create a project (or reuse an existing one) and enable the YouTube Data API v3.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-1 gap-1">
              <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">
                <ExternalLinkIcon className="size-3.5" />
                Open Google Cloud Console
              </a>
            </Button>
          </div>
        </li>

        {/* Step 2 */}
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium">Create OAuth credentials</p>
            <p className="text-xs text-muted-foreground">
              Go to <strong>APIs &amp; Services → Credentials → Create credentials → OAuth client ID</strong>. Choose <strong>Web application</strong>.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-1 gap-1">
              <a href="https://console.cloud.google.com/apis/credentials/oauthclient" target="_blank" rel="noreferrer">
                <ExternalLinkIcon className="size-3.5" />
                Create OAuth client
              </a>
            </Button>
          </div>
        </li>

        {/* Step 3 */}
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium">Add this redirect URI</p>
            <p className="text-xs text-muted-foreground">
              Under <strong>Authorized redirect URIs</strong>, add this exact URL:
            </p>
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2">
              <code className="flex-1 truncate text-xs">{redirectUri}</code>
              <Button variant="ghost" size="icon-xs" onClick={copyRedirectUri} aria-label="Copy redirect URI">
                <CopyIcon className="size-3.5" />
              </Button>
            </div>
          </div>
        </li>

        {/* Step 4 */}
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">4</span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium">Paste your credentials</p>
            <p className="text-xs text-muted-foreground">
              After creating the OAuth client, Google shows a Client ID and Client Secret. Paste them below.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="oauth-client-id" className="text-xs">Client ID</Label>
                <Input
                  id="oauth-client-id"
                  type="text"
                  placeholder="123456789-abcdef.apps.googleusercontent.com"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oauth-client-secret" className="text-xs">Client Secret</Label>
                <Input
                  id="oauth-client-secret"
                  type="password"
                  placeholder="GOCSPX-abcdef..."
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={save} disabled={saving || !clientId || !clientSecret} className="gap-1.5">
              {saving ? <LoaderIcon className="size-4 animate-spin" /> : <CheckCircleIcon className="size-4" />}
              {saving ? "Saving…" : "Save credentials"}
            </Button>
          </div>
        </li>
      </ol>

      <Separator />

      <div className="rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Why is this needed?</p>
        <p className="mt-1">
          Google requires every app that uploads to YouTube to have its own OAuth client. This is a one-time setup — once you paste the credentials here, they're stored in the app's database and the "Connect with Google" button works for every YouTube account you add.
        </p>
        <p className="mt-2">
          Prefer editing <code className="rounded bg-muted px-1">.env</code> instead? See{" "}
          <Link href="#" className="underline">docs/youtube-oauth.md</Link>.
        </p>
      </div>
    </div>
  );
}
