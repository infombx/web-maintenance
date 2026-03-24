import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reports, websites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const report = await db.query.reports.findFirst({
    where: eq(reports.id, id),
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const website = await db.query.websites.findFirst({
    where: and(eq(websites.id, report.websiteId), eq(websites.userId, userId)),
  });
  if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(report);
}
