"use client";

import { PrinterStatus } from "@/lib/types/live-queue";
import { Activity } from "lucide-react";

interface PrinterStatusDisplayProps {
  status: PrinterStatus;
}

const STATE_LABELS: Record<string, string> = {
  IDLE: "Idle",
  RUNNING: "Printing",
  FINISH: "Finished",
  FAILED: "Failed",
  PAUSE: "Paused",
  UNKNOWN: "Unknown",
};

const STATE_COLORS: Record<string, string> = {
  IDLE: "text-muted-foreground",
  RUNNING: "text-blue-500",
  FINISH: "text-green-500",
  FAILED: "text-destructive",
  PAUSE: "text-yellow-500",
  UNKNOWN: "text-muted-foreground",
};

export function PrinterStatusDisplay({ status }: PrinterStatusDisplayProps) {
  if (!status.connected) return null;

  const stateLabel = STATE_LABELS[status.gcodeState] || status.gcodeState;
  const stateColor = STATE_COLORS[status.gcodeState] || "text-muted-foreground";

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Printer Status</h3>
        <span className={`ml-auto text-xs font-medium ${stateColor}`}>
          {stateLabel}
        </span>
      </div>

      {status.gcodeState === "RUNNING" && (
        <>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${status.mcPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{status.mcPercent}%</span>
            <span>
              {status.mcRemainingTime > 0
                ? `${status.mcRemainingTime}m remaining`
                : "Calculating..."}
            </span>
          </div>
        </>
      )}

      {status.currentFile && (
        <p className="text-xs text-muted-foreground truncate">
          File: {status.currentFile}
        </p>
      )}

      {status.error && (
        <p className="text-xs text-destructive">{status.error}</p>
      )}
    </div>
  );
}
