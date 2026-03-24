import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToBuffer,
  Image,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import type { Report, Website, TestResult } from "@/lib/db/schema";
import { fetchAsBase64 } from "@/lib/blob/storage";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#1a1a1a",
  },
  coverPage: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 60,
    color: "#1a1a1a",
    backgroundColor: "#f9fafb",
  },
  title: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
    color: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 4,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.6,
    color: "#374151",
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
  },
  statBox: {
    flex: 1,
    padding: 12,
    borderRadius: 4,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
  },
  statLabel: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    padding: "6 8",
    borderRadius: 2,
  },
  tableRow: {
    flexDirection: "row",
    padding: "5 8",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  colDevice: { width: "12%", fontSize: 9 },
  colPage: { width: "35%", fontSize: 9 },
  colCheck: { width: "20%", fontSize: 9 },
  colStatus: { width: "10%", fontSize: 9 },
  colDetails: { width: "23%", fontSize: 9, color: "#6b7280" },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 8,
  },
  badgePass: { backgroundColor: "#d1fae5", color: "#065f46" },
  badgeFail: { backgroundColor: "#fee2e2", color: "#991b1b" },
  badgeWarn: { backgroundColor: "#fef3c7", color: "#92400e" },
  issueCard: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 10,
    paddingVertical: 4,
  },
  issueCritical: { borderLeftColor: "#ef4444" },
  issueWarning: { borderLeftColor: "#f59e0b" },
  issueInfo: { borderLeftColor: "#3b82f6" },
  issueTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  issueDesc: { fontSize: 9, color: "#374151", lineHeight: 1.5 },
  screenshotRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  screenshotBox: { flex: 1 },
  screenshotLabel: { fontSize: 8, color: "#6b7280", marginBottom: 3 },
  screenshot: { width: "100%", objectFit: "contain" },
});

const DEVICE_LABELS: Record<string, string> = {
  desktop: "Desktop",
  laptop: "Laptop",
  tablet: "Tablet",
  mobile: "Mobile",
};

const CHECK_LABELS: Record<string, string> = {
  page_load: "Page Load",
  console_errors: "Console Errors",
  link_check: "Links",
  form_submission: "Forms",
  visual_comparison: "Visual",
  performance: "Performance",
};

interface PdfInput {
  report: Report;
  website: Website;
  results: TestResult[];
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "pass"
      ? [styles.badge, styles.badgePass]
      : status === "fail"
      ? [styles.badge, styles.badgeFail]
      : [styles.badge, styles.badgeWarn];
  return React.createElement(View, { style }, React.createElement(Text, null, status.toUpperCase()));
}

