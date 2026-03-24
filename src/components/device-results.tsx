"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScreenshotCompare } from "@/components/screenshot-compare";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { TestResult } from "@/lib/db/schema";

const CHECK_LABELS: Record<string, string> = {
  page_load: "Page Load",
  console_errors: "Console Errors",
  link_check: "Broken Links",
  form_submission: "Forms",
  visual_comparison: "Visual",
  performance: "Performance",
};

const STATUS_VARIANTS = {
  pass: "default",
  fail: "destructive",
  warning: "secondary",
} as const;

interface DeviceResultsProps {
  results: TestResult[];
}

export function DeviceResults({ results }: DeviceResultsProps) {
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

  // Group by page
  const byPage = results.reduce<Record<string, TestResult[]>>((acc, r) => {
    if (!acc[r.pageUrl]) acc[r.pageUrl] = [];
    acc[r.pageUrl].push(r);
    return acc;
  }, {});

  function togglePage(url: string) {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {Object.entries(byPage).map(([pageUrl, checks]) => {
        const hasFail = checks.some((c) => c.status === "fail");
        const hasWarn = checks.some((c) => c.status === "warning");
        const expanded = expandedPages.has(pageUrl);
        const pageStatus = hasFail ? "fail" : hasWarn ? "warning" : "pass";

        return (
          <div key={pageUrl} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => togglePage(pageUrl)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-50 hover:bg-zinc-100 text-left transition-colors"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
              )}
              <Badge
                variant={STATUS_VARIANTS[pageStatus]}
                className="shrink-0"
              >
                {hasFail ? `${checks.filter((c) => c.status === "fail").length} fail` : hasWarn ? "warn" : "pass"}
              </Badge>
              <span className="text-sm font-medium text-zinc-700 truncate">
                {pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}
              </span>
              <span className="text-xs text-zinc-400 ml-auto shrink-0">
                {checks.filter((c) => c.status === "pass").length}/{checks.length} passed
              </span>
            </button>

            {expanded && (
              <div className="divide-y">
                {checks.map((check) => (
                  <div key={check.id} className="flex items-start gap-3 px-4 py-3">
                    <Badge
                      variant={STATUS_VARIANTS[check.status]}
                      className="mt-0.5 shrink-0 text-xs"
                    >
                      {check.status}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-700">
                        {CHECK_LABELS[check.checkType] ?? check.checkType}
                      </p>
                      {check.details?.message && (
                        <p className="text-xs text-zinc-500 mt-0.5">{check.details.message}</p>
                      )}
                      {check.details?.consoleErrors && check.details.consoleErrors.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {check.details.consoleErrors.slice(0, 3).map((err, i) => (
                            <li key={i} className="text-xs text-red-500 font-mono truncate">
                              {err}
                            </li>
                          ))}
                        </ul>
                      )}
                      {check.details?.brokenLinks && check.details.brokenLinks.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {check.details.brokenLinks.slice(0, 3).map((link, i) => (
                            <li key={i} className="text-xs text-red-500 truncate">
                              {link.url} ({link.status})
                            </li>
                          ))}
                        </ul>
                      )}
                      {check.details?.lcp && (
                        <p className="text-xs text-zinc-500 mt-0.5">
                          LCP: {(check.details.lcp / 1000).toFixed(2)}s
                          {check.details.fcp ? ` · FCP: ${(check.details.fcp / 1000).toFixed(2)}s` : ""}
                        </p>
                      )}
                    </div>
                    {check.checkType === "visual_comparison" && (
                      <ScreenshotCompare
                        currentUrl={check.screenshotUrl}
                        referenceUrl={check.referenceScreenshotUrl}
                        label={pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
