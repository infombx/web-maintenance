import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { websites, scrapes, testRuns } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TestRunCard } from "@/components/test-run-card";
import { WebsiteActions } from "@/components/website-actions";

export default async function WebsiteDetailPage({
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

  const [latestScrape, recentRuns] = await Promise.all([
    db.query.scrapes.findFirst({
      where: and(eq(scrapes.websiteId, id), eq(scrapes.type, "reference")),
      orderBy: [desc(scrapes.createdAt)],
    }),
    db.query.testRuns.findMany({
      where: eq(testRuns.websiteId, id),
      orderBy: [desc(testRuns.triggeredAt)],
      limit: 20,
    }),
  ]);

  const scrapeStatusColors = {
    pending: "secondary",
    running: "secondary",
    completed: "default",
    failed: "destructive",
  } as const;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/dashboard" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-zinc-900 truncate">{website.name}</h1>
          <a
            href={website.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 hover:text-zinc-700 flex items-center gap-1 mt-0.5"
          >
            {website.url}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/websites/${id}/edit`} />}>
          <Pencil className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </div>

      {website.requirements && (
        <div className="bg-zinc-50 rounded-lg p-4 text-sm text-zinc-600">
          <p className="font-medium text-zinc-800 mb-1">Test Requirements</p>
          <p className="whitespace-pre-wrap">{website.requirements}</p>
        </div>
      )}

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-zinc-800">Reference Baseline</h2>
        </div>

        {latestScrape ? (
          <div className="flex items-center gap-3 text-sm">
            <Badge variant={scrapeStatusColors[latestScrape.status]}>
              {latestScrape.status}
            </Badge>
            {latestScrape.status === "completed" && (
              <span className="text-zinc-500">
                {latestScrape.pagesDiscovered} pages captured —{" "}
                {formatDistanceToNow(new Date(latestScrape.createdAt), { addSuffix: true })}
              </span>
            )}
            {latestScrape.status === "failed" && (
              <span className="text-red-500">{latestScrape.errorMessage}</span>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">No baseline captured yet.</p>
        )}

        <WebsiteActions
          websiteId={id}
          hasScrape={latestScrape?.status === "completed"}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <h2 className="font-semibold text-zinc-800">Test History</h2>
        {recentRuns.length === 0 ? (
          <p className="text-sm text-zinc-400">No test runs yet.</p>
        ) : (
          <div className="space-y-2">
            {recentRuns.map((run) => (
              <TestRunCard key={run.id} testRun={run} websiteId={id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
