"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle, AlertCircle, ExternalLink, ImageIcon, RefreshCw, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "idle" | "uploading" | "success" | "error";

interface ImportResult {
  total: number;
  valid: number;
  inserted: number;
  skipped: number;
}

export default function ImportPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [backfillResult, setBackfillResult] = useState<{ updated: number; total: number; remaining?: number } | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const [backfillArtistsStatus, setBackfillArtistsStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [backfillArtistsResult, setBackfillArtistsResult] = useState<{ updated: number; total: number; remaining?: number } | null>(null);
  const [backfillArtistsError, setBackfillArtistsError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<"idle" | "running" | "ok" | "fail">("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [syncResult, setSyncResult] = useState<{ synced: number; message?: string; error?: string; hint?: string } | null>(null);
  const [lastfmResult, setLastfmResult] = useState<{ synced: number; message?: string; error?: string } | null>(null);

  async function runSync() {
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync", { method: "GET" });
      const data = await res.json();
      if (!res.ok) {
        setSyncResult({
          synced: 0,
          error: data.detail ?? data.error ?? "Sync failed",
          hint: data.hint,
        });
      } else {
        setSyncResult({
          synced: data.synced ?? 0,
          message: data.message ?? (data.synced > 0 ? `Added ${data.synced} streams` : "No new tracks"),
        });
      }
    } catch {
      setSyncResult({ synced: 0, error: "Network error" });
    }
  }

  async function runLastfmSync() {
    setLastfmResult(null);
    try {
      const res = await fetch("/api/sync-lastfm", { method: "GET" });
      const data = await res.json();
      if (!res.ok) {
        setLastfmResult({ synced: 0, error: data.detail ?? data.error ?? "Sync failed" });
      } else {
        setLastfmResult({
          synced: data.synced ?? 0,
          message: data.synced > 0 ? `Added ${data.synced} scrobbles` : data.message ?? "No new scrobbles",
        });
      }
    } catch {
      setLastfmResult({ synced: 0, error: "Network error" });
    }
  }

  async function testSpotify() {
    setTestStatus("running");
    setTestError(null);
    try {
      const res = await fetch("/api/spotify-test");
      const data = await res.json();
      if (!res.ok) {
        setTestError(data.error ?? "Connection failed");
        setTestStatus("fail");
      } else {
        setTestStatus("ok");
      }
    } catch {
      setTestError("Network error");
      setTestStatus("fail");
    }
  }

  async function runBackfill() {
    setBackfillStatus("running");
    setBackfillError(null);
    try {
      const res = await fetch("/api/backfill-art", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Backfill failed");
      setBackfillResult({ updated: data.updated, total: data.total ?? 0, remaining: data.remaining });
      setBackfillStatus("done");
    } catch (e) {
      setBackfillStatus("error");
      setBackfillError(e instanceof Error ? e.message : "Backfill failed");
    }
  }

  async function runBackfillArtists() {
    setBackfillArtistsStatus("running");
    setBackfillArtistsError(null);
    try {
      const res = await fetch("/api/backfill-artists", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Backfill failed");
      setBackfillArtistsResult({ updated: data.updated, total: data.total ?? 0, remaining: data.remaining });
      setBackfillArtistsStatus("done");
    } catch (e) {
      setBackfillArtistsStatus("error");
      setBackfillArtistsError(e instanceof Error ? e.message : "Backfill failed");
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Spotify Data</h1>
        <p className="text-muted-foreground mt-1">
          Upload your Spotify data export to load your full listening history.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to get your data export</CardTitle>
          <CardDescription>Takes 1-5 days for Spotify to prepare</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {[
            <>Go to <a href="https://www.spotify.com/account/privacy/" target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">spotify.com/account/privacy <ExternalLink className="h-3 w-3" /></a></>,
            <>Check <strong className="text-foreground">Extended streaming history</strong> only (uncheck everything else)</>,
            <>Click <strong className="text-foreground">Request data</strong> and confirm via the email Spotify sends</>,
            <>Wait 1-5 days — you&apos;ll get another email with a download link</>,
            <>Download the ZIP file and upload it here</>,
          ].map((step, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
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
              "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
              status === "uploading" && "pointer-events-none opacity-60"
            )}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
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
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Drop your ZIP file here</p>
            <p className="text-muted-foreground text-sm mt-1">or click to browse</p>
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
            <div className="mt-4 rounded-lg bg-primary/10 border border-primary/20 p-4 flex gap-3">
              <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">Import complete</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">{result.total.toLocaleString()} total entries</Badge>
                  <Badge variant="secondary">{result.inserted.toLocaleString()} new streams added</Badge>
                  <Badge variant="secondary">{result.skipped.toLocaleString()} duplicates skipped</Badge>
                </div>
                <p className="text-muted-foreground mt-2">
                  Head to the <a href="/me" className="text-primary hover:underline">Overview</a> to see your stats.
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="mt-4 rounded-lg bg-destructive/10 border border-destructive/20 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Import failed</p>
                <p className="text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Backfill album artwork
          </CardTitle>
          <CardDescription>
            Imported streams don&apos;t include images. This fetches artwork from Spotify for tracks that are missing it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={testSpotify}
              disabled={testStatus === "running"}
              className="text-xs px-3 py-1.5 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50"
            >
              {testStatus === "running" ? "Testing…" : testStatus === "ok" ? "Connection OK" : "Test Spotify connection"}
            </button>
            {testStatus === "ok" && <span className="text-xs text-primary">Spotify credentials work</span>}
            {testStatus === "fail" && testError && <span className="text-xs text-destructive">{testError}</span>}
          </div>
          <button
            onClick={runBackfill}
            disabled={backfillStatus === "running"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 font-medium text-sm transition-colors disabled:opacity-50"
          >
            {backfillStatus === "running" ? "Fetching artwork..." : "Backfill missing artwork"}
          </button>
          {backfillStatus === "done" && backfillResult && (
            <p className="text-sm text-muted-foreground mt-3">
              Updated {backfillResult.updated.toLocaleString()} streams with album art
              {backfillResult.total > 0 && ` (${backfillResult.total} tracks checked)`}
              {backfillResult.remaining !== undefined && backfillResult.remaining > 0 && (
                <> — {backfillResult.remaining.toLocaleString()} left. Click again to continue.</>
              )}
            </p>
          )}
          {backfillStatus === "error" && (
            <p className="text-sm text-destructive mt-3">{backfillError ?? "Backfill failed."}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Music2 className="h-4 w-4" />
            Backfill artist images
          </CardTitle>
          <CardDescription>
            Fetches artist photos from Last.fm for streams missing them. Requires LASTFM_API_KEY.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <button
            onClick={runBackfillArtists}
            disabled={backfillArtistsStatus === "running"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 font-medium text-sm transition-colors disabled:opacity-50"
          >
            {backfillArtistsStatus === "running" ? "Fetching images..." : "Backfill artist images"}
          </button>
          {backfillArtistsStatus === "done" && backfillArtistsResult && (
            <p className="text-sm text-muted-foreground mt-3">
              Updated {backfillArtistsResult.updated.toLocaleString()} streams with artist images
              {backfillArtistsResult.total > 0 && ` (${backfillArtistsResult.total} artists checked)`}
              {backfillArtistsResult.remaining !== undefined && backfillArtistsResult.remaining > 0 && (
                <> — {backfillArtistsResult.remaining.toLocaleString()} left. Click again to continue.</>
              )}
            </p>
          )}
          {backfillArtistsStatus === "error" && (
            <p className="text-sm text-destructive mt-3">{backfillArtistsError ?? "Backfill failed."}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Sync now
          </CardTitle>
          <CardDescription>
            Manually fetch new plays from Spotify. Runs automatically every hour, or click to sync now.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <button
            onClick={runSync}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 font-medium text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Sync now
          </button>
          {syncResult && (
            <div className="space-y-1">
              <p className={`text-sm ${syncResult.error ? "text-destructive" : "text-muted-foreground"}`}>
                {syncResult.error ?? (syncResult.synced > 0 ? `Added ${syncResult.synced} streams.` : syncResult.message)}
              </p>
              {syncResult.hint && (
                <p className="text-xs text-muted-foreground">{syncResult.hint}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Music2 className="h-4 w-4" />
            Sync from Last.fm
          </CardTitle>
          <CardDescription>
            Works without Spotify Premium. Connect Spotify to Last.fm, then sync your scrobbles here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>1. Create a free account at last.fm</p>
            <p>2. In Spotify: Settings → Social → Connect to Last.fm</p>
            <p>3. Get an API key at last.fm/api/account/create</p>
            <p>4. Add to Netlify env: LASTFM_API_KEY, LASTFM_USER (your Last.fm username)</p>
          </div>
          <button
            onClick={runLastfmSync}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 font-medium text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Sync from Last.fm
          </button>
          {lastfmResult && (
            <p className={`text-sm ${lastfmResult.error ? "text-destructive" : "text-muted-foreground"}`}>
              {lastfmResult.error ?? lastfmResult.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
