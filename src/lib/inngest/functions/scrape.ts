import { inngest } from "@/lib/inngest/client";
import { db } from "@/lib/db";
import { scrapes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { takeScreenshot } from "@/lib/cloudflare/browser";
import { uploadScreenshot } from "@/lib/blob/storage";

export const scrapeFunction = inngest.createFunction(
  {
    id: "website-scrape",
    name: "Capture Reference Baseline",
    retries: 1,
    timeouts: { finish: "3m" },
    triggers: [{ event: "website/scrape.requested" }],
  },
  async ({ event, step }: { event: { data: { scrapeId: string; websiteId: string; url: string } }; step: any }) => {
    const { scrapeId, url } = event.data;

    await step.run("mark-running", async () => {
      await db.update(scrapes).set({ status: "running" }).where(eq(scrapes.id, scrapeId));
    });

    // Take a screenshot directly — no crawl needed, much faster
    const screenshotUrls = await step.run("cloudflare-screenshot", async () => {
      const safePath = url.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 100);
      const screenshot = await takeScreenshot(url);
      const blobUrl = await uploadScreenshot(
        screenshot,
        `reference/${scrapeId}/${safePath}.png`
      );
      return { [url]: blobUrl };
    });

    await step.run("mark-completed", async () => {
      await db
        .update(scrapes)
        .set({
          status: "completed",
          pagesDiscovered: 1,
          screenshotUrls,
          htmlSnapshots: {},
          completedAt: new Date(),
        })
        .where(eq(scrapes.id, scrapeId));
    });

    return { pagesDiscovered: 1 };
  }
);
