"use client";

import { Button } from "@/components/ui/button";
import { QueueState, SwapMethod } from "@/lib/types/live-queue";
import { Play, Pause, Square, SkipForward, RotateCcw } from "lucide-react";

interface LiveQueueControlsProps {
  queueState: QueueState;
  swapMethod: SwapMethod;
  hasJobs: boolean;
  onControl: (action: string) => void;
  onSwapMethodChange: (method: SwapMethod) => void;
}

export function LiveQueueControls({
  queueState,
  swapMethod,
  hasJobs,
  onControl,
  onSwapMethodChange,
}: LiveQueueControlsProps) {
  const isRunning = queueState === "waiting" || queueState === "printing" || queueState === "uploading" || queueState === "swapping";
  const isPaused = queueState === "paused";
  const isIdle = queueState === "idle" || queueState === "completed";

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Queue Controls</h3>
        {!isIdle && (
          <span className="ml-auto text-xs text-muted-foreground capitalize">
            {queueState}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Swap method:</label>
        <select
          className="text-xs bg-muted border border-border rounded px-2 py-1"
          value={swapMethod}
          onChange={(e) => onSwapMethodChange(e.target.value as SwapMethod)}
          disabled={isRunning}
        >
          <option value="bake">Bake into 3MF</option>
          <option value="raw-gcode">Raw G-code after print</option>
        </select>
      </div>

      <div className="flex gap-2 flex-wrap">
        {isIdle && (
          <Button
            size="sm"
            onClick={() => onControl("start")}
            disabled={!hasJobs}
          >
            <Play className="mr-1 h-3 w-3" />
            Start Queue
          </Button>
        )}

        {isRunning && (
          <>
            <Button size="sm" variant="outline" onClick={() => onControl("pause")}>
              <Pause className="mr-1 h-3 w-3" />
              Pause
            </Button>
            <Button size="sm" variant="outline" onClick={() => onControl("skip")}>
              <SkipForward className="mr-1 h-3 w-3" />
              Skip
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onControl("stop")}>
              <Square className="mr-1 h-3 w-3" />
              Stop
            </Button>
          </>
        )}

        {isPaused && (
          <>
            <Button size="sm" onClick={() => onControl("resume")}>
              <Play className="mr-1 h-3 w-3" />
              Resume
            </Button>
            <Button size="sm" variant="outline" onClick={() => onControl("retry")}>
              <RotateCcw className="mr-1 h-3 w-3" />
              Retry
            </Button>
            <Button size="sm" variant="outline" onClick={() => onControl("skip")}>
              <SkipForward className="mr-1 h-3 w-3" />
              Skip
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onControl("stop")}>
              <Square className="mr-1 h-3 w-3" />
              Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
