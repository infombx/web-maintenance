"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RunStatusPoller } from "@/components/run-status-poller";
import { ReportViewer } from "@/components/report-viewer";
import type { TestRun, TestResult, Report } from "@/lib/db/schema";

type RunData = TestRun & { results: TestResult[]; report: Report | null };

export default function TestRunPage() {
  const params = useParams<{ id: string; runId: string }>();
  const [data, setData] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/test-runs/${params.runId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [params.runId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin h-6 w-6 border-2 border-zinc-300 border-t-zinc-700 rounded-full" />
      </div>
    );
  }

  const isComplete = data?.status === "completed";
  const isFailed = data?.status === "failed";
  const isRunning = data?.status === "running" || data?.status === "pending";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href={`/websites/${params.id}`} />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Test Run</h1>
          <p className="text-sm text-zinc-400 font-mono">{params.runId}</p>
        </div>
      </div>

      {isRunning && data && (
        <RunStatusPoller
          runId={params.runId}
          initialData={data}
          onComplete={(updated) => setData(updated)}
        />
      )}

      {isComplete && data && (
        <ReportViewer
          testRun={data}
          results={data.results}
          report={data.report}
        />
      )}

      {isFailed && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-lg font-medium text-zinc-700">Test run failed</p>
          <p className="text-sm text-zinc-400">
            Check the Inngest dashboard for error details.
          </p>
          <Button variant="outline" nativeButton={false} render={<Link href={`/websites/${params.id}`} />}>
            Back to website
          </Button>
        </div>
      )}
    </div>
  );
}
