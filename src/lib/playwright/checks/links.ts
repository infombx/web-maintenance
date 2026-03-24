import type { Page } from "playwright-core";

export interface LinksResult {
  status: "pass" | "fail" | "warning";
  details: {
    brokenLinks: Array<{ url: string; status: number }>;
    message?: string;
  };
}

export async function checkLinks(page: Page): Promise<LinksResult> {
  const baseOrigin = new URL(page.url()).origin;

  const hrefs: string[] = await page.$$eval("a[href]", (els) =>
    [...new Set(els.map((el) => (el as HTMLAnchorElement).href))]
  );

  const sameDomainLinks = hrefs.filter((href) => {
    try {
      return new URL(href).origin === baseOrigin && !href.includes("#");
    } catch {
      return false;
    }
  });

  const brokenLinks: Array<{ url: string; status: number }> = [];

  // Check links in batches of 5
  for (let i = 0; i < sameDomainLinks.length; i += 5) {
    const batch = sameDomainLinks.slice(i, i + 5);
    await Promise.all(
      batch.map(async (url) => {
        try {
          const context = page.context();
          const tempPage = await context.newPage();
          const response = await tempPage.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 10000,
          });
          const status = response?.status() ?? 0;
          if (status >= 400) {
            brokenLinks.push({ url, status });
          }
          await tempPage.close();
        } catch {
          brokenLinks.push({ url, status: 0 });
        }
      })
    );
  }

  if (brokenLinks.length === 0) {
    return { status: "pass", details: { brokenLinks: [] } };
  }

  return {
    status: "fail",
    details: {
      brokenLinks,
      message: `${brokenLinks.length} broken link(s) found`,
    },
  };
}
