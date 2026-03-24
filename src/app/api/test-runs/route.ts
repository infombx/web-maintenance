import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { websites, testRuns, scrapes } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
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

  // Must have a completed reference scrape
  const referenceScrape = await db.query.scrapes.findFirst({
    where: and(eq(scrapes.websiteId, websiteId), eq(scrapes.type, "reference"), eq(scrapes.status, "completed")),
    orderBy: [desc(scrapes.createdAt)],
  });
  if (!referenceScrape) {
    return NextResponse.json(
      { error: "No completed reference scrape found. Please run a reference scrape first." },
      { status: 400 }
    );
  }

  const [testRun] = await db
    .insert(testRuns)
    .values({ websiteId, triggeredBy: userId, status: "pending" })
    .returning();

  await inngest.send({
    name: "website/test.requested",
    data: {
      testRunId: testRun.id,
      websiteId,
      scrapeId: referenceScrape.id,
    },
  });

  return NextResponse.json({ testRunId: testRun.id }, { status: 201 });
}
