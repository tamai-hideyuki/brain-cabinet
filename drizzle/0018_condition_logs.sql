CREATE TABLE IF NOT EXISTS `condition_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`temperature` real,
	`humidity` real,
	`pressure` real,
	`recorded_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
