export interface ConsoleResult {
  status: "pass" | "fail" | "warning";
  details: {
    consoleErrors: string[];
    message?: string;
  };
}

export function checkConsoleErrors(errors: string[]): ConsoleResult {
  if (errors.length === 0) {
    return { status: "pass", details: { consoleErrors: [] } };
  }
  return {
    status: "warning",
    details: {
      consoleErrors: errors,
      message: `${errors.length} console error(s) detected`,
    },
  };
}
