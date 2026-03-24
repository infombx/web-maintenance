import Groq from "groq-sdk";
import type { TestResult, Website } from "@/lib/db/schema";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface IssueDetail {
  device: string;
  page: string;
  checkType: string;
  description: string;
  severity: "critical" | "warning" | "info";
}

export async function analyzeTestResults(
  results: TestResult[],
  website: Website
): Promise<{ summary: string; issueDetails: IssueDetail[] }> {
  const failed = results.filter((r) => r.status === "fail");
  const warned = results.filter((r) => r.status === "warning");
  const passed = results.filter((r) => r.status === "pass");

  if (failed.length === 0 && warned.length === 0) {
    return {
      summary: `All ${passed.length} checks passed across all devices for ${website.name}. The website is functioning correctly.`,
      issueDetails: [],
    };
  }

  const issueLines = [...failed, ...warned]
    .map(
      (r) =>
        `- [${r.deviceType.toUpperCase()}] ${r.pageUrl} | Check: ${r.checkType} | Status: ${r.status} | Details: ${JSON.stringify(r.details)}`
    )
    .join("\n");

  const prompt = `You are a web quality assurance expert writing a maintenance report for a client website.

Website: ${website.name} (${website.url})
Total checks: ${results.length}
Passed: ${passed.length}
Failed: ${failed.length}
Warnings: ${warned.length}

ISSUES FOUND:
${issueLines}

Please provide:
1. A 2-3 paragraph executive summary of the website's overall health, written for a non-technical client. Mention what works well and what needs attention.
2. For each issue, a plain-English description of what the problem is and why it matters to the end user.

Return ONLY valid JSON in this exact format:
{
  "summary": "...",
  "issues": [
    {
      "device": "desktop|laptop|tablet|mobile",
      "page": "the page URL",
      "checkType": "the check type",
      "description": "plain English description of the issue and its impact",
      "severity": "critical|warning|info"
    }
  ]
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2048,
    });

    const content = completion.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(content);

    return {
      summary: parsed.summary ?? "Analysis complete.",
      issueDetails: (parsed.issues ?? []) as IssueDetail[],
    };
  } catch (err) {
    console.error("Groq analysis failed:", err);
    return {
      summary: `Analysis complete. ${failed.length} failures and ${warned.length} warnings detected across ${results.length} total checks for ${website.name}.`,
      issueDetails: [...failed, ...warned].map((r) => ({
        device: r.deviceType,
        page: r.pageUrl,
        checkType: r.checkType,
        description: String(r.details?.message ?? "Issue detected"),
        severity: r.status === "fail" ? ("critical" as const) : ("warning" as const),
      })),
    };
  }
}
