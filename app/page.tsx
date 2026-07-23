"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Download, Loader2, RotateCcw, FlaskConical, Wrench, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
} from "@/components/ui/dropdown-menu";
import { Dropzone } from "@/components/dropzone";
import { PrintQueue } from "@/components/print-queue";
import { StatsDisplay } from "@/components/stats-display";
import { SettingsPanel } from "@/components/settings-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { ModeToggle } from "@/components/mode-toggle";
import { PrinterConnection } from "@/components/printer-connection";
import { PrinterStatusDisplay } from "@/components/printer-status-display";
import { LiveQueueControls } from "@/components/live-queue-controls";
import { LiveQueueItem } from "@/components/live-queue-item";
import { usePrinterSSE } from "@/hooks/use-printer-sse";
import {
  parse3MF,
  processJobs,
  cleanupJob,
  calculateTotalTime,
  calculateTotalFilament,
  calculatePlateSwaps,
  generateUtility3MF,
  type PrintJob,
} from "@/lib/processor";
import {
  DEFAULT_PLATE_SWAP_SEQUENCE,
  loadActiveSequence,
  saveActiveSequence,
} from "@/lib/plate-swap";
import { SwapMethod } from "@/lib/types/live-queue";

export default function Home() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [sequence, setSequence] = useState(DEFAULT_PLATE_SWAP_SEQUENCE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customFilename, setCustomFilename] = useState("");
  const [testCycles, setTestCycles] = useState(5);
  const [mode, setMode] = useState<"combined" | "live-queue">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("platerunner-mode") as "combined" | "live-queue") || "combined";
    }
    return "combined";
  });

  const snapshot = usePrinterSSE(mode === "live-queue");

  // Persist mode
  const handleModeChange = useCallback((newMode: "combined" | "live-queue") => {
    setMode(newMode);
    localStorage.setItem("platerunner-mode", newMode);
  }, []);

  // Load saved sequence on mount
  useEffect(() => {
    setSequence(loadActiveSequence());
  }, []);

  // Generate suggested filename based on jobs
  const suggestedFilename = useMemo(() => {
    if (jobs.length === 0) return "platecycler-output";
    if (jobs.length === 1) {
      const totalCopies = jobs[0].copies;
      const baseName = jobs[0].name.replace(/\.gcode$/i, "").replace(/\.3mf$/i, "");
      return `${baseName}-${totalCopies}x-platecycler`;
    }
    // Multiple jobs
    const totalCopies = jobs.reduce((sum, j) => sum + j.copies, 0);
    return `batch-${totalCopies}x-platecycler`;
  }, [jobs]);

  // Save sequence when it changes
  const handleSequenceChange = useCallback((newSequence: string) => {
    setSequence(newSequence);
    saveActiveSequence(newSequence);
  }, []);

  // Handle file uploads
  const handleFilesAdded = useCallback(async (files: File[]) => {
    setError(null);

    for (const file of files) {
      try {
        const job = await parse3MF(file);
        setJobs((prev) => [...prev, job]);
      } catch (err) {
        setError(`Failed to parse ${file.name}: ${(err as Error).message}`);
      }
    }
  }, []);

  // Handle job reordering
  const handleReorder = useCallback((newJobs: PrintJob[]) => {
    setJobs(newJobs);
  }, []);

  // Handle copy count updates
  const handleUpdateCopies = useCallback((id: string, copies: number) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === id ? { ...job, copies } : job))
    );
  }, []);

  // Handle job removal
  const handleRemove = useCallback((id: string) => {
    setJobs((prev) => {
      const job = prev.find((j) => j.id === id);
      if (job) {
        cleanupJob(job);
      }
      return prev.filter((j) => j.id !== id);
    });
  }, []);

  // Get the filename to use (custom or suggested)
  const filenameToUse = customFilename.trim() || suggestedFilename;

  // Generate and download a "clear plate" 3MF
  const handleClearPlate = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const blob = await generateUtility3MF(sequence, 1);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "clear-plate.3mf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Failed to generate clear plate: ${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [sequence]);

  // Generate and download a "test cycler" 3MF
  const handleTestCycler = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const blob = await generateUtility3MF(sequence, testCycles);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `test-cycler-${testCycles}x.3mf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Failed to generate test cycler: ${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [sequence, testCycles]);

  // Process and download
  const handleProcess = useCallback(async () => {
    if (jobs.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      const blob = await processJobs(jobs, sequence);

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Ensure filename ends with .3mf
      const finalName = filenameToUse.endsWith(".3mf") ? filenameToUse : `${filenameToUse}.3mf`;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Processing failed: ${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [jobs, sequence, filenameToUse]);

  // --- Live Queue handlers ---
  const handlePrinterConnect = useCallback(async (ip: string, serial: string, accessCode: string) => {
    const res = await fetch("/api/printer/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, serial, accessCode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Connection failed");
  }, []);

  const handlePrinterDisconnect = useCallback(async () => {
    await fetch("/api/printer/disconnect", { method: "POST" });
  }, []);

  const handleLiveFilesAdded = useCallback(async (files: File[]) => {
    setError(null);
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("copies", "1");
      const res = await fetch("/api/queue/jobs", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        setError(`Failed to add ${file.name}: ${data.error}`);
      }
    }
  }, []);

  const handleLiveRemove = useCallback(async (id: string) => {
    await fetch("/api/queue/jobs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }, []);

  const handleQueueControl = useCallback(async (action: string) => {
    const body: Record<string, string> = { action };
    if (action === "start") {
      body.swapSequence = sequence;
    }
    await fetch("/api/queue/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }, [sequence]);

  const handleSwapMethodChange = useCallback(async (method: SwapMethod) => {
    await fetch("/api/queue/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swapMethod: method }),
    });
  }, []);

  // Calculate stats
  const totalTime = calculateTotalTime(jobs);
  const { totalGrams, totalMeters } = calculateTotalFilament(jobs);
  const plateSwaps = calculatePlateSwaps(jobs);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">PlateRunner</h1>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              v{process.env.APP_VERSION}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">
            Self-hosted 3MF processor for Bambu Lab A1 Mini PlateCycler automation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu
            align="right"
            trigger={
              <Button variant="outline" size="sm" disabled={isProcessing}>
                <Wrench className="mr-2 h-4 w-4" />
                Tools
              </Button>
            }
          >
            <DropdownLabel>Quick Tools</DropdownLabel>
            <DropdownItem onClick={handleClearPlate} disabled={isProcessing}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear Plate
            </DropdownItem>
            <DropdownSeparator />
            <DropdownLabel>Test Cycler</DropdownLabel>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Input
                type="number"
                min={1}
                max={100}
                value={testCycles}
                onChange={(e) => setTestCycles(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                className="w-16 h-8 text-sm"
                disabled={isProcessing}
              />
              <span className="text-xs text-muted-foreground">cycles</span>
            </div>
            <DropdownItem onClick={handleTestCycler} disabled={isProcessing}>
              <FlaskConical className="mr-2 h-4 w-4" />
              Run Test Cycler
            </DropdownItem>
          </DropdownMenu>
          <ThemeToggle />
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="mb-6">
        <ModeToggle mode={mode} onModeChange={handleModeChange} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {mode === "combined" ? (
        <>
          {/* Upload Area */}
          <div className="mb-6">
            <Dropzone onFilesAdded={handleFilesAdded} disabled={isProcessing} />
          </div>

          {/* Stats */}
          {jobs.length > 0 && (
            <div className="mb-6">
              <StatsDisplay
                totalTimeSeconds={totalTime}
                totalWeightGrams={totalGrams}
                totalLengthMeters={totalMeters}
                plateSwaps={plateSwaps}
              />
            </div>
          )}

          {/* Print Queue */}
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-semibold">Print Queue</h2>
            <PrintQueue
              jobs={jobs}
              onReorder={handleReorder}
              onUpdateCopies={handleUpdateCopies}
              onRemove={handleRemove}
            />
          </div>

          {/* Settings */}
          <div className="mb-6">
            <SettingsPanel
              sequence={sequence}
              onSequenceChange={handleSequenceChange}
            />
          </div>

          {/* Filename & Process Button */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium">
                Output Filename
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  placeholder={suggestedFilename}
                  disabled={jobs.length === 0 || isProcessing}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">.3mf</span>
              </div>
            </div>
            <div className="pt-6">
              <Button
                size="lg"
                onClick={handleProcess}
                disabled={jobs.length === 0 || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Process & Download
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Live Queue Mode */}
          <div className="space-y-4">
            {/* Printer Connection */}
            <PrinterConnection
              connected={snapshot.printerStatus.connected}
              onConnect={handlePrinterConnect}
              onDisconnect={handlePrinterDisconnect}
            />

            {/* Printer Status */}
            <PrinterStatusDisplay status={snapshot.printerStatus} />

            {/* Queue Error */}
            {snapshot.error && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Queue error: {snapshot.error}
              </div>
            )}

            {/* Upload for live queue */}
            {snapshot.printerStatus.connected && (
              <div>
                <Dropzone onFilesAdded={handleLiveFilesAdded} disabled={false} />
              </div>
            )}

            {/* Live Queue List */}
            {snapshot.jobs.length > 0 && (
              <div>
                <h2 className="mb-3 text-lg font-semibold">Live Queue</h2>
                <div className="space-y-2">
                  {snapshot.jobs.map((job) => (
                    <LiveQueueItem
                      key={job.id}
                      id={job.id}
                      name={job.name}
                      copies={job.copies}
                      currentCopy={job.currentCopy}
                      status={job.status}
                      isCurrent={job.id === snapshot.currentJobId}
                      onRemove={handleLiveRemove}
                      disabled={snapshot.state !== "idle" && snapshot.state !== "completed"}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Settings (swap sequence) */}
            {snapshot.printerStatus.connected && (
              <SettingsPanel
                sequence={sequence}
                onSequenceChange={handleSequenceChange}
              />
            )}

            {/* Queue Controls */}
            {snapshot.printerStatus.connected && (
              <LiveQueueControls
                queueState={snapshot.state}
                swapMethod={snapshot.swapMethod}
                hasJobs={snapshot.jobs.length > 0}
                onControl={handleQueueControl}
                onSwapMethodChange={handleSwapMethodChange}
              />
            )}
          </div>
        </>
      )}
    </main>
  );
}
