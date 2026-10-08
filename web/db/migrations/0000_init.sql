CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"site_id" uuid,
	"site_title" text NOT NULL,
	"site_date" text NOT NULL,
	"title" text NOT NULL,
	"body" text[] NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT '초안' NOT NULL,
	"url" text,
	"billed_this_month" boolean DEFAULT false NOT NULL,
	"approved_on" text,
	"published_at" timestamp with time zone,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"billed_on" date NOT NULL,
	"item" text NOT NULL,
	"method" text NOT NULL,
	"amount" integer NOT NULL,
	"state" text NOT NULL,
	"payer" text,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"partner_id" uuid PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"registrar" text DEFAULT '가비아' NOT NULL,
	"connection" text DEFAULT '미연결' NOT NULL,
	"certificate" text DEFAULT '대기' NOT NULL,
	"verify_token" text NOT NULL,
	"checked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "generation_assignments" (
	"run_id" uuid NOT NULL,
	"region" text NOT NULL,
	"draft_label" text NOT NULL,
	"photo_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"override" boolean DEFAULT false NOT NULL,
	CONSTRAINT "generation_assignments_run_id_region_pk" PRIMARY KEY("run_id","region")
);
--> statement-breakpoint
CREATE TABLE "generation_drafts" (
	"run_id" uuid NOT NULL,
	"label" text NOT NULL,
	"style" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"picked" boolean DEFAULT false NOT NULL,
	"partner_like" boolean DEFAULT false NOT NULL,
	"partner_note" text DEFAULT '' NOT NULL,
	CONSTRAINT "generation_drafts_run_id_label_pk" PRIMARY KEY("run_id","label")
);
--> statement-breakpoint
CREATE TABLE "generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"page_type" text NOT NULL,
	"regions" text[] NOT NULL,
	"draft_count" integer NOT NULL,
	"status" text DEFAULT '사진 연결' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "industries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT '사용 가능' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "industries_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "industry_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"industry_id" uuid NOT NULL,
	"group" text NOT NULL,
	"label" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"page_id" uuid,
	"page_title" text,
	"page_type" text,
	"channel" text DEFAULT '폼' NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"body" text,
	"status" text DEFAULT '신규' NOT NULL,
	"verify" text DEFAULT '확인 중' NOT NULL,
	"amount" integer,
	"needs_result" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"will_fail_again" boolean DEFAULT false NOT NULL,
	"tries" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_key" text NOT NULL,
	"query" text NOT NULL,
	"industry" text NOT NULL,
	"partner_id" uuid,
	"captured_on" date NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"blur" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_memos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"user_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"company" text NOT NULL,
	"manager" text,
	"phone" text NOT NULL,
	"email" text,
	"homepage" text,
	"message" text,
	"industry" text NOT NULL,
	"regions" text[] DEFAULT '{}'::text[] NOT NULL,
	"request_type" text DEFAULT 'new' NOT NULL,
	"source_form" text,
	"status" text DEFAULT '신규' NOT NULL,
	"owner_user_id" uuid,
	"partner_id" uuid
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"login_id" text PRIMARY KEY NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"page_id" uuid,
	"query" text NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"period" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"site_id" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"path" text,
	"lang" text DEFAULT 'ko' NOT NULL,
	"status" text DEFAULT '작성 중' NOT NULL,
	"visits_30d" integer DEFAULT 0 NOT NULL,
	"unique_ratio" real,
	"published_at" timestamp with time zone,
	"index_requested_at" timestamp with time zone,
	"indexed_at" timestamp with time zone,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_features" (
	"partner_id" uuid PRIMARY KEY NOT NULL,
	"alim" boolean DEFAULT true NOT NULL,
	"blog" text DEFAULT '꺼짐' NOT NULL,
	"place" boolean DEFAULT false NOT NULL,
	"ml" boolean DEFAULT false NOT NULL,
	"sheet" boolean DEFAULT false NOT NULL,
	"ml_config" jsonb
);
--> statement-breakpoint
CREATE TABLE "partner_regions" (
	"partner_id" uuid NOT NULL,
	"region" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "partner_regions_partner_id_region_pk" PRIMARY KEY("partner_id","region")
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"ceo" text,
	"biz_reg_no" text,
	"tel" text,
	"manager" text,
	"mobile" text,
	"email" text,
	"industry_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" text DEFAULT '준비 중' NOT NULL,
	"scope" text DEFAULT '기본' NOT NULL,
	"pay_mode" text DEFAULT '계좌 입금' NOT NULL,
	"brand_color" text,
	"mark" text,
	"drive_folder_url" text,
	"drive_connected" boolean DEFAULT false NOT NULL,
	"drive_synced_at" timestamp with time zone,
	"started_at" date,
	"ended_at" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"site_id" uuid,
	"file_key" text NOT NULL,
	"taken_at" timestamp with time zone,
	"place" text,
	"label" text,
	"source" text NOT NULL,
	"has_person" boolean DEFAULT false NOT NULL,
	"partner_public" boolean DEFAULT false NOT NULL,
	"duplicate_of" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"setup_fee" integer NOT NULL,
	"monthly_fee" integer NOT NULL,
	"extra_note" text DEFAULT '' NOT NULL,
	"default_features" jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "review_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"type" text NOT NULL,
	"draft_style" text,
	"col1" text NOT NULL,
	"col2" text NOT NULL,
	"common_body" text[] NOT NULL,
	"created_on" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid,
	"bundle_label" text NOT NULL,
	"user_id" uuid,
	"who" text NOT NULL,
	"what" text NOT NULL,
	"snapshot" jsonb,
	"reverted" boolean DEFAULT false NOT NULL,
	"when_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"page_id" uuid,
	"name" text NOT NULL,
	"info" text NOT NULL,
	"photos" integer NOT NULL,
	"sites" integer NOT NULL,
	"unique_pct" integer NOT NULL,
	"state" text DEFAULT '대기' NOT NULL,
	"selected" boolean DEFAULT true NOT NULL,
	"reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"note" text,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scope_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"user_id" uuid,
	"who" text NOT NULL,
	"what" text NOT NULL,
	"warning_ack" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"keep" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"month" text NOT NULL,
	"contract_count" integer NOT NULL,
	"contract_amount" integer NOT NULL,
	"rate_pct" integer NOT NULL,
	"fee" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"region" text,
	"work_type" text,
	"building_type" text,
	"area_pyeong" integer,
	"days" integer,
	"note" text,
	"worked_at" date,
	"photo_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT '작성 중' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" uuid NOT NULL,
	"requested_on" date NOT NULL,
	"state" text DEFAULT '요청됨' NOT NULL,
	"issued_by" uuid,
	"issued_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"page_title" text NOT NULL,
	"lang" text NOT NULL,
	"status" text DEFAULT '검수 대기' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"login_id" text NOT NULL,
	"password_hash" text NOT NULL,
	"kind" text NOT NULL,
	"role" text,
	"partner_id" uuid,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"status" text DEFAULT '첫 로그인 전' NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"activity_count" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_login_id_unique" UNIQUE("login_id")
);
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_assignments" ADD CONSTRAINT "generation_assignments_run_id_generation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."generation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_drafts" ADD CONSTRAINT "generation_drafts_run_id_generation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."generation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "industry_items" ADD CONSTRAINT "industry_items_industry_id_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_captures" ADD CONSTRAINT "landing_captures_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_memos" ADD CONSTRAINT "lead_memos_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_memos" ADD CONSTRAINT "lead_memos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_queries" ADD CONSTRAINT "page_queries_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_queries" ADD CONSTRAINT "page_queries_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_features" ADD CONSTRAINT "partner_features_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_regions" ADD CONSTRAINT "partner_regions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_industry_id_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_bundles" ADD CONSTRAINT "review_bundles_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_history" ADD CONSTRAINT "review_history_bundle_id_review_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."review_bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_history" ADD CONSTRAINT "review_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_bundle_id_review_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."review_bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_logs" ADD CONSTRAINT "scope_logs_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_logs" ADD CONSTRAINT "scope_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_requests" ADD CONSTRAINT "tax_requests_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translations" ADD CONSTRAINT "translations_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inquiries_partner_idx" ON "inquiries" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "pages_partner_idx" ON "pages" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "photos_partner_idx" ON "photos" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "sites_partner_idx" ON "sites" USING btree ("partner_id");