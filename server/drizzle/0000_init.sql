CREATE TABLE "admin_audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"admin_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_user_id" uuid,
	"old_value" jsonb,
	"new_value" jsonb,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_rewards" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "daily_rewards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"reward_date" date NOT NULL,
	"streak" integer NOT NULL,
	"amount" integer NOT NULL,
	"transaction_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_rounds" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "game_rounds_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 10001 CACHE 1),
	"user_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"bet_amount" bigint NOT NULL,
	"random_value" double precision NOT NULL,
	"target_outcome" text NOT NULL,
	"outcome" text,
	"payout" bigint,
	"probability_profile_id" integer NOT NULL,
	"probability_snapshot" jsonb NOT NULL,
	"status" text NOT NULL,
	"seq" integer DEFAULT 0 NOT NULL,
	"state" jsonb,
	"detail" jsonb,
	"summary" text DEFAULT '' NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "game_rounds_bet_positive" CHECK ("game_rounds"."bet_amount" > 0),
	CONSTRAINT "game_rounds_payout_non_negative" CHECK ("game_rounds"."payout" is null or "game_rounds"."payout" >= 0),
	CONSTRAINT "game_rounds_random_range" CHECK ("game_rounds"."random_value" >= 0 and "game_rounds"."random_value" < 100)
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"min_bet" integer NOT NULL,
	"max_bet" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_bet_limits" CHECK ("games"."min_bet" > 0 and "games"."min_bet" <= "games"."max_bet")
);
--> statement-breakpoint
CREATE TABLE "probability_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"win_probability" integer NOT NULL,
	"small_win_probability" integer NOT NULL,
	"big_win_probability" integer NOT NULL,
	"loss_probability" integer NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "probability_profiles_name_unique" UNIQUE("name"),
	CONSTRAINT "probability_profiles_total_100" CHECK ("probability_profiles"."win_probability" + "probability_profiles"."small_win_probability" + "probability_profiles"."big_win_probability" + "probability_profiles"."loss_probability" = 100),
	CONSTRAINT "probability_profiles_range" CHECK ("probability_profiles"."win_probability" between 0 and 100 and "probability_profiles"."small_win_probability" between 0 and 100 and "probability_profiles"."big_win_probability" between 0 and 100 and "probability_profiles"."loss_probability" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "security_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid,
	"ip" text,
	"type" text NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_probability_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" integer NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_probability_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"avatar" text DEFAULT '🦚' NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'player' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('player', 'admin')),
	CONSTRAINT "users_status_check" CHECK ("users"."status" in ('active', 'suspended')),
	CONSTRAINT "users_xp_check" CHECK ("users"."xp" >= 0)
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wallet_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"round_id" bigint,
	"type" text NOT NULL,
	"amount" bigint NOT NULL,
	"balance_before" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"currency" text DEFAULT 'INR_VIRTUAL' NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_transactions_math" CHECK ("wallet_transactions"."balance_before" + "wallet_transactions"."amount" = "wallet_transactions"."balance_after"),
	CONSTRAINT "wallet_transactions_non_negative" CHECK ("wallet_transactions"."balance_after" >= 0),
	CONSTRAINT "wallet_transactions_nonzero" CHECK ("wallet_transactions"."amount" <> 0),
	CONSTRAINT "wallet_transactions_currency_virtual" CHECK ("wallet_transactions"."currency" = 'INR_VIRTUAL')
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"virtual_balance" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'INR_VIRTUAL' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "wallets_balance_non_negative" CHECK ("wallets"."virtual_balance" >= 0),
	CONSTRAINT "wallets_currency_virtual" CHECK ("wallets"."currency" = 'INR_VIRTUAL')
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_rewards" ADD CONSTRAINT "daily_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_rewards" ADD CONSTRAINT "daily_rewards_transaction_id_wallet_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."wallet_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_probability_profile_id_probability_profiles_id_fk" FOREIGN KEY ("probability_profile_id") REFERENCES "public"."probability_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probability_profiles" ADD CONSTRAINT "probability_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_probability_profiles" ADD CONSTRAINT "user_probability_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_probability_profiles" ADD CONSTRAINT "user_probability_profiles_profile_id_probability_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."probability_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_probability_profiles" ADD CONSTRAINT "user_probability_profiles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_round_id_game_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."game_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_logs_created_idx" ON "admin_audit_logs" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_rewards_user_date_idx" ON "daily_rewards" USING btree ("user_id","reward_date");--> statement-breakpoint
CREATE UNIQUE INDEX "game_rounds_idempotency_idx" ON "game_rounds" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "game_rounds_one_active_idx" ON "game_rounds" USING btree ("user_id","game_id") WHERE "game_rounds"."status" = 'IN_PROGRESS';--> statement-breakpoint
CREATE INDEX "game_rounds_user_created_idx" ON "game_rounds" USING btree ("user_id","id");--> statement-breakpoint
CREATE INDEX "game_rounds_created_idx" ON "game_rounds" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "security_events_created_idx" ON "security_events" USING btree ("id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_idx" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "wallet_transactions_user_idx" ON "wallet_transactions" USING btree ("user_id","id");