CREATE TABLE `bookmark_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`note_id` text,
	`url` text,
	`position` integer DEFAULT 0 NOT NULL,
	`is_expanded` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `secret_box_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	`is_expanded` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `secret_box_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`original_name` text NOT NULL,
	`type` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`data` blob NOT NULL,
	`thumbnail` blob,
	`folder_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
