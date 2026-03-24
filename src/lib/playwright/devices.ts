export const DEVICES = {
  desktop: {
    width: 1920,
    height: 1080,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    label: "Desktop (1920×1080)",
    isMobile: false,
  },
  laptop: {
    width: 1366,
    height: 768,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    label: "Laptop (1366×768)",
    isMobile: false,
  },
  tablet: {
    width: 393,
    height: 851,
    userAgent:
      "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    label: "Tablet / Android (Pixel 5)",
    isMobile: true,
  },
  mobile: {
    width: 390,
    height: 844,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
    label: "Mobile / iPhone 12",
    isMobile: true,
  },
} as const;

export type DeviceKey = keyof typeof DEVICES;
