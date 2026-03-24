"use client";

import useSWR from "swr";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { TestRun, TestResult, Report } from "@/lib/db/schema";

type RunData = TestRun & { results: TestResult[]; report: Report | null };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface RunStatusPollerProps {
  runId: string;
  initialData?: RunData;
  onComplete?: (data: RunData) => void;
}

export function RunStatusPoller({ runId, initialData, onComplete }: RunStatusPollerProps) {
  const { data } = useSWR<RunData>(
    `/api/test-runs/${runId}`,
    fetcher,
    {
      fallbackData: initialData,
      refreshInterval: (data) => {
        if (!data) return 3000;
        if (data.status === "completed" || data.status === "failed") {
          onComplete?.(data);
          return 0;
        }
        return 3000;
      },
    }
  );

  if (!data) return null;

  if (data.status === "pending" || data.status === "running") {
    const progressValue =
      data.totalTests && data.totalTests > 0
        ? Math.round(((data.passedTests ?? 0 + (data.failedTests ?? 0)) / data.totalTests) * 100)
        : 0;

    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
        <p className="text-lg font-medium text-zinc-700">
          {data.status === "pending" ? "Queued…" : "Running tests across all devices…"}
        </p>
        <p className="text-sm text-zinc-400">This may take 3–8 minutes. You can safely navigate away.</p>
        {data.status === "running" && (
          <div className="w-80">
            <Progress value={progressValue} className="h-2" />
          </div>
        )}
      </div>
    );
  }

  if (data.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <XCircle className="h-10 w-10 text-red-500" />
        <p className="text-lg font-medium text-zinc-700">Test run failed</p>
        <p className="text-sm text-zinc-400">Check the Inngest dashboard for details.</p>
      </div>
    );
  }

  return null;
}
