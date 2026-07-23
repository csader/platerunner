"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { QueueSnapshot } from "@/lib/types/live-queue";

const DEFAULT_SNAPSHOT: QueueSnapshot = {
  state: "idle",
  jobs: [],
  currentJobId: null,
  printerStatus: {
    connected: false,
    gcodeState: "UNKNOWN",
    mcPercent: 0,
    mcRemainingTime: 0,
    currentFile: null,
    error: null,
  },
  swapMethod: "bake",
  error: null,
};

export function usePrinterSSE(enabled: boolean): QueueSnapshot {
  const [snapshot, setSnapshot] = useState<QueueSnapshot>(DEFAULT_SNAPSHOT);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource("/api/printer/status");
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setSnapshot(data);
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      setSnapshot(DEFAULT_SNAPSHOT);
      return;
    }

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [enabled, connect]);

  return snapshot;
}
