import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import type { TestRun } from "@/lib/db/schema";

const statusConfig = {
  pending: { label: "Pending", icon: Clock, variant: "secondary" as const, color: "text-zinc-500" },
  running: { label: "Running", icon: Loader2, variant: "secondary" as const, color: "text-blue-500 animate-spin" },
  completed: { label: "Completed", icon: CheckCircle2, variant: "default" as const, color: "text-green-500" },
  failed: { label: "Failed", icon: XCircle, variant: "destructive" as const, color: "text-red-500" },
};

interface TestRunCardProps {
  testRun: TestRun;
  websiteId: string;
}

export function TestRunCard({ testRun, websiteId }: TestRunCardProps) {
  const config = statusConfig[testRun.status];
  const Icon = config.icon;
  const passRate =
    testRun.totalTests && testRun.totalTests > 0
      ? Math.round(((testRun.passedTests ?? 0) / testRun.totalTests) * 100)
      : null;

  return (
    <Link href={`/websites/${websiteId}/run/${testRun.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${config.color}`} />
              <Badge variant={config.variant}>{config.label}</Badge>
            </div>
            <span className="text-xs text-zinc-400">
              {formatDistanceToNow(new Date(testRun.triggeredAt), { addSuffix: true })}
            </span>
          </div>

          {testRun.status === "completed" && passRate !== null && (
            <div className="mt-3 flex gap-4 text-sm">
              <span className="text-green-600 font-medium">
                {testRun.passedTests} passed
              </span>
              <span className="text-red-500 font-medium">
                {testRun.failedTests} failed
              </span>
              <span className="text-zinc-400">
                {passRate}% pass rate
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
