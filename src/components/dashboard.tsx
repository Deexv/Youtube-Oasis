"use client";

import { ChannelBreakdownChart } from "@/components/channel-breakdown-chart";
import { ConversationVolumeChart } from "@/components/conversation-volume-chart";
import { CsatResponsesChart } from "@/components/csat-responses-chart";
import { FirstReplyTimeChart } from "@/components/first-reply-time-chart";
import { RecentConversations } from "@/components/recent-conversations";
import { DashboardStats } from "@/components/stats";
import { SupportActivity } from "@/components/support-activity";
import { TeamOnDuty } from "@/components/team-on-duty";
import { LongFormPanel } from "@/components/long-form-panel";
import { ShortsPanel } from "@/components/shorts-panel";
import { UpcomingPanel } from "@/components/upcoming-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { CreatePanel } from "@/components/create-panel";
import { NewLongFormDialog } from "@/components/new-long-form-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useDashboardStore, type DashboardTab } from "@/lib/store";
import { useEffect, useState } from "react";

export function Dashboard() {
  const tab = useDashboardStore((s) => s.tab);
  const setTab = useDashboardStore((s) => s.setTab);
  // Render charts only after client-side mount to avoid hydration mismatches
  // caused by browser extensions (e.g. DarkReader) that mutate the DOM.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Sync tab with URL hash so sidebar links work
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as DashboardTab;
    if (["overview", "create", "long-form", "shorts", "upcoming", "settings"].includes(hash)) {
      setTab(hash);
    }
    const onHash = () => {
      const h = window.location.hash.replace("#", "") as DashboardTab;
      if (["overview", "create", "long-form", "shorts", "upcoming", "settings"].includes(h)) {
        setTab(h);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [setTab]);

  function changeTab(t: DashboardTab) {
    setTab(t);
    window.location.hash = t;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">YouTube scheduler</h1>
          <p className="text-sm text-muted-foreground">
            Long-form videos + auto-generated shorts, all scheduled natively on YouTube.
          </p>
        </div>
        <NewLongFormDialog />
      </div>

      <Tabs value={tab} onValueChange={(v) => changeTab(v as DashboardTab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="long-form">Long-form</TabsTrigger>
          <TabsTrigger value="shorts">Shorts</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {mounted ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DashboardStats />
              <ConversationVolumeChart />
              <ChannelBreakdownChart />
              <CsatResponsesChart />
              <FirstReplyTimeChart />
              <TeamOnDuty />
              <RecentConversations />
              <SupportActivity />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="create" className="mt-4">
          <CreatePanel />
        </TabsContent>

        <TabsContent value="long-form" className="mt-4">
          <LongFormPanel />
        </TabsContent>

        <TabsContent value="shorts" className="mt-4">
          <ShortsPanel />
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          <UpcomingPanel />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <SettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
