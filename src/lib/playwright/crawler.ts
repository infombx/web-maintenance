import type { Browser } from "playwright-core";

const EXCLUDED_PATTERNS = [
  /\/cdn-cgi\//,
  /\/#/,
  /\/wp-admin\//,
  /\.(pdf|jpg|jpeg|png|gif|svg|ico|css|js|woff|woff2|ttf|zip|mp4|mp3)$/i,
  /^mailto:/,
  /^tel:/,
  /^javascript:/,
];

function normalizeUrl(href: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(href, baseUrl);
    // Only same-origin
    const base = new URL(baseUrl);
    if (resolved.origin !== base.origin) return null;
    // Remove hash
    resolved.hash = "";
    return resolved.href;
  } catch {
    return null;
  }
}

function isExcluded(url: string): boolean {
  return EXCLUDED_PATTERNS.some((p) => p.test(url));
}

export async function crawlWebsite(
  browser: Browser,
  startUrl: string,
  maxPages = 30
): Promise<string[]> {
  const visited = new Set<string>();
  const queue: string[] = [normalizeUrl(startUrl, startUrl) ?? startUrl];

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (compatible; WebMaintainBot/1.0)",
    viewport: { width: 1280, height: 800 },
  });

  try {
    while (queue.length > 0 && visited.size < maxPages) {
      const url = queue.shift()!;
      if (visited.has(url) || isExcluded(url)) continue;
      visited.add(url);

      try {
        const page = await context.newPage();
        const response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });

        if (!response || response.status() >= 400) {
          await page.close();
          continue;
        }

        const hrefs = await page.$$eval("a[href]", (els) =>
          els.map((el) => (el as HTMLAnchorElement).href)
        );

        for (const href of hrefs) {
          const normalized = normalizeUrl(href, url);
          if (normalized && !visited.has(normalized) && !isExcluded(normalized)) {
            queue.push(normalized);
          }
        }

        await page.close();
      } catch {
        // Skip pages that fail to load during crawl
      }
    }
  } finally {
    await context.close();
  }

  return Array.from(visited);
}
