CREATE TABLE `report_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`ownerOpenId` varchar(128) NOT NULL,
	`token` varchar(96) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	CONSTRAINT `report_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `report_shares_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(128) NOT NULL,
	`studyId` int NOT NULL,
	`status` enum('processing','completed','failed') NOT NULL DEFAULT 'processing',
	`modelVersion` varchar(128) NOT NULL DEFAULT 'DenseNet121 · pending',
	`originalImageUrl` varchar(768),
	`originalFileName` varchar(255),
	`findingsJson` text,
	`processedImageUrl` varchar(768),
	`gradcamHeatmapUrl` varchar(768),
	`gradcamOverlayUrl` varchar(768),
	`errorMessage` text,
	`analysisTimestamp` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
