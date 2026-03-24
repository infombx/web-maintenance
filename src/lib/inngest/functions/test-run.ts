import { inngest } from "@/lib/inngest/client";
import { db } from "@/lib/db";
import { testRuns, testResults, reports, scrapes, websites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getBrowser } from "@/lib/playwright/browser";
import { DEVICES, type DeviceKey } from "@/lib/playwright/devices";
import { checkPageLoad } from "@/lib/playwright/checks/page-load";
import { checkConsoleErrors } from "@/lib/playwright/checks/console";
import { checkLinks } from "@/lib/playwright/checks/links";
import { checkForms } from "@/lib/playwright/checks/forms";
import { checkVisual } from "@/lib/playwright/checks/visual";
import { checkPerformance } from "@/lib/playwright/checks/performance";
import { uploadScreenshot } from "@/lib/blob/storage";
import { analyzeTestResults } from "@/lib/groq/analyze";
import { generatePdf } from "@/lib/report/pdf";
import { put } from "@vercel/blob";

export const testRunFunction = inngest.createFunction(
  {
    id: "website-test-run",
    name: "Run Website Tests",
    retries: 0,
    timeouts: { finish: "15m" },
    triggers: [{ event: "website/test.requested" }],
  },
  async ({ event, step }: { event: { data: { testRunId: string; websiteId: string; scrapeId: string } }; step: any }) => {
    const { testRunId, websiteId, scrapeId } = event.data;

    await step.run("mark-running", async () => {
      await db
        .update(testRuns)
        .set({ status: "running" })
        .where(eq(testRuns.id, testRunId));
    });

    const { website, referenceScrape } = await step.run("load-context", async () => {
      const [website, referenceScrape] = await Promise.all([
        db.query.websites.findFirst({ where: eq(websites.id, websiteId) }),
        db.query.scrapes.findFirst({ where: eq(scrapes.id, scrapeId) }),
      ]);
      return { website, referenceScrape };
    });

    if (!website || !referenceScrape?.screenshotUrls) {
      await db
        .update(testRuns)
        .set({ status: "failed" })
        .where(eq(testRuns.id, testRunId));
      return { error: "Missing website or reference scrape" };
    }

    const pageUrls = Object.keys(referenceScrape.screenshotUrls);
    const prefillData = (website.formPrefillData as Array<{ selector: string; value: string; label: string }>) ?? [];

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    const devices: DeviceKey[] = ["desktop", "laptop", "tablet", "mobile"];

    for (const deviceKey of devices) {
      const device = DEVICES[deviceKey];

      await step.run(`test-device-${deviceKey}`, async () => {
        const browser = await getBrowser();

        try {
          for (const pageUrl of pageUrls) {
            const context = await browser.newContext({
              viewport: { width: device.width, height: device.height },
              userAgent: device.userAgent,
              isMobile: device.isMobile,
            });

            const consoleErrors: string[] = [];
            const page = await context.newPage();
            page.on("console", (msg) => {
              if (msg.type() === "error" || msg.type() === "warning") {
                consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
              }
            });

            let response = null;
            try {
              response = await page.goto(pageUrl, {
                waitUntil: "load",
                timeout: 15000,
              });
            } catch (err) {
              // Navigation failed
            }

            // Take screenshot
            let screenshotUrl: string | undefined;
            try {
              const screenshot = await page.screenshot({ fullPage: true });
              const safePath = pageUrl.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 80);
              screenshotUrl = await uploadScreenshot(
                screenshot,
                `test-runs/${testRunId}/${deviceKey}/${safePath}.png`
              );
            } catch {}

            const referenceScreenshotUrl =
              referenceScrape.screenshotUrls?.[pageUrl] ?? null;

            // Run all checks
            const [pageLoadResult, consoleResult, linksResult, formsResult, visualResult, perfResult] =
              await Promise.all([
                checkPageLoad(response),
                Promise.resolve(checkConsoleErrors(consoleErrors)),
                checkLinks(page),
                checkForms(page, prefillData),
                (async () => {
                  try {
                    const screenshot = await page.screenshot({ fullPage: true });
                    return checkVisual(screenshot, referenceScreenshotUrl);
                  } catch {
                    return { status: "warning" as const, details: { message: "Screenshot failed" } };
                  }
                })(),
                checkPerformance(page),
              ]);

            // Insert all results
            const checks = [
              { checkType: "page_load" as const, result: pageLoadResult },
              { checkType: "console_errors" as const, result: consoleResult },
              { checkType: "link_check" as const, result: linksResult },
              { checkType: "form_submission" as const, result: formsResult },
              { checkType: "visual_comparison" as const, result: visualResult },
              { checkType: "performance" as const, result: perfResult },
            ];

            for (const { checkType, result } of checks) {
              await db.insert(testResults).values({
                testRunId,
                deviceType: deviceKey,
                pageUrl,
                status: result.status,
                checkType,
                details: result.details,
                screenshotUrl,
                referenceScreenshotUrl: referenceScreenshotUrl ?? undefined,
              });

              totalTests++;
              if (result.status === "pass") passedTests++;
              else if (result.status === "fail") failedTests++;
            }

            await context.close();
          }
        } finally {
          await browser.close();
        }
      });
    }

    // Update test run counts
    await step.run("update-counts", async () => {
      await db
        .update(testRuns)
        .set({ totalTests, passedTests, failedTests })
        .where(eq(testRuns.id, testRunId));
    });

    // Groq analysis
    const { summary, issueDetails } = await step.run("groq-analysis", async () => {
      const allResults = await db.query.testResults.findMany({
        where: eq(testResults.testRunId, testRunId),
      });
      return analyzeTestResults(allResults, website);
    });

    // Create report record
    const reportId = await step.run("create-report", async () => {
      const [report] = await db
        .insert(reports)
        .values({
          testRunId,
          websiteId,
          groqSummary: summary,
          groqIssueDetails: issueDetails,
          status: "running",
        })
        .returning();
      return report.id;
    });

    // Generate PDF
    await step.run("generate-pdf", async () => {
      const [allResults, report] = await Promise.all([
        db.query.testResults.findMany({ where: eq(testResults.testRunId, testRunId) }),
        db.query.reports.findFirst({ where: eq(reports.id, reportId) }),
      ]);

      if (!report) return;

      const pdfBuffer = await generatePdf({ report, website, results: allResults });
      const { url: pdfUrl } = await put(`reports/${reportId}.pdf`, pdfBuffer, {
        access: "public",
        contentType: "application/pdf",
      });

      await db
        .update(reports)
        .set({ pdfUrl, status: "completed", completedAt: new Date() })
        .where(eq(reports.id, reportId));
    });

    // Mark test run complete
    await step.run("mark-completed", async () => {
      await db
        .update(testRuns)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(testRuns.id, testRunId));
    });

    return { testRunId, totalTests, passedTests, failedTests };
  }
);
