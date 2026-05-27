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
  SPEED_PROFILES,
  PROFILE_CONSERVATIVE,
  loadCustomPresets,
  saveCustomPreset,
  loadActiveSequence,
  saveActiveSequence,
  loadSwapMode,
  saveSwapMode,
  loadSwapProfile,
  saveSwapProfile,
  loadSwapProfileName,
  saveSwapProfileName,
  generateSwapSequence,
  type PlateSwapPreset,
  type SwapProfile,
  type SwapMode,
  type SpeedProfileKey,
} from "@/lib/plate-swap";

interface SettingsPanelProps {
  sequence: string;
  onSequenceChange: (sequence: string) => void;
}

const PROFILE_FIELDS: {
  key: keyof SwapProfile;
  label: string;
  description: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "pushSpeed", label: "Push Speed", description: "Speed for pushing plates on/off the bed", unit: "mm/min", min: 200, max: 2000, step: 50 },
  { key: "precisionSpeed", label: "Precision Speed", description: "Speed for final plate seating and homing", unit: "mm/min", min: 100, max: 1000, step: 50 },
  { key: "travelSpeed", label: "Travel Speed", description: "Speed for positioning moves between pushes", unit: "mm/min", min: 1000, max: 6000, step: 100 },
  { key: "fastTravel", label: "Fast Travel", description: "Speed for long repositioning moves", unit: "mm/min", min: 3000, max: 12000, step: 500 },
  { key: "dwellMs", label: "Dwell Time", description: "Pause after each precision move to let motion settle", unit: "ms", min: 100, max: 1000, step: 50 },
  { key: "finalDwellMs", label: "Final Dwell", description: "Pause at end of swap before next print starts", unit: "ms", min: 250, max: 2000, step: 50 },
  { key: "zClearance", label: "Z Clearance", description: "Height to raise Z to clear the printed part", unit: "mm", min: 100, max: 200, step: 5 },
  { key: "zLip", label: "Z Lip Height", description: "Height above the plate lip for the push arm", unit: "mm", min: 170, max: 200, step: 1 },
  { key: "zLower", label: "Z Lower", description: "Height to lower Z after plate is seated", unit: "mm", min: 50, max: 150, step: 5 },
];

export function SettingsPanel({
  sequence,
  onSequenceChange,
}: SettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<SwapMode>("profile");
  const [profileName, setProfileName] = useState<SpeedProfileKey>("conservative");
  const [customProfile, setCustomProfile] = useState<SwapProfile>(PROFILE_CONSERVATIVE);
  const [customPresets, setCustomPresets] = useState<PlateSwapPreset[]>([]);
  const [presetName, setPresetName] = useState("");

  useEffect(() => {
    setMode(loadSwapMode());
    setProfileName(loadSwapProfileName());
    setCustomProfile(loadSwapProfile());
    setCustomPresets(loadCustomPresets());
  }, []);

  const handleModeChange = (newMode: SwapMode) => {
    setMode(newMode);
    saveSwapMode(newMode);
  };

  const handleProfileSelect = (key: SpeedProfileKey) => {
    setProfileName(key);
    saveSwapProfileName(key);
    const profile = SPEED_PROFILES[key].profile;
    setCustomProfile(profile);
    saveSwapProfile(profile);
    const seq = generateSwapSequence(profile);
    onSequenceChange(seq);
  };

  const handleAdvancedChange = (key: keyof SwapProfile, value: number) => {
    const updated = { ...customProfile, [key]: value };
    setCustomProfile(updated);
    saveSwapProfile(updated);
    const seq = generateSwapSequence(updated);
    onSequenceChange(seq);
  };

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
    handleModeChange("raw");
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
          {/* Mode Tabs */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(["profile", "advanced", "raw"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => handleModeChange(tab)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "profile" ? "Profiles" : tab === "advanced" ? "Advanced" : "Raw G-code"}
              </button>
            ))}
          </div>

          {/* Profile Mode */}
          {mode === "profile" && (
            <div className="space-y-3">
              {(Object.entries(SPEED_PROFILES) as [SpeedProfileKey, typeof SPEED_PROFILES[SpeedProfileKey]][]).map(
                ([key, { label, description }]) => (
                  <button
                    key={key}
                    onClick={() => handleProfileSelect(key)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      profileName === key
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-xs text-muted-foreground">{description}</div>
                  </button>
                )
              )}
            </div>
          )}

          {/* Advanced Mode */}
          {mode === "advanced" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PROFILE_FIELDS.map(({ key, label, description, unit, min, max, step }) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium">{label}</label>
                      <span className="text-xs text-muted-foreground">
                        {customProfile[key]} {unit}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{description}</p>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={customProfile[key]}
                      onChange={(e) => handleAdvancedChange(key, Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCustomProfile(PROFILE_CONSERVATIVE);
                  saveSwapProfile(PROFILE_CONSERVATIVE);
                  onSequenceChange(generateSwapSequence(PROFILE_CONSERVATIVE));
                }}
              >
                <RotateCcw className="mr-2 h-3 w-3" />
                Reset to Conservative
              </Button>
            </div>
          )}

          {/* Raw Mode */}
          {mode === "raw" && (
            <div className="space-y-4">
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
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
