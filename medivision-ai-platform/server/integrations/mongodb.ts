import { MongoClient, type Collection, type Db } from "mongodb";

let client: MongoClient | null = null;
let database: Db | null = null;

export function isMongoConfigured() {
  return Boolean(process.env.MONGODB_URI);
}

async function getDatabase() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured");
  if (!database) {
    client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    database = client.db();
  }
  return database;
}

async function collection<T extends Record<string, unknown>>(name: string): Promise<Collection<T>> {
  return (await getDatabase()).collection<T>(name);
}

export type MongoStudy = {
  legacyId?: number;
  ownerOpenId: string;
  originalName: string;
  cloudinaryPublicId: string;
  storageUrl: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  qualityStatus: "pass" | "review";
  status: "uploaded" | "removed";
  createdAt: Date;
};

export async function mirrorStudy(study: MongoStudy) {
  const studies = await collection<MongoStudy>("xrayStudies");
  const result = await studies.insertOne(study);
  return result.insertedId.toString();
}

export async function mirrorPrediction(input: { legacyReportId?: number; studyId: number; ownerOpenId: string; status: string; modelVersion: string; findings: unknown; analyzedAt: Date; }) {
  const predictions = await collection("predictions");
  const result = await predictions.insertOne({ ...input, createdAt: new Date() });
  return result.insertedId.toString();
}

export async function mirrorUser(input: { openId: string; email?: string | null; name?: string | null; role: string; isActive: number }) {
  const users = await collection("users");
  await users.updateOne({ openId: input.openId }, { $set: { ...input, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
}

export async function mirrorReport(input: { legacyId: number; ownerOpenId: string; studyId: number; status: string; modelVersion: string; findings: unknown; processingTimeMs?: number; createdAt: Date; updatedAt: Date }) {
  const reports = await collection("reports");
  await reports.updateOne({ legacyId: input.legacyId }, { $set: input }, { upsert: true });
}

export async function mirrorAuditRecord(input: { actorOpenId: string; actorRole: string; action: string; reportId?: number; details?: unknown; createdAt: Date }) {
  const audits = await collection("auditRecords");
  await audits.insertOne(input);
}

export async function mirrorModelVersion(input: { legacyId: number; version: string; architecture: string; datasetVersion?: string | null; checkpointUrl?: string | null; epochs?: number | null; isActive: number; createdAt: Date }) {
  const models = await collection("modelVersions");
  await models.updateOne({ legacyId: input.legacyId }, { $set: input }, { upsert: true });
}

export async function mongoHealth() {
  if (!isMongoConfigured()) return { configured: false, connected: false };
  try {
    const db = await getDatabase();
    await db.command({ ping: 1 });
    return { configured: true, connected: true };
  } catch (error) {
    database = null;
    client = null;
    return { configured: true, connected: false, error: error instanceof Error ? error.message : "MongoDB connection failed" };
  }
}
