import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 128 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["patient", "doctor", "admin"]).default("patient").notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const xrayStudies = mysqlTable("xray_studies", {
  id: int("id").autoincrement().primaryKey(), ownerOpenId: varchar("ownerOpenId", { length: 128 }).notNull(), originalName: varchar("originalName", { length: 255 }).notNull(), storageKey: varchar("storageKey", { length: 512 }).notNull(), storageUrl: varchar("storageUrl", { length: 768 }).notNull(), mimeType: varchar("mimeType", { length: 64 }).notNull(), sizeBytes: int("sizeBytes").notNull(), width: int("width").notNull(), height: int("height").notNull(), qualityStatus: mysqlEnum("qualityStatus", ["pass", "review"]).default("pass").notNull(), status: mysqlEnum("status", ["uploaded", "removed"]).default("uploaded").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(), ownerOpenId: varchar("ownerOpenId", { length: 128 }).notNull(), studyId: int("studyId").notNull(), status: mysqlEnum("status", ["processing", "completed", "failed"]).default("processing").notNull(), modelVersion: varchar("modelVersion", { length: 128 }).default("DenseNet121 · pending").notNull(), originalImageUrl: varchar("originalImageUrl", { length: 768 }), originalFileName: varchar("originalFileName", { length: 255 }), findingsJson: text("findingsJson"), processedImageUrl: varchar("processedImageUrl", { length: 768 }), gradcamHeatmapUrl: varchar("gradcamHeatmapUrl", { length: 768 }), gradcamOverlayUrl: varchar("gradcamOverlayUrl", { length: 768 }), errorMessage: text("errorMessage"), analysisTimestamp: timestamp("analysisTimestamp").defaultNow().notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const reportShares = mysqlTable("report_shares", {
  id: int("id").autoincrement().primaryKey(), reportId: int("reportId").notNull(), ownerOpenId: varchar("ownerOpenId", { length: 128 }).notNull(), token: varchar("token", { length: 96 }).notNull().unique(), expiresAt: timestamp("expiresAt").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), revokedAt: timestamp("revokedAt"),
});

export const reviewRecords = mysqlTable("review_records", {
  id: int("id").autoincrement().primaryKey(), reportId: int("reportId").notNull(), reviewerOpenId: varchar("reviewerOpenId", { length: 128 }).notNull(), reviewerRole: mysqlEnum("reviewerRole", ["doctor", "admin"]).notNull(), decision: mysqlEnum("decision", ["pending", "approved", "rejected"]).default("pending").notNull(), correctedLabelsJson: text("correctedLabelsJson"), notes: text("notes"), comments: text("comments"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditEvents = mysqlTable("audit_events", {
  id: int("id").autoincrement().primaryKey(), reportId: int("reportId").notNull(), actorOpenId: varchar("actorOpenId", { length: 128 }).notNull(), actorRole: varchar("actorRole", { length: 32 }).notNull(), action: varchar("action", { length: 128 }).notNull(), detailsJson: text("detailsJson"), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const modelVersions = mysqlTable("model_versions", {
  id: int("id").autoincrement().primaryKey(), version: varchar("version", { length: 128 }).notNull().unique(), architecture: varchar("architecture", { length: 128 }).notNull(), checkpointUrl: varchar("checkpointUrl", { length: 768 }), datasetVersion: varchar("datasetVersion", { length: 128 }), trainingDate: timestamp("trainingDate"), epochs: int("epochs"), thresholdConfigJson: text("thresholdConfigJson"), trainingLossJson: text("trainingLossJson"), validationLossJson: text("validationLossJson"), isActive: int("isActive").default(0).notNull(), createdBy: varchar("createdBy", { length: 128 }).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const evaluationRuns = mysqlTable("evaluation_runs", {
  id: int("id").autoincrement().primaryKey(), modelVersionId: int("modelVersionId").notNull(), datasetVersion: varchar("datasetVersion", { length: 128 }).notNull(), sampleCount: int("sampleCount").notNull(), metricsJson: text("metricsJson").notNull(), rocCurvesJson: text("rocCurvesJson"), confusionMatricesJson: text("confusionMatricesJson"), evaluatedAt: timestamp("evaluatedAt").defaultNow().notNull(), createdBy: varchar("createdBy", { length: 128 }).notNull(),
});

export const announcements = mysqlTable("announcements", {
  id: int("id").autoincrement().primaryKey(), title: varchar("title", { length: 180 }).notNull(), body: text("body").notNull(), severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(), isPublished: int("isPublished").default(0).notNull(), createdBy: varchar("createdBy", { length: 128 }).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const systemEvents = mysqlTable("system_events", {
  id: int("id").autoincrement().primaryKey(), actorOpenId: varchar("actorOpenId", { length: 128 }), action: varchar("action", { length: 128 }).notNull(), severity: mysqlEnum("severity", ["info", "warning", "error"]).default("info").notNull(), detailsJson: text("detailsJson"), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(), settingKey: varchar("settingKey", { length: 128 }).notNull().unique(), settingValue: text("settingValue").notNull(), updatedBy: varchar("updatedBy", { length: 128 }).notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type XrayStudy = typeof xrayStudies.$inferSelect;
export type InsertXrayStudy = typeof xrayStudies.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;
export type ReportShare = typeof reportShares.$inferSelect;
export type ReviewRecord = typeof reviewRecords.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type ModelVersion = typeof modelVersions.$inferSelect;
export type EvaluationRun = typeof evaluationRuns.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type SystemEvent = typeof systemEvents.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
