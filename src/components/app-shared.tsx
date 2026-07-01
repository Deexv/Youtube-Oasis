import type { ReactNode } from "react";
import {
  LayoutGridIcon,
  FilmIcon,
  ScissorsIcon,
  CalendarClockIcon,
  SettingsIcon,
  HelpCircleIcon,
  ActivityIcon,
  SparklesIcon,
} from "lucide-react";

export type SidebarNavItem = {
  title: string;
  path?: string;
  icon?: ReactNode;
  isActive?: boolean;
  subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
  label?: string;
  items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
  {
    items: [
      {
        title: "Overview",
        path: "#overview",
        icon: <LayoutGridIcon />,
        isActive: true,
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        title: "Create",
        path: "#create",
        icon: <SparklesIcon />,
        isActive: false,
      },
      {
        title: "Long-form",
        path: "#long-form",
        icon: <FilmIcon />,
      },
      {
        title: "Shorts",
        path: "#shorts",
        icon: <ScissorsIcon />,
      },
    ],
  },
  {
    label: "Schedule",
    items: [
      {
        title: "Upcoming",
        path: "#upcoming",
        icon: <CalendarClockIcon />,
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        title: "Settings",
        path: "#settings",
        icon: <SettingsIcon />,
        subItems: [
          { title: "Limits & windows", path: "#settings" },
          { title: "Z.AI API key", path: "#settings" },
          { title: "YouTube OAuth", path: "#settings" },
        ],
      },
    ],
  },
];

export const footerNavLinks: SidebarNavItem[] = [
  {
    title: "Help Center",
    path: "#help",
    icon: <HelpCircleIcon />,
  },
  {
    title: "System status",
    path: "#status",
    icon: <ActivityIcon />,
  },
];

export const navLinks: SidebarNavItem[] = [
  ...navGroups.flatMap((group) =>
    group.items.flatMap((item) =>
      item.subItems?.length ? [item, ...item.subItems] : [item]
    )
  ),
  ...footerNavLinks,
];
