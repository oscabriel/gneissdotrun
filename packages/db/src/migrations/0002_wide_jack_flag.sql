CREATE TABLE `action_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`note_id` text,
	`description` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`deadline` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `action_items_userId_idx` ON `action_items` (`user_id`);--> statement-breakpoint
CREATE INDEX `action_items_noteId_idx` ON `action_items` (`note_id`);--> statement-breakpoint
CREATE TABLE `collection_notes` (
	`collection_id` text NOT NULL,
	`note_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collection_notes_collectionId_idx` ON `collection_notes` (`collection_id`);--> statement-breakpoint
CREATE INDEX `collection_notes_noteId_idx` ON `collection_notes` (`note_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_capture_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collections_userId_idx` ON `collections` (`user_id`);--> statement-breakpoint
CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`mention_count` integer DEFAULT 0 NOT NULL,
	`first_mentioned_at` integer,
	`last_mentioned_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entities_userId_idx` ON `entities` (`user_id`);--> statement-breakpoint
CREATE INDEX `entities_name_idx` ON `entities` (`name`);--> statement-breakpoint
CREATE TABLE `entity_mentions` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`note_id` text NOT NULL,
	`context` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_mentions_entityId_idx` ON `entity_mentions` (`entity_id`);--> statement-breakpoint
CREATE INDEX `entity_mentions_noteId_idx` ON `entity_mentions` (`note_id`);--> statement-breakpoint
CREATE TABLE `note_extractions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`note_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text DEFAULT (json_object()) NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_extractions_userId_idx` ON `note_extractions` (`user_id`);--> statement-breakpoint
CREATE INDEX `note_extractions_noteId_idx` ON `note_extractions` (`note_id`);--> statement-breakpoint
CREATE INDEX `note_extractions_kind_idx` ON `note_extractions` (`kind`);--> statement-breakpoint
CREATE TABLE `fact_contradictions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`fact_a_id` text NOT NULL,
	`fact_b_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`resolution_note_id` text,
	`resolution_reason` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fact_a_id`) REFERENCES `facts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fact_b_id`) REFERENCES `facts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolution_note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `fact_contradictions_userId_idx` ON `fact_contradictions` (`user_id`);--> statement-breakpoint
CREATE INDEX `fact_contradictions_factAId_idx` ON `fact_contradictions` (`fact_a_id`);--> statement-breakpoint
CREATE INDEX `fact_contradictions_factBId_idx` ON `fact_contradictions` (`fact_b_id`);--> statement-breakpoint
CREATE TABLE `facts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entity_id` text,
	`fact` text NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`source_note_id` text,
	`observed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `facts_userId_idx` ON `facts` (`user_id`);--> statement-breakpoint
CREATE INDEX `facts_entityId_idx` ON `facts` (`entity_id`);--> statement-breakpoint
CREATE INDEX `facts_sourceNoteId_idx` ON `facts` (`source_note_id`);--> statement-breakpoint
CREATE TABLE `note_links` (
	`id` text PRIMARY KEY NOT NULL,
	`from_note_id` text NOT NULL,
	`to_note_id` text NOT NULL,
	`link_type` text DEFAULT 'related' NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`from_note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_links_fromNoteId_idx` ON `note_links` (`from_note_id`);--> statement-breakpoint
CREATE INDEX `note_links_toNoteId_idx` ON `note_links` (`to_note_id`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`preference` text NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_preferences_userId_idx` ON `user_preferences` (`user_id`);--> statement-breakpoint
ALTER TABLE `notes` ADD `content_hash` text;--> statement-breakpoint
ALTER TABLE `notes` ADD `processed_at` integer;