"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScanLine, Play, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface WebsiteActionsProps {
  websiteId: string;
  hasScrape: boolean;
}

export function WebsiteActions({ websiteId, hasScrape }: WebsiteActionsProps) {
  const router = useRouter();
  const [scraping, setScraping] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleScrape() {
    setScraping(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });
      if (!res.ok) throw new Error("Failed to start scrape");
      toast.success("Reference scrape started — this may take a minute.");
      router.refresh();
    } catch {
      toast.error("Failed to start scrape");
    } finally {
      setScraping(false);
    }
  }

  async function handleRunTests() {
    setTesting(true);
    toast.info("Running tests — this takes 3–5 minutes. Please keep this tab open.");
    try {
      const res = await fetch("/api/test-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to start test run");
        return;
      }
      toast.success("Tests complete!");
      router.push(`/websites/${websiteId}/run/${data.testRunId}`);
    } catch {
      toast.error("Test run failed or timed out");
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete website");
      toast.success("Website removed");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to delete website");
      setDeleting(false);
    }
  }

  return (
    <div className="flex gap-3">
      <Button variant="outline" onClick={handleScrape} disabled={scraping}>
        {scraping ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <ScanLine className="h-4 w-4 mr-2" />
        )}
        {hasScrape ? "Re-capture Baseline" : "Capture Baseline"}
      </Button>

      <Button
        onClick={handleRunTests}
        disabled={testing || !hasScrape}
        title={!hasScrape ? "Capture a baseline first" : undefined}
      >
        {testing ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Play className="h-4 w-4 mr-2" />
        )}
        {testing ? "Running… (3–5 min)" : "Run Tests"}
      </Button>

      <Button
        variant="destructive"
        size="icon"
        title="Remove website"
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Remove website?</DialogTitle>
          <DialogDescription>
            This will remove the website and all its data. This action cannot be undone.
          </DialogDescription>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
