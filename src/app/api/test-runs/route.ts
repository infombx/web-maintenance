import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { websites, testRuns, testResults, reports, scrapes } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { takeScreenshot } from "@/lib/cloudflare/browser";
import { checkVisual } from "@/lib/playwright/checks/visual";
import { uploadScreenshot } from "@/lib/blob/storage";
import { analyzeTestResults } from "@/lib/groq/analyze";
import { generatePdf } from "@/lib/report/pdf";
import { put } from "@vercel/blob";
import { DEVICES, type DeviceKey } from "@/lib/playwright/devices";

export const maxDuration = 60;

/** Run tasks with max concurrency */
async function pLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  let i = 0;
  async function run(): Promise<void> {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, run));
  return results;
}

// Lightweight page-load check via fetch
async function httpCheck(url: string) {
  try {
    const start = Date.now();
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10000) });
    const ttfb = Date.now() - start;
    const text = await res.text();
    if (res.status >= 400) {
      return { pageLoad: { status: "fail" as const, details: { httpStatus: res.status, message: `HTTP ${res.status}` } }, html: "", ttfb };
    }
    return { pageLoad: { status: "pass" as const, details: { httpStatus: res.status } }, html: text, ttfb };
  } catch (err) {
    return { pageLoad: { status: "fail" as const, details: { httpStatus: 0, message: String(err) } }, html: "", ttfb: 0 };
  }
}

// Extract and check links from HTML
async function checkLinks(html: string, baseUrl: string) {
  try {
    const base = new URL(baseUrl);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    const internal = hrefs
      .filter(h => h.startsWith("/") || h.startsWith(base.origin))
      .map(h => h.startsWith("/") ? base.origin + h : h)
      .filter((h, i, a) => a.indexOf(h) === i)
      .slice(0, 10); // max 10 links

    const broken: Array<{ url: string; status: number }> = [];
    await Promise.all(internal.map(async (href) => {
      try {
        const r = await fetch(href, { method: "HEAD", signal: AbortSignal.timeout(5000), redirect: "follow" });
        if (r.status >= 400) broken.push({ url: href, status: r.status });
      } catch {
        broken.push({ url: href, status: 0 });
      }
    }));

    if (broken.length > 0) {
      return { status: "fail" as const, details: { brokenLinks: broken, message: `${broken.length} broken link(s) found` } };
    }
    return { status: "pass" as const, details: { message: `${internal.length} links OK` } };
  } catch {
    return { status: "warning" as const, details: { message: "Link check failed" } };
  }
}

// Performance check from TTFB
function perfCheck(ttfb: number) {
  if (ttfb > 3000) return { status: "fail" as const, details: { ttfb, message: `Slow response: ${ttfb}ms TTFB` } };
  if (ttfb > 1500) return { status: "warning" as const, details: { ttfb, message: `Moderate response: ${ttfb}ms TTFB` } };
  return { status: "pass" as const, details: { ttfb, message: `${ttfb}ms TTFB` } };
}

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
  // Visual screenshots for desktop + mobile only to stay within time/rate limits
  const visualDevices: DeviceKey[] = ["desktop", "mobile"];
  const allDevices: DeviceKey[] = ["desktop", "laptop", "tablet", "mobile"];

  let totalTests = 0, passedTests = 0, failedTests = 0;

  try {
    // HTTP checks for all pages in parallel (fast, no browser)
    const pageChecks = await Promise.all(pageUrls.map(async (pageUrl) => {
      const { pageLoad, html, ttfb } = await httpCheck(pageUrl);
      const linksResult = await checkLinks(html, pageUrl);
      const perfResult = perfCheck(ttfb);
      return { pageUrl, pageLoad, linksResult, perfResult };
    }));

    // Visual screenshots: desktop + mobile, max 3 concurrent Cloudflare requests
    const screenshotTasks = pageUrls.flatMap((pageUrl) =>
      visualDevices.map((deviceKey) => async () => {
        const device = DEVICES[deviceKey];
        const safePath = pageUrl.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 80);
        const referenceScreenshotUrl = (referenceScrape.screenshotUrls as Record<string, string>)[pageUrl] ?? null;
        let screenshotUrl: string | undefined;
        let visualResult: { status: "pass" | "fail" | "warning"; details: Record<string, unknown> } = {
          status: "warning", details: { message: "Screenshot unavailable" },
        };
        try {
          const buf = await takeScreenshot(pageUrl, { width: device.width, height: device.height });
          screenshotUrl = await uploadScreenshot(buf, `test-runs/${testRunId}/${deviceKey}/${safePath}.png`);
          visualResult = await checkVisual(buf, referenceScreenshotUrl);
        } catch (err) {
          visualResult = { status: "warning", details: { message: `Screenshot failed: ${String(err)}` } };
        }
        return { pageUrl, deviceKey, screenshotUrl, visualResult, referenceScreenshotUrl };
      })
    );
    const screenshotResults = await pLimit(screenshotTasks, 3);

    // Build a lookup: pageUrl+device → screenshot data
    const screenshotMap = new Map(
      screenshotResults.map(r => [`${r.pageUrl}::${r.deviceKey}`, r])
    );

    // Insert all test results
    for (const { pageUrl, pageLoad, linksResult, perfResult } of pageChecks) {
      for (const deviceKey of allDevices) {
        const screenshotData = screenshotMap.get(`${pageUrl}::${deviceKey}`);
        const screenshotUrl = screenshotData?.screenshotUrl;
        const referenceScreenshotUrl = (referenceScrape.screenshotUrls as Record<string, string>)[pageUrl] ?? null;
        const visualResult = screenshotData?.visualResult ?? { status: "warning" as const, details: { message: "Visual check skipped for this device" } };

        const checks = [
          { checkType: "page_load" as const, result: pageLoad },
          { checkType: "link_check" as const, result: linksResult },
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            details: result.details as any,
            screenshotUrl,
            referenceScreenshotUrl: referenceScreenshotUrl ?? undefined,
          });
          totalTests++;
          if (result.status === "pass") passedTests++;
          else if (result.status === "fail") failedTests++;
        }
      }
    }

    await db.update(testRuns).set({ totalTests, passedTests, failedTests }).where(eq(testRuns.id, testRunId));

    // Groq analysis
    const allResults = await db.query.testResults.findMany({ where: eq(testResults.testRunId, testRunId) });
    const { summary, issueDetails } = await analyzeTestResults(allResults, website);

    const [report] = await db.insert(reports).values({
      testRunId, websiteId, groqSummary: summary, groqIssueDetails: issueDetails, status: "running",
    }).returning();

    const pdfBuffer = await generatePdf({ report, website, results: allResults });
    const { url: pdfUrl } = await put(`reports/${report.id}.pdf`, pdfBuffer, { access: "public", contentType: "application/pdf" });

    await db.update(reports).set({ pdfUrl, status: "completed", completedAt: new Date() }).where(eq(reports.id, report.id));
    await db.update(testRuns).set({ status: "completed", completedAt: new Date() }).where(eq(testRuns.id, testRunId));

    return NextResponse.json({ testRunId }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(testRuns).set({ status: "failed" }).where(eq(testRuns.id, testRunId));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
