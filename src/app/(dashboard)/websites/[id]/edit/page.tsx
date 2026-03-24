import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { WebsiteForm } from "@/components/website-form";

export default async function EditWebsitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  const { id } = await params;

  const website = await db.query.websites.findFirst({
    where: and(eq(websites.id, id), eq(websites.userId, userId!), eq(websites.isActive, true)),
  });
  if (!website) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Edit Website</h1>
        <p className="text-sm text-zinc-500 mt-1">{website.name}</p>
      </div>
      <WebsiteForm website={website} />
    </div>
  );
}
