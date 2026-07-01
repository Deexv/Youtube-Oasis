"use client";

import { Progress } from "@/components/ui/progress";
import { CheckCircleIcon, LoaderIcon, CircleIcon } from "lucide-react";

export type Step = {
  label: string;
  status: "pending" | "active" | "done" | "error";
};

/**
 * Multi-step progress indicator for long-running operations like shorts
 * generation: upload → detect moments → generate headers → schedule on YouTube.
 */
export function StepProgress({ steps }: { steps: Step[] }) {
  const doneCount = steps.filter((s) => s.status === "done").length;
  const totalCount = steps.length;
  const pct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-3">
      <Progress value={pct} className="h-2" />
      <ul className="space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            {step.status === "done" && (
              <CheckCircleIcon className="size-4 text-emerald-600" />
            )}
            {step.status === "active" && (
              <LoaderIcon className="size-4 animate-spin text-primary" />
            )}
            {step.status === "pending" && (
              <CircleIcon className="size-4 text-muted-foreground/40" />
            )}
            {step.status === "error" && (
              <CheckCircleIcon className="size-4 text-destructive" />
            )}
            <span
              className={
                step.status === "done"
                  ? "text-foreground"
                  : step.status === "active"
                    ? "font-medium text-foreground"
                    : step.status === "error"
                      ? "text-destructive"
                      : "text-muted-foreground"
              }
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
