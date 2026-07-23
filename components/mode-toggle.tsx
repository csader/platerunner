"use client";

interface ModeToggleProps {
  mode: "combined" | "live-queue";
  onModeChange: (mode: "combined" | "live-queue") => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted p-1">
      <button
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          mode === "combined"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => onModeChange("combined")}
      >
        Combined 3MF
      </button>
      <button
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          mode === "live-queue"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => onModeChange("live-queue")}
      >
        Live Queue
      </button>
    </div>
  );
}
