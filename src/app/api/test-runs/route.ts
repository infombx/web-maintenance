import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { websites, testRuns, testResults, reports, scrapes } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getBrowser } from "@/lib/playwright/browser";
import { DEVICES, type DeviceKey } from "@/lib/playwright/devices";
import { checkPageLoad } from "@/lib/playwright/checks/page-load";
import { checkConsoleErrors } from "@/lib/playwright/checks/console";
import { checkForms } from "@/lib/playwright/checks/forms";
import { checkVisual } from "@/lib/playwright/checks/visual";
import { checkPerformance } from "@/lib/playwright/checks/performance";
import { uploadScreenshot } from "@/lib/blob/storage";
import { analyzeTestResults } from "@/lib/groq/analyze";
import { generatePdf } from "@/lib/report/pdf";
import { put } from "@vercel/blob";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { websiteId } = await req.json();
  if (!websiteId) return NextResponse.json({ error: "websiteId required" }, { status: 400 });

  const website = await db.query.websites.findFirst({
    where: and(eq(websites.id, websiteId), eq(websites.userId, userId), eq(websites.isActive, true)),
  });
  if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const referenceScrape = await db.query.scrapes.findFirst({
    where: and(eq(scrapes.websiteId, websiteId), eq(scrapes.type, "reference"), eq(scrapes.status, "completed")),
    orderBy: [desc(scrapes.createdAt)],
  });
  if (!referenceScrape) {
    return NextResponse.json({ error: "No completed reference scrape found. Please capture a baseline first." }, { status: 400 });
  }

  const [testRun] = await db
    .insert(testRuns)
    .values({ websiteId, triggeredBy: userId, status: "running" })
    .returning();

  const testRunId = testRun.id;
  const pageUrls = Object.keys(referenceScrape.screenshotUrls as Record<string, string>);
  const prefillData = (website.formPrefillData as Array<{ selector: string; value: string; label: string }>) ?? [];
  const devices: DeviceKey[] = ["desktop", "laptop", "tablet", "mobile"];

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  const browser = await getBrowser();

  try {
    for (const deviceKey of devices) {
      const device = DEVICES[deviceKey];

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
          response = await page.goto(pageUrl, { waitUntil: "load", timeout: 15000 });
        } catch {}

        let screenshotUrl: string | undefined;
        try {
          const screenshot = await page.screenshot({ fullPage: true });
          const safePath = pageUrl.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 80);
          screenshotUrl = await uploadScreenshot(screenshot, `test-runs/${testRunId}/${deviceKey}/${safePath}.png`);
        } catch {}

        const referenceScreenshotUrl = (referenceScrape.screenshotUrls as Record<string, string>)[pageUrl] ?? null;

        const [pageLoadResult, consoleResult, formsResult, visualResult, perfResult] = await Promise.all([
          checkPageLoad(response),
          Promise.resolve(checkConsoleErrors(consoleErrors)),
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

        const checks = [
          { checkType: "page_load" as const, result: pageLoadResult },
          { checkType: "console_errors" as const, result: consoleResult },
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
    }
  } finally {
    await browser.close();
  }

  await db.update(testRuns).set({ totalTests, passedTests, failedTests }).where(eq(testRuns.id, testRunId));

  // Groq analysis
  const allResults = await db.query.testResults.findMany({ where: eq(testResults.testRunId, testRunId) });
  const { summary, issueDetails } = await analyzeTestResults(allResults, website);

  const [report] = await db.insert(reports).values({
    testRunId,
    websiteId,
    groqSummary: summary,
    groqIssueDetails: issueDetails,
    status: "running",
  }).returning();

  // Generate PDF
  const pdfBuffer = await generatePdf({ report, website, results: allResults });
  const { url: pdfUrl } = await put(`reports/${report.id}.pdf`, pdfBuffer, { access: "public", contentType: "application/pdf" });

  await db.update(reports).set({ pdfUrl, status: "completed", completedAt: new Date() }).where(eq(reports.id, report.id));
  await db.update(testRuns).set({ status: "completed", completedAt: new Date() }).where(eq(testRuns.id, testRunId));

  return NextResponse.json({ testRunId }, { status: 201 });
}
