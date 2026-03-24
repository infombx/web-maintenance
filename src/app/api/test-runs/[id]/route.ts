import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testRuns, testResults, websites, reports } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const testRun = await db.query.testRuns.findFirst({
    where: eq(testRuns.id, id),
  });
  if (!testRun) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify ownership
  const website = await db.query.websites.findFirst({
    where: and(eq(websites.id, testRun.websiteId), eq(websites.userId, userId)),
  });
  if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [results, report] = await Promise.all([
    db.query.testResults.findMany({
      where: eq(testResults.testRunId, id),
      orderBy: (r, { asc }) => [asc(r.deviceType), asc(r.pageUrl)],
    }),
    db.query.reports.findFirst({
      where: eq(reports.testRunId, id),
    }),
  ]);

  return NextResponse.json({ ...testRun, results, report });
}
