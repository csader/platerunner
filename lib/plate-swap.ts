// Default plate swap G-code sequence for PlateCycler
// This sequence is injected after each print to eject the current plate and load the next one
// Matches Chitu's exact formatting including trailing spaces

export const DEFAULT_PLATE_SWAP_SEQUENCE = `G0 X-10 F5000;
 G0 Z175;
 G0 Y-5 F2000;
  G0 Y186.5 F2000;
  G0 Y182 F10000;
  G0 Z186 ;
  G0 X180 F5000;
 G0 Y120 F500;
 G0 Y-4 Z175 X-15 F3000;
 G0 Y145;
  G0 Y115 F1000;
 G0 Y25 F500;
 G0 Y85 F1000;
 G0 Y180 F1000;
 G0 X-10 F5000;
 G4 P500; wait
 G0 Y186.5 F200;
 G4 P500; wait
 G0 Y3 F3000;
 G0 Y-5 F200;
G4 P500; wait
 G0 Y10 F1000;
 G0 Z100 Y186 F2000;
 G0 Y150;
 G4 P1000; wait;`;

export interface PlateSwapPreset {
  name: string;
  description: string;
  sequence: string;
}

export const PRESETS: PlateSwapPreset[] = [
  {
    name: "Default (Chitu)",
    description: "Standard PlateCycler C1M sequence",
    sequence: DEFAULT_PLATE_SWAP_SEQUENCE,
  },
];

// Storage key for custom presets
export const CUSTOM_PRESETS_KEY = "platecycler-custom-presets";
export const ACTIVE_SEQUENCE_KEY = "platecycler-active-sequence";

export function loadCustomPresets(): PlateSwapPreset[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(CUSTOM_PRESETS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveCustomPreset(preset: PlateSwapPreset): void {
  const presets = loadCustomPresets();
  const existingIndex = presets.findIndex((p) => p.name === preset.name);
  if (existingIndex >= 0) {
    presets[existingIndex] = preset;
  } else {
    presets.push(preset);
  }
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
}

export function deleteCustomPreset(name: string): void {
  const presets = loadCustomPresets().filter((p) => p.name !== name);
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
}

export function loadActiveSequence(): string {
  if (typeof window === "undefined") return DEFAULT_PLATE_SWAP_SEQUENCE;
  return localStorage.getItem(ACTIVE_SEQUENCE_KEY) || DEFAULT_PLATE_SWAP_SEQUENCE;
}

export function saveActiveSequence(sequence: string): void {
  localStorage.setItem(ACTIVE_SEQUENCE_KEY, sequence);
}
