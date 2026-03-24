import type { Page, Response } from "playwright-core";

export interface PageLoadResult {
  status: "pass" | "fail";
  details: {
    httpStatus: number;
    message?: string;
  };
}

export async function checkPageLoad(response: Response | null): Promise<PageLoadResult> {
  if (!response) {
    return {
      status: "fail",
      details: { httpStatus: 0, message: "No response received" },
    };
  }

  const httpStatus = response.status();
  if (httpStatus >= 400) {
    return {
      status: "fail",
      details: { httpStatus, message: `HTTP ${httpStatus}` },
    };
  }

  return { status: "pass", details: { httpStatus } };
}
