"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/**
 * Wraps the standard SidebarTrigger so the efferd app-header can render
 * the menu toggle on mobile without a separate registry block.
 */
export function CustomSidebarTrigger({ className }: { className?: string }) {
  return <SidebarTrigger className={cn(className)} />;
}
