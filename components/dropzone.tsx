"use client";

import { useCallback } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
}

export function Dropzone({ onFilesAdded, disabled, className }: DropzoneProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.name.toLowerCase().endsWith(".3mf")
      );

      if (files.length > 0) {
        onFilesAdded(files);
      }
    },
    [onFilesAdded, disabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      const files = Array.from(e.target.files || []).filter((file) =>
        file.name.toLowerCase().endsWith(".3mf")
      );

      if (files.length > 0) {
        onFilesAdded(files);
      }
      // Reset input
      e.target.value = "";
    },
    [onFilesAdded, disabled]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 px-6 py-10 transition-colors hover:border-muted-foreground/50 hover:bg-muted",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
      <p className="mb-2 text-sm font-medium text-foreground">
        Drop 3MF files here
      </p>
      <p className="text-xs text-muted-foreground">or click to browse</p>
      <input
        type="file"
        accept=".3mf"
        multiple
        onChange={handleFileInput}
        disabled={disabled}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </div>
  );
}
