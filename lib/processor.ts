import JSZip from "jszip";
import SparkMD5 from "spark-md5";
import {
  parseGcodeMetadata,
  parseSliceInfo,
  updateSliceInfo,
  type GcodeMetadata,
} from "./gcode-parser";

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export interface PrintJob {
  id: string;
  name: string;
  file: File;
  gcode: string;
  metadata: GcodeMetadata;
  sliceInfoXml: string;
  thumbnailUrl: string | null;
  copies: number;
  originalZip: JSZip;
}

/**
 * Check if the gcode already has a plate swap sequence after EXECUTABLE_BLOCK_END
 */
function hasSwapSequence(gcode: string): boolean {
  const marker = "; EXECUTABLE_BLOCK_END";
  const markerIndex = gcode.indexOf(marker);
  if (markerIndex === -1) return false;

  // Check if there's significant content after the marker (swap sequence is ~25 lines)
  const afterMarker = gcode.slice(markerIndex + marker.length).trim();
  // Swap sequence starts with G0 commands for plate movement
  return afterMarker.length > 100 && afterMarker.includes("G0 X-10");
}

/**
 * Inject swap sequence after EXECUTABLE_BLOCK_END if not already present
 */
function ensureSwapSequence(gcode: string, swapSequence: string): string {
  if (hasSwapSequence(gcode)) {
    // Even if it already has a swap sequence, ensure it ends with newlines for concatenation
    return gcode.trimEnd() + "\n\n";
  }

  const marker = "; EXECUTABLE_BLOCK_END";
  const markerIndex = gcode.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("Could not find EXECUTABLE_BLOCK_END marker in gcode");
  }

  // Find end of the line containing the marker
  let insertPoint = gcode.indexOf("\n", markerIndex);
  if (insertPoint === -1) {
    insertPoint = gcode.length;
  } else {
    insertPoint++; // Move past the newline after marker
  }

  // Check for additional empty line after marker (common in Bambu gcode)
  if (gcode[insertPoint] === "\n") {
    insertPoint++; // Move past the empty line
  }

  // Insert swap sequence with trailing newlines to ensure clean separation from next gcode
  // The newlines ensure the next gcode's header starts on its own line
  return gcode.slice(0, insertPoint) + swapSequence.trimEnd() + "\n\n";
}

/**
 * Find a file in the zip, trying multiple path variations
 */
function findFile(zip: JSZip, ...paths: string[]): JSZip.JSZipObject | null {
  for (const path of paths) {
    const file = zip.file(path);
    if (file) return file;
  }

  // Try case-insensitive search
  const allFiles = Object.keys(zip.files);
  for (const path of paths) {
    const lowerPath = path.toLowerCase();
    const match = allFiles.find(f => f.toLowerCase() === lowerPath);
    if (match) {
      return zip.file(match);
    }
  }

  return null;
}

/**
 * Parse a 3MF file and extract all relevant data
 */
export async function parse3MF(file: File): Promise<PrintJob> {
  // Read file as ArrayBuffer for JSZip
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Debug: log all files in the zip
  const allFiles = Object.keys(zip.files);
  console.log("All files in 3MF:", allFiles.join("\n"));

  // Extract gcode - try multiple possible paths
  const gcodeFile = findFile(zip,
    "Metadata/plate_1.gcode",
    "metadata/plate_1.gcode",
    "Metadata/Plate_1.gcode"
  );

  if (!gcodeFile) {
    // Log available files for debugging
    const gcodeFiles = allFiles.filter(f => f.toLowerCase().includes("gcode"));
    console.error("Available gcode files:", gcodeFiles);
    console.error("All files:", allFiles);
    throw new Error(`No gcode found in 3MF file. Found ${allFiles.length} files, gcode matches: ${gcodeFiles.join(", ") || "none"}`);
  }
  const gcode = await gcodeFile.async("string");

  // Extract slice info
  const sliceInfoFile = findFile(zip, "Metadata/slice_info.config", "metadata/slice_info.config");
  const sliceInfoXml = sliceInfoFile
    ? await sliceInfoFile.async("string")
    : "";

  // Parse metadata from gcode
  const metadata = parseGcodeMetadata(gcode);

  // Try to extract thumbnail
  let thumbnailUrl: string | null = null;
  const thumbnailFile = findFile(zip, "Metadata/plate_1.png", "metadata/plate_1.png");
  if (thumbnailFile) {
    const thumbnailBlob = await thumbnailFile.async("blob");
    thumbnailUrl = URL.createObjectURL(thumbnailBlob);
  }

  // Extract name from filename (remove .3mf extension)
  const name = file.name.replace(/\.3mf$/i, "");

  return {
    id: generateId(),
    name,
    file,
    gcode,
    metadata,
    sliceInfoXml,
    thumbnailUrl,
    copies: 1,
    originalZip: zip,
  };
}

