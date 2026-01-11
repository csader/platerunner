"use client";

import { GripVertical, Trash2, Clock, Scale } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatTime, formatWeight, formatLength } from "@/lib/utils";
import type { PrintJob } from "@/lib/processor";

interface PrintItemProps {
  job: PrintJob;
  onUpdateCopies: (id: string, copies: number) => void;
  onRemove: (id: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function PrintItem({
  job,
  onUpdateCopies,
  onRemove,
  dragHandleProps,
}: PrintItemProps) {
  const handleCopiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 99) {
      onUpdateCopies(job.id, value);
    }
  };

  return (
    <Card className="group relative">
      <CardContent className="flex items-center gap-4 p-4">
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="flex cursor-grab items-center text-muted-foreground opacity-50 transition-opacity hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5" />
        </div>

        {/* Thumbnail */}
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {job.thumbnailUrl ? (
            <img
              src={job.thumbnailUrl}
              alt={job.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              No preview
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">{job.name}</h3>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(job.metadata.printTimeSeconds)}
            </span>
            <span className="flex items-center gap-1">
              <Scale className="h-3 w-3" />
              {formatWeight(job.metadata.filamentWeightGrams)}
            </span>
            <span>{formatLength(job.metadata.filamentLengthMm / 1000)}</span>
          </div>
        </div>

        {/* Copies Input */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Copies:</span>
          <Input
            type="number"
            min={1}
            max={99}
            value={job.copies}
            onChange={handleCopiesChange}
            className="h-9 w-16 text-center"
          />
        </div>

        {/* Delete Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(job.id)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
