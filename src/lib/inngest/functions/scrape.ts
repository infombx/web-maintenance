import { inngest } from "@/lib/inngest/client";
import { db } from "@/lib/db";
import { scrapes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { startCrawl, waitForCrawl, takeScreenshot } from "@/lib/cloudflare/browser";
import { uploadScreenshot, uploadHtml } from "@/lib/blob/storage";

export const scrapeFunction = inngest.createFunction(
  {
    id: "website-scrape",
    name: "Capture Reference Baseline",
    retries: 1,
    timeouts: { finish: "10m" },
    triggers: [{ event: "website/scrape.requested" }],
  },
  async ({ event, step }: { event: { data: { scrapeId: string; websiteId: string; url: string } }; step: any }) => {
    const { scrapeId, url } = event.data;

    await step.run("mark-running", async () => {
      await db.update(scrapes).set({ status: "running" }).where(eq(scrapes.id, scrapeId));
    });

    // Step 1: Crawl via Cloudflare — discovers all pages + their HTML
    const crawledPages = await step.run("cloudflare-crawl", async () => {
      const jobId = await startCrawl(url, 15);
      return waitForCrawl(jobId);
    });

    if (crawledPages.length === 0) {
      await db.update(scrapes)
        .set({ status: "failed", errorMessage: "No pages discovered during crawl" })
        .where(eq(scrapes.id, scrapeId));
      return { error: "No pages discovered" };
    }

    // Step 2: Screenshot all pages in parallel via Cloudflare
    const { screenshotUrls, htmlSnapshots } = await step.run("cloudflare-screenshots", async () => {
      const screenshotUrls: Record<string, string> = {};
      const htmlSnapshots: Record<string, string> = {};

      await Promise.all(
        crawledPages.map(async (page: { url: string; html?: string }) => {
          const safePath = page.url.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 100);

          try {
            const screenshot = await takeScreenshot(page.url);
            screenshotUrls[page.url] = await uploadScreenshot(
              screenshot,
              `reference/${scrapeId}/${safePath}.png`
            );
          } catch (err) {
            console.error(`Screenshot failed for ${page.url}:`, err);
          }

          if (page.html) {
            try {
              htmlSnapshots[page.url] = await uploadHtml(
                page.html,
                `reference/${scrapeId}/${safePath}.html`
              );
            } catch (err) {
              console.error(`HTML upload failed for ${page.url}:`, err);
            }
          }
        })
      );

      return { screenshotUrls, htmlSnapshots };
    });

    await step.run("mark-completed", async () => {
      await db
        .update(scrapes)
        .set({
          status: "completed",
          pagesDiscovered: crawledPages.length,
          screenshotUrls,
          htmlSnapshots,
          completedAt: new Date(),
        })
        .where(eq(scrapes.id, scrapeId));
    });

    return { pagesDiscovered: crawledPages.length };
  }
);
