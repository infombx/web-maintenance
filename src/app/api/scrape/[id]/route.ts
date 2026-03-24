import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scrapes, websites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const scrape = await db.query.scrapes.findFirst({
    where: eq(scrapes.id, id),
    with: { website: true },
  });

  if (!scrape) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify ownership through the website
  const website = await db.query.websites.findFirst({
    where: and(eq(websites.id, scrape.websiteId), eq(websites.userId, userId)),
  });
  if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(scrape);
}
