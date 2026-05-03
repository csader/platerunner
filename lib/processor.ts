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
 * Builds a full OPC-compliant 3MF package with proper gcode block structure
 * (HEADER_BLOCK, CONFIG_BLOCK, EXECUTABLE_BLOCK) so Bambu Studio accepts it.
 */
export async function generateUtility3MF(
  swapSequence: string,
  cycles: number = 1
): Promise<Blob> {
  // Build swap sections
  const swapSections = Array.from({ length: cycles }, (_, i) => {
    return `;swap start ${i + 1}\n\n${swapSequence.trimEnd()}\n\n;swap end`;
  }).join("\n\n");

  const gcode = [
    "; HEADER_BLOCK_START",
    "; PlateRunner utility gcode",
    "; total estimated time: 0m 0s",
    "; total layer number: 0",
    "; max_z_height: 0.00",
    "; HEADER_BLOCK_END",
    "",
    "; CONFIG_BLOCK_START",
    "; CONFIG_BLOCK_END",
    "",
    "; EXECUTABLE_BLOCK_START",
    "",
    "M140 S0 ; turn off bed",
    "M106 S0 ; turn off fan",
    "M104 S0 ; turn off hotend",
    "",
    "; FEATURE: Custom",
    "",
    swapSections,
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

  const contentTypes = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>',
    ' <Default Extension="gcode" ContentType="text/x.gcode"/>',
    '</Types>',
  ].join("\n");

  const rels = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    ' <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>',
    '</Relationships>',
  ].join("\n");

  // 3D model with a minimal 1mm cube so Bambu Studio doesn't complain about missing geometry
  const model = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">',
    ' <metadata name="Application">PlateRunner</metadata>',
    ' <metadata name="BambuStudio:3mfVersion">1</metadata>',
    ' <resources>',
    '  <object id="1" type="model">',
    '   <mesh>',
    '    <vertices>',
    '     <vertex x="0" y="0" z="0"/>',
    '     <vertex x="1" y="0" z="0"/>',
    '     <vertex x="1" y="1" z="0"/>',
    '     <vertex x="0" y="1" z="0"/>',
    '     <vertex x="0" y="0" z="1"/>',
    '     <vertex x="1" y="0" z="1"/>',
    '     <vertex x="1" y="1" z="1"/>',
    '     <vertex x="0" y="1" z="1"/>',
    '    </vertices>',
    '    <triangles>',
    '     <triangle v1="0" v2="1" v3="2"/><triangle v1="0" v2="2" v3="3"/>',
    '     <triangle v1="4" v2="6" v3="5"/><triangle v1="4" v2="7" v3="6"/>',
    '     <triangle v1="0" v2="4" v3="5"/><triangle v1="0" v2="5" v3="1"/>',
    '     <triangle v1="2" v2="6" v3="7"/><triangle v1="2" v2="7" v3="3"/>',
    '     <triangle v1="0" v2="7" v3="4"/><triangle v1="0" v2="3" v3="7"/>',
    '     <triangle v1="1" v2="5" v3="6"/><triangle v1="1" v2="6" v3="2"/>',
    '    </triangles>',
    '   </mesh>',
    '  </object>',
    ' </resources>',
    ' <build>',
    '  <item objectid="1" p:UUID="cb828680-f429-4706-a0f7-1000000000ff" transform="1 0 0 0 1 0 0 0 1 89 89 0"/>',
    ' </build>',
    '</model>',
  ].join("\n");

  const modelSettingsRels = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    ' <Relationship Target="/Metadata/plate_1.gcode" Id="rel-1" Type="http://schemas.bambulab.com/package/2021/gcode"/>',
    '</Relationships>',
  ].join("\n");

  const modelSettings = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<config>',
    '  <plate>',
    '    <metadata key="plater_id" value="1"/>',
    '    <metadata key="plater_name" value=""/>',
    '    <metadata key="locked" value="false"/>',
    '    <metadata key="gcode_file" value="Metadata/plate_1.gcode"/>',
    '    <metadata key="pattern_bbox_file" value="Metadata/plate_1.json"/>',
    '  </plate>',
    '</config>',
  ].join("\n");

  const plateJson = JSON.stringify({
    bbox_all: [89.0, 89.0, 91.0, 91.0],
    bbox_objects: [{
      area: 4.0,
      bbox: [89.0, 89.0, 91.0, 91.0],
      id: 1,
      layer_height: 0.2,
      name: "Cube",
    }],
    bed_type: "textured_plate",
    filament_colors: ["#C0C0C0"],
    filament_ids: [0],
    first_extruder: 0,
    is_seq_print: false,
    nozzle_diameter: 0.4,
    version: 2,
  });

  // Minimal project_settings.config so Bambu Studio recognizes this as a sliced project
  const projectSettings = JSON.stringify({
    printer_model: "Bambu Lab A1 mini",
    printer_variant: "0.4",
    printer_settings_id: "Bambu Lab A1 mini 0.4 nozzle",
    print_settings_id: "0.20mm Standard @BBL A1M",
    filament_settings_id: ["Generic PLA @BBL A1M"],
    printer_technology: "FFF",
  }, null, 4);

  const sliceInfo = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<config>',
    '  <header>',
    '    <header_item key="X-BBL-Client-Type" value="slicer"/>',
    '    <header_item key="X-BBL-Client-Version" value="01.09.01.67"/>',
    '  </header>',
    '  <plate>',
    '    <metadata key="index" value="1"/>',
    '    <metadata key="printer_model_id" value="N1"/>',
    '    <metadata key="nozzle_diameters" value="0.4"/>',
    '    <metadata key="prediction" value="0"/>',
    '    <metadata key="weight" value="0.00"/>',
    '    <metadata key="outside" value="false"/>',
    '    <metadata key="support_used" value="false"/>',
    '    <metadata key="label_object_enabled" value="false"/>',
    '    <object identify_id="1" name="Cube" skipped="false"/>',
    '    <filament id="1" type="PLA" color="#C0C0C0" used_m="0.00" used_g="0.00"/>',
    '  </plate>',
    '</config>',
  ].join("\n");

  const cutInfo = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<objects>',
    ' <object id="1">',
    '  <cut_id id="0" check_sum="1" connectors_cnt="0"/>',
    ' </object>',
    '</objects>',
  ].join("\n");

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", rels);
  zip.file("3D/3dmodel.model", model);
  zip.file("Metadata/_rels/model_settings.config.rels", modelSettingsRels);
  zip.file("Metadata/model_settings.config", modelSettings);
  zip.file("Metadata/cut_information.xml", cutInfo);
  zip.file("Metadata/plate_1.gcode", gcode);
  zip.file("Metadata/plate_1.gcode.md5", gcodeHash);
  zip.file("Metadata/plate_1.json", plateJson);
  zip.file("Metadata/project_settings.config", projectSettings);
  zip.file("Metadata/slice_info.config", sliceInfo);

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