export async function generatePdf({ report, website, results }: PdfInput): Promise<Buffer> {
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const warned = results.filter((r) => r.status === "warning").length;
  const passRate = results.length > 0 ? Math.round((passed / results.length) * 100) : 0;

  const issueDetails = (report.groqIssueDetails ?? []) as Array<{
    device: string;
    page: string;
    checkType: string;
    description: string;
    severity: "critical" | "warning" | "info";
  }>;

  // Fetch screenshots for visual failures (limit to 5 to keep PDF size reasonable)
  const visualFailures = results
    .filter((r) => r.checkType === "visual_comparison" && r.status !== "pass")
    .slice(0, 5);

  const screenshotData: Array<{
    result: TestResult;
    current: string | null;
    reference: string | null;
  }> = await Promise.all(
    visualFailures.map(async (r) => ({
      result: r,
      current: r.screenshotUrl ? await fetchAsBase64(r.screenshotUrl) : null,
      reference: r.referenceScreenshotUrl
        ? await fetchAsBase64(r.referenceScreenshotUrl)
        : null,
    }))
  );

  const devices = ["desktop", "laptop", "tablet", "mobile"];

  const doc = React.createElement(
    Document,
    null,

    // Cover page
    React.createElement(
      Page,
      { size: "A4", style: styles.coverPage },
      React.createElement(
        View,
        { style: { marginTop: 80 } },
        React.createElement(Text, { style: styles.title }, "Website Maintenance Report"),
        React.createElement(Text, { style: styles.subtitle }, website.name),
        React.createElement(Text, { style: { fontSize: 11, color: "#9ca3af", marginTop: 4 } }, website.url),
        React.createElement(
          Text,
          { style: { fontSize: 10, color: "#9ca3af", marginTop: 8 } },
          `Generated: ${format(new Date(report.createdAt), "PPP")}`
        ),
        React.createElement(
          View,
          { style: styles.statsRow },
          React.createElement(
            View,
            { style: [styles.statBox, { backgroundColor: "#d1fae5" }] },
            React.createElement(Text, { style: [styles.statNumber, { color: "#065f46" }] }, String(passed)),
            React.createElement(Text, { style: styles.statLabel }, "Passed")
          ),
          React.createElement(
            View,
            { style: [styles.statBox, { backgroundColor: "#fee2e2" }] },
            React.createElement(Text, { style: [styles.statNumber, { color: "#991b1b" }] }, String(failed)),
            React.createElement(Text, { style: styles.statLabel }, "Failed")
          ),
          React.createElement(
            View,
            { style: [styles.statBox, { backgroundColor: "#fef3c7" }] },
            React.createElement(Text, { style: [styles.statNumber, { color: "#92400e" }] }, String(warned)),
            React.createElement(Text, { style: styles.statLabel }, "Warnings")
          ),
          React.createElement(
            View,
            { style: [styles.statBox, { backgroundColor: "#eff6ff" }] },
            React.createElement(Text, { style: [styles.statNumber, { color: "#1d4ed8" }] }, `${passRate}%`),
            React.createElement(Text, { style: styles.statLabel }, "Pass Rate")
          )
        )
      )
    ),

    // Executive Summary page
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(
        View,
        null,
        React.createElement(Text, { style: styles.sectionTitle }, "Executive Summary"),
        ...(report.groqSummary ?? "No summary available.")
          .split("\n")
          .filter(Boolean)
          .map((para, i) =>
            React.createElement(Text, { key: i, style: styles.paragraph }, para)
          )
      ),
      issueDetails.length > 0 &&
        React.createElement(
          View,
          { style: styles.section },
          React.createElement(Text, { style: styles.sectionTitle }, "Issues Found"),
          ...issueDetails.map((issue, i) =>
            React.createElement(
              View,
              {
                key: i,
                style: [
                  styles.issueCard,
                  issue.severity === "critical"
                    ? styles.issueCritical
                    : issue.severity === "warning"
                    ? styles.issueWarning
                    : styles.issueInfo,
                ],
              },
              React.createElement(
                Text,
                { style: styles.issueTitle },
                `[${issue.severity.toUpperCase()}] ${DEVICE_LABELS[issue.device] ?? issue.device} — ${CHECK_LABELS[issue.checkType] ?? issue.checkType}`
              ),
              React.createElement(Text, { style: { fontSize: 8, color: "#6b7280", marginBottom: 2 } }, issue.page),
              React.createElement(Text, { style: styles.issueDesc }, issue.description)
            )
          )
        )
    ),

    // Per-device results pages
    ...devices.map((device) => {
      const deviceResults = results.filter((r) => r.deviceType === device);
      if (deviceResults.length === 0) return null;

      return React.createElement(
        Page,
        { size: "A4", style: styles.page, key: device },
        React.createElement(
          View,
          null,
          React.createElement(
            Text,
            { style: styles.sectionTitle },
            `${DEVICE_LABELS[device]} Results`
          ),
          React.createElement(
            View,
            { style: styles.tableHeader },
            React.createElement(Text, { style: styles.colPage }, "Page"),
            React.createElement(Text, { style: styles.colCheck }, "Check"),
            React.createElement(Text, { style: styles.colStatus }, "Status"),
            React.createElement(Text, { style: styles.colDetails }, "Details")
          ),
          ...deviceResults.map((r, i) =>
            React.createElement(
              View,
              { key: i, style: styles.tableRow },
              React.createElement(
                Text,
                { style: styles.colPage },
                r.pageUrl.replace(/^https?:\/\/[^/]+/, "").substring(0, 40) || "/"
              ),
              React.createElement(
                Text,
                { style: styles.colCheck },
                CHECK_LABELS[r.checkType] ?? r.checkType
              ),
              React.createElement(
                View,
                { style: styles.colStatus },
                React.createElement(StatusBadge, { status: r.status })
              ),
              React.createElement(
                Text,
                { style: styles.colDetails },
                String(r.details?.message ?? "").substring(0, 60)
              )
            )
          )
        )
      );
    }).filter(Boolean),

    // Screenshots page
    screenshotData.some((s) => s.current || s.reference) &&
      React.createElement(
        Page,
        { size: "A4", style: styles.page },
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.sectionTitle }, "Visual Comparisons"),
          ...screenshotData
            .filter((s) => s.current || s.reference)
            .map((s, i) =>
              React.createElement(
                View,
                { key: i, style: { marginBottom: 16 } },
                React.createElement(
                  Text,
                  { style: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 } },
                  `${DEVICE_LABELS[s.result.deviceType]} — ${s.result.pageUrl}`
                ),
                React.createElement(
                  View,
                  { style: styles.screenshotRow },
                  s.reference &&
                    React.createElement(
                      View,
                      { style: styles.screenshotBox },
                      React.createElement(Text, { style: styles.screenshotLabel }, "Reference"),
                      React.createElement(Image, { src: s.reference, style: styles.screenshot })
                    ),
                  s.current &&
                    React.createElement(
                      View,
                      { style: styles.screenshotBox },
                      React.createElement(Text, { style: styles.screenshotLabel }, "Current"),
                      React.createElement(Image, { src: s.current, style: styles.screenshot })
                    )
                )
              )
            )
        )
      )
  );

  return await renderToBuffer(doc);
}
