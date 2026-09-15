CREATE TABLE `announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`isPublished` int NOT NULL DEFAULT 0,
	`createdBy` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evaluation_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelVersionId` int NOT NULL,
	`datasetVersion` varchar(128) NOT NULL,
	`sampleCount` int NOT NULL,
	`metricsJson` text NOT NULL,
	`rocCurvesJson` text,
	`confusionMatricesJson` text,
	`evaluatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` varchar(128) NOT NULL,
	CONSTRAINT `evaluation_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version` varchar(128) NOT NULL,
	`architecture` varchar(128) NOT NULL,
	`checkpointUrl` varchar(768),
	`datasetVersion` varchar(128),
	`trainingDate` timestamp,
	`epochs` int,
	`thresholdConfigJson` text,
	`trainingLossJson` text,
	`validationLossJson` text,
	`isActive` int NOT NULL DEFAULT 0,
	`createdBy` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `model_versions_version_unique` UNIQUE(`version`)
);
--> statement-breakpoint
CREATE TABLE `system_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorOpenId` varchar(128),
	`action` varchar(128) NOT NULL,
	`severity` enum('info','warning','error') NOT NULL DEFAULT 'info',
	`detailsJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(128) NOT NULL,
	`settingValue` text NOT NULL,
	`updatedBy` varchar(128) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_settings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` int DEFAULT 1 NOT NULL;