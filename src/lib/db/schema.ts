import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  pgEnum,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const scrapeTypeEnum = pgEnum("scrape_type", ["reference", "test"]);
export const scrapeStatusEnum = pgEnum("scrape_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);
export const testRunStatusEnum = pgEnum("test_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);
export const checkStatusEnum = pgEnum("check_status", [
  "pass",
  "fail",
  "warning",
]);
export const deviceTypeEnum = pgEnum("device_type", [
  "desktop",
  "laptop",
  "tablet",
  "mobile",
]);
export const checkTypeEnum = pgEnum("check_type", [
  "page_load",
  "form_submission",
  "link_check",
  "visual_comparison",
  "console_errors",
  "performance",
]);

// ─── Tables ──────────────────────────────────────────────────────────────────

export const websites = pgTable(
  "websites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    url: text("url").notNull(),
    name: text("name").notNull(),
    requirements: text("requirements"),
    formPrefillData: jsonb("form_prefill_data").$type<
      Array<{ selector: string; value: string; label: string }>
    >(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("websites_user_id_idx").on(t.userId)]
);

export const scrapes = pgTable(
  "scrapes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    type: scrapeTypeEnum("type").notNull().default("reference"),
    status: scrapeStatusEnum("status").notNull().default("pending"),
    pagesDiscovered: integer("pages_discovered").default(0),
    screenshotUrls: jsonb("screenshot_urls").$type<Record<string, string>>(),
    htmlSnapshots: jsonb("html_snapshots").$type<Record<string, string>>(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [index("scrapes_website_id_idx").on(t.websiteId)]
);

export const testRuns = pgTable(
  "test_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    status: testRunStatusEnum("status").notNull().default("pending"),
    triggeredBy: text("triggered_by").notNull(),
    totalTests: integer("total_tests").default(0),
    passedTests: integer("passed_tests").default(0),
    failedTests: integer("failed_tests").default(0),
    triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [
    index("test_runs_website_id_idx").on(t.websiteId),
    index("test_runs_status_idx").on(t.status),
  ]
);

export const testResults = pgTable(
  "test_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testRunId: uuid("test_run_id")
      .notNull()
      .references(() => testRuns.id, { onDelete: "cascade" }),
    deviceType: deviceTypeEnum("device_type").notNull(),
    pageUrl: text("page_url").notNull(),
    status: checkStatusEnum("status").notNull(),
    checkType: checkTypeEnum("check_type").notNull(),
    details: jsonb("details").$type<{
      message?: string;
      httpStatus?: number;
      consoleErrors?: string[];
      brokenLinks?: Array<{ url: string; status: number }>;
      lcp?: number;
      fcp?: number;
      visualDiffPercent?: number;
      formSuccess?: boolean;
      formErrors?: string[];
    }>(),
    screenshotUrl: text("screenshot_url"),
    referenceScreenshotUrl: text("reference_screenshot_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("test_results_run_id_idx").on(t.testRunId),
    index("test_results_device_type_idx").on(t.deviceType),
  ]
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testRunId: uuid("test_run_id")
      .notNull()
      .references(() => testRuns.id, { onDelete: "cascade" })
      .unique(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    groqSummary: text("groq_summary"),
    groqIssueDetails: jsonb("groq_issue_details").$type<
      Array<{
        device: string;
        page: string;
        checkType: string;
        description: string;
        severity: "critical" | "warning" | "info";
      }>
    >(),
    pdfUrl: text("pdf_url"),
    status: scrapeStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [
    index("reports_test_run_id_idx").on(t.testRunId),
    index("reports_website_id_idx").on(t.websiteId),
  ]
);

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type Website = typeof websites.$inferSelect;
export type NewWebsite = typeof websites.$inferInsert;
export type Scrape = typeof scrapes.$inferSelect;
export type NewScrape = typeof scrapes.$inferInsert;
export type TestRun = typeof testRuns.$inferSelect;
export type NewTestRun = typeof testRuns.$inferInsert;
export type TestResult = typeof testResults.$inferSelect;
export type NewTestResult = typeof testResults.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
