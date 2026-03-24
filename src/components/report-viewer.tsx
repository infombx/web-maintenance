"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DeviceResults } from "@/components/device-results";
import { Download, Monitor, Laptop2, Tablet, Smartphone } from "lucide-react";
import type { TestRun, TestResult, Report } from "@/lib/db/schema";

const DEVICE_ICONS = {
  desktop: Monitor,
  laptop: Laptop2,
  tablet: Tablet,
  mobile: Smartphone,
};

const DEVICE_LABELS = {
  desktop: "Desktop",
  laptop: "Laptop",
  tablet: "Tablet",
  mobile: "Mobile",
};

interface ReportViewerProps {
  testRun: TestRun;
  results: TestResult[];
  report: Report | null;
}

export function ReportViewer({ testRun, results, report }: ReportViewerProps) {
  const devices = ["desktop", "laptop", "tablet", "mobile"] as const;

  const deviceStats = devices.map((device) => {
    const deviceResults = results.filter((r) => r.deviceType === device);
    const passed = deviceResults.filter((r) => r.status === "pass").length;
    const failed = deviceResults.filter((r) => r.status === "fail").length;
    const warned = deviceResults.filter((r) => r.status === "warning").length;
    return { device, passed, failed, warned, total: deviceResults.length };
  });

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-4">
        {deviceStats.map(({ device, passed, failed, warned, total }) => {
          const Icon = DEVICE_ICONS[device];
          const allPass = failed === 0 && warned === 0;
          return (
            <Card key={device} className={allPass ? "border-green-200" : failed > 0 ? "border-red-200" : "border-yellow-200"}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-zinc-500" />
                  <span className="text-sm font-medium">{DEVICE_LABELS[device]}</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="text-green-600">{passed} pass</span>
                  {failed > 0 && <span className="text-red-500">{failed} fail</span>}
                  {warned > 0 && <span className="text-yellow-600">{warned} warn</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Groq summary */}
      {report?.groqSummary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">AI Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed">
              {report.groqSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Download button */}
      {report && (
        <div className="flex justify-end">
          <Button variant="outline" render={<a href={`/api/reports/${report.id}/download`} download />}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF Report
          </Button>
        </div>
      )}

      <Separator />

      {/* Per-device tabs */}
      <Tabs defaultValue="desktop">
        <TabsList>
          {devices.map((device) => {
            const stats = deviceStats.find((s) => s.device === device)!;
            const Icon = DEVICE_ICONS[device];
            return (
              <TabsTrigger key={device} value={device} className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                {DEVICE_LABELS[device]}
                {stats.failed > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs h-4 px-1">
                    {stats.failed}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {devices.map((device) => {
          const deviceResults = results.filter((r) => r.deviceType === device);
          return (
            <TabsContent key={device} value={device} className="mt-4">
              {deviceResults.length === 0 ? (
                <p className="text-sm text-zinc-400">No results for this device.</p>
              ) : (
                <DeviceResults results={deviceResults} />
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
