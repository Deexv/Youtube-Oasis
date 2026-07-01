"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { YoutubeIcon, AlertTriangleIcon } from "lucide-react";
import Link from "next/link";

export type Account = {
  id: string;
  displayName: string;
  channelId?: string | null;
  avatarUrl?: string | null;
  color: string;
  isDefault: boolean;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

/**
 * Account selector with colored avatars to prevent cross-account mistakes.
 * Shows the selected account's color prominently. When no account is
 * connected, prompts the user to add one.
 */
export function YouTubeAccountSelector({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/youtube/accounts")
      .then((r) => r.json())
      .then((d) => {
        setAccounts(d.accounts ?? []);
        // Auto-select the default account if none is selected
        if (!value && (d.accounts ?? []).length > 0) {
          const def = (d.accounts as Account[]).find((a) => a.isDefault);
          onChange(def?.id ?? d.accounts[0].id);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [onChange, value]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <YoutubeIcon className="size-4" />
        Loading accounts…
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangleIcon className="size-4" />
          No YouTube account connected
        </div>
        <p className="text-xs text-muted-foreground">
          You need to connect at least one YouTube account before scheduling.
        </p>
        <Button asChild size="sm" className="w-fit">
          <Link href="/api/youtube/auth?returnTo=/create">Connect YouTube account</Link>
        </Button>
      </div>
    );
  }

  const selected = accounts.find((a) => a.id === value);

  return (
    <div className={className}>
      <Select value={value ?? undefined} onValueChange={(v) => onChange(v)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select YouTube account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: a.color }}
                />
                <Avatar className="size-5">
                  <AvatarImage src={a.avatarUrl || undefined} alt={a.displayName} />
                  <AvatarFallback className="text-[10px]">{getInitials(a.displayName)}</AvatarFallback>
                </Avatar>
                <span className="truncate">{a.displayName}</span>
                {a.isDefault && (
                  <Badge variant="outline" className="ml-1 text-[10px]">
                    default
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected && (
        <div
          className="mt-2 flex items-center gap-2 rounded-md border-l-4 p-2 text-xs"
          style={{
            borderLeftColor: selected.color,
            backgroundColor: `${selected.color}10`,
          }}
        >
          <AlertTriangleIcon className="size-3.5" style={{ color: selected.color }} />
          <span>
            Posting as <strong>{selected.displayName}</strong> — videos will
            appear on this channel.
          </span>
        </div>
      )}
    </div>
  );
}
