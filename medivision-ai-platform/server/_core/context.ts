import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { User } from "../../drizzle/schema";
import { getUserByOpenId, upsertUser } from "../db";
import { ENV } from "./env";
import { isMongoConfigured, mirrorUser } from "../integrations/mongodb";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

const clerkJwks = ENV.clerkJwksUrl ? createRemoteJWKSet(new URL(ENV.clerkJwksUrl)) : null;

type ClerkClaims = JWTPayload & {
  email?: string;
  email_address?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  public_metadata?: { role?: string };
};

function getBearerToken(req: CreateExpressContextOptions["req"]) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

async function authenticateClerkRequest(req: CreateExpressContextOptions["req"]): Promise<User | null> {
  const token = getBearerToken(req);
  if (!token || !clerkJwks || !ENV.clerkIssuerUrl) return null;
  const verified = await jwtVerify(token, clerkJwks, {
    issuer: ENV.clerkIssuerUrl,
    algorithms: ["RS256"],
  });
  const claims = verified.payload as ClerkClaims;
  if (!claims.sub) return null;
  const role = claims.public_metadata?.role;
  await upsertUser({
    openId: claims.sub,
    name: claims.name ?? ([claims.given_name, claims.family_name].filter(Boolean).join(" ") || null),
    email: claims.email ?? claims.email_address ?? null,
    loginMethod: "clerk",
    ...(role === "doctor" || role === "admin" ? { role } : {}),
    lastSignedIn: new Date(),
  });
  const persisted = await getUserByOpenId(claims.sub);
  if (isMongoConfigured()) void mirrorUser({ openId: claims.sub, name: persisted?.name ?? claims.name ?? null, email: persisted?.email ?? claims.email ?? claims.email_address ?? null, role: persisted?.role ?? (role === "doctor" || role === "admin" ? role : "patient"), isActive: persisted?.isActive ?? 1 }).catch(error => console.warn("[MongoDB] User mirror failed:", error instanceof Error ? error.name : "UnknownError"));
  if (persisted) return persisted.isActive ? persisted : null;
  return {
    id: 0,
    openId: claims.sub,
    name: claims.name ?? null,
    email: claims.email ?? claims.email_address ?? null,
    loginMethod: "clerk",
    role: role === "doctor" || role === "admin" ? role : "patient",
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    user = await authenticateClerkRequest(opts.req);
  } catch (error) {
    console.warn("[Clerk] Token verification failed:", error instanceof Error ? error.message : error);
  }
  return { req: opts.req, res: opts.res, user };
}
