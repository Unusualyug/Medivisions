CREATE TABLE `xray_studies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(128) NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(768) NOT NULL,
	`mimeType` varchar(64) NOT NULL,
	`sizeBytes` int NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`qualityStatus` enum('pass','review') NOT NULL DEFAULT 'pass',
	`status` enum('uploaded','removed') NOT NULL DEFAULT 'uploaded',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `xray_studies_id` PRIMARY KEY(`id`)
);
