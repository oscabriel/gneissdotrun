CREATE TABLE `note_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text,
	`user_id` text NOT NULL,
	`object_key` text NOT NULL,
	`bucket` text DEFAULT 'files' NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `note_uploads_object_key_unique` ON `note_uploads` (`object_key`);--> statement-breakpoint
CREATE INDEX `note_uploads_userId_idx` ON `note_uploads` (`user_id`);--> statement-breakpoint
CREATE INDEX `note_uploads_noteId_idx` ON `note_uploads` (`note_id`);--> statement-breakpoint
CREATE INDEX `note_uploads_createdAt_idx` ON `note_uploads` (`created_at`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text DEFAULT 'Untitled note' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT (json_array()) NOT NULL,
	`source_message_id` text,
	`dedupe_key` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notes_userId_idx` ON `notes` (`user_id`);--> statement-breakpoint
CREATE INDEX `notes_updatedAt_idx` ON `notes` (`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `notes_dedupeKey_idx` ON `notes` (`dedupe_key`);