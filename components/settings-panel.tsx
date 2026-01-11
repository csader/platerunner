"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEFAULT_PLATE_SWAP_SEQUENCE,
  PRESETS,
  loadCustomPresets,
  saveCustomPreset,
  loadActiveSequence,
  saveActiveSequence,
  type PlateSwapPreset,
} from "@/lib/plate-swap";

interface SettingsPanelProps {
  sequence: string;
  onSequenceChange: (sequence: string) => void;
}

export function SettingsPanel({
  sequence,
  onSequenceChange,
}: SettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [customPresets, setCustomPresets] = useState<PlateSwapPreset[]>([]);
  const [presetName, setPresetName] = useState("");

  useEffect(() => {
    setCustomPresets(loadCustomPresets());
  }, []);

  const handleReset = () => {
    onSequenceChange(DEFAULT_PLATE_SWAP_SEQUENCE);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;

    const preset: PlateSwapPreset = {
      name: presetName.trim(),
      description: "Custom preset",
      sequence,
    };

    saveCustomPreset(preset);
    setCustomPresets(loadCustomPresets());
    setPresetName("");
  };

  const handleLoadPreset = (preset: PlateSwapPreset) => {
    onSequenceChange(preset.sequence);
  };

  const allPresets = [...PRESETS, ...customPresets];

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Plate Swap Settings</CardTitle>
          <Button variant="ghost" size="icon">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Presets */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Load Preset
            </label>
            <div className="flex flex-wrap gap-2">
              {allPresets.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleLoadPreset(preset)}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Sequence Editor */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              G-Code Sequence
            </label>
            <Textarea
              value={sequence}
              onChange={(e) => onSequenceChange(e.target.value)}
              className="font-mono text-xs"
              rows={12}
              placeholder="Enter plate swap G-code sequence..."
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Default
            </Button>

            <div className="flex flex-1 items-center gap-2">
              <Input
                placeholder="Preset name..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="h-9"
              />
              <Button
                size="sm"
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Preset
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
