"use client";

import { useState, useCallback } from "react";
import { PrintItem } from "./print-item";
import type { PrintJob } from "@/lib/processor";

interface PrintQueueProps {
  jobs: PrintJob[];
  onReorder: (jobs: PrintJob[]) => void;
  onUpdateCopies: (id: string, copies: number) => void;
  onRemove: (id: string) => void;
}

export function PrintQueue({
  jobs,
  onReorder,
  onUpdateCopies,
  onRemove,
}: PrintQueueProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, id: string) => {
      setDraggedId(id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, id: string) => {
      e.preventDefault();
      if (id !== draggedId) {
        setDragOverId(id);
      }
    },
    [draggedId]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      setDragOverId(null);

      if (!draggedId || draggedId === targetId) {
        setDraggedId(null);
        return;
      }

      const draggedIndex = jobs.findIndex((j) => j.id === draggedId);
      const targetIndex = jobs.findIndex((j) => j.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) {
        setDraggedId(null);
        return;
      }

      const newJobs = [...jobs];
      const [removed] = newJobs.splice(draggedIndex, 1);
      newJobs.splice(targetIndex, 0, removed);

      onReorder(newJobs);
      setDraggedId(null);
    },
    [draggedId, jobs, onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center text-muted-foreground">
        No print jobs in queue. Add 3MF files above to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <div
          key={job.id}
          draggable
          onDragStart={(e) => handleDragStart(e, job.id)}
          onDragOver={(e) => handleDragOver(e, job.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, job.id)}
          onDragEnd={handleDragEnd}
          className={`transition-all ${
            draggedId === job.id ? "opacity-50" : ""
          } ${
            dragOverId === job.id
              ? "translate-y-1 border-t-2 border-primary"
              : ""
          }`}
        >
          <PrintItem
            job={job}
            onUpdateCopies={onUpdateCopies}
            onRemove={onRemove}
          />
        </div>
      ))}
    </div>
  );
}
