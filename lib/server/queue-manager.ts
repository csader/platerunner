import { PrinterClient } from "./printer-client";
import {
  QueueJob,
  QueueSnapshot,
  QueueState,
  SwapMethod,
  PrinterStatus,
} from "../types/live-queue";
import { bakeSwapInto3MF } from "./prepare-job";

type UpdateCallback = (snapshot: QueueSnapshot) => void;

export class QueueManager {
  private client: PrinterClient;
  private jobs: QueueJob[] = [];
  private state: QueueState = "idle";
  private currentJobId: string | null = null;
  private swapMethod: SwapMethod = "bake";
  private swapSequence: string = "";
  private error: string | null = null;
  private callbacks: UpdateCallback[] = [];
  private unsubscribeStatus: (() => void) | null = null;

  constructor(client: PrinterClient) {
    this.client = client;
    this.unsubscribeStatus = client.onStatus((status) => {
      this.handlePrinterStatus(status);
    });
  }

  setSwapMethod(method: SwapMethod): void {
    this.swapMethod = method;
    this.emit();
  }

  setSwapSequence(sequence: string): void {
    this.swapSequence = sequence;
  }

  addJob(job: QueueJob): void {
    this.jobs.push(job);
    this.emit();
  }

  removeJob(id: string): void {
    this.jobs = this.jobs.filter((j) => j.id !== id);
    this.emit();
  }

  reorderJobs(ids: string[]): void {
    const map = new Map(this.jobs.map((j) => [j.id, j]));
    this.jobs = ids.map((id) => map.get(id)!).filter(Boolean);
    this.emit();
  }

  start(): void {
    if (this.state !== "idle" && this.state !== "completed") return;
    this.error = null;
    for (const job of this.jobs) {
      job.status = "pending";
      job.currentCopy = 0;
    }
    this.state = "waiting";
    this.emit();
    this.tryDispatchNext();
  }

  pause(): void {
    if (this.state === "waiting" || this.state === "printing") {
      this.state = "paused";
      this.emit();
    }
  }

  resume(): void {
    if (this.state !== "paused") return;
    this.error = null;
    this.state = "waiting";
    this.emit();
    this.tryDispatchNext();
  }

  stop(): void {
    this.state = "idle";
    this.currentJobId = null;
    this.emit();
  }

  skipCurrent(): void {
    if (!this.currentJobId) return;
    const job = this.jobs.find((j) => j.id === this.currentJobId);
    if (job) job.status = "skipped";
    this.currentJobId = null;
    this.state = "waiting";
    this.error = null;
    this.emit();
    this.tryDispatchNext();
  }

  retryCurrent(): void {
    if (!this.currentJobId) return;
    const job = this.jobs.find((j) => j.id === this.currentJobId);
    if (job) {
      job.status = "pending";
    }
    this.state = "waiting";
    this.error = null;
    this.emit();
    this.tryDispatchNext();
  }

  getSnapshot(): QueueSnapshot {
    return {
      state: this.state,
      jobs: this.jobs.map((j) => ({
        id: j.id,
        name: j.name,
        copies: j.copies,
        currentCopy: j.currentCopy,
        status: j.status,
      })),
      currentJobId: this.currentJobId,
      printerStatus: this.client.getStatus(),
      swapMethod: this.swapMethod,
      error: this.error,
    };
  }

  onUpdate(cb: UpdateCallback): () => void {
    this.callbacks.push(cb);
    return () => {
      this.callbacks = this.callbacks.filter((c) => c !== cb);
    };
  }

  destroy(): void {
    if (this.unsubscribeStatus) {
      this.unsubscribeStatus();
      this.unsubscribeStatus = null;
    }
    this.callbacks = [];
  }

  private handlePrinterStatus(status: PrinterStatus): void {
    if (this.state === "printing" && status.gcodeState === "FINISH") {
      this.onPrintFinished();
    } else if (this.state === "printing" && status.gcodeState === "FAILED") {
      this.onPrintFailed();
    } else if (this.state === "swapping" && status.gcodeState === "IDLE") {
      this.onSwapComplete();
    } else if (this.state === "waiting" && status.gcodeState === "IDLE") {
      this.tryDispatchNext();
    }
    this.emit();
  }

  private async tryDispatchNext(): Promise<void> {
    if (this.state !== "waiting") return;

    const printerStatus = this.client.getStatus();
    if (printerStatus.gcodeState !== "IDLE") return;

    const nextJob = this.getNextPendingJob();
    if (!nextJob) {
      this.state = "completed";
      this.currentJobId = null;
      this.emit();
      return;
    }

    this.currentJobId = nextJob.id;
    nextJob.status = "active";
    nextJob.currentCopy++;

    await this.dispatchJob(nextJob);
  }

  private async dispatchJob(job: QueueJob): Promise<void> {
    this.state = "uploading";
    this.emit();

    try {
      const filename = `platerunner_${job.id}_${job.currentCopy}.3mf`;
      let fileData = job.fileBuffer;

      if (this.swapMethod === "bake" && this.swapSequence) {
        fileData = await bakeSwapInto3MF(fileData, this.swapSequence);
      }

      await this.client.uploadFile(filename, fileData);
      await this.client.startPrint(filename);

      this.state = "printing";
      this.emit();
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Upload failed";
      this.state = "paused";
      this.emit();
    }
  }

  private async onPrintFinished(): Promise<void> {
    const job = this.jobs.find((j) => j.id === this.currentJobId);

    if (this.swapMethod === "raw-gcode" && this.swapSequence) {
      this.state = "swapping";
      this.emit();
      try {
        await this.client.sendGcodeLine(this.swapSequence);
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Swap failed";
        this.state = "paused";
        this.emit();
        return;
      }
    } else {
      this.advanceJob(job);
    }
  }

  private onSwapComplete(): void {
    const job = this.jobs.find((j) => j.id === this.currentJobId);
    this.advanceJob(job);
  }

  private onPrintFailed(): void {
    const job = this.jobs.find((j) => j.id === this.currentJobId);
    if (job) job.status = "failed";
    this.error = "Print failed";
    this.state = "paused";
    this.emit();
  }

  private advanceJob(job: QueueJob | undefined): void {
    if (job) {
      if (job.currentCopy >= job.copies) {
        job.status = "completed";
        this.currentJobId = null;
      }
    }
    this.state = "waiting";
    this.emit();
    this.tryDispatchNext();
  }

  private getNextPendingJob(): QueueJob | null {
    const current = this.jobs.find((j) => j.id === this.currentJobId);
    if (current && current.currentCopy < current.copies) {
      return current;
    }
    return this.jobs.find((j) => j.status === "pending") || null;
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const cb of this.callbacks) {
      cb(snapshot);
    }
  }
}
