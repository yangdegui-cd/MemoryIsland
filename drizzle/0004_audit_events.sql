CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`actor_id` text,
	`actor_name` text,
	`auth_type` text NOT NULL,
	`session_ref` text,
	`subject_id` text,
	`action` text NOT NULL,
	`outcome` text NOT NULL,
	`status` integer NOT NULL,
	`method` text NOT NULL,
	`path` text NOT NULL,
	`target_id` text,
	`ip` text,
	`user_agent` text,
	`details` text NOT NULL,
	`event_key` text
);
--> statement-breakpoint
CREATE INDEX `audit_events_time` ON `audit_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_time` ON `audit_events` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_action_time` ON `audit_events` (`action`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `audit_events_event_key` ON `audit_events` (`event_key`);