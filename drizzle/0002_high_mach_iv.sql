CREATE TABLE `decision_counterevidences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`decision_note_id` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`source_note_id` text,
	`severity_score` real DEFAULT 0.5 NOT NULL,
	`severity_label` text DEFAULT 'minor' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `promotion_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_id` text NOT NULL,
	`trigger_type` text NOT NULL,
	`source` text NOT NULL,
	`suggested_type` text NOT NULL,
	`reason` text NOT NULL,
	`confidence` real NOT NULL,
	`reason_detail` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE TABLE `recall_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_id` text NOT NULL,
	`question_type` text NOT NULL,
	`question` text NOT NULL,
	`expected_keywords` text,
	`source` text DEFAULT 'template' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`content_hash` text,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_id` text NOT NULL,
	`easiness_factor` real DEFAULT 2.5 NOT NULL,
	`interval` integer DEFAULT 1 NOT NULL,
	`repetition` integer DEFAULT 0 NOT NULL,
	`next_review_at` integer NOT NULL,
	`last_reviewed_at` integer,
	`scheduled_by` text DEFAULT 'auto' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_id` text NOT NULL,
	`schedule_id` integer NOT NULL,
	`quality` integer NOT NULL,
	`response_time_ms` integer,
	`questions_attempted` integer,
	`questions_correct` integer,
	`easiness_factor_before` real,
	`easiness_factor_after` real,
	`interval_before` integer,
	`interval_after` integer,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `note_inferences` ADD `confidence_detail` text;--> statement-breakpoint
ALTER TABLE `note_inferences` ADD `decay_profile` text;