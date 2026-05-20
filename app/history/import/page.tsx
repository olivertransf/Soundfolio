"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ImageIcon,
  RefreshCw,
  Music2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "idle" | "uploading" | "success" | "error";

interface ImportResult {
  total: number;
  valid: number;
  inserted: number;
  skipped: number;
}

export default function HistoryImportPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [backfillResult, setBackfillResult] = useState<{
    updated: number;
    total: number;
    remaining?: number;
  } | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const [backfillDebug, setBackfillDebug] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [lastfmResult, setLastfmResult] = useState<{ synced: number; message?: string; error?: string } | null>(null);
  const [lastfmLoading, setLastfmLoading] = useState(false);

  async function runLastfmSync() {
    setLastfmResult(null);
    setLastfmLoading(true);
    try {
      const res = await fetch("/api/sync-lastfm", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setLastfmResult({ synced: 0, error: data.detail ?? data.error ?? "Sync failed" });
      } else if (data.skipped) {
        setLastfmResult({
          synced: 0,
          message: data.detail ?? data.message ?? "Add LASTFM_USER and LASTFM_API_KEY to .env",
        });
      } else {
        setLastfmResult({
          synced: data.synced ?? 0,
          message: data.synced > 0 ? `Added ${data.synced} scrobbles` : data.message ?? "No new scrobbles",
        });
        if ((data.synced ?? 0) > 0) router.refresh();
      }
    } catch {
      setLastfmResult({ synced: 0, error: "Network error" });
    } finally {
      setLastfmLoading(false);
    }
  }

  async function runBackfill() {
    setBackfillStatus("running");
    setBackfillError(null);
    setBackfillDebug(null);
    let responseDebug: string | null = null;
    try {
      const res = await fetch("/api/backfill-art", { method: "POST" });
      const data = await res.json();
      responseDebug = JSON.stringify({ httpStatus: res.status, ...data }, null, 2);
      setBackfillDebug(responseDebug);
      if (!res.ok) throw new Error(data.error ?? "Backfill failed");
      setBackfillResult({ updated: data.updated, total: data.total ?? 0, remaining: data.remaining });
      setBackfillStatus("done");
      if ((data.updated ?? 0) > 0) router.refresh();
    } catch (e) {
      setBackfillStatus("error");
      const msg = e instanceof Error ? e.message : "Backfill failed";
      setBackfillError(msg);
      setBackfillDebug(responseDebug ?? JSON.stringify({ error: msg }, null, 2));
    }
  }

  async function handleFile(file: File) {
    if (!file.name.endsWith(".zip")) {
      setError("Please upload the ZIP file from your Spotify data export.");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setError(null);
    setProgress(20);

    const formData = new FormData();
    formData.append("file", file);

    setProgress(50);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      setProgress(90);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Import failed.");
        setStatus("error");
        return;
      }

      setResult(data);
      setStatus("success");
      setProgress(100);
      if ((data.inserted ?? 0) > 0) router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data center</h1>
        <p className="mt-1 text-muted-foreground">
          Import history, sync new plays, and fill missing artwork from one place.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
      <Card className="lg:row-span-2">
        <CardHeader>
          <CardTitle className="text-base">How to get your data export</CardTitle>
          <CardDescription>Takes 1-5 days for Spotify to prepare</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {[
            <>Go to <a href="https://www.spotify.com/account/privacy/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">spotify.com/account/privacy <ExternalLink className="h-3 w-3" /></a></>,
            <>Check <strong className="text-foreground">Extended streaming history</strong> only (uncheck everything else)</>,
            <>Click <strong className="text-foreground">Request data</strong> and confirm via the email Spotify sends</>,
            <>Wait 1-5 days — you&apos;ll get another email with a download link</>,
            <>Download the ZIP file and upload it here</>,
          ].map((step, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <p className="text-muted-foreground">{step}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div
            className={cn(
              "cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
              status === "uploading" && "pointer-events-none opacity-60"
            )}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={onInputChange}
            />
            <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Drop your ZIP file here</p>
            <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
          </div>

          {status === "uploading" && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Processing your data...</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {status === "success" && result && (
            <div className="mt-4 flex gap-3 rounded-lg border border-primary/20 bg-primary/10 p-4">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">Import complete</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{result.total.toLocaleString()} total entries</Badge>
                  <Badge variant="secondary">{result.inserted.toLocaleString()} new streams added</Badge>
                  <Badge variant="secondary">{result.skipped.toLocaleString()} duplicates skipped</Badge>
                </div>
                <p className="mt-2 text-muted-foreground">
                  Head to the{" "}
                  <Link href="/me?range=ytd" className="text-primary hover:underline">
                    Overview
                  </Link>{" "}
                  to see your stats.
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="mt-4 flex gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Import failed</p>
                <p className="mt-1 text-muted-foreground">{error}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Music2 className="h-4 w-4" />
            Sync from Last.fm
          </CardTitle>
          <CardDescription>
            Ongoing plays are pulled from your Last.fm scrobbles, not the Spotify API. Connect Spotify to Last.fm in the Spotify app (Settings → Social).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>1. Create a free account at last.fm</p>
            <p>2. In Spotify: Settings → Social → Connect to Last.fm</p>
            <p>3. Create an API key at last.fm/api/account/create</p>
            <p>
              4. Set <code className="text-foreground">LASTFM_API_KEY</code> and{" "}
              <code className="text-foreground">LASTFM_USER</code> in your{" "}
              <code className="text-foreground">.env</code>
            </p>
          </div>
          <button
            type="button"
            onClick={runLastfmSync}
            disabled={lastfmLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 disabled:pointer-events-none disabled:opacity-60"
          >
            {lastfmLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            {lastfmLoading ? "Syncing…" : "Sync from Last.fm"}
          </button>
          {lastfmResult && (
            <p className={`text-sm ${lastfmResult.error ? "text-destructive" : "text-muted-foreground"}`}>
              {lastfmResult.error ?? lastfmResult.message}
            </p>
          )}
        </CardContent>
      </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4" />
            Backfill album artwork
          </CardTitle>
          <CardDescription>
            Imported streams don&apos;t include images. This looks up cover art via Last.fm (if configured), then iTunes and Cover Art Archive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <button
            type="button"
            onClick={runBackfill}
            disabled={backfillStatus === "running"}
            className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary/80 disabled:pointer-events-none disabled:opacity-60"
          >
            {backfillStatus === "running" ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : null}
            {backfillStatus === "running" ? "Fetching artwork…" : "Backfill missing artwork"}
          </button>
          {backfillStatus === "running" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
              <span>Server is looking up cover art (can take up to ~1 min).</span>
            </p>
          )}
          {backfillStatus === "done" && backfillResult && (
            <p className="mt-3 text-sm text-muted-foreground">
              Updated {backfillResult.updated.toLocaleString()} streams with album art
              {backfillResult.total > 0 && ` (${backfillResult.total} tracks checked)`}
              {backfillResult.remaining !== undefined && backfillResult.remaining > 0 && (
                <> — {backfillResult.remaining.toLocaleString()} left. Click again to continue.</>
              )}
            </p>
          )}
          {backfillStatus === "error" && (
            <p className="mt-3 text-sm text-destructive">{backfillError ?? "Backfill failed."}</p>
          )}
          {backfillDebug && (backfillStatus === "done" || backfillStatus === "error") && (
            <details className="mt-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-left">
              <summary className="cursor-pointer select-none text-xs text-muted-foreground">Response details</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
                {backfillDebug}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
