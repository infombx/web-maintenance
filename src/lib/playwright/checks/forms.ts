import type { Page } from "playwright-core";

export interface FormsResult {
  status: "pass" | "fail" | "warning";
  details: {
    formSuccess?: boolean;
    formErrors?: string[];
    message?: string;
    formsFound?: number;
  };
}

interface PrefillField {
  selector: string;
  value: string;
  label: string;
}

export async function checkForms(
  page: Page,
  prefillData: PrefillField[]
): Promise<FormsResult> {
  const formCount = await page.$$eval("form", (els) => els.length);

  if (formCount === 0) {
    return {
      status: "pass",
      details: { formsFound: 0, message: "No forms found on this page" },
    };
  }

  if (prefillData.length === 0) {
    return {
      status: "warning",
      details: {
        formsFound: formCount,
        message: `${formCount} form(s) found but no prefill data configured`,
      },
    };
  }

  const errors: string[] = [];

  for (const field of prefillData) {
    try {
      const el = await page.$(field.selector);
      if (!el) {
        errors.push(`Field "${field.label}" not found (${field.selector})`);
        continue;
      }
      const tagName = await el.evaluate((e) => e.tagName.toLowerCase());
      if (tagName === "select") {
        await el.selectOption(field.value);
      } else {
        await el.fill(field.value);
      }
    } catch (err) {
      errors.push(`Failed to fill "${field.label}": ${String(err)}`);
    }
  }

  if (errors.length > 0) {
    return {
      status: "fail",
      details: { formErrors: errors, formSuccess: false, message: errors.join("; ") },
    };
  }

  return {
    status: "pass",
    details: { formSuccess: true, formsFound: formCount },
  };
}
