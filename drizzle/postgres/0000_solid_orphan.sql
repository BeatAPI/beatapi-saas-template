CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_task" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"media_type" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt" text NOT NULL,
	"options" text,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"task_id" text,
	"task_info" text,
	"task_result" text,
	"cost_credits" integer DEFAULT 0 NOT NULL,
	"scene" text DEFAULT '' NOT NULL,
	"credit_id" text
);
--> statement-breakpoint
CREATE TABLE "apikey" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chat" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"parts" text NOT NULL,
	"metadata" text,
	"content" text
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"role" text NOT NULL,
	"parts" text NOT NULL,
	"metadata" text,
	"model" text NOT NULL,
	"provider" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config" (
	"name" text NOT NULL,
	"value" text,
	CONSTRAINT "config_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "credit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_email" text,
	"order_no" text,
	"subscription_no" text,
	"transaction_no" text NOT NULL,
	"transaction_type" text NOT NULL,
	"transaction_scene" text,
	"credits" integer NOT NULL,
	"remaining_credits" integer DEFAULT 0 NOT NULL,
	"description" text,
	"expires_at" timestamp,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"consumed_detail" text,
	"metadata" text,
	CONSTRAINT "credit_transaction_no_unique" UNIQUE("transaction_no")
);
--> statement-breakpoint
CREATE TABLE "credit_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"plan_id" text,
	"price_id" text,
	"subscription_id" text,
	"grant_month" timestamp,
	"amount" integer NOT NULL,
	"remaining_amount" integer,
	"reference_type" text,
	"reference_id" text,
	"expiration_date" timestamp,
	"expiration_date_processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "effect" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" integer NOT NULL,
	"model" text NOT NULL,
	"version" text,
	"credit" integer NOT NULL,
	"link_name" text NOT NULL,
	"pre_prompt" text,
	"des" text,
	"platform" text,
	"api" text,
	"is_open" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"provider" text NOT NULL,
	"input_schema" jsonb,
	"pricing_schema" jsonb,
	CONSTRAINT "effect_link_name_unique" UNIQUE("link_name")
);
--> statement-breakpoint
CREATE TABLE "generation_asset_link" (
	"id" text PRIMARY KEY NOT NULL,
	"generation_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"effect_id" integer NOT NULL,
	"status" text NOT NULL,
	"provider_task_id" text,
	"lifecycle_phase" text,
	"last_provider_sync_at" timestamp,
	"execution_mode" text DEFAULT 'create_new' NOT NULL,
	"submitted_prompt" text,
	"submitted_params" jsonb,
	"result_asset_id" text,
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"failed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_code" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"trial_days" integer DEFAULT 15 NOT NULL,
	"note" text DEFAULT '',
	"created_by" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invite_code_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" text PRIMARY KEY NOT NULL,
	"order_no" text NOT NULL,
	"user_id" text NOT NULL,
	"user_email" text,
	"status" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"product_id" text,
	"payment_type" text,
	"payment_interval" text,
	"payment_provider" text NOT NULL,
	"payment_session_id" text,
	"checkout_info" text NOT NULL,
	"checkout_result" text,
	"payment_result" text,
	"discount_code" text,
	"discount_amount" integer,
	"discount_currency" text,
	"payment_email" text,
	"payment_amount" integer,
	"payment_currency" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"description" text,
	"product_name" text,
	"subscription_id" text,
	"subscription_result" text,
	"checkout_url" text,
	"callback_url" text,
	"credits_amount" integer,
	"credits_valid_days" integer,
	"plan_name" text,
	"payment_product_id" text,
	"invoice_id" text,
	"invoice_url" text,
	"subscription_no" text,
	"transaction_id" text,
	"payment_user_name" text,
	"payment_user_id" text,
	CONSTRAINT "order_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"price_id" text NOT NULL,
	"type" text NOT NULL,
	"scene" text,
	"interval" text,
	"user_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"subscription_id" text,
	"session_id" text,
	"invoice_id" text,
	"status" text NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"cancel_at_period_end" boolean,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"credits_anchor_at" timestamp,
	"next_price_id" text,
	"last_plan_change_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_session_id_unique" UNIQUE("session_id"),
	CONSTRAINT "payment_invoice_id_unique" UNIQUE("invoice_id")
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"external_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "permission_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	"title" text,
	"description" text,
	"image" text,
	"content" text,
	"categories" text,
	"tags" text,
	"author_name" text,
	"author_image" text,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "post_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"cover_asset_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"current_state_version" integer DEFAULT 1 NOT NULL,
	"last_workspace_mode" text DEFAULT 'canvas' NOT NULL,
	"last_opened_at" timestamp,
	"archived_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_asset_membership" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"source_run_id" text,
	"category" text NOT NULL,
	"workflow_type" text,
	"workflow_instance_id" text,
	"slot_id" text,
	"role" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_canvas_state" (
	"project_id" text PRIMARY KEY NOT NULL,
	"document_json" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_workflow_state" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"workflow_type" text NOT NULL,
	"workflow_instance_id" text NOT NULL,
	"template_slug" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"form_json" jsonb,
	"layout_json" jsonb,
	"selection_json" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_callback_nonce" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"nonce" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "role_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"id" text PRIMARY KEY NOT NULL,
	"role_id" text NOT NULL,
	"permission_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_no" text NOT NULL,
	"user_id" text NOT NULL,
	"user_email" text,
	"status" text NOT NULL,
	"payment_provider" text NOT NULL,
	"subscription_id" text NOT NULL,
	"subscription_result" text,
	"product_id" text,
	"description" text,
	"amount" integer,
	"currency" text,
	"interval" text,
	"interval_count" integer,
	"trial_period_days" integer,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"plan_name" text,
	"billing_url" text,
	"product_name" text,
	"credits_amount" integer,
	"credits_valid_days" integer,
	"payment_product_id" text,
	"payment_user_id" text,
	"canceled_at" timestamp,
	"canceled_end_at" timestamp,
	"canceled_reason" text,
	"canceled_reason_type" text,
	CONSTRAINT "subscription_subscription_no_unique" UNIQUE("subscription_no")
);
--> statement-breakpoint
CREATE TABLE "taxonomy" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"image" text,
	"icon" text,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "taxonomy_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ticket" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_message" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"content" text NOT NULL,
	"attachments" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"normalized_email" text,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"role" text,
	"banned" boolean,
	"ban_reason" text,
	"ban_expires" timestamp,
	"customer_id" text,
	"subscription_state" text DEFAULT 'free' NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_normalized_email_unique" UNIQUE("normalized_email")
);
--> statement-breakpoint
CREATE TABLE "user_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"asset_class" text DEFAULT 'original' NOT NULL,
	"storage_provider" text,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"public_url" text NOT NULL,
	"filename" text,
	"mime_type" text,
	"size_bytes" integer,
	"sha256" text,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"origin_project_id" text,
	"thumbnail_asset_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_credit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"current_credits" integer DEFAULT 0 NOT NULL,
	"last_refresh_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"invite_code_id" text NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"trial_ends_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_task" ADD CONSTRAINT "ai_task_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit" ADD CONSTRAINT "credit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_asset_link" ADD CONSTRAINT "generation_asset_link_generation_id_generation_history_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generation_history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_asset_link" ADD CONSTRAINT "generation_asset_link_asset_id_user_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."user_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_history" ADD CONSTRAINT "generation_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_history" ADD CONSTRAINT "generation_history_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_history" ADD CONSTRAINT "generation_history_effect_id_effect_id_fk" FOREIGN KEY ("effect_id") REFERENCES "public"."effect"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_history" ADD CONSTRAINT "generation_history_result_asset_id_user_asset_id_fk" FOREIGN KEY ("result_asset_id") REFERENCES "public"."user_asset"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_code" ADD CONSTRAINT "invite_code_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_asset_membership" ADD CONSTRAINT "project_asset_membership_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_asset_membership" ADD CONSTRAINT "project_asset_membership_asset_id_user_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."user_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_asset_membership" ADD CONSTRAINT "project_asset_membership_source_run_id_generation_history_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."generation_history"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_canvas_state" ADD CONSTRAINT "project_canvas_state_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_workflow_state" ADD CONSTRAINT "project_workflow_state_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomy" ADD CONSTRAINT "taxonomy_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_asset" ADD CONSTRAINT "user_asset_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_asset" ADD CONSTRAINT "user_asset_origin_project_id_project_id_fk" FOREIGN KEY ("origin_project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_asset" ADD CONSTRAINT "user_asset_thumbnail_asset_id_user_asset_id_fk" FOREIGN KEY ("thumbnail_asset_id") REFERENCES "public"."user_asset"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credit" ADD CONSTRAINT "user_credit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invite" ADD CONSTRAINT "user_invite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invite" ADD CONSTRAINT "user_invite_invite_code_id_invite_code_id_fk" FOREIGN KEY ("invite_code_id") REFERENCES "public"."invite_code"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_account_id_idx" ON "account" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "account_provider_id_idx" ON "account" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_account_provider_account" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_ai_task_user_media_type" ON "ai_task" USING btree ("user_id","media_type");--> statement-breakpoint
