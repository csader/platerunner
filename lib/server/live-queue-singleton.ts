import { PrinterClient } from "./printer-client";
import { QueueManager } from "./queue-manager";
import { PrinterConfig } from "../types/live-queue";

let printerClient: PrinterClient | null = null;
let queueManager: QueueManager | null = null;

export function getPrinterClient(): PrinterClient | null {
  return printerClient;
}

export function getQueueManager(): QueueManager | null {
  return queueManager;
}

export async function initialize(
  config: PrinterConfig
): Promise<{ client: PrinterClient; queue: QueueManager }> {
  if (printerClient) {
    await teardown();
  }

  printerClient = new PrinterClient(config);
  await printerClient.connect();

  queueManager = new QueueManager(printerClient);

  await printerClient.requestStatus();

  return { client: printerClient, queue: queueManager };
}

export async function teardown(): Promise<void> {
  if (queueManager) {
    queueManager.stop();
    queueManager = null;
  }
  if (printerClient) {
    await printerClient.disconnect();
    printerClient = null;
  }
}
