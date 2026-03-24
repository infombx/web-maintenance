import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { websites, scrapes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { inngest } from "@/lib/inngest/client";

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
    .values({ websiteId, type: "reference", status: "pending" })
    .returning();

  await inngest.send({
    name: "website/scrape.requested",
    data: { scrapeId: scrape.id, websiteId, url: website.url },
  });

  return NextResponse.json({ scrapeId: scrape.id }, { status: 201 });
}
