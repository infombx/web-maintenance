"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ScrapeStatusPoller({ scrapeId }: { scrapeId: string }) {
  const router = useRouter();

  const { data } = useSWR(`/api/scrape/${scrapeId}`, fetcher, {
    refreshInterval: 3000,
  });

  useEffect(() => {
    if (data?.status === "completed" || data?.status === "failed") {
      router.refresh();
    }
  }, [data?.status, router]);

  return null;
}
