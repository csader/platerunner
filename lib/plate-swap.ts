// Default plate swap G-code sequence for PlateCycler
// This sequence is injected after each print to eject the current plate and load the next one
// Matches Chitu's exact formatting including trailing spaces

export interface SwapProfile {
  pushSpeed: number;       // F value for plate push/pull (default 500)
  precisionSpeed: number;  // F value for seating moves (default 200)
  travelSpeed: number;     // F value for positioning moves (default 2000)
  fastTravel: number;      // F value for long repositioning (default 5000)
  dwellMs: number;         // G4 P value for short pauses (default 500)
  finalDwellMs: number;    // G4 P value for final pause (default 1000)
  zClearance: number;      // Z height for clearance (default 175)
  zLip: number;            // Z height above plate lip (default 186)
  zLower: number;          // Z height for final lower (default 100)
}

export const PROFILE_CONSERVATIVE: SwapProfile = {
  pushSpeed: 500,
  precisionSpeed: 200,
  travelSpeed: 2000,
  fastTravel: 5000,
  dwellMs: 500,
  finalDwellMs: 1000,
  zClearance: 175,
  zLip: 186,
  zLower: 100,
};

export const PROFILE_BALANCED: SwapProfile = {
  pushSpeed: 800,
  precisionSpeed: 400,
  travelSpeed: 3000,
  fastTravel: 6000,
  dwellMs: 350,
  finalDwellMs: 750,
  zClearance: 175,
  zLip: 186,
  zLower: 100,
};

export const PROFILE_FAST: SwapProfile = {
  pushSpeed: 1200,
  precisionSpeed: 600,
  travelSpeed: 4000,
  fastTravel: 8000,
  dwellMs: 250,
  finalDwellMs: 500,
  zClearance: 175,
  zLip: 186,
  zLower: 100,
};

export const SPEED_PROFILES = {
  conservative: { label: "Conservative", description: "Original Chitu speeds (~55s)", profile: PROFILE_CONSERVATIVE },
  balanced: { label: "Balanced", description: "Moderate speedup (~35s)", profile: PROFILE_BALANCED },
  fast: { label: "Fast", description: "Aggressive speeds (~25s)", profile: PROFILE_FAST },
} as const;

export type SpeedProfileKey = keyof typeof SPEED_PROFILES;

/**
 * Generate a plate swap G-code sequence from a speed profile
 */
export function generateSwapSequence(p: SwapProfile): string {
  return [
    `G0 X-10 F${p.fastTravel};`,
    ` G0 Z${p.zClearance};`,
    ` G0 Y-5 F${p.travelSpeed};`,
    `  G0 Y186.5 F${p.travelSpeed};`,
    `  G0 Y182 F${p.fastTravel * 2};`,
    `  G0 Z${p.zLip} ;`,
    `  G0 X180 F${p.fastTravel};`,
    ` G0 Y120 F${p.pushSpeed};`,
    ` G0 Y-4 Z${p.zClearance} X-15 F${p.travelSpeed};`,
    ` G0 Y145;`,
    `  G0 Y115 F${p.pushSpeed};`,
    ` G0 Y25 F${p.pushSpeed};`,
    ` G0 Y85 F${p.travelSpeed};`,
    ` G0 Y180 F${p.travelSpeed};`,
    ` G0 X-10 F${p.fastTravel};`,
    ` G4 P${p.dwellMs}; wait`,
    ` G0 Y186.5 F${p.precisionSpeed};`,
    ` G4 P${p.dwellMs}; wait`,
    ` G0 Y3 F${p.travelSpeed};`,
    ` G0 Y-5 F${p.precisionSpeed};`,
    `G4 P${p.dwellMs}; wait`,
    ` G0 Y10 F${p.travelSpeed};`,
    ` G0 Z${p.zLower} Y186 F${p.travelSpeed};`,
    ` G0 Y150;`,
    ` G4 P${p.finalDwellMs}; wait;`,
  ].join("\n");
}

export const DEFAULT_PLATE_SWAP_SEQUENCE = generateSwapSequence(PROFILE_CONSERVATIVE);

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

// Storage keys
export const CUSTOM_PRESETS_KEY = "platecycler-custom-presets";
export const ACTIVE_SEQUENCE_KEY = "platecycler-active-sequence";
export const SWAP_MODE_KEY = "platecycler-swap-mode";
export const SWAP_PROFILE_KEY = "platecycler-swap-profile";
export const SWAP_PROFILE_NAME_KEY = "platecycler-swap-profile-name";

export type SwapMode = "profile" | "advanced" | "raw";

export function loadSwapMode(): SwapMode {
  if (typeof window === "undefined") return "profile";
  return (localStorage.getItem(SWAP_MODE_KEY) as SwapMode) || "profile";
}

export function saveSwapMode(mode: SwapMode): void {
  localStorage.setItem(SWAP_MODE_KEY, mode);
}

export function loadSwapProfile(): SwapProfile {
  if (typeof window === "undefined") return PROFILE_CONSERVATIVE;
  const stored = localStorage.getItem(SWAP_PROFILE_KEY);
  return stored ? JSON.parse(stored) : PROFILE_CONSERVATIVE;
}

export function saveSwapProfile(profile: SwapProfile): void {
  localStorage.setItem(SWAP_PROFILE_KEY, JSON.stringify(profile));
}

export function loadSwapProfileName(): SpeedProfileKey {
  if (typeof window === "undefined") return "conservative";
  return (localStorage.getItem(SWAP_PROFILE_NAME_KEY) as SpeedProfileKey) || "conservative";
}

export function saveSwapProfileName(name: SpeedProfileKey): void {
  localStorage.setItem(SWAP_PROFILE_NAME_KEY, name);
}

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
