import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createAnnouncement,
  createAuditEvent,
  createEvaluationRun,
  createModelVersion,
  createReport,
  createReportShare,
  createReviewRecord,
  createXrayStudy,
  deleteReportForOwner,
  getActiveShare,
  getAdminUsers,
  getAnnouncements,
  getAuditTrail,
  getEvaluationRuns,
  getFailedReports,
  getModelVersions,
  getReportById,
  getReportForOwner,
  getReportHistory,
  getReviewsForReport,
  getReviewerQueue,
  getSystemEvents,
  getSystemSettings,
  getXrayHistory,
  getXrayStudyForOwner,
  removeXrayStudy,
  revokeReportShare,
  setActiveModelVersion,
  updateAdminUser,
  updateReportResult,
  upsertSystemSetting,
} from "./db";
import { storagePut } from "./storage";
import {
  isCloudinaryConfigured,
  uploadDerivedImage,
  uploadXray,
} from "./integrations/cloudinary";
import {
  isMongoConfigured,
  mirrorPrediction,
  mirrorReport,
  mirrorStudy,
  mongoHealth,
} from "./integrations/mongodb";
import {
  generateGradcam,
  getMlServiceUrl,
  mlHealth,
  predictWithDenseNet,
} from "./integrations/ml-service";
import { scanUploadBuffer } from "./integrations/upload-safety";
import { buildReportPdf } from "./reports/pdf";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  reviewerProcedure,
  router,
} from "./_core/trpc";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const allowedMime = z.enum(["image/jpeg", "image/png"]);

function decodeDataUrl(dataUrl: string, mimeType: string) {
  const prefix = `data:${mimeType};base64,`;
  if (!dataUrl.startsWith(prefix))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid image payload.",
    });
  const buffer = Buffer.from(dataUrl.slice(prefix.length), "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Image must be smaller than 10 MB.",
    });
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (
    (mimeType === "image/jpeg" && !isJpeg) ||
    (mimeType === "image/png" && !isPng)
  )
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The file contents do not match its image format.",
    });
  return buffer;
}

