const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering`;

const authHeaders = () => ({
  Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
  "Content-Type": "application/json",
});

export interface CrawlPage {
  url: string;
  html?: string;
}

/** Start an async crawl job. Returns the job ID. */
export async function startCrawl(url: string, limit = 15): Promise<string> {
  const res = await fetch(`${CF_BASE}/crawl`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      url,
      limit,
      formats: ["html"],
      render: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudflare crawl start failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { result: { id: string } };
  return data.result.id;
}

/** Poll a crawl job until completed or errored. Polls every 4s, up to 3 minutes. */
export async function waitForCrawl(jobId: string): Promise<CrawlPage[]> {
  const maxAttempts = 90; // 90 × 2s = 3 min max

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(`${CF_BASE}/crawl/${jobId}`, {
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
    });

    if (!res.ok) throw new Error(`Crawl poll failed (${res.status})`);

    const data = await res.json() as {
      result: { status: string; pages?: CrawlPage[] };
    };

    const { status, pages } = data.result;

    if (status === "completed") return pages ?? [];
    if (status === "errored") throw new Error("Cloudflare crawl errored");
    if (status.startsWith("cancelled")) throw new Error(`Crawl cancelled: ${status}`);
    // status === "running" → keep polling
  }

  throw new Error("Cloudflare crawl timed out after 3 minutes");
}

/** Take a full-page screenshot via Cloudflare. Returns a PNG Buffer. */
export async function takeScreenshot(
  url: string,
  viewport = { width: 1280, height: 800 }
): Promise<Buffer> {
  const res = await fetch(`${CF_BASE}/screenshot`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      url,
      viewport,
      screenshotOptions: { fullPage: true, type: "png" },
      gotoOptions: { waitUntil: "load", timeout: 15000 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Screenshot failed for ${url} (${res.status}): ${await res.text()}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
