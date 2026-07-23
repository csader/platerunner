import mqtt, { MqttClient } from "mqtt";
import { Client as FtpClient } from "basic-ftp";
import { Readable } from "stream";
import { PrinterConfig, PrinterStatus, PrinterState } from "../types/live-queue";

type StatusCallback = (status: PrinterStatus) => void;

export class PrinterClient {
  private config: PrinterConfig;
  private mqttClient: MqttClient | null = null;
  private statusCallbacks: StatusCallback[] = [];
  private currentStatus: PrinterStatus = {
    connected: false,
    gcodeState: "UNKNOWN",
    mcPercent: 0,
    mcRemainingTime: 0,
    currentFile: null,
    error: null,
  };
  private sequenceId = 0;

  constructor(config: PrinterConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `mqtts://${this.config.ip}:8883`;
      this.mqttClient = mqtt.connect(url, {
        username: "bblp",
        password: this.config.accessCode,
        rejectUnauthorized: false,
        connectTimeout: 10000,
        keepalive: 30,
      });

      this.mqttClient.on("connect", () => {
        const topic = `device/${this.config.serial}/report`;
        this.mqttClient!.subscribe(topic, (err) => {
          if (err) {
            reject(new Error(`Failed to subscribe: ${err.message}`));
            return;
          }
          this.currentStatus.connected = true;
          this.emit();
          resolve();
        });
      });

      this.mqttClient.on("message", (_topic, payload) => {
        this.handleMessage(payload);
      });

      this.mqttClient.on("error", (err) => {
        this.currentStatus.error = err.message;
        this.emit();
        if (!this.currentStatus.connected) {
          reject(err);
        }
      });

      this.mqttClient.on("close", () => {
        this.currentStatus.connected = false;
        this.emit();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.mqttClient) {
      await this.mqttClient.endAsync();
      this.mqttClient = null;
    }
    this.currentStatus = {
      connected: false,
      gcodeState: "UNKNOWN",
      mcPercent: 0,
      mcRemainingTime: 0,
      currentFile: null,
      error: null,
    };
    this.emit();
  }

  onStatus(cb: StatusCallback): () => void {
    this.statusCallbacks.push(cb);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter((c) => c !== cb);
    };
  }

  getStatus(): PrinterStatus {
    return { ...this.currentStatus };
  }

  async uploadFile(filename: string, data: Buffer): Promise<void> {
    const ftp = new FtpClient();
    ftp.ftp.verbose = false;

    try {
      await ftp.access({
        host: this.config.ip,
        port: 990,
        user: "bblp",
        password: this.config.accessCode,
        secure: "implicit",
        secureOptions: { rejectUnauthorized: false },
      });
      const stream = Readable.from(data);
      await ftp.uploadFrom(stream, `/${filename}`);
    } finally {
      ftp.close();
    }
  }

  async startPrint(filename: string): Promise<void> {
    await this.publish({
      print: {
        sequence_id: String(this.sequenceId++),
        command: "project_file",
        param: "Metadata/plate_1.gcode",
        url: `ftp:///${filename}`,
        bed_type: "auto",
        bed_levelling: true,
        flow_cali: false,
        vibration_cali: false,
        use_ams: false,
      },
    });
  }

  async sendGcodeLine(gcode: string): Promise<void> {
    await this.publish({
      print: {
        sequence_id: String(this.sequenceId++),
        command: "gcode_line",
        param: gcode,
      },
    });
  }

  async requestStatus(): Promise<void> {
    await this.publish({
      pushing: {
        sequence_id: String(this.sequenceId++),
        command: "pushall",
        version: 1,
        push_target: 1,
      },
    });
  }

  private async publish(payload: object): Promise<void> {
    if (!this.mqttClient?.connected) {
      throw new Error("MQTT not connected");
    }
    const topic = `device/${this.config.serial}/request`;
    await this.mqttClient.publishAsync(topic, JSON.stringify(payload));
  }

  private handleMessage(payload: Buffer): void {
    try {
      const msg = JSON.parse(payload.toString());
      if (msg.print) {
        const p = msg.print;
        if (p.gcode_state) {
          this.currentStatus.gcodeState = this.mapState(p.gcode_state);
        }
        if (p.mc_percent !== undefined) {
          this.currentStatus.mcPercent = p.mc_percent;
        }
        if (p.mc_remaining_time !== undefined) {
          this.currentStatus.mcRemainingTime = p.mc_remaining_time;
        }
        if (p.gcode_file) {
          this.currentStatus.currentFile = p.gcode_file;
        }
        this.currentStatus.error = null;
        this.emit();
      }
    } catch {
      // ignore malformed messages
    }
  }

  private mapState(raw: string): PrinterState {
    const map: Record<string, PrinterState> = {
      IDLE: "IDLE",
      RUNNING: "RUNNING",
      FINISH: "FINISH",
      FAILED: "FAILED",
      PAUSE: "PAUSE",
      PREPARE: "RUNNING",
      SLICING: "RUNNING",
    };
    return map[raw] || "UNKNOWN";
  }

  private emit(): void {
    const snapshot = this.getStatus();
    for (const cb of this.statusCallbacks) {
      cb(snapshot);
    }
  }
}
