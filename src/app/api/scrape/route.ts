import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { websites, scrapes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { takeScreenshot } from "@/lib/cloudflare/browser";
import { uploadScreenshot } from "@/lib/blob/storage";

export const maxDuration = 60;

/** Extract all https?:// URLs from the requirements text */
function extractUrls(text: string | null, fallback: string): string[] {
  if (!text) return [fallback];
  const found = [...text.matchAll(/https?:\/\/[^\s,)]+/g)].map(m => m[0]);
  return found.length > 0 ? [...new Set(found)] : [fallback];
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

  const urls = extractUrls(website.requirements, website.url);

  const [scrape] = await db
    .insert(scrapes)
    .values({ websiteId, type: "reference", status: "running" })
    .returning();

  try {
    const screenshotUrls: Record<string, string> = {};

    // Screenshot all pages in parallel
    await Promise.all(
      urls.map(async (url) => {
        try {
          const safePath = url.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 100);
          const screenshot = await takeScreenshot(url);
          screenshotUrls[url] = await uploadScreenshot(screenshot, `reference/${scrape.id}/${safePath}.png`);
        } catch (err) {
          console.error(`Screenshot failed for ${url}:`, err);
        }
      })
    );

    if (Object.keys(screenshotUrls).length === 0) {
      throw new Error("All screenshots failed");
    }

    await db.update(scrapes).set({
      status: "completed",
      pagesDiscovered: Object.keys(screenshotUrls).length,
      screenshotUrls,
      htmlSnapshots: {},
      completedAt: new Date(),
    }).where(eq(scrapes.id, scrape.id));

    return NextResponse.json({ scrapeId: scrape.id, status: "completed", pages: Object.keys(screenshotUrls).length }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await db.update(scrapes).set({ status: "failed", errorMessage: msg }).where(eq(scrapes.id, scrape.id));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
