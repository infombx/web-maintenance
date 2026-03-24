import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { scrapeFunction } from "@/lib/inngest/functions/scrape";
import { testRunFunction } from "@/lib/inngest/functions/test-run";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scrapeFunction, testRunFunction],
});
