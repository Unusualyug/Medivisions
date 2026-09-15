import { and, desc, eq, gt, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertReport, InsertUser, InsertXrayStudy, Report, ReportShare, announcements, auditEvents, evaluationRuns, modelVersions, reports, reportShares, reviewRecords, systemEvents, systemSettings, users, xrayStudies } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) { if (user[field] !== undefined) { const value = user[field] ?? null; values[field] = value; updateSet[field] = value; } }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; } else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1); return result[0]; }
export async function createXrayStudy(study: InsertXrayStudy) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); const result = await db.insert(xrayStudies).values(study); const rows = await db.select().from(xrayStudies).where(eq(xrayStudies.id, Number(result[0].insertId))).limit(1); return rows[0]; }
export async function getXrayHistory(ownerOpenId: string) { const db = await getDb(); if (!db) return []; return db.select().from(xrayStudies).where(eq(xrayStudies.ownerOpenId, ownerOpenId)).orderBy(desc(xrayStudies.createdAt)); }
export async function getXrayStudyForOwner(ownerOpenId: string, id: number) { const db = await getDb(); if (!db) return undefined; const rows = await db.select().from(xrayStudies).where(and(eq(xrayStudies.id, id), eq(xrayStudies.ownerOpenId, ownerOpenId))).limit(1); return rows[0]; }
export async function removeXrayStudy(ownerOpenId: string, id: number) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); await db.update(xrayStudies).set({ status: "removed" }).where(and(eq(xrayStudies.id, id), eq(xrayStudies.ownerOpenId, ownerOpenId))); return { success: true } as const; }
export async function createReport(report: InsertReport) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); const result = await db.insert(reports).values(report); const rows = await db.select().from(reports).where(eq(reports.id, Number(result[0].insertId))).limit(1); return rows[0]; }
export async function updateReportResult(id: number, update: { status: "completed" | "failed"; modelVersion?: string; findingsJson?: string; processedImageUrl?: string; gradcamHeatmapUrl?: string; gradcamOverlayUrl?: string; errorMessage?: string | null }) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); await db.update(reports).set({ ...update, analysisTimestamp: new Date() }).where(eq(reports.id, id)); const rows = await db.select().from(reports).where(eq(reports.id, id)).limit(1); return rows[0]; }
export async function getReportHistory(ownerOpenId: string) { const db = await getDb(); if (!db) return []; return db.select().from(reports).where(eq(reports.ownerOpenId, ownerOpenId)).orderBy(desc(reports.createdAt)); }
export async function getReportForOwner(ownerOpenId: string, id: number) { const db = await getDb(); if (!db) return undefined; const rows = await db.select().from(reports).where(and(eq(reports.id, id), eq(reports.ownerOpenId, ownerOpenId))).limit(1); return rows[0]; }
export async function getReportById(id: number) { const db = await getDb(); if (!db) return undefined; const rows = await db.select().from(reports).where(eq(reports.id, id)).limit(1); return rows[0]; }
export async function deleteReportForOwner(ownerOpenId: string, id: number) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); await db.delete(reportShares).where(and(eq(reportShares.reportId, id), eq(reportShares.ownerOpenId, ownerOpenId))); await db.delete(reports).where(and(eq(reports.id, id), eq(reports.ownerOpenId, ownerOpenId))); return { success: true } as const; }
export async function createReportShare(ownerOpenId: string, reportId: number, expiresAt: Date) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""); await db.insert(reportShares).values({ reportId, ownerOpenId, token, expiresAt }); return { token, expiresAt }; }
export async function getActiveShare(token: string) { const db = await getDb(); if (!db) return undefined; const shares = await db.select().from(reportShares).where(and(eq(reportShares.token, token), isNull(reportShares.revokedAt), gt(reportShares.expiresAt, new Date()))).limit(1); const share = shares[0]; if (!share) return undefined; const reportRows = await db.select().from(reports).where(and(eq(reports.id, share.reportId), eq(reports.ownerOpenId, share.ownerOpenId))).limit(1); return reportRows[0] ? { share, report: reportRows[0] } : undefined; }
export async function revokeReportShare(ownerOpenId: string, token: string) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); await db.update(reportShares).set({ revokedAt: new Date() }).where(and(eq(reportShares.ownerOpenId, ownerOpenId), eq(reportShares.token, token))); return { success: true } as const; }
export async function getReviewerQueue() { const db = await getDb(); if (!db) return []; return db.select().from(reports).orderBy(desc(reports.createdAt)); }
export async function getReviewsForReport(reportId: number) { const db = await getDb(); if (!db) return []; return db.select().from(reviewRecords).where(eq(reviewRecords.reportId, reportId)).orderBy(desc(reviewRecords.updatedAt)); }
export async function createReviewRecord(review: typeof reviewRecords.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); const result = await db.insert(reviewRecords).values(review); const rows = await db.select().from(reviewRecords).where(eq(reviewRecords.id, Number(result[0].insertId))).limit(1); return rows[0]; }
export async function createAuditEvent(event: typeof auditEvents.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); const result = await db.insert(auditEvents).values(event); const rows = await db.select().from(auditEvents).where(eq(auditEvents.id, Number(result[0].insertId))).limit(1); return rows[0]; }
export async function getAuditTrail(reportId: number) { const db = await getDb(); if (!db) return []; return db.select().from(auditEvents).where(eq(auditEvents.reportId, reportId)).orderBy(desc(auditEvents.createdAt)); }
export async function getAdminUsers() { const db = await getDb(); if (!db) return []; return db.select().from(users).orderBy(desc(users.createdAt)); }
export async function updateAdminUser(openId: string, changes: { role?: "patient" | "doctor" | "admin"; isActive?: number }) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); await db.update(users).set(changes).where(eq(users.openId, openId)); return getUserByOpenId(openId); }
export async function getModelVersions() { const db = await getDb(); if (!db) return []; return db.select().from(modelVersions).orderBy(desc(modelVersions.createdAt)); }
export async function createModelVersion(model: typeof modelVersions.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); const result = await db.insert(modelVersions).values(model); const rows = await db.select().from(modelVersions).where(eq(modelVersions.id, Number(result[0].insertId))).limit(1); return rows[0]; }
export async function setActiveModelVersion(id: number, actor: string) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); await db.update(modelVersions).set({ isActive: 0 }).where(eq(modelVersions.isActive, 1)); await db.update(modelVersions).set({ isActive: 1 }).where(eq(modelVersions.id, id)); await db.insert(systemEvents).values({ actorOpenId: actor, action: "model.activate", severity: "info", detailsJson: JSON.stringify({ modelVersionId: id }) }); return { success: true } as const; }
export async function getEvaluationRuns() { const db = await getDb(); if (!db) return []; return db.select().from(evaluationRuns).orderBy(desc(evaluationRuns.evaluatedAt)); }
export async function createEvaluationRun(run: typeof evaluationRuns.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); const result = await db.insert(evaluationRuns).values(run); const rows = await db.select().from(evaluationRuns).where(eq(evaluationRuns.id, Number(result[0].insertId))).limit(1); return rows[0]; }
export async function getSystemEvents() { const db = await getDb(); if (!db) return []; return db.select().from(systemEvents).orderBy(desc(systemEvents.createdAt)).limit(100); }
export async function getAnnouncements() { const db = await getDb(); if (!db) return []; return db.select().from(announcements).orderBy(desc(announcements.createdAt)); }
export async function createAnnouncement(announcement: typeof announcements.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); const result = await db.insert(announcements).values(announcement); const rows = await db.select().from(announcements).where(eq(announcements.id, Number(result[0].insertId))).limit(1); return rows[0]; }
export async function getSystemSettings() { const db = await getDb(); if (!db) return []; return db.select().from(systemSettings).orderBy(systemSettings.settingKey); }
export async function upsertSystemSetting(settingKey: string, settingValue: string, updatedBy: string) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); await db.insert(systemSettings).values({ settingKey, settingValue, updatedBy }).onDuplicateKeyUpdate({ set: { settingValue, updatedBy, updatedAt: new Date() } }); return { success: true } as const; }
export async function getFailedReports() { const db = await getDb(); if (!db) return []; return db.select().from(reports).where(eq(reports.status, "failed")).orderBy(desc(reports.updatedAt)); }
