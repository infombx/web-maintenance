import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { websites, testRuns, scrapes } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  requirements: z.string().optional(),
  formPrefillData: z
    .array(
      z.object({
        selector: z.string(),
        value: z.string(),
        label: z.string(),
      })
    )
    .optional(),
});

async function getOwnedWebsite(id: string, userId: string) {
  return db.query.websites.findFirst({
    where: and(eq(websites.id, id), eq(websites.userId, userId), eq(websites.isActive, true)),
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const website = await getOwnedWebsite(id, userId);
  if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [latestScrape, recentRuns] = await Promise.all([
    db.query.scrapes.findFirst({
      where: and(eq(scrapes.websiteId, id)),
      orderBy: [desc(scrapes.createdAt)],
    }),
    db.query.testRuns.findMany({
      where: eq(testRuns.websiteId, id),
      orderBy: [desc(testRuns.triggeredAt)],
      limit: 10,
    }),
  ]);

  return NextResponse.json({ ...website, latestScrape, testRuns: recentRuns });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const website = await getOwnedWebsite(id, userId);
  if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(websites)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(websites.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const website = await getOwnedWebsite(id, userId);
  if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.update(websites).set({ isActive: false }).where(eq(websites.id, id));

  return NextResponse.json({ success: true });
}
