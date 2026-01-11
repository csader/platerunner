// Parser for extracting metadata from Bambu Lab gcode files

export interface GcodeMetadata {
  printTimeSeconds: number;
  filamentWeightGrams: number;
  filamentLengthMm: number;
  layerCount: number;
  maxZHeight: number;
}

/**
 * Parse gcode header comments to extract print metadata
 */
export function parseGcodeMetadata(gcode: string): GcodeMetadata {
  const metadata: GcodeMetadata = {
    printTimeSeconds: 0,
    filamentWeightGrams: 0,
    filamentLengthMm: 0,
    layerCount: 0,
    maxZHeight: 0,
  };

  // Match: ; total estimated time: 21m 13s
  // or: ; model printing time: 13m 59s
  const timeMatch = gcode.match(/;\s*(?:total estimated time|model printing time):\s*(?:(\d+)h\s*)?(\d+)m\s*(\d+)s/i);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1] || "0", 10);
    const minutes = parseInt(timeMatch[2] || "0", 10);
    const seconds = parseInt(timeMatch[3] || "0", 10);
    metadata.printTimeSeconds = hours * 3600 + minutes * 60 + seconds;
  }

  // Match: ; total filament weight [g] : 6.53
  const weightMatch = gcode.match(/;\s*total filament weight \[g\]\s*:\s*([\d.]+)/i);
  if (weightMatch) {
    metadata.filamentWeightGrams = parseFloat(weightMatch[1]);
  }

  // Match: ; total filament length [mm] : 2055.25
  const lengthMatch = gcode.match(/;\s*total filament length \[mm\]\s*:\s*([\d.]+)/i);
  if (lengthMatch) {
    metadata.filamentLengthMm = parseFloat(lengthMatch[1]);
  }

  // Match: ; total layer number: 100
  const layerMatch = gcode.match(/;\s*total layer number:\s*(\d+)/i);
  if (layerMatch) {
    metadata.layerCount = parseInt(layerMatch[1], 10);
  }

  // Match: ; max_z_height: 20.00
  const zHeightMatch = gcode.match(/;\s*max_z_height:\s*([\d.]+)/i);
  if (zHeightMatch) {
    metadata.maxZHeight = parseFloat(zHeightMatch[1]);
  }

  return metadata;
}

/**
 * Find the insertion point in gcode (after EXECUTABLE_BLOCK_END)
 * Returns the index of the newline after EXECUTABLE_BLOCK_END
 */
export function findInsertionPoint(gcode: string): number {
  const marker = "; EXECUTABLE_BLOCK_END";
  const markerIndex = gcode.indexOf(marker);

  if (markerIndex === -1) {
    throw new Error("Could not find EXECUTABLE_BLOCK_END marker in gcode");
  }

  // Find the end of the line
  const newlineIndex = gcode.indexOf("\n", markerIndex);
  return newlineIndex !== -1 ? newlineIndex + 1 : gcode.length;
}

/**
 * Parse slice_info.config XML to extract filament usage
 */
export function parseSliceInfo(xml: string): { usedG: number; usedM: number } {
  // Match: used_g="6.53" used_m="2.06"
  const gMatch = xml.match(/used_g="([\d.]+)"/);
  const mMatch = xml.match(/used_m="([\d.]+)"/);

  return {
    usedG: gMatch ? parseFloat(gMatch[1]) : 0,
    usedM: mMatch ? parseFloat(mMatch[1]) : 0,
  };
}

/**
 * Update slice_info.config XML with new filament usage values
 */
export function updateSliceInfo(
  xml: string,
  totalUsedG: number,
  totalUsedM: number
): string {
  return xml
    .replace(/used_g="[\d.]+"/, `used_g="${totalUsedG.toFixed(2)}"`)
    .replace(/used_m="[\d.]+"/, `used_m="${totalUsedM.toFixed(2)}"`);
}
