import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

export interface VisualResult {
  status: "pass" | "fail" | "warning";
  details: {
    visualDiffPercent?: number;
    message?: string;
  };
}

export async function checkVisual(
  currentScreenshot: Buffer,
  referenceUrl: string | null
): Promise<VisualResult> {
  if (!referenceUrl) {
    return {
      status: "warning",
      details: { message: "No reference screenshot available for comparison" },
    };
  }

  try {
    const refResponse = await fetch(referenceUrl);
    if (!refResponse.ok) {
      return {
        status: "warning",
        details: { message: "Could not fetch reference screenshot" },
      };
    }
    const refBuffer = Buffer.from(await refResponse.arrayBuffer());

    const currentPng = PNG.sync.read(currentScreenshot);
    const refPng = PNG.sync.read(refBuffer);

    // Resize to same dimensions if they differ
    const width = Math.min(currentPng.width, refPng.width);
    const height = Math.min(currentPng.height, refPng.height);

    const diffPng = new PNG({ width, height });

    const mismatch = pixelmatch(
      currentPng.data,
      refPng.data,
      diffPng.data,
      width,
      height,
      { threshold: 0.1 }
    );

    const totalPixels = width * height;
    const diffPercent = (mismatch / totalPixels) * 100;

    if (diffPercent > 10) {
      return {
        status: "fail",
        details: {
          visualDiffPercent: Math.round(diffPercent * 100) / 100,
          message: `${diffPercent.toFixed(1)}% visual difference from reference`,
        },
      };
    }

    if (diffPercent > 5) {
      return {
        status: "warning",
        details: {
          visualDiffPercent: Math.round(diffPercent * 100) / 100,
          message: `${diffPercent.toFixed(1)}% minor visual difference from reference`,
        },
      };
    }

    return {
      status: "pass",
      details: { visualDiffPercent: Math.round(diffPercent * 100) / 100 },
    };
  } catch (err) {
    return {
      status: "warning",
      details: { message: `Visual comparison failed: ${String(err)}` },
    };
  }
}