/**
 * Combine multiple print jobs into a single gcode string with plate swap sequences.
 *
 * The approach matches Chitu's tool:
 * 1. Ensure each job's gcode has the swap sequence after EXECUTABLE_BLOCK_END
 * 2. For each copy, concatenate the full gcode (swap sequence ends with G4 P1000; wait;)
 * 3. The next gcode header starts immediately after
 */
export function combineGcode(
  jobs: PrintJob[],
  swapSequence: string
): string {
  let combined = "";

  for (const job of jobs) {
    // Ensure the gcode has the swap sequence
    const gcodeWithSwap = ensureSwapSequence(job.gcode, swapSequence);

    // Concatenate the gcode for each copy
    for (let copy = 0; copy < job.copies; copy++) {
      combined += gcodeWithSwap;
    }
  }

  return combined;
}

/**
 * Calculate total filament usage across all jobs
 */
export function calculateTotalFilament(jobs: PrintJob[]): {
  totalGrams: number;
  totalMeters: number;
} {
  let totalGrams = 0;
  let totalMeters = 0;

  for (const job of jobs) {
    const sliceInfo = parseSliceInfo(job.sliceInfoXml);
    totalGrams += sliceInfo.usedG * job.copies;
    totalMeters += sliceInfo.usedM * job.copies;
  }

  return { totalGrams, totalMeters };
}

/**
 * Calculate total print time across all jobs
 */
export function calculateTotalTime(jobs: PrintJob[]): number {
  return jobs.reduce(
    (sum, job) => sum + job.metadata.printTimeSeconds * job.copies,
    0
  );
}

/**
 * Calculate total number of plate swaps
 */
export function calculatePlateSwaps(jobs: PrintJob[]): number {
  return jobs.reduce((sum, job) => sum + job.copies, 0);
}

/**
 * Create a new 3MF file with the combined gcode
 */
