CREATE TABLE `cluster_dynamics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`cluster_id` integer NOT NULL,
	`centroid` blob NOT NULL,
	`cohesion` real NOT NULL,
	`note_count` integer NOT NULL,
	`interactions` text,
	`stability_score` real,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cluster_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_id` text NOT NULL,
	`cluster_id` integer NOT NULL,
	`assigned_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clusters` (
	`id` integer PRIMARY KEY NOT NULL,
	`centroid` text,
	`size` integer DEFAULT 0 NOT NULL,
	`sample_note_id` text,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `concept_graph_edges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_cluster` integer NOT NULL,
	`target_cluster` integer NOT NULL,
	`weight` real NOT NULL,
	`mutual` real NOT NULL,
	`last_updated` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `drift_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`detected_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`severity` text NOT NULL,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`related_cluster` integer,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE TABLE `job_statuses` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`payload` text,
	`result` text,
	`error` text,
	`progress` integer,
	`progress_message` text,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`started_at` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `metrics_time_series` (
	`date` text PRIMARY KEY NOT NULL,
	`note_count` integer NOT NULL,
	`avg_semantic_diff` real,
	`dominant_cluster` integer,
	`entropy` real,
	`growth_vector` blob,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `note_embeddings` (
	`note_id` text PRIMARY KEY NOT NULL,
	`embedding` blob NOT NULL,
	`model` text DEFAULT 'text-embedding-3-small' NOT NULL,
	`dimensions` integer DEFAULT 1536 NOT NULL,
	`vector_norm` real,
	`semantic_diff` real,
	`cluster_id` integer,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `note_inferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_id` text NOT NULL,
	`type` text NOT NULL,
	`intent` text NOT NULL,
	`confidence` real NOT NULL,
	`model` text NOT NULL,
	`reasoning` text,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `note_influence_edges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_note_id` text NOT NULL,
	`target_note_id` text NOT NULL,
	`weight` real NOT NULL,
	`cosine_sim` real NOT NULL,
	`drift_score` real NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `note_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`source_note_id` text NOT NULL,
	`target_note_id` text NOT NULL,
	`relation_type` text NOT NULL,
	`score` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ptm_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`captured_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`center_of_gravity` blob,
	`cluster_strengths` blob,
	`influence_map` blob,
	`imbalance_score` real,
	`growth_direction` blob,
	`summary` text
);
--> statement-breakpoint
CREATE TABLE `workflow_status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workflow` text NOT NULL,
	`status` text NOT NULL,
	`progress` text,
	`cluster_job_id` text,
	`started_at` integer,
	`completed_at` integer,
	`error` text
);
--> statement-breakpoint
ALTER TABLE `note_history` ADD `semantic_diff` text;--> statement-breakpoint
ALTER TABLE `note_history` ADD `prev_cluster_id` integer;--> statement-breakpoint
ALTER TABLE `note_history` ADD `new_cluster_id` integer;--> statement-breakpoint
ALTER TABLE `notes` ADD `cluster_id` integer;