const reviewInput = z.object({
  reportId: z.number().int().positive(),
  decision: z.enum(["pending", "approved", "rejected"]),
  correctedLabels: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        decision: z.enum(["positive", "negative", "uncertain"]),
      })
    )
    .max(100)
    .default([]),
  notes: z.string().max(10000).default(""),
  comments: z.string().max(10000).default(""),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  xray: router({
    history: protectedProcedure.query(({ ctx }) =>
      getXrayHistory(ctx.user.openId)
    ),
    upload: protectedProcedure
      .input(
        z.object({
          fileName: z.string().min(1).max(255),
          mimeType: allowedMime,
          sizeBytes: z.number().int().positive().max(MAX_IMAGE_BYTES),
          width: z.number().int().min(256).max(12000),
          height: z.number().int().min(256).max(12000),
          qualityStatus: z.enum(["pass", "review"]).default("pass"),
          dataUrl: z.string().min(32),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const buffer = decodeDataUrl(input.dataUrl, input.mimeType);
        if (buffer.length !== input.sizeBytes)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Image size validation failed.",
          });
        const scan = scanUploadBuffer(buffer);
        if (!scan.safe)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Upload rejected by security screening.",
          });
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const stored = isCloudinaryConfigured()
          ? await uploadXray(buffer, safeName, ctx.user.openId, input.mimeType)
          : await storagePut(
              `users/${ctx.user.openId}/xray/${Date.now()}-${safeName}`,
              buffer,
              input.mimeType
            );
        const study = await createXrayStudy({
          ownerOpenId: ctx.user.openId,
          originalName: input.fileName,
          storageKey: "publicId" in stored ? stored.publicId : stored.key,
          storageUrl: "secureUrl" in stored ? stored.secureUrl : stored.url,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          width: input.width,
          height: input.height,
          qualityStatus: input.qualityStatus,
          status: "uploaded",
        });
        if (isMongoConfigured())
          void mirrorStudy({
            legacyId: study.id,
            ownerOpenId: ctx.user.openId,
            originalName: study.originalName,
            cloudinaryPublicId:
              "publicId" in stored ? stored.publicId : study.storageKey,
            storageUrl: study.storageUrl,
            mimeType: study.mimeType,
            sizeBytes: study.sizeBytes,
            width: study.width,
            height: study.height,
            qualityStatus: study.qualityStatus,
            status: study.status,
            createdAt: study.createdAt,
          }).catch(error =>
            console.warn("[MongoDB] Study mirror failed:", error)
          );
        return study;
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => removeXrayStudy(ctx.user.openId, input.id)),
  }),
  reports: router({
    history: protectedProcedure.query(({ ctx }) =>
      getReportHistory(ctx.user.openId)
    ),
    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const report = await getReportForOwner(ctx.user.openId, input.id);
        if (!report)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Report not found.",
          });
        return report;
      }),
    pdf: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const report = await getReportForOwner(ctx.user.openId, input.id);
        if (!report)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Report not found.",
          });
        const pdf = await buildReportPdf(report);
        return {
          filename: `medivision-report-${report.id}.pdf`,
          contentType: "application/pdf",
          base64: pdf.toString("base64"),
        };
      }),
    create: protectedProcedure
      .input(z.object({ studyId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const study = await getXrayStudyForOwner(
          ctx.user.openId,
          input.studyId
        );
        if (!study || study.status === "removed")
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Study not found.",
          });
        const report = await createReport({
          ownerOpenId: ctx.user.openId,
          studyId: study.id,
          status: "processing",
          modelVersion: "DenseNet121 · pending",
          originalImageUrl: study.storageUrl,
          originalFileName: study.originalName,
          findingsJson: JSON.stringify([]),
          analysisTimestamp: new Date(),
        });
        if (isMongoConfigured())
          void mirrorReport({
            legacyId: report.id,
            ownerOpenId: ctx.user.openId,
            studyId: study.id,
            status: report.status,
            modelVersion: report.modelVersion,
            findings: [],
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
          }).catch(error =>
            console.warn(
              "[MongoDB] Report mirror failed:",
              error instanceof Error ? error.name : "UnknownError"
            )
          );
        if (process.env.ML_SERVICE_URL) {
          try {
            const prediction = await predictWithDenseNet({
              imageUrl: study.storageUrl,
              studyId: String(study.id),
            });
            console.log(
              "=== RAW PREDICTION RESPONSE ===",
              JSON.stringify(prediction, null, 2)
            );
            const rawFindings =
              prediction.predictions ||
              prediction.findings ||
              prediction.probabilities ||
              [];
            const findings = rawFindings.map((item: any) => ({
              name: item.name ?? item.finding,
              probability: item.probability,
              positive: item.positive,
            }));

            let completed = await updateReportResult(report.id, {
              status: "completed",
              modelVersion: String(prediction.modelVersion || "DenseNet121"),
              findingsJson: JSON.stringify(findings),
            });

            // Automatically generate Grad-CAM visuals for the top finding
            if (
              isCloudinaryConfigured() &&
              Array.isArray(findings) &&
              findings.length
            ) {
              try {
                const topFinding = [...findings].sort(
                  (a: any, b: any) =>
                    (b.probability ?? 0) - (a.probability ?? 0)
                )[0];

                const gradcamResult = await generateGradcam({
                  imageUrl: study.storageUrl,
                  studyId: String(study.id),
                  finding: topFinding.name,
                });

                const [processed, heatmap, overlay] = await Promise.all([
                  uploadDerivedImage(
                    Buffer.from(gradcamResult.images.processed, "base64"),
                    `report-${report.id}-processed`
                  ),
                  uploadDerivedImage(
                    Buffer.from(gradcamResult.images.heatmap, "base64"),
                    `report-${report.id}-${topFinding.name}-heatmap`
                  ),
                  uploadDerivedImage(
                    Buffer.from(gradcamResult.images.overlay, "base64"),
                    `report-${report.id}-${topFinding.name}-overlay`
                  ),
                ]);
                completed = await updateReportResult(report.id, {
                  status: "completed",
                  processedImageUrl: processed.secureUrl,
                  gradcamHeatmapUrl: heatmap.secureUrl,
                  gradcamOverlayUrl: overlay.secureUrl,
                });
              } catch (gradcamError) {
                console.warn(
                  "[ML] Grad-CAM auto-generation failed:",
                  gradcamError instanceof Error
                    ? gradcamError.message
                    : gradcamError
                );
              }
            }

            if (isMongoConfigured())
              void mirrorReport({
                legacyId: completed.id,
                ownerOpenId: ctx.user.openId,
                studyId: completed.studyId,
                status: completed.status,
                modelVersion: completed.modelVersion,
                findings: prediction,
                createdAt: completed.createdAt,
                updatedAt: completed.updatedAt,
              }).catch(error =>
                console.warn(
                  "[MongoDB] Report mirror failed:",
                  error instanceof Error ? error.name : "UnknownError"
                )
              );
            if (isMongoConfigured())
              void mirrorPrediction({
                legacyReportId: report.id,
                studyId: study.id,
                ownerOpenId: ctx.user.openId,
                status: "completed",
                modelVersion: completed.modelVersion,
                findings: prediction,
                analyzedAt: new Date(),
              }).catch(error =>
                console.warn("[MongoDB] Prediction mirror failed:", error)
              );
            return completed;
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Python ML service failed";
            await updateReportResult(report.id, {
              status: "failed",
              modelVersion: "DenseNet121 · unavailable",
              errorMessage: message,
            });
            throw new TRPCError({
              code: "BAD_GATEWAY",
              message: `Python ML service unavailable: ${message}`,
            });
          }
        }
        return report;
      }),
    generateGradcam: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          finding: z.string().min(1).max(120),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const report = await getReportForOwner(ctx.user.openId, input.id);
        if (!report)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Report not found.",
          });
        if (!report.originalImageUrl)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Original image is unavailable for this report.",
          });
        if (!process.env.ML_SERVICE_URL)
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "ML service is not configured.",
          });
        if (!isCloudinaryConfigured())
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message:
              "Cloudinary is not configured for storing explanation images.",
          });
        try {
          const result = await generateGradcam({
            imageUrl: report.originalImageUrl,
            studyId: String(report.studyId),
            finding: input.finding,
          });
          const [processed, heatmap, overlay] = await Promise.all([
            uploadDerivedImage(
              Buffer.from(result.images.processed, "base64"),
              `report-${report.id}-processed`
            ),
            uploadDerivedImage(
              Buffer.from(result.images.heatmap, "base64"),
              `report-${report.id}-${input.finding}-heatmap`
            ),
            uploadDerivedImage(
              Buffer.from(result.images.overlay, "base64"),
              `report-${report.id}-${input.finding}-overlay`
            ),
          ]);
          return updateReportResult(report.id, {
            status: "completed",
            processedImageUrl: processed.secureUrl,
            gradcamHeatmapUrl: heatmap.secureUrl,
            gradcamOverlayUrl: overlay.secureUrl,
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Grad-CAM generation failed";
          throw new TRPCError({ code: "BAD_GATEWAY", message });
        }
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) =>
        deleteReportForOwner(ctx.user.openId, input.id)
      ),
    share: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          expiresInDays: z
            .union([z.literal(1), z.literal(7), z.literal(30)])
            .default(7),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const report = await getReportForOwner(ctx.user.openId, input.id);
        if (!report)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Report not found.",
          });
        const expiresAt = new Date(
          Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000
        );
        const share = await createReportShare(
          ctx.user.openId,
          report.id,
          expiresAt
        );
        return { ...share, path: `/shared-report/${share.token}` };
      }),
    revokeShare: protectedProcedure
      .input(z.object({ token: z.string().min(16) }))
      .mutation(({ ctx, input }) =>
        revokeReportShare(ctx.user.openId, input.token)
      ),
    public: publicProcedure
      .input(z.object({ token: z.string().min(16) }))
      .query(async ({ input }) => {
        const result = await getActiveShare(input.token);
        if (!result)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "This report link has expired or was revoked.",
          });
        return result;
      }),
  }),
  reviewer: router({
    queue: reviewerProcedure.query(() => getReviewerQueue()),
    get: reviewerProcedure
      .input(z.object({ reportId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const report = await getReportById(input.reportId);
        if (!report)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Report not found.",
          });
        const [reviews, audit] = await Promise.all([
          getReviewsForReport(input.reportId),
          getAuditTrail(input.reportId),
        ]);
        return { report, reviews, audit };
      }),
    save: reviewerProcedure
      .input(reviewInput)
      .mutation(async ({ ctx, input }) => {
        const report = await getReportById(input.reportId);
        if (!report)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Report not found.",
          });
        const reviewerRole = ctx.user.role === "admin" ? "admin" : "doctor";
        const review = await createReviewRecord({
          reportId: input.reportId,
          reviewerOpenId: ctx.user.openId,
          reviewerRole,
          decision: input.decision,
          correctedLabelsJson: JSON.stringify(input.correctedLabels),
          notes: input.notes,
          comments: input.comments,
        });
        const audit = await createAuditEvent({
          reportId: input.reportId,
          actorOpenId: ctx.user.openId,
          actorRole: reviewerRole,
          action: `review.${input.decision}`,
          detailsJson: JSON.stringify({
            correctedLabels: input.correctedLabels,
            hasNotes: Boolean(input.notes),
            hasComments: Boolean(input.comments),
          }),
        });
        return { review, audit };
      }),
    exportData: reviewerProcedure
      .input(z.object({ reportId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const report = await getReportById(input.reportId);
        if (!report)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Report not found.",
          });
        const [reviews, audit] = await Promise.all([
          getReviewsForReport(input.reportId),
          getAuditTrail(input.reportId),
        ]);
        return { exportedAt: new Date(), report, reviews, audit };
      }),
  }),
  admin: router({
    overview: adminProcedure.query(async () => {
      const [users, models, evaluations, events, announcements, settings] =
        await Promise.all([
          getAdminUsers(),
          getModelVersions(),
          getEvaluationRuns(),
          getSystemEvents(),
          getAnnouncements(),
          getSystemSettings(),
        ]);
      return {
        users,
        models,
        evaluations,
        events,
        announcements,
        settings,
        health: {
          status: "operational",
          uptimeSeconds: Math.round(process.uptime()),
          databaseConfigured: Boolean(process.env.DATABASE_URL),
          apiVersion: "2026.09",
        },
      };
    }),
    users: adminProcedure.query(() => getAdminUsers()),
    updateUser: adminProcedure
      .input(
        z.object({
          openId: z.string().min(1).max(128),
          role: z.enum(["patient", "doctor", "admin"]).optional(),
          isActive: z.union([z.literal(0), z.literal(1)]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.openId === ctx.user.openId && input.isActive === 0)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You cannot disable your own administrator account.",
          });
        const user = await updateAdminUser(input.openId, {
          role: input.role,
          isActive: input.isActive,
        });
        await createAuditEvent({
          reportId: 0,
          actorOpenId: ctx.user.openId,
          actorRole: "admin",
          action: "admin.user.update",
          detailsJson: JSON.stringify({
            targetOpenId: input.openId,
            role: input.role,
            isActive: input.isActive,
          }),
        });
        return user;
      }),
    models: adminProcedure.query(() => getModelVersions()),
    uploadModel: adminProcedure
      .input(
        z.object({
          version: z.string().min(1).max(128),
          architecture: z.string().min(1).max(128),
          datasetVersion: z.string().max(128).optional(),
          epochs: z.number().int().positive().max(10000).optional(),
          trainingDate: z.coerce.date().optional(),
          thresholdConfig: z
            .record(z.string(), z.number().min(0).max(1))
            .default({}),
          checkpointDataUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        let checkpointUrl: string | undefined;
        if (input.checkpointDataUrl) {
          const comma = input.checkpointDataUrl.indexOf(",");
          const bytes = Buffer.from(
            comma >= 0
              ? input.checkpointDataUrl.slice(comma + 1)
              : input.checkpointDataUrl,
            "base64"
          );
          if (!bytes.length || bytes.length > 500 * 1024 * 1024)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Model checkpoint must be between 1 byte and 500 MB.",
            });
          const stored = await storagePut(
            `admin/models/${input.version}-${Date.now()}.pth`,
            bytes,
            "application/octet-stream"
          );
          checkpointUrl = stored.url;
        }
        const model = await createModelVersion({
          version: input.version,
          architecture: input.architecture,
          checkpointUrl,
          datasetVersion: input.datasetVersion,
          trainingDate: input.trainingDate,
          epochs: input.epochs,
          thresholdConfigJson: JSON.stringify(input.thresholdConfig),
          createdBy: ctx.user.openId,
          isActive: 0,
        });
        await createAuditEvent({
          reportId: 0,
          actorOpenId: ctx.user.openId,
          actorRole: "admin",
          action: "model.upload",
          detailsJson: JSON.stringify({
            version: input.version,
            hasCheckpoint: Boolean(checkpointUrl),
          }),
        });
        return model;
      }),
    activateModel: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) =>
        setActiveModelVersion(input.id, ctx.user.openId)
      ),
    evaluations: adminProcedure.query(() => getEvaluationRuns()),
    addEvaluation: adminProcedure
      .input(
        z.object({
          modelVersionId: z.number().int().positive(),
          datasetVersion: z.string().min(1).max(128),
          sampleCount: z.number().int().positive(),
          metrics: z.record(z.string(), z.unknown()),
          rocCurves: z.record(z.string(), z.unknown()).optional(),
          confusionMatrices: z.record(z.string(), z.unknown()).optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        createEvaluationRun({
          modelVersionId: input.modelVersionId,
          datasetVersion: input.datasetVersion,
          sampleCount: input.sampleCount,
          metricsJson: JSON.stringify(input.metrics),
          rocCurvesJson: JSON.stringify(input.rocCurves || {}),
          confusionMatricesJson: JSON.stringify(input.confusionMatrices || {}),
          createdBy: ctx.user.openId,
        })
      ),
    activity: adminProcedure.query(() => getSystemEvents()),
    announcements: adminProcedure.query(() => getAnnouncements()),
    createAnnouncement: adminProcedure
      .input(
        z.object({
          title: z.string().min(1).max(180),
          body: z.string().min(1).max(10000),
          severity: z.enum(["info", "warning", "critical"]).default("info"),
          isPublished: z.union([z.literal(0), z.literal(1)]).default(0),
        })
      )
      .mutation(({ ctx, input }) =>
        createAnnouncement({ ...input, createdBy: ctx.user.openId })
      ),
    settings: adminProcedure.query(() => getSystemSettings()),
    updateSetting: adminProcedure
      .input(
        z.object({
          settingKey: z.string().min(1).max(128),
          settingValue: z.string().max(10000),
        })
      )
      .mutation(({ ctx, input }) =>
        upsertSystemSetting(
          input.settingKey,
          input.settingValue,
          ctx.user.openId
        )
      ),
    failedPredictions: adminProcedure.query(() => getFailedReports()),
    integrations: adminProcedure.query(async () => ({
      cloudinary: { configured: isCloudinaryConfigured() },
      mongodb: await mongoHealth(),
      ml: await mlHealth(),
      mlServiceUrl: getMlServiceUrl(),
    })),
  }),
});

export type AppRouter = typeof appRouter;
