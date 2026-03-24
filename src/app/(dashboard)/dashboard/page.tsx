import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Globe, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const { userId } = await auth();
  const allWebsites = await db.query.websites.findMany({
    where: and(eq(websites.userId, userId!), eq(websites.isActive, true)),
    orderBy: (w, { desc }) => [desc(w.createdAt)],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {allWebsites.length} website{allWebsites.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/websites/new" />}>
          <Plus className="h-4 w-4 mr-2" />
          Add Website
        </Button>
      </div>

      {allWebsites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Globe className="h-12 w-12 text-zinc-300 mb-4" />
          <h2 className="text-lg font-medium text-zinc-700">No websites yet</h2>
          <p className="text-sm text-zinc-400 mt-1 mb-6">
            Add your first client website to start running maintenance tests.
          </p>
          <Button nativeButton={false} render={<Link href="/websites/new" />}>
            <Plus className="h-4 w-4 mr-2" />
            Add Website
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allWebsites.map((site) => (
            <Link key={site.id} href={`/websites/${site.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{site.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-zinc-500 truncate">{site.url}</p>
                  <p className="text-xs text-zinc-400">
                    Added {formatDistanceToNow(new Date(site.createdAt), { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
