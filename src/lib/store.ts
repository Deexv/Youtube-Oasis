import { create } from "zustand";

export type DashboardTab = "overview" | "long-form" | "shorts" | "upcoming" | "settings";

type DashboardState = {
  tab: DashboardTab;
  setTab: (t: DashboardTab) => void;
  // Refresh token — bumped after mutations so charts refetch.
  refreshKey: number;
  bumpRefresh: () => void;
};

export const useDashboardStore = create<DashboardState>((set) => ({
  tab: "overview",
  setTab: (tab) => set({ tab }),
  refreshKey: 0,
  bumpRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
}));
