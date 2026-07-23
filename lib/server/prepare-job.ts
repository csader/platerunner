import JSZip from "jszip";
import SparkMD5 from "spark-md5";

export async function bakeSwapInto3MF(
  fileBuffer: Buffer,
  swapSequence: string
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(fileBuffer);

  const allFiles = Object.keys(zip.files);
  const gcodeMatch = allFiles.find((f) =>
    /^Metadata\/plate_\d+\.gcode$/i.test(f)
  );
  if (!gcodeMatch) {
    throw new Error("No gcode found in 3MF");
  }

  let gcode = await zip.file(gcodeMatch)!.async("string");
  gcode = ensureSwapSequence(gcode, swapSequence);

  const gcodeHash = SparkMD5.hash(gcode);
  zip.file(gcodeMatch, gcode);
  zip.file(`${gcodeMatch}.md5`, gcodeHash);

  const output = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  return output;
}

function ensureSwapSequence(gcode: string, swapSequence: string): string {
  const marker = "; EXECUTABLE_BLOCK_END";
  const markerIndex = gcode.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("Could not find EXECUTABLE_BLOCK_END marker in gcode");
  }

  const afterMarker = gcode.slice(markerIndex + marker.length).trim();
  if (afterMarker.length > 100 && afterMarker.includes("G0 X-10")) {
    return gcode;
  }

  let insertPoint = gcode.indexOf("\n", markerIndex);
  if (insertPoint === -1) {
    insertPoint = gcode.length;
  } else {
    insertPoint++;
  }

  if (gcode[insertPoint] === "\n") {
    insertPoint++;
  }

  return gcode.slice(0, insertPoint) + swapSequence.trimEnd() + "\n\n";
}