CREATE INDEX "idx_ai_task_media_type_status" ON "ai_task" USING btree ("media_type","status");--> statement-breakpoint
CREATE INDEX "idx_apikey_user_status" ON "apikey" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_apikey_keyhash_status" ON "apikey" USING btree ("key_hash","status");--> statement-breakpoint
CREATE INDEX "idx_chat_user_status" ON "chat" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_chat_message_chat_id" ON "chat_message" USING btree ("chat_id","status");--> statement-breakpoint
CREATE INDEX "idx_chat_message_user_id" ON "chat_message" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_credit_consume_fifo" ON "credit" USING btree ("user_id","status","transaction_type","remaining_credits","expires_at");--> statement-breakpoint
CREATE INDEX "idx_credit_order_no" ON "credit" USING btree ("order_no");--> statement-breakpoint
CREATE INDEX "idx_credit_subscription_no" ON "credit" USING btree ("subscription_no");--> statement-breakpoint
CREATE INDEX "credit_transaction_user_id_idx" ON "credit_transaction" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_transaction_type_idx" ON "credit_transaction" USING btree ("type");--> statement-breakpoint
CREATE INDEX "credit_transaction_plan_id_idx" ON "credit_transaction" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "credit_transaction_grant_month_idx" ON "credit_transaction" USING btree ("grant_month");--> statement-breakpoint
CREATE INDEX "credit_transaction_reference_idx" ON "credit_transaction" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_transaction_reference_uidx" ON "credit_transaction" USING btree ("user_id","type","reference_type","reference_id") WHERE "credit_transaction"."reference_type" IS NOT NULL AND "credit_transaction"."reference_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "effect_link_name_idx" ON "effect" USING btree ("link_name");--> statement-breakpoint
CREATE INDEX "effect_provider_idx" ON "effect" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "generation_asset_link_generation_idx" ON "generation_asset_link" USING btree ("generation_id");--> statement-breakpoint
CREATE INDEX "generation_asset_link_asset_idx" ON "generation_asset_link" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_asset_link_unique" ON "generation_asset_link" USING btree ("generation_id","asset_id","role");--> statement-breakpoint
CREATE INDEX "generation_history_user_id_idx" ON "generation_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generation_history_project_id_idx" ON "generation_history" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "generation_history_effect_id_idx" ON "generation_history" USING btree ("effect_id");--> statement-breakpoint
CREATE INDEX "generation_history_status_idx" ON "generation_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generation_history_provider_task_id_idx" ON "generation_history" USING btree ("provider_task_id");--> statement-breakpoint
CREATE INDEX "generation_history_lifecycle_phase_idx" ON "generation_history" USING btree ("lifecycle_phase");--> statement-breakpoint
CREATE INDEX "generation_history_result_asset_id_idx" ON "generation_history" USING btree ("result_asset_id");--> statement-breakpoint
CREATE INDEX "generation_history_status_lifecycle_idx" ON "generation_history" USING btree ("status","lifecycle_phase");--> statement-breakpoint
CREATE INDEX "generation_history_status_last_provider_sync_idx" ON "generation_history" USING btree ("status","last_provider_sync_at");--> statement-breakpoint
CREATE INDEX "idx_invite_code_code" ON "invite_code" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_order_user_status_payment_type" ON "order" USING btree ("user_id","status","payment_type");--> statement-breakpoint
CREATE INDEX "idx_order_transaction_provider" ON "order" USING btree ("transaction_id","payment_provider");--> statement-breakpoint
CREATE INDEX "idx_order_created_at" ON "order" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payment_type_idx" ON "payment" USING btree ("type");--> statement-breakpoint
CREATE INDEX "payment_scene_idx" ON "payment" USING btree ("scene");--> statement-breakpoint
CREATE INDEX "payment_price_id_idx" ON "payment" USING btree ("price_id");--> statement-breakpoint
CREATE INDEX "payment_user_id_idx" ON "payment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_customer_id_idx" ON "payment" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "payment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_paid_idx" ON "payment" USING btree ("paid");--> statement-breakpoint
CREATE INDEX "payment_subscription_id_idx" ON "payment" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "payment_session_id_idx" ON "payment" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "payment_invoice_id_idx" ON "payment" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payment_next_price_id_idx" ON "payment" USING btree ("next_price_id");--> statement-breakpoint
CREATE INDEX "payment_credits_anchor_at_idx" ON "payment" USING btree ("credits_anchor_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_event_provider_external_unique" ON "payment_webhook_event" USING btree ("provider","external_event_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_event_created_at_idx" ON "payment_webhook_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_permission_resource_action" ON "permission" USING btree ("resource","action");--> statement-breakpoint
CREATE INDEX "idx_post_type_status" ON "post" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "project_user_id_idx" ON "project" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_status_idx" ON "project" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_current_state_version_idx" ON "project" USING btree ("current_state_version");--> statement-breakpoint
CREATE INDEX "project_updated_at_idx" ON "project" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "project_last_opened_at_idx" ON "project" USING btree ("last_opened_at");--> statement-breakpoint
CREATE INDEX "project_archived_at_idx" ON "project" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "project_asset_membership_project_idx" ON "project_asset_membership" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_asset_membership_asset_idx" ON "project_asset_membership" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "project_asset_membership_source_run_idx" ON "project_asset_membership" USING btree ("source_run_id");--> statement-breakpoint
CREATE INDEX "project_asset_membership_category_idx" ON "project_asset_membership" USING btree ("category");--> statement-breakpoint
CREATE INDEX "project_asset_membership_workflow_idx" ON "project_asset_membership" USING btree ("workflow_type","workflow_instance_id");--> statement-breakpoint
CREATE INDEX "project_asset_membership_slot_idx" ON "project_asset_membership" USING btree ("slot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_asset_membership_unique" ON "project_asset_membership" USING btree ("project_id","asset_id","category");--> statement-breakpoint
CREATE INDEX "project_canvas_state_updated_at_idx" ON "project_canvas_state" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "project_workflow_state_project_idx" ON "project_workflow_state" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_workflow_state_workflow_type_idx" ON "project_workflow_state" USING btree ("workflow_type");--> statement-breakpoint
CREATE INDEX "project_workflow_state_template_slug_idx" ON "project_workflow_state" USING btree ("template_slug");--> statement-breakpoint
CREATE INDEX "project_workflow_state_updated_at_idx" ON "project_workflow_state" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_workflow_state_unique" ON "project_workflow_state" USING btree ("project_id","workflow_type","workflow_instance_id");--> statement-breakpoint
CREATE INDEX "provider_callback_nonce_provider_idx" ON "provider_callback_nonce" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "provider_callback_nonce_expires_at_idx" ON "provider_callback_nonce" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_callback_nonce_unique" ON "provider_callback_nonce" USING btree ("provider","nonce");--> statement-breakpoint
CREATE INDEX "idx_role_status" ON "role" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_role_permission_role_permission" ON "role_permission" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE INDEX "session_token_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_session_user_expires" ON "session" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "idx_subscription_user_status_interval" ON "subscription" USING btree ("user_id","status","interval");--> statement-breakpoint
CREATE INDEX "idx_subscription_provider_id" ON "subscription" USING btree ("subscription_id","payment_provider");--> statement-breakpoint
CREATE INDEX "idx_subscription_created_at" ON "subscription" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_taxonomy_type_status" ON "taxonomy" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "idx_ticket_user" ON "ticket" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_status" ON "ticket" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ticket_message_ticket" ON "ticket_message" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "user_id_idx" ON "user" USING btree ("id");--> statement-breakpoint
CREATE INDEX "user_customer_id_idx" ON "user" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
CREATE INDEX "user_subscription_state_idx" ON "user" USING btree ("subscription_state");--> statement-breakpoint
CREATE INDEX "idx_user_name" ON "user" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_user_created_at" ON "user" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_asset_user_id_idx" ON "user_asset" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_asset_type_idx" ON "user_asset" USING btree ("type");--> statement-breakpoint
CREATE INDEX "user_asset_asset_class_idx" ON "user_asset" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "user_asset_storage_provider_idx" ON "user_asset" USING btree ("storage_provider");--> statement-breakpoint
CREATE INDEX "user_asset_origin_project_id_idx" ON "user_asset" USING btree ("origin_project_id");--> statement-breakpoint
CREATE INDEX "user_asset_thumbnail_asset_id_idx" ON "user_asset" USING btree ("thumbnail_asset_id");--> statement-breakpoint
CREATE INDEX "user_asset_created_at_idx" ON "user_asset" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_asset_bucket_object_key_uidx" ON "user_asset" USING btree ("bucket","object_key");--> statement-breakpoint
CREATE INDEX "user_credit_user_id_idx" ON "user_credit" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_credit_user_id_uidx" ON "user_credit" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_invite_user" ON "user_invite" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_invite_code" ON "user_invite" USING btree ("invite_code_id");--> statement-breakpoint
CREATE INDEX "idx_user_role_user_expires" ON "user_role" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "idx_verification_identifier" ON "verification" USING btree ("identifier");