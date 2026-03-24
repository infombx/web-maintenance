CREATE TYPE "public"."check_status" AS ENUM('pass', 'fail', 'warning');--> statement-breakpoint
CREATE TYPE "public"."check_type" AS ENUM('page_load', 'form_submission', 'link_check', 'visual_comparison', 'console_errors', 'performance');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('desktop', 'laptop', 'tablet', 'mobile');--> statement-breakpoint
CREATE TYPE "public"."scrape_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."scrape_type" AS ENUM('reference', 'test');--> statement-breakpoint
CREATE TYPE "public"."test_run_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_run_id" uuid NOT NULL,
	"website_id" uuid NOT NULL,
	"groq_summary" text,
	"groq_issue_details" jsonb,
	"pdf_url" text,
	"status" "scrape_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "reports_test_run_id_unique" UNIQUE("test_run_id")
);
--> statement-breakpoint
CREATE TABLE "scrapes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"type" "scrape_type" DEFAULT 'reference' NOT NULL,
	"status" "scrape_status" DEFAULT 'pending' NOT NULL,
	"pages_discovered" integer DEFAULT 0,
	"screenshot_urls" jsonb,
	"html_snapshots" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_run_id" uuid NOT NULL,
	"device_type" "device_type" NOT NULL,
	"page_url" text NOT NULL,
	"status" "check_status" NOT NULL,
	"check_type" "check_type" NOT NULL,
	"details" jsonb,
	"screenshot_url" text,
	"reference_screenshot_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"status" "test_run_status" DEFAULT 'pending' NOT NULL,
	"triggered_by" text NOT NULL,
	"total_tests" integer DEFAULT 0,
	"passed_tests" integer DEFAULT 0,
	"failed_tests" integer DEFAULT 0,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "websites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"name" text NOT NULL,
	"requirements" text,
	"form_prefill_data" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_test_run_id_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrapes" ADD CONSTRAINT "scrapes_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_test_run_id_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_test_run_id_idx" ON "reports" USING btree ("test_run_id");--> statement-breakpoint
CREATE INDEX "reports_website_id_idx" ON "reports" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "scrapes_website_id_idx" ON "scrapes" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "test_results_run_id_idx" ON "test_results" USING btree ("test_run_id");--> statement-breakpoint
CREATE INDEX "test_results_device_type_idx" ON "test_results" USING btree ("device_type");--> statement-breakpoint
CREATE INDEX "test_runs_website_id_idx" ON "test_runs" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "test_runs_status_idx" ON "test_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "websites_user_id_idx" ON "websites" USING btree ("user_id");