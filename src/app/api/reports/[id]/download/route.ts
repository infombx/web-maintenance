export const runtime = "nodejs";

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reports, websites, testResults } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generatePdf } from "@/lib/report/pdf";
import { put } from "@vercel/blob";

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

  // Return cached PDF if available
  if (report.pdfUrl) {
    return NextResponse.redirect(report.pdfUrl);
  }

  // Generate PDF on demand
  const results = await db.query.testResults.findMany({
    where: eq(testResults.testRunId, report.testRunId),
  });

  const pdfBuffer = await generatePdf({ report, website, results });

  const { url } = await put(`reports/${report.id}.pdf`, pdfBuffer, {
    access: "public",
    contentType: "application/pdf",
  });

  await db.update(reports).set({ pdfUrl: url }).where(eq(reports.id, id));

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="maintenance-report-${report.id}.pdf"`,
    },
  });
}
