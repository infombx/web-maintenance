import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { websites, scrapes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { takeScreenshot } from "@/lib/cloudflare/browser";
import { uploadScreenshot } from "@/lib/blob/storage";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { websiteId } = await req.json();
  if (!websiteId) return NextResponse.json({ error: "websiteId required" }, { status: 400 });

  const website = await db.query.websites.findFirst({
    where: and(eq(websites.id, websiteId), eq(websites.userId, userId), eq(websites.isActive, true)),
  });
  if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [scrape] = await db
    .insert(scrapes)
    .values({ websiteId, type: "reference", status: "running" })
    .returning();

  try {
    const safePath = website.url.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 100);
    const screenshot = await takeScreenshot(website.url);
    const blobUrl = await uploadScreenshot(screenshot, `reference/${scrape.id}/${safePath}.png`);

    await db.update(scrapes).set({
      status: "completed",
      pagesDiscovered: 1,
      screenshotUrls: { [website.url]: blobUrl },
      htmlSnapshots: {},
      completedAt: new Date(),
    }).where(eq(scrapes.id, scrape.id));

    return NextResponse.json({ scrapeId: scrape.id, status: "completed" }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await db.update(scrapes).set({ status: "failed", errorMessage: msg }).where(eq(scrapes.id, scrape.id));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
