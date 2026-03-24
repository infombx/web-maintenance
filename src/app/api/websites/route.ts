import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
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

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results = await db.query.websites.findMany({
    where: and(eq(websites.userId, userId), eq(websites.isActive, true)),
    orderBy: (w, { desc }) => [desc(w.createdAt)],
  });

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [website] = await db
    .insert(websites)
    .values({ ...parsed.data, userId })
    .returning();

  return NextResponse.json(website, { status: 201 });
}
