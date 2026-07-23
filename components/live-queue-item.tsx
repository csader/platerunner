"use client";

import { JobStatus } from "@/lib/types/live-queue";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiveQueueItemProps {
  id: string;
  name: string;
  copies: number;
  currentCopy: number;
  status: JobStatus;
  isCurrent: boolean;
  onRemove: (id: string) => void;
  disabled: boolean;
}

const STATUS_BADGE: Record<JobStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  active: { label: "Active", className: "bg-blue-500/10 text-blue-500" },
  completed: { label: "Done", className: "bg-green-500/10 text-green-500" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
  skipped: { label: "Skipped", className: "bg-yellow-500/10 text-yellow-500" },
};

export function LiveQueueItem({
  id,
  name,
  copies,
  currentCopy,
  status,
  isCurrent,
  onRemove,
  disabled,
}: LiveQueueItemProps) {
  const badge = STATUS_BADGE[status];

  return (
    <div
      className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
        isCurrent ? "border-blue-500/50 bg-blue-500/5" : "border-border"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground">
          {copies > 1
            ? `Copy ${currentCopy}/${copies}`
            : "1 copy"}
        </p>
      </div>

      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
      >
        {badge.label}
      </span>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => onRemove(id)}
        disabled={disabled || status === "active"}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
