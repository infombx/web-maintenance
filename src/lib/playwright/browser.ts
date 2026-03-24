import playwright from "playwright-core";

export async function getBrowser() {
  const isVercel = process.env.VERCEL === "1";

  if (isVercel) {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const executablePath = await chromium.executablePath(
      process.env.CHROMIUM_REMOTE_URL!
    );
    return playwright.chromium.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
  }

  // Local: use system-installed Playwright chromium
  return playwright.chromium.launch({ headless: true });
}
