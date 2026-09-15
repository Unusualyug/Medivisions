CREATE TABLE `audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`actorOpenId` varchar(128) NOT NULL,
	`actorRole` varchar(32) NOT NULL,
	`action` varchar(128) NOT NULL,
	`detailsJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`reviewerOpenId` varchar(128) NOT NULL,
	`reviewerRole` enum('doctor','admin') NOT NULL,
	`decision` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`correctedLabelsJson` text,
	`notes` text,
	`comments` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `review_records_id` PRIMARY KEY(`id`)
);
