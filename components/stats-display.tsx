"use client";

import { Clock, Scale, Layers, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatTime, formatWeight, formatLength } from "@/lib/utils";

interface StatsDisplayProps {
  totalTimeSeconds: number;
  totalWeightGrams: number;
  totalLengthMeters: number;
  plateSwaps: number;
}

export function StatsDisplay({
  totalTimeSeconds,
  totalWeightGrams,
  totalLengthMeters,
  plateSwaps,
}: StatsDisplayProps) {
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Time</p>
            <p className="font-semibold">{formatTime(totalTimeSeconds)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
            <Scale className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Filament</p>
            <p className="font-semibold">{formatWeight(totalWeightGrams)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900">
            <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Length</p>
            <p className="font-semibold">{formatLength(totalLengthMeters)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-full bg-orange-100 p-2 dark:bg-orange-900">
            <RefreshCw className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Plate Swaps</p>
            <p className="font-semibold">{plateSwaps}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
