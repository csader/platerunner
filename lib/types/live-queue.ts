export interface PrinterConfig {
  ip: string;
  serial: string;
  accessCode: string;
}

export type PrinterState =
  | "IDLE"
  | "RUNNING"
  | "FINISH"
  | "FAILED"
  | "PAUSE"
  | "UNKNOWN";

export interface PrinterStatus {
  connected: boolean;
  gcodeState: PrinterState;
  mcPercent: number;
  mcRemainingTime: number;
  currentFile: string | null;
  error: string | null;
}

export type SwapMethod = "bake" | "raw-gcode";

export type QueueState =
  | "idle"
  | "waiting"
  | "uploading"
  | "printing"
  | "swapping"
  | "paused"
  | "completed";

export type JobStatus = "pending" | "active" | "completed" | "failed" | "skipped";

export interface QueueJob {
  id: string;
  name: string;
  fileBuffer: Buffer;
  copies: number;
  currentCopy: number;
  status: JobStatus;
}

export interface QueueSnapshot {
  state: QueueState;
  jobs: Array<{
    id: string;
    name: string;
    copies: number;
    currentCopy: number;
    status: JobStatus;
  }>;
  currentJobId: string | null;
  printerStatus: PrinterStatus;
  swapMethod: SwapMethod;
  error: string | null;
}
