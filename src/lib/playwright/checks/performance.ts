import type { Page } from "playwright-core";

export interface PerformanceResult {
  status: "pass" | "fail" | "warning";
  details: {
    lcp?: number;
    fcp?: number;
    message?: string;
  };
}

export async function checkPerformance(page: Page): Promise<PerformanceResult> {
  try {
    const metrics = await page.evaluate(() => {
      return new Promise<{ lcp?: number; fcp?: number }>((resolve) => {
        const result: { lcp?: number; fcp?: number } = {};
        let resolved = false;

        const finish = () => {
          if (!resolved) {
            resolved = true;
            resolve(result);
          }
        };

        try {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) {
              result.lcp = entries[entries.length - 1].startTime;
            }
          });
          lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
        } catch {}

        try {
          const fcpObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.name === "first-contentful-paint") {
                result.fcp = entry.startTime;
              }
            }
          });
          fcpObserver.observe({ type: "paint", buffered: true });
        } catch {}

        // Give observers 2 seconds then resolve
        setTimeout(finish, 2000);
      });
    });

    const { lcp, fcp } = metrics;

    // LCP > 4s = fail, 2.5s-4s = warning, < 2.5s = pass
    if (lcp && lcp > 4000) {
      return {
        status: "fail",
        details: { lcp, fcp, message: `LCP ${(lcp / 1000).toFixed(2)}s exceeds 4s threshold` },
      };
    }
    if (lcp && lcp > 2500) {
      return {
        status: "warning",
        details: { lcp, fcp, message: `LCP ${(lcp / 1000).toFixed(2)}s needs improvement` },
      };
    }

    return { status: "pass", details: { lcp, fcp } };
  } catch (err) {
    return {
      status: "warning",
      details: { message: `Performance check failed: ${String(err)}` },
    };
  }
}
