"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

interface PrinterConnectionProps {
  connected: boolean;
  onConnect: (ip: string, serial: string, accessCode: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function PrinterConnection({
  connected,
  onConnect,
  onDisconnect,
}: PrinterConnectionProps) {
  const [ip, setIp] = useState("");
  const [serial, setSerial] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConnect(ip, serial, accessCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await onDisconnect();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        {connected ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-muted-foreground" />
        )}
        <h3 className="text-sm font-medium">Printer Connection</h3>
        {connected && (
          <span className="ml-auto text-xs text-green-500 font-medium">
            Connected
          </span>
        )}
      </div>

      {!connected ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input
              placeholder="Printer IP"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              disabled={loading}
            />
            <Input
              placeholder="Serial Number"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              disabled={loading}
            />
            <Input
              placeholder="Access Code"
              type="password"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              disabled={loading}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            onClick={handleConnect}
            disabled={loading || !ip || !serial || !accessCode}
            size="sm"
          >
            {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Connect
          </Button>
          <p className="text-xs text-muted-foreground">
            Requires Developer Mode enabled on the printer. Find these values in
            the printer&apos;s LCD settings.
          </p>
        </>
      ) : (
        <Button
          onClick={handleDisconnect}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Disconnect
        </Button>
      )}
    </div>
  );
}