export async function create3MF(
  baseJob: PrintJob,
  combinedGcode: string,
  jobs: PrintJob[]
): Promise<Blob> {
  // Clone the base zip
  const zip = baseJob.originalZip;

  // Calculate total filament
  const { totalGrams, totalMeters } = calculateTotalFilament(jobs);

  // Update slice info
  const updatedSliceInfo = updateSliceInfo(
    baseJob.sliceInfoXml,
    totalGrams,
    totalMeters
  );

  // Calculate MD5 of gcode
  const gcodeHash = SparkMD5.hash(combinedGcode);

  // Update files in zip
  zip.file("Metadata/plate_1.gcode", combinedGcode);
  zip.file("Metadata/plate_1.gcode.md5", gcodeHash);
  zip.file("Metadata/slice_info.config", updatedSliceInfo);

  // Generate the zip
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

/**
 * Process all jobs and generate the final 3MF
 */
export async function processJobs(
  jobs: PrintJob[],
  swapSequence: string
): Promise<Blob> {
  if (jobs.length === 0) {
    throw new Error("No jobs to process");
  }

  // Combine all gcode
  const combinedGcode = combineGcode(jobs, swapSequence);

  // Create the 3MF using the first job as the base
  return create3MF(jobs[0], combinedGcode, jobs);
}

/**
 * Generate a utility-only 3MF that contains G-code with no actual print —
 * just the provided sequence repeated `cycles` times.
 * Useful for "clear plate" (1 cycle) or "test cycler" (N cycles).
 *
 * Uses a bundled template 3MF (from a known-working sliced project) and
 * replaces just the gcode and checksum — same approach as create3MF.
 * This ensures Bambu Studio recognizes it as already sliced.
 */
export async function generateUtility3MF(
  swapSequence: string,
  cycles: number = 1
): Promise<Blob> {
  // Load the bundled template 3MF and clone its structure
  const response = await fetch("/template.3mf");
  const templateBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);

  // Extract the template's original gcode to preserve header + config blocks
  const templateGcodeFile = zip.file("Metadata/plate_1.gcode");
  const templateGcode = templateGcodeFile
    ? await templateGcodeFile.async("string")
    : "";

  // Keep everything up to and including EXECUTABLE_BLOCK_START
  const execStartMarker = "; EXECUTABLE_BLOCK_START";
  const execStartIdx = templateGcode.indexOf(execStartMarker);
  const preamble = execStartIdx !== -1
    ? templateGcode.slice(0, execStartIdx + execStartMarker.length)
    : "; HEADER_BLOCK_START\n; PlateRunner utility gcode\n; HEADER_BLOCK_END\n\n; CONFIG_BLOCK_START\n; CONFIG_BLOCK_END\n\n; EXECUTABLE_BLOCK_START";

  // Build swap sections
  const swapSections = Array.from({ length: cycles }, (_, i) => {
    return `;swap start ${i + 1}\n\n${swapSequence.trimEnd()}\n\n;swap end`;
  }).join("\n\n");

  const gcode = [
    preamble,
    "",
    "M140 S0 ; turn off bed",
    "M106 S0 ; turn off fan",
    "M104 S0 ; turn off hotend",
    "",
    "; FEATURE: Custom",
    "",
    "M73 P0 R0;",
    "",
    "G0 Z30 ; raise head first to clear any print on plate",
    "G28 X Y ; home X/Y only",
    "",
    swapSections,
    "",
    "M73 P100 R0;",
    "",
    "G0 Z90 Y90 X90 F3000",
    "",
    "M18 ; disable steppers",
    "",
    "M140 S0 ; turn off bed",
    "M106 S0 ; turn off fan",
    "M104 S0 ; turn off hotend",
    "",
    "; EXECUTABLE_BLOCK_END",
    "",
    "; filament used [mm] = 0.00",
    "; filament used [cm3] = 0.00",
    "",
  ].join("\n");

  const gcodeHash = SparkMD5.hash(gcode);

  // Replace gcode and checksum
  zip.file("Metadata/plate_1.gcode", gcode);
  zip.file("Metadata/plate_1.gcode.md5", gcodeHash);

  // Zero out filament usage in slice_info
  const sliceInfoFile = zip.file("Metadata/slice_info.config");
  if (sliceInfoFile) {
    const sliceInfoXml = await sliceInfoFile.async("string");
    const updatedSliceInfo = updateSliceInfo(sliceInfoXml, 0, 0);
    zip.file("Metadata/slice_info.config", updatedSliceInfo);
  }

  // Zero out temperatures in project_settings so the printer doesn't heat up
  const projectSettingsFile = zip.file("Metadata/project_settings.config");
  if (projectSettingsFile) {
    const settings = JSON.parse(await projectSettingsFile.async("string"));
    const zeroKeys = [
      "cool_plate_temp", "cool_plate_temp_initial_layer",
      "hot_plate_temp", "hot_plate_temp_initial_layer",
      "eng_plate_temp", "eng_plate_temp_initial_layer",
      "textured_plate_temp", "textured_plate_temp_initial_layer",
      "nozzle_temperature", "nozzle_temperature_initial_layer",
      "nozzle_temperature_range_high", "nozzle_temperature_range_low",
    ];
    for (const key of zeroKeys) {
      if (key in settings) {
        if (Array.isArray(settings[key])) {
          settings[key] = settings[key].map(() => "0");
        } else {
          settings[key] = "0";
        }
      }
    }
    zip.file("Metadata/project_settings.config", JSON.stringify(settings, null, 4));
  }

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

/**
 * Clean up thumbnail URLs to prevent memory leaks
 */
export function cleanupJob(job: PrintJob): void {
  if (job.thumbnailUrl) {
    URL.revokeObjectURL(job.thumbnailUrl);
  }
}
