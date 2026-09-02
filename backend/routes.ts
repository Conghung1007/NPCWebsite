import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { insertContactRequestSchema, insertArticleSchema, registrationFormSchema, ContactInfo, InsertContactInfo, insertTestimonialSchema, updateTestimonialSchema, upsertSiteContentSchema, bulkUpsertSiteContentSchema } from "@shared/schema";
import { z } from "zod";
import {
  getPageLayout,
  resetPageLayout,
  savePageLayout,
} from "./pageLayouts";
import {
  createCmsPage,
  deleteCmsPage,
  getCmsPageBySlug,
  listCmsPages,
} from "./cmsPages";
import { cmsPageToContentEntry } from "@shared/cmsPages";
import { getSiteSettings, upsertSiteSettings } from "./siteSettings";
import {
  getMonthlyAnalytics,
  recordPageView,
  getTodayViews,
} from "./pageAnalytics";
import { getOrderStats } from "./commerceStorage";
import { siteSettingsInputSchema } from "@shared/siteSettings";
import { isPortalId, type PortalId } from "@shared/portal";
import {
  isLayoutPageId,
  savePageLayoutSchema,
  type LayoutPageId,
} from "@shared/pageSections";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { multiR2Storage, type MediaUploadConfig, type FileInfo } from "./multiR2Storage";
import { r2Manager, EXTERNAL_R2_CONFIGS } from "./r2Config";
import { cleanupAbandonedTempMedia, startTempMediaGcScheduler } from "./tempMediaGc";
import {
  checkRateLimit,
  generateOTPCode,
  getExpirationTime,
  getRateLimitRemaining,
  isEmailServiceConfigured,
  sendVerificationEmail,
} from "./emailService";
import {
  findOrCreateGoogleUser,
  getGoogleClientId,
  isGoogleAuthConfigured,
  verifyGoogleCredential,
} from "./googleAuth";
import { scoreExamAttempt } from "./examScoring";
import { didAttemptPass } from "./examPass";
import {
  loadQuestionsByIdForExam,
  isAttemptOwner,
  assertInProgress,
  completeSectionOnAttempt,
  finalizeAttempt,
  applyScoringSnapshotToQuestion,
  normalizeSectionResults,
  listExamSections,
  collectValidAnswerIds,
  filterAnswersToValidIds,
  computeWaitSeconds,
  computeTrialQuestionIds,
  sectionIdsForQuestionIds,
  filterQuestionsForTrialIds,
  readTrialAttemptState,
} from "./examAttemptSession";
import { filterAnswersToTrialIds } from "./examScoring";
import multer from "multer";
import { registerCommerceRoutes } from "./commerceRoutes";
import { portalMiddleware } from "./portalMiddleware";
import { portalFromArticleCategory, normalizeAllowedPortals, normalizePortalAlias, canAccessPortal, sanitizePortalsInput } from "@shared/portal";
import {
  EXAM_PACKAGE_PRICE_VND,
  EXAM_TRIAL_QUESTION_LIMIT,
  isExamLevel,
  resolveExamAccess,
} from "@shared/examAccess";
import {
  listActiveLevelsForUser,
  listActivePackageIdsForUser,
  listAllEntitlements,
  listEntitlementsForUser,
  requestExamPackage,
  requestExamPackageById,
  reviewExamPackage,
  listExamPackages,
  getExamPackage,
  createExamPackage,
  updateExamPackage,
  deleteExamPackage,
  ensureDefaultExamPackages,
  countExamsInPackage,
  listExamsInPackage,
  setPackageExams,
  resolveDisplayExamCount,
} from "./examEntitlements";
import {
  buildPaymentDisplay,
  getPaymentSettings,
  upsertPaymentSettings,
} from "./paymentSettings";
import {
  cancelExamPackageOrder,
  createExamPackageOrder,
  fulfillExamPackageOrder,
  getExamPackageOrderByCode,
  getExamPackageOrderByPayosCode,
  getExamPackageOrderWithPackage,
  updateExamPackageOrderPayment,
} from "./examPackageCheckout";
import { createPayosPaymentLink, isPayosConfigured } from "./payos";
import { resolvePublicBaseUrl } from "@shared/origins";
import { buildPayosCancelUrl, buildPayosReturnUrl } from "./payosOrderCode";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

class MediaPromoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaPromoteError";
  }
}

// Middleware to check if user is authenticated
const requireAuth = (req: any, res: any, next: any) => {
  const sessionUser = req.session?.user;
  if (!sessionUser) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  req.user = sessionUser;
  next();
};

// Middleware to check if user has image edit permission
const requireImageEditPermission = (req: any, res: any, next: any) => {
  const sessionUser = req.session?.user;
  if (!sessionUser || (sessionUser.role !== "manager" && sessionUser.role !== "admin")) {
    return res.status(403).json({ message: "Forbidden - insufficient permissions" });
  }
  req.user = sessionUser;
  next();
};

const requireAdminOrManager = requireImageEditPermission;

/** Strip password (and other secrets) before sending user objects to clients / session */
function sanitizeUser<T extends { password?: string }>(user: T): Omit<T, "password"> {
  const { password: _pw, ...safe } = user;
  return safe;
}

function sanitizeUsers<T extends { password?: string }>(users: T[]) {
  return users.map(sanitizeUser);
}

function isAdminOrManager(sessionUser: any): boolean {
  return !!sessionUser && (sessionUser.role === "admin" || sessionUser.role === "manager");
}

function sessionAllowedPortals(sessionUser: any) {
  return normalizeAllowedPortals(sessionUser?.portals);
}

function denyPortalAccess(res: any) {
  return res.status(403).json({ message: "Bạn không có quyền truy cập portal này" });
}

/** Owner, staff, anonymous (no userId), or any attempt on a demo exam. */
async function canAccessExamAttempt(
  attempt: { userId?: string | null; examId: string },
  sessionUser: any
): Promise<boolean> {
  if (!attempt.userId) return true;
  if (sessionUser?.id === attempt.userId) return true;
  if (isAdminOrManager(sessionUser)) return true;
  const exam = await storage.getExam(attempt.examId);
  return !!exam?.isDemo;
}

/**
 * Exam Section Data Format Helpers
 * 
 * These helpers ensure backward compatibility between legacy and new exam section formats:
 * - Legacy format: section.questionIds = ["q1", "q2", ...]
 * - New format: section.questionSets = [{id, name, questions: ["q1", "q2"]}, ...]
 * 
 * IMPORTANT: All backend consumers of exam.sections must use these helpers to avoid
 * regressions when accessing section question data. Never directly access section.questionIds
 * without first normalizing via these functions.
 */

// Helper function to migrate legacy exam sections to question sets structure
const migrateLegacySections = (sections: any[]): any[] => {
  if (!Array.isArray(sections)) return sections;
  
  return sections.map(section => {
    // If section has questionIds but no questionSets, migrate to new structure
    if (section.questionIds && !section.questionSets) {
      return {
        ...section,
        questionSets: [{
          id: "qs-1",
          name: "",
          questionIds: section.questionIds,
        }],
        questionIds: undefined // Remove legacy field
      };
    }
    // Normalize sets that only have `questions` (IDs or objects) → questionIds
    if (section.questionSets && Array.isArray(section.questionSets)) {
      return {
        ...section,
        questionSets: section.questionSets.map((qs: any, idx: number) => {
          const fromIds = Array.isArray(qs.questionIds) ? qs.questionIds : null;
          const fromQuestions = Array.isArray(qs.questions)
            ? qs.questions.map((q: any) => (typeof q === "string" ? q : q?.id)).filter(Boolean)
            : [];
          return {
            id: qs.id || `qs-${idx + 1}`,
            name: qs.name || "",
            questionIds: fromIds && fromIds.length > 0 ? fromIds : fromQuestions,
          };
        }),
      };
    }
    return section;
  });
};

// Helper function to extract all question IDs from question sets (supports both formats)
const extractQuestionIds = (section: any): string[] => {
  // New structure: questionSets with questionIds OR questions arrays
  if (section.questionSets && Array.isArray(section.questionSets)) {
    return section.questionSets.flatMap((set: any) => {
      if (Array.isArray(set.questionIds)) return set.questionIds.filter(Boolean);
      if (Array.isArray(set.questions)) {
        return set.questions
          .map((q: any) => (typeof q === "string" ? q : q?.id))
          .filter(Boolean);
      }
      return [];
    });
  }
  // Legacy structure: questionIds array
  if (section.questionIds && Array.isArray(section.questionIds)) {
    return section.questionIds.filter(Boolean);
  }
  return [];
};

// Helper function to calculate total time limit from sections
const calculateTotalTimeLimit = (exam: any): number => {
  if (exam.sections && Array.isArray(exam.sections)) {
    return exam.sections.reduce((total: number, section: any) => {
      return total + (section.timeLimit || 0);
    }, 0);
  }
  // Legacy format
  return (exam.vocabularyTimeLimit || 0) + 
         (exam.grammarTimeLimit || 0) + 
         (exam.listeningTimeLimit || 0) + 
         (exam.readingTimeLimit || 0);
};

// Helper function to calculate total question count from sections
const calculateQuestionCount = (exam: any): number => {
  if (exam.sections && Array.isArray(exam.sections)) {
    return exam.sections.reduce((total: number, section: any) => {
      return total + extractQuestionIds(section).length;
    }, 0);
  }
  // Legacy format
  const legacyCount = [
    ...(Array.isArray(exam.vocabularyQuestions) ? exam.vocabularyQuestions : []),
    ...(Array.isArray(exam.grammarQuestions) ? exam.grammarQuestions : []),
    ...(Array.isArray(exam.listeningQuestions) ? exam.listeningQuestions : []),
    ...(Array.isArray(exam.readingQuestions) ? exam.readingQuestions : [])
  ].length;
  return legacyCount;
};

/** Ensure CMS image URLs use the R2 proxy path (works without public bucket URL). */
function normalizeUiImagePublicUrl(url: string): string {
  if (!url || url.startsWith("/api/proxy-image/")) return url;
  const legacyApi = url.match(/^\/api\/ui-images\/([^/?]+)$/i);
  if (legacyApi?.[1]) {
    return `/api/proxy-image/primary/ui-images/${legacyApi[1]}`;
  }
  const legacyBare = url.match(/^\/ui-images\/([^/?]+)$/i);
  if (legacyBare?.[1]) {
    return `/api/proxy-image/primary/ui-images/${legacyBare[1]}`;
  }
  return url;
}

async function resolveExamAccessForSession(
  exam: any,
  sessionUser: { id: string; role?: string } | null | undefined,
) {
  const activeLevels = sessionUser?.id
    ? await listActiveLevelsForUser(sessionUser.id)
    : [];
  const activePackageIds = sessionUser?.id
    ? await listActivePackageIdsForUser(sessionUser.id)
    : [];
  let packagePriceVnd: number | null = null;
  if (exam.packageId) {
    const pkg = await getExamPackage(exam.packageId);
    packagePriceVnd = pkg?.priceVnd ?? null;
  } else if (exam.level) {
    const pkgs = await listExamPackages({ activeOnly: true });
    const pkg = pkgs.find((p) => p.level === exam.level);
    packagePriceVnd = pkg?.priceVnd ?? null;
  }
  return resolveExamAccess({
    exam,
    userId: sessionUser?.id,
    role: sessionUser?.role,
    activeLevels,
    activePackageIds,
    packagePriceVnd,
  });
}

function buildTrialClientState(
  exam: any,
  questionsById: Map<string, any>,
  bodyTrialIds?: unknown,
): {
  accessMode: "trial";
  trialQuestionIds: string[];
  trialSectionIds: string[];
} {
  const validIds = collectValidAnswerIds(questionsById);
  let trialQuestionIds: string[];
  let trialSectionIds: string[];

  if (Array.isArray(bodyTrialIds) && bodyTrialIds.length > 0) {
    trialQuestionIds = bodyTrialIds
      .filter((id): id is string => typeof id === "string" && validIds.has(id))
      .slice(0, EXAM_TRIAL_QUESTION_LIMIT);
    if (trialQuestionIds.length === 0) {
      const computed = computeTrialQuestionIds(
        exam,
        questionsById,
        EXAM_TRIAL_QUESTION_LIMIT,
      );
      trialQuestionIds = computed.questionIds;
      trialSectionIds = computed.sectionIds;
    } else {
      trialSectionIds = sectionIdsForQuestionIds(
        exam,
        trialQuestionIds,
        questionsById,
      );
    }
  } else {
    const computed = computeTrialQuestionIds(
      exam,
      questionsById,
      EXAM_TRIAL_QUESTION_LIMIT,
    );
    trialQuestionIds = computed.questionIds;
    trialSectionIds = computed.sectionIds;
  }

  return {
    accessMode: "trial",
    trialQuestionIds,
    trialSectionIds,
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(portalMiddleware);
  registerCommerceRoutes(app);

  // Serve static files from frontend/public directory
  const path = await import('path');
  const fs = await import('fs');
  
  app.get("/api/static/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.resolve(import.meta.dirname, '..', 'frontend', 'public', filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }
      
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error serving static file:", error);
      res.status(500).json({ message: "Error serving file" });
    }
  });

  // Auth endpoint - returns current user information
  app.get("/api/auth/user", async (req, res) => {
    try {
      // Check if user is authenticated via session
      const sessionUser = (req.session as any)?.user;
      
      if (!sessionUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Return sanitized user (password never in session after login fix)
      res.json(sanitizeUser(sessionUser));
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  app.get("/api/auth/google/config", (_req, res) => {
    const clientId = getGoogleClientId();
    res.json({
      enabled: isGoogleAuthConfigured(),
      clientId: clientId || null,
    });
  });

  app.post("/api/auth/google", async (req, res) => {
    try {
      if (!isGoogleAuthConfigured()) {
        return res.status(503).json({
          success: false,
          message: "Đăng nhập Google chưa được cấu hình. Vui lòng dùng email hoặc liên hệ hỗ trợ.",
        });
      }

      const credential = String(req.body?.credential || "").trim();
      if (!credential) {
        return res.status(400).json({
          success: false,
          message: "Thiếu thông tin xác thực Google",
        });
      }

      const profile = await verifyGoogleCredential(credential);
      const { user, isNew } = await findOrCreateGoogleUser(storage, profile);

      (req.session as any).user = sanitizeUser(user);

      res.json({
        success: true,
        isNew,
        message: isNew ? "Đăng ký thành công!" : "Đăng nhập thành công",
        user: sanitizeUser(user),
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "EMAIL_NOT_VERIFIED") {
        return res.status(400).json({
          success: false,
          message: "Email Google chưa được xác minh. Vui lòng xác minh email trên Google rồi thử lại.",
        });
      }
      if (code === "EMAIL_LINKED_OTHER_GOOGLE") {
        return res.status(409).json({
          success: false,
          message: "Email này đã liên kết với tài khoản Google khác.",
        });
      }
      if (code === "INVALID_GOOGLE_TOKEN") {
        return res.status(401).json({
          success: false,
          message: "Phiên Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.",
        });
      }
      console.error("Google auth error:", error);
      res.status(500).json({
        success: false,
        message: "Có lỗi xảy ra khi đăng nhập Google. Vui lòng thử lại sau.",
      });
    }
  });

  // Registration endpoint — requires email OTP (Resend)
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { code: verificationCode, ...rawBody } = req.body || {};
      const formData = registrationFormSchema.parse(rawBody);

      if (!verificationCode || !/^\d{6}$/.test(String(verificationCode))) {
        return res.status(400).json({
          success: false,
          message: "Mã xác minh email là bắt buộc",
        });
      }

      const phone = (formData.phone || "").trim();

      const [usernameExists, emailExists, phoneExists] = await Promise.all([
        storage.checkUsernameExists(formData.username.toLowerCase()),
        storage.checkEmailExists(formData.email.toLowerCase()),
        phone ? storage.checkPhoneExists(phone) : Promise.resolve(false),
      ]);

      if (usernameExists) {
        return res.status(409).json({
          success: false,
          message: "Tên đăng nhập đã tồn tại",
        });
      }

      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: "Email đã được sử dụng",
        });
      }

      if (phoneExists) {
        return res.status(409).json({
          success: false,
          message: "Số điện thoại đã được sử dụng",
        });
      }

      const otpResult = await storage.verifyEmailCode(
        formData.email.toLowerCase(),
        String(verificationCode),
        "registration",
        { consume: false },
      );
      if (!otpResult.success) {
        return res.status(400).json({
          success: false,
          message: otpResult.error || "Mã xác minh không hợp lệ hoặc đã hết hạn",
        });
      }

      let newUser;
      try {
        newUser = await storage.createUser({
          username: formData.username.toLowerCase(),
          fullName: formData.fullName || null,
          email: formData.email.toLowerCase(),
          phone: phone || null,
          password: formData.password,
          role: "user",
        });
      } catch (createErr) {
        console.error("Registration createUser error:", createErr);
        return res.status(409).json({
          success: false,
          message: "Tên đăng nhập hoặc email đã được sử dụng",
        });
      }

      if (otpResult.verificationId) {
        await storage.markEmailVerificationUsed(otpResult.verificationId);
      }

      (req.session as any).user = sanitizeUser(newUser);

      res.json({
        success: true,
        message: "Đăng ký thành công!",
        autoLogin: true,
        user: sanitizeUser(newUser),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        res.status(400).json({
          success: false,
          message: firstError.message,
        });
      } else {
        console.error("Registration error:", error);
        res.status(500).json({
          success: false,
          message: "Có lỗi xảy ra, vui lòng thử lại sau",
        });
      }
    }
  });

  async function dispatchRegistrationOtp(email: string) {
    const normalized = email.toLowerCase();
    const emailExists = await storage.checkEmailExists(normalized);
    if (emailExists) {
      return {
        status: 400 as const,
        body: {
          success: false,
          message: "Email đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.",
        },
      };
    }

    if (!checkRateLimit(normalized, 3, 5)) {
      const rateLimitInfo = getRateLimitRemaining(normalized);
      return {
        status: 429 as const,
        body: {
          success: false,
          message: `Vui lòng đợi ${rateLimitInfo.resetInSeconds} giây trước khi yêu cầu mã mới`,
          retryAfter: rateLimitInfo.resetInSeconds,
        },
      };
    }

    if (!isEmailServiceConfigured()) {
      return {
        status: 503 as const,
        body: {
          success: false,
          message:
            "Hệ thống email chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.",
        },
      };
    }

    const code = generateOTPCode();
    const expiresAt = getExpirationTime(5);
    await storage.createEmailVerification(normalized, code, "registration", expiresAt);
    const emailResult = await sendVerificationEmail(normalized, code, "registration");
    if (!emailResult.success) {
      await storage.deleteVerificationsByEmail(normalized, "registration");
      return {
        status: 500 as const,
        body: {
          success: false,
          message: emailResult.error || "Không thể gửi email xác minh",
        },
      };
    }

    return {
      status: 200 as const,
      body: {
        success: true,
        emailDispatched: true,
        message:
          "Mã xác minh đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư (và thư rác).",
        expiresIn: 300,
      },
    };
  }

  app.post("/api/auth/send-verification", async (req, res) => {
    try {
      const { email, type } = req.body || {};
      if (!email || type !== "registration") {
        return res.status(400).json({
          success: false,
          message: "Email và loại xác minh không hợp lệ",
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(email))) {
        return res.status(400).json({
          success: false,
          message: "Định dạng email không hợp lệ",
        });
      }

      const result = await dispatchRegistrationOtp(String(email));
      res.status(result.status).json(result.body);
    } catch (error) {
      console.error("Send verification error:", error);
      res.status(500).json({
        success: false,
        message: "Có lỗi xảy ra, vui lòng thử lại sau",
      });
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email, type } = req.body || {};
      if (!email || type !== "registration") {
        return res.status(400).json({
          success: false,
          message: "Email và loại xác minh không hợp lệ",
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(email))) {
        return res.status(400).json({
          success: false,
          message: "Định dạng email không hợp lệ",
        });
      }

      const result = await dispatchRegistrationOtp(String(email));
      res.status(result.status).json(result.body);
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({
        success: false,
        message: "Có lỗi xảy ra, vui lòng thử lại sau",
      });
    }
  });

  // Check availability endpoints
  app.post("/api/auth/check-username", async (req, res) => {
    try {
      const { username } = req.body;
      if (!username || username.length < 8 || username.length > 30) {
        return res.status(400).json({ available: false, message: "Tên đăng nhập phải có từ 8-30 ký tự" });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({
          available: false,
          message: "Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới",
        });
      }

      const exists = await storage.checkUsernameExists(username.toLowerCase());
      res.json({ 
        available: !exists, 
        message: exists ? "Tên đăng nhập đã tồn tại" : "Tên đăng nhập có thể sử dụng"
      });
    } catch (error) {
      res.status(500).json({ available: false, message: "Lỗi kiểm tra tên đăng nhập" });
    }
  });

  app.post("/api/auth/check-email", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ available: false, message: "Email không hợp lệ" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ available: false, message: "Email không hợp lệ" });
      }

      const exists = await storage.checkEmailExists(email.toLowerCase());
      res.json({ 
        available: !exists, 
        message: exists ? "Email đã được sử dụng" : "Email có thể sử dụng"
      });
    } catch (error) {
      res.status(500).json({ available: false, message: "Lỗi kiểm tra email" });
    }
  });

  app.post("/api/auth/check-phone", async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone || !String(phone).trim()) {
        return res.json({ available: true, message: "Số điện thoại tuỳ chọn" });
      }
      
      const exists = await storage.checkPhoneExists(String(phone).trim());
      res.json({ 
        available: !exists, 
        message: exists ? "Số điện thoại đã được sử dụng" : "Số điện thoại có thể sử dụng"
      });
    } catch (error) {
      res.status(500).json({ available: false, message: "Lỗi kiểm tra số điện thoại" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    (req.session as any).user = null;
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Có lỗi xảy ra khi đăng xuất" });
      }
      res.json({ success: true, message: "Đăng xuất thành công" });
    });
  });

  // Users endpoint - for managers and admins
  app.get("/api/users", requireAdminOrManager, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(sanitizeUsers(users));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy danh sách người dùng" });
    }
  });

  // Create new user
  app.post("/api/users", requireAdminOrManager, async (req, res) => {
    try {
      const { username, fullName, email, phone, password, role, portals } = req.body;
      
      if (!username || !password || !role) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username.toLowerCase());
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }

      const newUser = await storage.createUser({ 
        username: username.toLowerCase(), 
        fullName: fullName || null,
        email: email || null,
        phone: phone || null,
        password, 
        role,
        portals: role === "user" ? null : sanitizePortalsInput(portals),
      });
      res.status(201).json(sanitizeUser(newUser));
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Update user
  app.put("/api/users/:id", requireAdminOrManager, async (req, res) => {
    try {
      const { id } = req.params;
      const { username, fullName, email, phone, password, role, portals } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }

      const nextRole = role || "user";
      const updateData: any = { 
        username: username.toLowerCase(), 
        fullName: fullName || null,
        email: email || null,
        phone: phone || null,
        role: nextRole,
        portals: nextRole === "user" ? null : sanitizePortalsInput(portals),
      };
      
      if (password) {
        updateData.password = password;
      }

      const updatedUser = await storage.updateUser(id, updateData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(sanitizeUser(updatedUser));
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user
  app.delete("/api/users/:id", requireAdminOrManager, async (req, res) => {
    try {
      const { id } = req.params;
      
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Registration requests endpoints
  app.get("/api/registration-requests", requireAdminOrManager, async (req, res) => {
    try {
      const registrations = await storage.getAllRegistrationRequests();
      res.json(sanitizeUsers(registrations as any));
    } catch (error) {
      console.error("Error fetching registration requests:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy danh sách đăng ký" });
    }
  });

  app.post("/api/registration-requests/:id/approve", requireAdminOrManager, async (req, res) => {
    try {
      const { id } = req.params;
      const sessionUser = (req as any).user;

      // Get registration request
      const registrationRequest = await storage.getRegistrationRequest(id);
      if (!registrationRequest || registrationRequest.status !== 'pending') {
        return res.status(404).json({ message: "Registration request not found or already processed" });
      }

      // Create user account
      const newUser = await storage.createUser({
        username: registrationRequest.username,
        fullName: registrationRequest.fullName || null,
        email: registrationRequest.email,
        phone: registrationRequest.phone,
        password: registrationRequest.password,
        role: "user"
      });

      await storage.deleteRegistrationRequest(id);

      res.json({ 
        success: true, 
        message: "Đã duyệt đăng ký và tạo tài khoản thành công",
        user: sanitizeUser(newUser),
        reviewedBy: sessionUser?.id,
      });
    } catch (error) {
      console.error("Error approving registration:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi duyệt đăng ký" });
    }
  });

  app.delete("/api/registration-requests/:id", requireAdminOrManager, async (req, res) => {
    try {
      const { id } = req.params;
      const sessionUser = (req.session as any)?.user;
      
      if (!sessionUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const registrationRequest = await storage.getRegistrationRequest(id);
      if (!registrationRequest) {
        return res.status(404).json({ message: "Registration request not found" });
      }

      await storage.deleteRegistrationRequest(id);

      res.json({ 
        success: true, 
        message: "Đã xóa yêu cầu đăng ký" 
      });
    } catch (error) {
      console.error("Error deleting registration:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi xóa yêu cầu đăng ký" });
    }
  });

  // Exam system endpoints
  app.get("/api/exams", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      const includeInactive =
        req.query.includeInactive === "1" || req.query.includeInactive === "true";
      const canManage =
        sessionUser &&
        (sessionUser.role === "admin" || sessionUser.role === "manager");

      const exams =
        includeInactive && canManage
          ? await storage.getAllExams()
          : await storage.getActiveExams();

      // Migrate legacy sections and compute list fields without N+1 question loads
      const migratedExams = exams.map((exam) => {
        const migratedSections = exam.sections ? migrateLegacySections(exam.sections as any[]) : exam.sections;
        const examWithMigratedSections = { ...exam, sections: migratedSections };
        
        return {
          ...examWithMigratedSections,
          timeLimit: calculateTotalTimeLimit(examWithMigratedSections),
          questionCount: calculateQuestionCount(examWithMigratedSections),
        };
      });
      res.json(migratedExams);
    } catch (error) {
      console.error("Error fetching exams:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy danh sách đề thi" });
    }
  });

  // Get attempt count for all exams (for admin/manager) - MUST be before /api/exams/:id
  app.get("/api/exams/attempt-counts", requireAdminOrManager, async (req, res) => {
    try {
      const counts = await storage.getExamAttemptCounts();
      res.json(counts);
    } catch (error) {
      console.error("Error fetching attempt counts:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy số lượng lượt thi" });
    }
  });

  app.get("/api/exams/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const exam = await storage.getExam(id);
      if (!exam) {
        return res.status(404).json({ message: "Không tìm thấy đề thi" });
      }

      const sessionUser = (req.session as any)?.user;
      if (exam.isActive === false && !isAdminOrManager(sessionUser)) {
        return res.status(404).json({ message: "Không tìm thấy đề thi" });
      }

      // Migrate legacy sections to question sets structure
      const migratedExam = {
        ...exam,
        sections: exam.sections ? migrateLegacySections(exam.sections as any[]) : exam.sections
      };
      res.json(migratedExam);
    } catch (error) {
      console.error("Error fetching exam:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy thông tin đề thi" });
    }
  });

  app.get("/api/exams/:id/questions", async (req, res) => {
    try {
      const { id } = req.params;
      const exam = await storage.getExam(id);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      const sessionUser = (req.session as any)?.user;
      if (exam.isActive === false && !isAdminOrManager(sessionUser)) {
        return res.status(404).json({ message: "Exam not found" });
      }

      const access = await resolveExamAccessForSession(exam, sessionUser);
      if (access.mode === "denied") {
        return res.status(access.requiresLogin ? 401 : 403).json({
          message: access.reason || "Không có quyền xem câu hỏi",
        });
      }

      const questionsById = await loadQuestionsByIdForExam(id);
      let allQuestions = [...questionsById.values()];

      if (access.mode === "trial") {
        let allowedIds: Set<string> | null = null;
        if (sessionUser?.id) {
          const existing = await storage.getInProgressExamAttempt(id, sessionUser.id);
          if (existing?.clientState) {
            const attemptTrial = readTrialAttemptState(existing.clientState);
            if (attemptTrial.trialQuestionIds.size > 0) {
              allowedIds = attemptTrial.trialQuestionIds;
            }
          }
        }
        if (!allowedIds) {
          const { questionIds } = computeTrialQuestionIds(
            exam,
            questionsById,
            EXAM_TRIAL_QUESTION_LIMIT,
          );
          allowedIds = new Set(questionIds);
        }
        allQuestions = filterQuestionsForTrialIds(allQuestions, allowedIds);
      }

      res.json(allQuestions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy câu hỏi" });
    }
  });

  // Question Bank API endpoints
  app.get("/api/questions", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { q, category } = req.query;
      
      let parentQuestions;
      if (q && typeof q === 'string') {
        parentQuestions = await storage.searchQuestions(q);
      } else if (category && typeof category === 'string') {
        parentQuestions = await storage.getQuestionsByCategory(category);
      } else {
        parentQuestions = await storage.getAllQuestions();
      }
      
      // For each parent question, fetch its sub-questions
      const questionsWithSubs = await Promise.all(
        parentQuestions.map(async (parent) => {
          const subQuestions = await storage.getSubQuestions(parent.id);
          return {
            ...parent,
            subQuestions: subQuestions.length > 0 ? subQuestions : undefined
          };
        })
      );
      
      res.json(questionsWithSubs);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy danh sách câu hỏi" });
    }
  });

  app.get("/api/questions/category/:category", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { category } = req.params;
      const questions = await storage.getQuestionsByCategory(category);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching questions by category:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy câu hỏi theo danh mục" });
    }
  });

  // Add question to exam
  app.post("/api/exams/:examId/questions/:questionId", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { examId, questionId } = req.params;
      const { sortOrder } = req.body;

      const success = await storage.addQuestionToExam(examId, questionId, sortOrder || 0);
      
      if (!success) {
        return res.status(404).json({ message: "Exam or question not found" });
      }

      res.json({ message: "Question added to exam successfully" });
    } catch (error) {
      console.error("Error adding question to exam:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi thêm câu hỏi vào đề thi" });
    }
  });

  // Remove question from exam
  app.delete("/api/exams/:examId/questions/:questionId", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { examId, questionId } = req.params;

      const success = await storage.removeQuestionFromExam(examId, questionId);
      
      if (!success) {
        return res.status(404).json({ message: "Question not found in this exam" });
      }

      res.json({ message: "Question removed from exam successfully" });
    } catch (error) {
      console.error("Error removing question from exam:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi xóa câu hỏi khỏi đề thi" });
    }
  });

  // --- Exam attempt session (server-side draft + submit) ---

  app.post("/api/exam-attempts/start", async (req, res) => {
    try {
      const { examId, trialQuestionIds: bodyTrialIds } = req.body || {};
      const sessionUser = (req.session as any)?.user;
      if (!examId || typeof examId !== "string") {
        return res.status(400).json({ message: "Thiếu mã đề thi" });
      }

      const exam = await storage.getExam(examId);
      if (!exam) {
        return res.status(404).json({ message: "Không tìm thấy đề thi" });
      }
      if (exam.isActive === false) {
        return res.status(403).json({ message: "Đề thi này hiện không mở để làm bài" });
      }

      const access = await resolveExamAccessForSession(exam, sessionUser);

      if (access.mode === "denied") {
        return res.status(access.requiresLogin ? 401 : 403).json({
          message: access.reason || "Không có quyền thi đề này",
          access,
        });
      }

      const questionsById = await loadQuestionsByIdForExam(examId);
      let clientState: Record<string, unknown> = { accessMode: access.mode };
      if (access.mode === "trial") {
        clientState = buildTrialClientState(exam, questionsById, bodyTrialIds);
      }

      // Resume existing in-progress attempt for logged-in users (anti-duplicate session)
      if (sessionUser?.id) {
        const existing = await storage.getInProgressExamAttempt(examId, sessionUser.id);
        if (existing) {
          const existingTrial = readTrialAttemptState(existing.clientState);
          const cs =
            existing.clientState && typeof existing.clientState === "object"
              ? {
                  ...(existing.clientState as object),
                  accessMode: access.mode,
                  ...(access.mode === "trial" && !existingTrial.trialQuestionIds.size
                    ? {
                        trialQuestionIds: clientState.trialQuestionIds,
                        trialSectionIds: clientState.trialSectionIds,
                      }
                    : {}),
                }
              : clientState;
          if (!(existing.clientState as any)?.accessMode) {
            await storage.updateExamAttempt(existing.id, { clientState: cs } as any);
          }
          return res.json({ ...existing, clientState: cs, accessMode: access.mode });
        }
      }

      const attempt = await storage.createExamAttempt({
        examId,
        userId: sessionUser?.id || null,
        status: "in_progress",
        sectionResults: [],
        totalScore: 0,
        totalTimeSpent: 0,
        waitTimeBetweenSections: 0,
        startedAt: new Date(),
        completedAt: null,
        clientState,
        scoringSnapshot: null,
      } as any);

      res.status(201).json({ ...attempt, accessMode: access.mode });
    } catch (error) {
      console.error("Error starting exam attempt:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi bắt đầu bài thi" });
    }
  });

  // --- Exam packages catalog + purchase / duyệt ---

  app.get("/api/exam-packages", async (_req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      await ensureDefaultExamPackages();
      const packages = await listExamPackages({ activeOnly: true });
      const withCounts = await Promise.all(
        packages.map(async (p) => {
          const linkedExamCount = await countExamsInPackage(p.id);
          return {
            ...p,
            linkedExamCount,
            displayExamCount: resolveDisplayExamCount(
              p.examCount,
              linkedExamCount,
            ),
          };
        }),
      );
      res.json(withCounts);
    } catch (error) {
      console.error("Error listing exam packages:", error);
      res.status(500).json({ message: "Không tải được danh sách gói đề" });
    }
  });

  app.get("/api/exam-packages/me", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser?.id) {
        return res.status(401).json({ message: "Cần đăng nhập" });
      }
      const rows = await listEntitlementsForUser(sessionUser.id);
      const activeLevels = rows
        .filter((r) => r.status === "active")
        .map((r) => r.level)
        .filter(Boolean);
      const activePackageIds = rows
        .filter((r) => r.status === "active" && r.packageId)
        .map((r) => r.packageId as string);
      res.json({
        entitlements: rows,
        activeLevels,
        activePackageIds,
      });
    } catch (error) {
      console.error("Error listing exam package entitlements:", error);
      res.status(500).json({ message: "Không tải được quyền luyện thi" });
    }
  });

  app.post("/api/exam-packages/request", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser?.id) {
        return res.status(401).json({ message: "Cần đăng nhập để mua gói đề" });
      }
      const packageId = req.body?.packageId;
      const level = req.body?.level;
      const note =
        typeof req.body?.note === "string" ? req.body.note : undefined;

      let row;
      if (typeof packageId === "string" && packageId) {
        row = await requestExamPackageById({
          userId: sessionUser.id,
          packageId,
          note,
        });
      } else if (isExamLevel(level)) {
        row = await requestExamPackage({
          userId: sessionUser.id,
          level,
          note,
        });
      } else {
        return res.status(400).json({ message: "Thiếu packageId hoặc level" });
      }
      res.status(201).json(row);
    } catch (error: any) {
      console.error("Error requesting exam package:", error);
      res.status(400).json({
        message: error?.message || "Không gửi được yêu cầu mua gói",
      });
    }
  });

  app.get("/api/payment-status", (_req, res) => {
    res.json({
      payosConfigured: isPayosConfigured(),
    });
  });

  app.get("/api/payment-display", async (req, res) => {
    try {
      const portal =
        typeof req.query.portal === "string" ? req.query.portal : "luyenthi";
      const settings = await getPaymentSettings(portal);
      const amount =
        typeof req.query.amount === "string"
          ? Number.parseInt(req.query.amount, 10)
          : undefined;
      const level =
        typeof req.query.level === "string" ? req.query.level : undefined;
      const username =
        typeof req.query.username === "string" ? req.query.username : undefined;
      const packageName =
        typeof req.query.package === "string" ? req.query.package : undefined;

      const display = buildPaymentDisplay(settings, {
        amount: Number.isFinite(amount) ? amount : undefined,
        level,
        username,
        packageName,
      });
      res.json(display);
    } catch (error) {
      console.error("Error loading payment display:", error);
      res.status(500).json({ message: "Không tải được thông tin thanh toán" });
    }
  });

  app.get("/api/admin/payment-settings", requireAdminOrManager, async (req, res) => {
    try {
      const portal =
        typeof req.query.portal === "string" ? req.query.portal : "luyenthi";
      const settings = await getPaymentSettings(portal);
      res.json({
        settings: settings ?? null,
        payosConfigured: isPayosConfigured(),
      });
    } catch (error) {
      console.error("Error loading admin payment settings:", error);
      res.status(500).json({ message: "Không tải được cấu hình thanh toán" });
    }
  });

  app.put("/api/admin/payment-settings", requireAdminOrManager, async (req, res) => {
    try {
      const portal =
        typeof req.body?.portal === "string" ? req.body.portal : "luyenthi";
      const bankCode = String(req.body?.bankCode ?? "").trim();
      const bankName = String(req.body?.bankName ?? "").trim();
      const accountNumber = String(req.body?.accountNumber ?? "").trim();
      const accountName = String(req.body?.accountName ?? "").trim();
      const transferTemplate = String(
        req.body?.transferTemplate ?? "LT {level} {username}",
      ).trim();

      if (!bankCode || !accountNumber || !accountName) {
        return res.status(400).json({
          message: "Cần mã ngân hàng, số tài khoản và tên chủ tài khoản",
        });
      }

      const row = await upsertPaymentSettings(portal, {
        bankCode,
        bankName: bankName || bankCode,
        accountNumber,
        accountName,
        transferTemplate,
      });
      res.json({
        settings: row,
        payosConfigured: isPayosConfigured(),
      });
    } catch (error: any) {
      console.error("Error saving payment settings:", error);
      res.status(400).json({
        message: error?.message || "Không lưu được cấu hình thanh toán",
      });
    }
  });

  app.post("/api/exam-packages/checkout", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser?.id) {
        return res.status(401).json({ message: "Cần đăng nhập để thanh toán" });
      }

      const packageId = req.body?.packageId;
      if (typeof packageId !== "string" || !packageId) {
        return res.status(400).json({ message: "Thiếu packageId" });
      }

      if (!isPayosConfigured()) {
        return res.status(503).json({
          message:
            "Thanh toán tự động chưa bật. Dùng chuyển khoản thủ công hoặc liên hệ quản trị.",
          payosConfigured: false,
        });
      }

      const { order, pkg } = await createExamPackageOrder({
        userId: sessionUser.id,
        packageId,
      });

      const baseUrl = resolvePublicBaseUrl({
        host: req.get("x-forwarded-host") || req.get("host"),
        forwardedProto: req.get("x-forwarded-proto"),
        protocol: req.protocol,
        portal: req.portal || "luyenthi",
      });
      const returnUrl = process.env.PAYOS_RETURN_URL
        ? buildPayosReturnUrl(
            process.env.PAYOS_RETURN_URL,
            order.code,
            "exam-package",
          )
        : `${baseUrl}/checkout/success?order=${encodeURIComponent(order.code)}&type=exam-package`;
      const cancelUrl = process.env.PAYOS_CANCEL_URL
        ? buildPayosCancelUrl(
            process.env.PAYOS_CANCEL_URL,
            order.code,
            "exam-package",
          )
        : `${baseUrl}/checkout/cancel?order=${encodeURIComponent(order.code)}&type=exam-package`;

      const payment = await createPayosPaymentLink({
        orderCode: order.payosOrderCode,
        amount: order.amountVnd,
        description: `Goi ${pkg.level || pkg.name}`.slice(0, 25),
        returnUrl,
        cancelUrl,
        buyerName: sessionUser.fullName || sessionUser.username,
        buyerEmail: sessionUser.email || undefined,
      });

      await updateExamPackageOrderPayment(order.id, {
        paymentLinkId: payment.paymentLinkId,
        checkoutUrl: payment.checkoutUrl,
      });

      res.status(201).json({
        orderCode: order.code,
        checkoutUrl: payment.checkoutUrl,
        payosConfigured: true,
      });
    } catch (error: any) {
      console.error("exam package checkout error:", error);
      res.status(400).json({
        message: error?.message || "Không tạo được link thanh toán",
      });
    }
  });

  app.get("/api/exam-package-orders/:code", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      const data = await getExamPackageOrderWithPackage(req.params.code);
      if (!data) {
        return res.status(404).json({ message: "Không tìm thấy đơn gói đề" });
      }
      const isStaff =
        sessionUser?.role === "admin" || sessionUser?.role === "manager";
      const isOwner = sessionUser?.id === data.order.userId;

      const payload = {
        code: data.order.code,
        status: data.order.status,
        amountVnd: data.order.amountVnd,
        packageName: data.package?.name ?? null,
        packageLevel: data.package?.level ?? null,
        paidAt: data.order.paidAt,
      };

      if (isOwner || isStaff) {
        return res.json(payload);
      }

      // Anonymous polling on success page (code is unguessable)
      return res.json(payload);
    } catch (error) {
      console.error("Error loading exam package order:", error);
      res.status(500).json({ message: "Không tải được đơn gói đề" });
    }
  });

  app.post("/api/exam-package-orders/:code/cancel", async (req, res) => {
    try {
      const order = await getExamPackageOrderByCode(req.params.code);
      if (!order) {
        return res.status(404).json({ message: "Không tìm thấy đơn gói đề" });
      }
      const updated = await cancelExamPackageOrder(order.id);
      res.json(updated);
    } catch (error) {
      console.error("Error cancelling exam package order:", error);
      res.status(500).json({ message: "Không hủy được đơn gói đề" });
    }
  });

  app.get("/api/exams/:id/access", async (req, res) => {
    try {
      const exam = await storage.getExam(req.params.id);
      if (!exam) {
        return res.status(404).json({ message: "Không tìm thấy đề thi" });
      }
      const sessionUser = (req.session as any)?.user;
      const access = await resolveExamAccessForSession(exam, sessionUser);
      let packagePriceVnd: number | null = null;
      if (exam.packageId) {
        const pkg = await getExamPackage(exam.packageId);
        packagePriceVnd = pkg?.priceVnd ?? null;
      } else if (exam.level) {
        const pkgs = await listExamPackages({ activeOnly: true });
        const pkg = pkgs.find((p) => p.level === exam.level);
        packagePriceVnd = pkg?.priceVnd ?? null;
      }
      res.json({
        ...access,
        priceVnd: packagePriceVnd ?? EXAM_PACKAGE_PRICE_VND,
        trialQuestionLimit: EXAM_TRIAL_QUESTION_LIMIT,
      });
    } catch (error) {
      console.error("Error resolving exam access:", error);
      res.status(500).json({ message: "Không kiểm tra được quyền thi" });
    }
  });

  app.get("/api/admin/exam-package-catalog", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (
        !sessionUser ||
        (sessionUser.role !== "admin" && sessionUser.role !== "manager")
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      await ensureDefaultExamPackages();
      const packages = await listExamPackages();
      const withCounts = await Promise.all(
        packages.map(async (p) => {
          const linkedExamCount = await countExamsInPackage(p.id);
          return {
            ...p,
            linkedExamCount,
            displayExamCount: resolveDisplayExamCount(
              p.examCount,
              linkedExamCount,
            ),
            examCount:
              linkedExamCount > 0 ? linkedExamCount : Math.max(0, p.examCount || 0),
          };
        }),
      );
      res.json(withCounts);
    } catch (error) {
      console.error("Error listing package catalog:", error);
      res.status(500).json({ message: "Không tải catalog gói đề" });
    }
  });

  app.get("/api/admin/exam-package-catalog/:id", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (
        !sessionUser ||
        (sessionUser.role !== "admin" && sessionUser.role !== "manager")
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const pkg = await getExamPackage(req.params.id);
      if (!pkg) {
        return res.status(404).json({ message: "Không tìm thấy gói" });
      }
      const packageExams = await listExamsInPackage(pkg.id);
      res.json({
        ...pkg,
        linkedExamCount: packageExams.length,
        exams: packageExams,
      });
    } catch (error) {
      console.error("Error fetching package detail:", error);
      res.status(500).json({ message: "Không tải được chi tiết gói đề" });
    }
  });

  app.put("/api/admin/exam-package-catalog/:id/exams", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (
        !sessionUser ||
        (sessionUser.role !== "admin" && sessionUser.role !== "manager")
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const examIds = Array.isArray(req.body?.examIds)
        ? req.body.examIds.map((id: unknown) => String(id))
        : [];
      if (examIds.length === 0) {
        return res.status(400).json({ message: "Cần chọn ít nhất 1 đề thi" });
      }
      const { linkedCount, missingIds } = await setPackageExams(req.params.id, examIds);
      res.json({ ok: true, linkedCount, missingIds });
    } catch (error) {
      console.error("Error updating package exams:", error);
      res.status(500).json({
        message:
          error instanceof Error ? error.message : "Không cập nhật được đề trong gói",
      });
    }
  });

  app.post("/api/admin/exam-package-catalog", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (
        !sessionUser ||
        (sessionUser.role !== "admin" && sessionUser.role !== "manager")
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { name, description, level, priceVnd, compareAtPriceVnd, isActive, sortOrder, examIds } =
        req.body || {};
      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Tên gói là bắt buộc" });
      }
      const ids = Array.isArray(examIds)
        ? examIds.map((id: unknown) => String(id))
        : [];
      const selling = isActive !== false;
      if (selling && ids.length === 0) {
        return res.status(400).json({
          message: "Gói đang bán cần có ít nhất 1 đề thi",
        });
      }
      if (selling && (Number(priceVnd) || 0) <= 0) {
        return res.status(400).json({
          message: "Gói đang bán cần giá lớn hơn 0",
        });
      }
      const row = await createExamPackage({
        name,
        description: description ?? null,
        level: level ?? null,
        examCount: ids.length,
        priceVnd: Number(priceVnd) || 0,
        compareAtPriceVnd,
        isActive: isActive !== false,
        sortOrder: Number(sortOrder) || 0,
      });
      const { missingIds: missingExamIds } = await setPackageExams(row.id, ids);
      const packageExams = await listExamsInPackage(row.id);
      const fresh = await getExamPackage(row.id);
      res.status(201).json({
        ...fresh,
        linkedExamCount: packageExams.length,
        displayExamCount: packageExams.length,
        exams: packageExams,
        missingExamIds,
      });
    } catch (error) {
      console.error("Error creating package:", error);
      res.status(500).json({ message: "Không tạo được gói đề" });
    }
  });

  app.patch("/api/admin/exam-package-catalog/:id", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (
        !sessionUser ||
        (sessionUser.role !== "admin" && sessionUser.role !== "manager")
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const updated = await updateExamPackage(req.params.id, {
        name: req.body?.name,
        description: req.body?.description,
        level: req.body?.level,
        priceVnd: req.body?.priceVnd,
        compareAtPriceVnd: req.body?.compareAtPriceVnd,
        isActive: req.body?.isActive,
        sortOrder: req.body?.sortOrder,
      });
      if (!updated) {
        return res.status(404).json({ message: "Không tìm thấy gói" });
      }
      const nextActive =
        req.body?.isActive !== undefined
          ? req.body.isActive !== false
          : updated.isActive;
      const nextPrice =
        req.body?.priceVnd !== undefined
          ? Number(req.body.priceVnd) || 0
          : updated.priceVnd;
      if (nextActive && nextPrice <= 0) {
        return res.status(400).json({
          message: "Gói đang bán cần giá lớn hơn 0",
        });
      }
      let missingExamIds: string[] = [];
      if (Array.isArray(req.body?.examIds)) {
        const examIds = req.body.examIds.map((id: unknown) => String(id));
        if (nextActive && examIds.length === 0) {
          return res.status(400).json({
            message: "Gói đang bán cần có ít nhất 1 đề thi",
          });
        }
        const linkResult = await setPackageExams(req.params.id, examIds);
        missingExamIds = linkResult.missingIds;
      }
      const packageExams = await listExamsInPackage(req.params.id);
      const fresh = await getExamPackage(req.params.id);
      const linkedExamCount = packageExams.length;
      res.json({
        ...fresh,
        linkedExamCount,
        displayExamCount: resolveDisplayExamCount(
          fresh?.examCount ?? 0,
          linkedExamCount,
        ),
        exams: packageExams,
        missingExamIds,
      });
    } catch (error) {
      console.error("Error updating package:", error);
      res.status(500).json({ message: "Không cập nhật được gói đề" });
    }
  });

  app.delete("/api/admin/exam-package-catalog/:id", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (
        !sessionUser ||
        (sessionUser.role !== "admin" && sessionUser.role !== "manager")
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const ok = await deleteExamPackage(req.params.id);
      if (!ok) {
        return res.status(404).json({ message: "Không tìm thấy gói" });
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("Error deleting package:", error);
      res.status(500).json({ message: "Không xóa được gói đề" });
    }
  });

  app.get("/api/admin/exam-packages", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (
        !sessionUser ||
        (sessionUser.role !== "admin" && sessionUser.role !== "manager")
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const rows = await listAllEntitlements();
      res.json(rows);
    } catch (error) {
      console.error("Error listing admin exam packages:", error);
      res.status(500).json({ message: "Không tải danh sách yêu cầu mua gói" });
    }
  });

  app.patch("/api/admin/exam-packages/:id", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (
        !sessionUser ||
        (sessionUser.role !== "admin" && sessionUser.role !== "manager")
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const status = req.body?.status;
      if (status !== "active" && status !== "rejected") {
        return res.status(400).json({ message: "status phải là active hoặc rejected" });
      }
      const updated = await reviewExamPackage({
        id: req.params.id,
        status,
        reviewedBy: sessionUser.id,
        note: typeof req.body?.note === "string" ? req.body.note : undefined,
      });
      if (!updated) {
        return res.status(404).json({ message: "Không tìm thấy yêu cầu" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error reviewing exam package:", error);
      res.status(500).json({ message: "Không cập nhật được yêu cầu" });
    }
  });

  app.post("/api/exam-attempts/:id/section-start", async (req, res) => {
    try {
      const { id } = req.params;
      const { sectionId } = req.body || {};
      const sessionUser = (req.session as any)?.user;
      if (!sectionId || typeof sectionId !== "string") {
        return res.status(400).json({ message: "Thiếu mã phần thi" });
      }

      const attempt = await storage.getExamAttempt(id);
      if (!attempt) {
        return res.status(404).json({ message: "Không tìm thấy phiên làm bài" });
      }
      if (!isAttemptOwner(attempt, sessionUser)) {
        return res.status(403).json({ message: "Bạn không có quyền với phiên này" });
      }
      const progressErr = assertInProgress(attempt);
      if (progressErr) {
        return res.status(409).json({ message: progressErr });
      }

      const exam = await storage.getExam(attempt.examId);
      if (!exam) {
        return res.status(404).json({ message: "Không tìm thấy đề thi" });
      }

      const questionsById = await loadQuestionsByIdForExam(attempt.examId);
      const sections = listExamSections(exam).filter((s) =>
        s.questionIds.some((qid) => questionsById.has(qid))
      );
      if (!sections.some((s) => s.id === sectionId)) {
        return res.status(400).json({ message: "Phần thi không hợp lệ" });
      }

      const now = new Date();
      let waitExtra = 0;
      if (attempt.lastSectionCompletedAt) {
        waitExtra = computeWaitSeconds(attempt.lastSectionCompletedAt, now);
      }

      const updated = await storage.updateExamAttempt(id, {
        currentSectionId: sectionId,
        sectionStartedAt: now,
        waitTimeBetweenSections:
          (attempt.waitTimeBetweenSections || 0) + waitExtra,
        lastSectionCompletedAt: null,
      } as any);

      res.json(updated);
    } catch (error) {
      console.error("Error starting section:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi bắt đầu phần thi" });
    }
  });

  app.put("/api/exam-attempts/:id/draft", async (req, res) => {
    try {
      const { id } = req.params;
      const { clientState, currentSectionAnswers } = req.body || {};
      const sessionUser = (req.session as any)?.user;

      const attempt = await storage.getExamAttempt(id);
      if (!attempt) {
        return res.status(404).json({ message: "Không tìm thấy phiên làm bài" });
      }
      if (!isAttemptOwner(attempt, sessionUser)) {
        return res.status(403).json({ message: "Bạn không có quyền với phiên này" });
      }
      const progressErr = assertInProgress(attempt);
      if (progressErr) {
        return res.status(409).json({ message: progressErr });
      }

      const questionsById = await loadQuestionsByIdForExam(attempt.examId);
      const validIds = collectValidAnswerIds(questionsById);
      const trialState = readTrialAttemptState(attempt.clientState);

      let draftAnswers: Record<string, string> | undefined;
      if (currentSectionAnswers && typeof currentSectionAnswers === "object") {
        let answersToFilter = currentSectionAnswers;
        if (trialState.isTrial && trialState.trialQuestionIds.size > 0) {
          const { filtered, disallowed } = filterAnswersToTrialIds(
            currentSectionAnswers,
            trialState.trialQuestionIds,
            validIds,
          );
          if (disallowed.length > 0) {
            return res.status(403).json({
              message: "Vượt quá giới hạn thi thử",
              unknownIds: disallowed,
            });
          }
          answersToFilter = filtered;
        }
        const { filtered, unknownIds } = filterAnswersToValidIds(
          answersToFilter,
          validIds
        );
        if (unknownIds.length > 0) {
          return res.status(400).json({
            message: "Có đáp án không thuộc đề thi",
            unknownIds,
          });
        }
        draftAnswers = filtered;
      }

      const nextClientState = {
        ...(typeof clientState === "object" && clientState ? clientState : {}),
        ...(draftAnswers
          ? { currentSectionAnswers: draftAnswers }
          : {}),
      };

      const updated = await storage.updateExamAttempt(id, {
        clientState: nextClientState as any,
      } as any);

      res.json(updated);
    } catch (error) {
      console.error("Error saving exam draft:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lưu nháp bài thi" });
    }
  });

  app.post("/api/exam-attempts/:id/complete-section", async (req, res) => {
    try {
      const { id } = req.params;
      const { sectionId, answers } = req.body || {};
      const sessionUser = (req.session as any)?.user;

      if (!sectionId || typeof sectionId !== "string") {
        return res.status(400).json({ message: "Thiếu mã phần thi" });
      }
      if (!answers || typeof answers !== "object") {
        return res.status(400).json({ message: "Thiếu đáp án phần thi" });
      }

      const attempt = await storage.getExamAttempt(id);
      if (!attempt) {
        return res.status(404).json({ message: "Không tìm thấy phiên làm bài" });
      }
      if (!isAttemptOwner(attempt, sessionUser)) {
        return res.status(403).json({ message: "Bạn không có quyền với phiên này" });
      }
      const progressErr = assertInProgress(attempt);
      if (progressErr) {
        return res.status(409).json({ message: progressErr });
      }

      // Idempotent: section already completed
      const existing = normalizeSectionResults(attempt.sectionResults);
      if (existing.some((r) => r.sectionId === sectionId)) {
        return res.json(attempt);
      }

      if (attempt.currentSectionId && attempt.currentSectionId !== sectionId) {
        return res.status(400).json({ message: "Phần thi hiện tại không khớp" });
      }

      const exam = await storage.getExam(attempt.examId);
      if (!exam) {
        return res.status(404).json({ message: "Không tìm thấy đề thi" });
      }

      const questionsById = await loadQuestionsByIdForExam(attempt.examId);
      const trialState = readTrialAttemptState(attempt.clientState);
      const result = await completeSectionOnAttempt({
        attempt,
        exam,
        sectionId,
        answers,
        questionsById,
        trialQuestionIds:
          trialState.isTrial && trialState.trialQuestionIds.size > 0
            ? trialState.trialQuestionIds
            : undefined,
      });

      if (!result.ok) {
        return res.status(result.status).json({
          message: result.message,
          unknownIds: result.unknownIds,
        });
      }

      res.json(result.attempt);
    } catch (error) {
      console.error("Error completing section:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi hoàn thành phần thi" });
    }
  });

  app.post("/api/exam-attempts/:id/submit", async (req, res) => {
    try {
      const { id } = req.params;
      const { sectionId, answers } = req.body || {};
      const sessionUser = (req.session as any)?.user;

      const attempt = await storage.getExamAttempt(id);
      if (!attempt) {
        return res.status(404).json({ message: "Không tìm thấy phiên làm bài" });
      }
      if (!isAttemptOwner(attempt, sessionUser)) {
        return res.status(403).json({ message: "Bạn không có quyền với phiên này" });
      }

      // Idempotent: already submitted
      if (attempt.status === "completed") {
        return res.json(attempt);
      }

      const exam = await storage.getExam(attempt.examId);
      if (!exam) {
        return res.status(404).json({ message: "Không tìm thấy đề thi" });
      }
      if (exam.isActive === false) {
        return res.status(403).json({ message: "Đề thi này hiện không mở để làm bài" });
      }

      const questionsById = await loadQuestionsByIdForExam(attempt.examId);
      const trialState = readTrialAttemptState(attempt.clientState);
      let working = attempt;

      // Complete current/last section if answers provided and not yet recorded
      if (sectionId && answers && typeof answers === "object") {
        const existing = normalizeSectionResults(working.sectionResults);
        if (!existing.some((r) => r.sectionId === sectionId)) {
          const completed = await completeSectionOnAttempt({
            attempt: working,
            exam,
            sectionId,
            answers,
            questionsById,
            trialQuestionIds:
              trialState.isTrial && trialState.trialQuestionIds.size > 0
                ? trialState.trialQuestionIds
                : undefined,
          });
          if (!completed.ok) {
            return res.status(completed.status).json({
              message: completed.message,
              unknownIds: completed.unknownIds,
            });
          }
          working = completed.attempt;
        }
      }

      const sections = listExamSections(exam).filter((s) =>
        s.questionIds.some((qid) => questionsById.has(qid))
      );
      const requiredSections =
        trialState.isTrial && trialState.trialSectionIds.size > 0
          ? sections.filter((s) => trialState.trialSectionIds.has(s.id))
          : sections;
      const doneIds = new Set(
        normalizeSectionResults(working.sectionResults).map((r) => r.sectionId)
      );
      const missing = requiredSections.filter((s) => !doneIds.has(s.id));
      if (missing.length > 0) {
        return res.status(400).json({
          message: "Chưa hoàn thành đủ các phần thi",
          missingSectionIds: missing.map((s) => s.id),
        });
      }

      const finalized = await finalizeAttempt({
        attempt: working,
        exam,
        questionsById,
        waitTimeBetweenSections: working.waitTimeBetweenSections || 0,
      });

      if (!finalized) {
        return res.status(500).json({ message: "Không nộp được bài thi" });
      }

      res.json(finalized);
    } catch (error) {
      console.error("Error submitting exam attempt:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi nộp bài thi" });
    }
  });

  // Legacy one-shot submit (kept for compatibility) — creates completed attempt with server scoring
  app.post("/api/exam-attempts", async (req, res) => {
    try {
      const {
        examId,
        sectionResults: clientSectionResults,
      } = req.body;
      const sessionUser = (req.session as any)?.user;

      if (!examId || typeof examId !== "string") {
        return res.status(400).json({ message: "Thiếu mã đề thi" });
      }
      if (!Array.isArray(clientSectionResults)) {
        return res.status(400).json({ message: "Dữ liệu phần thi không hợp lệ" });
      }

      const exam = await storage.getExam(examId);
      if (!exam) {
        return res.status(404).json({ message: "Không tìm thấy đề thi" });
      }
      if (exam.isActive === false) {
        return res.status(403).json({ message: "Đề thi này hiện không mở để làm bài" });
      }
      if (!exam.isDemo && !sessionUser) {
        return res.status(401).json({ message: "Cần đăng nhập để thi đề chính thức" });
      }

      const questionsById = await loadQuestionsByIdForExam(examId);
      const scored = scoreExamAttempt({
        exam,
        questionsById,
        clientSectionResults,
        serverTimeBySectionId: Object.fromEntries(
          clientSectionResults.map((r: any) => [
            r.sectionId,
            // Legacy path: still accept client time but clamp later via scoreExamAttempt without server map
            // Use explicit map from client only for legacy — prefer 0 and rely on client clamp in scoreExamAttempt
            Math.max(0, Math.round(Number(r.timeSpent) || 0)),
          ])
        ),
      });

      if (scored.unknownAnswerIds.length > 0) {
        return res.status(400).json({
          message: "Có đáp án không thuộc đề thi",
          unknownIds: scored.unknownAnswerIds,
        });
      }
      if (scored.sectionResults.length === 0) {
        return res.status(400).json({ message: "Đề thi không có câu hỏi hợp lệ để chấm điểm" });
      }

      const attempt = await storage.createExamAttempt({
        examId,
        sectionResults: scored.sectionResults,
        totalScore: scored.totalScore,
        totalTimeSpent: scored.totalTimeSpent,
        waitTimeBetweenSections: 0,
        userId: sessionUser?.id || null,
        status: "completed",
        completedAt: new Date(),
        scoringSnapshot: scored.scoringSnapshot,
      } as any);

      res.json(attempt);
    } catch (error) {
      console.error("Error submitting exam:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi nộp bài thi" });
    }
  });

  app.get("/api/exam-attempts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const sessionUser = (req.session as any)?.user;
      const attempt = await storage.getExamAttempt(id);
      if (!attempt) {
        return res.status(404).json({ message: "Không tìm thấy kết quả thi" });
      }
      if (!(await canAccessExamAttempt(attempt, sessionUser))) {
        return res.status(403).json({ message: "Bạn không có quyền xem kết quả này" });
      }

      let user: { id: string; fullName: string | null; username: string } | null = null;
      if (attempt.userId) {
        const attemptUser = await storage.getUser(attempt.userId);
        if (attemptUser) {
          user = {
            id: attemptUser.id,
            fullName: attemptUser.fullName ?? null,
            username: attemptUser.username,
          };
        }
      }

      res.json({ ...attempt, user });
    } catch (error) {
      console.error("Error fetching exam attempt:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy kết quả thi" });
    }
  });

  app.get("/api/exam-attempts/:id/details", async (req, res) => {
    try {
      const { id } = req.params;
      const sessionUser = (req.session as any)?.user;
      const attempt = await storage.getExamAttempt(id);
      if (!attempt) {
        return res.status(404).json({ message: "Không tìm thấy kết quả thi" });
      }
      if (!(await canAccessExamAttempt(attempt, sessionUser))) {
        return res.status(403).json({ message: "Bạn không có quyền xem kết quả này" });
      }
      if (attempt.status === "in_progress") {
        return res.status(409).json({ message: "Bài thi chưa nộp, chưa có chi tiết kết quả" });
      }

      const exam = await storage.getExam(attempt.examId);
      if (!exam) {
        return res.status(404).json({ message: "Không tìm thấy đề thi" });
      }

      const snapshot = attempt.scoringSnapshot as any;
      const questions = await storage.getQuestionsByExamId(attempt.examId);
      
      let sectionQuestionIds: string[] = [];
      let allAnswers: Record<string, string> = {};
      let sectionPassingFromSnapshot: any[] | null = null;

      if (snapshot?.sections?.length) {
        sectionQuestionIds = snapshot.sections.flatMap((s: any) => s.questionIds || []);
        sectionPassingFromSnapshot = snapshot.sections;
      } else if (exam.sections && Array.isArray(exam.sections) && exam.sections.length > 0) {
        exam.sections.forEach((section: any) => {
          sectionQuestionIds.push(...extractQuestionIds(section));
        });
      } else {
        sectionQuestionIds = [
          ...(Array.isArray(exam.vocabularyQuestions) ? exam.vocabularyQuestions : []),
          ...(Array.isArray(exam.grammarQuestions) ? exam.grammarQuestions : []),
          ...(Array.isArray(exam.listeningQuestions) ? exam.listeningQuestions : []),
          ...(Array.isArray(exam.readingQuestions) ? exam.readingQuestions : [])
        ].filter((id): id is string => typeof id === 'string');
      }

      if (attempt.sectionResults && typeof attempt.sectionResults === 'object') {
        Object.values(attempt.sectionResults as Record<string, any>).forEach((sectionResult: any) => {
          if (sectionResult.answers) {
            Object.assign(allAnswers, sectionResult.answers);
          }
        });
      } else {
        allAnswers = {
          ...(attempt.vocabularyAnswers as Record<string, string> || {}),
          ...(attempt.grammarAnswers as Record<string, string> || {}),
          ...(attempt.listeningAnswers as Record<string, string> || {}),
          ...(attempt.readingAnswers as Record<string, string> || {})
        };
      }

      const parentQuestionsInOrder = sectionQuestionIds.map(questionId => {
        return questions.find(q => q.id === questionId);
      }).filter(Boolean);

      const subQuestionsMap = new Map<string, any[]>();
      questions.forEach(q => {
        if (q.parentId) {
          if (!subQuestionsMap.has(q.parentId)) {
            subQuestionsMap.set(q.parentId, []);
          }
          subQuestionsMap.get(q.parentId)!.push(q);
        }
      });

      const questionsWithAnswers = parentQuestionsInOrder.map(question => {
        const subQuestions = subQuestionsMap.get(question!.id) || [];
        subQuestions.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        const withSubs = {
          ...question,
          subQuestions: subQuestions.length > 0
            ? subQuestions.map(sq => ({
                ...sq,
                userAnswer: allAnswers[sq.id] || null,
              }))
            : undefined,
        };

        const frozen = applyScoringSnapshotToQuestion(withSubs, snapshot);

        return {
          question: {
            ...frozen,
            subQuestions: frozen.subQuestions?.map((sq: any) => ({
              ...sq,
              userAnswer: allAnswers[sq.id] || null,
            })),
          },
          userAnswer: allAnswers[question!.id] || null,
        };
      });

      res.json({
        questions: questionsWithAnswers,
        scoringSnapshot: snapshot || null,
        sectionMeta: sectionPassingFromSnapshot,
        examPassingScore: snapshot?.examPassingScore ?? (exam as any).passingScore ?? null,
      });
    } catch (error) {
      console.error("Error fetching exam attempt details:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy chi tiết kết quả thi" });
    }
  });

  // Get all attempts for a specific exam (for admin/manager)
  app.get("/api/exams/:examId/attempts", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { examId } = req.params;
      const attempts = await storage.getExamAttemptsByExamId(examId);
      
      // Get user info for each attempt
      const attemptsWithUserInfo = await Promise.all(
        attempts.map(async (attempt) => {
          let userInfo = null;
          if (attempt.userId) {
            const user = await storage.getUser(attempt.userId);
            if (user) {
              userInfo = {
                username: user.username,
                fullName: user.fullName || null,
              };
            }
          }
          return {
            ...attempt,
            userInfo,
          };
        })
      );

      res.json(attemptsWithUserInfo);
    } catch (error) {
      console.error("Error fetching exam attempts:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy danh sách lượt thi" });
    }
  });

  // Cross-exam completed attempts for Cpanel “Kết quả thi”
  // GET /api/admin/exam-attempts?examId=&q=&result=all|passed|failed&limit=&offset=
  app.get("/api/admin/exam-attempts", requireAdminOrManager, async (req, res) => {
    try {
      const examId =
        typeof req.query.examId === "string" && req.query.examId.trim()
          ? req.query.examId.trim()
          : undefined;
      const q =
        typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      const resultFilter =
        typeof req.query.result === "string" ? req.query.result : "all";
      const limit = Math.min(
        5000,
        Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50)
      );
      const offset = Math.max(
        0,
        parseInt(String(req.query.offset ?? "0"), 10) || 0
      );

      const needsInMemoryFilter =
        !!q || resultFilter === "passed" || resultFilter === "failed";

      const listed = await storage.listCompletedExamAttempts({
        examId,
        limit: needsInMemoryFilter ? 5000 : limit,
        offset: needsInMemoryFilter ? 0 : offset,
      });

      const examsList = await storage.getAllExams();
      const examById = new Map(examsList.map((e) => [e.id, e]));

      const userIds = [
        ...new Set(
          listed.attempts
            .map((a) => a.userId)
            .filter((id): id is string => !!id)
        ),
      ];
      const userById = new Map<
        string,
        { username: string; fullName: string | null }
      >();
      await Promise.all(
        userIds.map(async (id) => {
          const user = await storage.getUser(id);
          if (user) {
            userById.set(id, {
              username: user.username,
              fullName: user.fullName || null,
            });
          }
        })
      );

      let enriched = listed.attempts.map((attempt) => {
        const exam = examById.get(attempt.examId);
        const userInfo = attempt.userId
          ? userById.get(attempt.userId) || null
          : null;
        const passed = exam ? didAttemptPass(exam, attempt) : false;
        return {
          ...attempt,
          userInfo,
          examTitle: exam?.title || "Đề đã xóa",
          passed,
        };
      });

      if (q) {
        enriched = enriched.filter((row) => {
          const username = (row.userInfo?.username || "khách").toLowerCase();
          const fullName = (row.userInfo?.fullName || "").toLowerCase();
          return username.includes(q) || fullName.includes(q);
        });
      }

      if (resultFilter === "passed") {
        enriched = enriched.filter((row) => row.passed);
      } else if (resultFilter === "failed") {
        enriched = enriched.filter((row) => !row.passed);
      }

      const total = needsInMemoryFilter ? enriched.length : listed.total;
      const items = needsInMemoryFilter
        ? enriched.slice(offset, offset + limit)
        : enriched;

      res.json({ items, total });
    } catch (error) {
      console.error("Error listing admin exam attempts:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy danh sách kết quả thi" });
    }
  });

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu"
        });
      }

      const user = await storage.authenticateUser(username.toLowerCase(), password);
      
      if (user) {
        // Store sanitized user in session (never keep password in session)
        (req.session as any).user = sanitizeUser(user);
        
        res.json({
          success: true,
          message: "Đăng nhập thành công",
          user: sanitizeUser(user)
        });
      } else {
        const existing = await storage.getUserByUsername(username.toLowerCase());
        if (existing && !existing.password) {
          return res.status(401).json({
            success: false,
            message: "Tài khoản này đăng ký bằng Google. Vui lòng dùng nút «Tiếp tục với Google».",
          });
        }
        res.status(401).json({
          success: false,
          message: "Tên đăng nhập hoặc mật khẩu không đúng"
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Có lỗi xảy ra, vui lòng thử lại sau"
      });
    }
  });

  // Contact form submission
  app.post("/api/contact", async (req, res) => {
    try {
      const contactData = insertContactRequestSchema.parse({
        ...req.body,
        portal: normalizePortalAlias(req.body?.portal) || req.portal || "group",
      });
      const contact = await storage.createContactRequest(contactData);
      
      // Here you would typically send an email notification
      console.log("New contact request:", contact);
      
      res.json({ success: true, message: "Yêu cầu của bạn đã được gửi thành công!" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          success: false, 
          message: "Dữ liệu không hợp lệ", 
          errors: error.errors 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Có lỗi xảy ra, vui lòng thử lại sau" 
        });
      }
    }
  });

  // Get all contact requests (for admin purposes)
  app.get("/api/contact", requireAdminOrManager, async (req, res) => {
    try {
      const requests = await storage.getContactRequests();
      const allowed = sessionAllowedPortals((req as any).user || (req.session as any)?.user);
      const filtered = allowed
        ? requests.filter((r) => canAccessPortal(allowed, r.portal))
        : requests;
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Không thể lấy danh sách yêu cầu" 
      });
    }
  });

  // Delete contact request
  app.delete("/api/contact/:id", requireAdminOrManager, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteContactRequest(id);
      
      if (deleted) {
        res.json({ success: true, message: "Đã xóa tin nhắn thành công" });
      } else {
        res.status(404).json({ success: false, message: "Không tìm thấy tin nhắn" });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: "Có lỗi xảy ra" });
    }
  });

  app.patch("/api/contact/:id/read", requireAdminOrManager, async (req, res) => {
    try {
      const updated = await storage.markContactRequestRead(req.params.id);
      if (!updated) {
        return res.status(404).json({ success: false, message: "Không tìm thấy tin nhắn" });
      }
      res.json({ success: true, message: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: "Có lỗi xảy ra" });
    }
  });

  // Public site settings (branding, social, popup)
  app.get("/api/site-settings", async (req, res) => {
    try {
      const portal = String(req.query.portal || req.portal || "group");
      const p = isPortalId(portal) ? portal : "group";
      const settings = await getSiteSettings(p);
      res.json(settings);
    } catch (error) {
      console.error("site-settings get:", error);
      res.status(500).json({ message: "Không tải được cấu hình" });
    }
  });

  app.put("/api/admin/site-settings", requireAdminOrManager, async (req, res) => {
    try {
      const portalRaw = String(req.body?.portal || "group");
      if (!isPortalId(portalRaw)) {
        return res.status(400).json({ message: "Portal không hợp lệ" });
      }
      const parsed = siteSettingsInputSchema.parse(req.body);
      const saved = await upsertSiteSettings(portalRaw as PortalId, parsed);
      res.json(saved);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Dữ liệu không hợp lệ" });
      }
      console.error("site-settings put:", error);
      res.status(500).json({ message: "Không lưu được cấu hình" });
    }
  });

  app.post("/api/analytics/pageview", async (req, res) => {
    try {
      const portal = String(req.body?.portal || req.portal || "group");
      if (!isPortalId(portal)) {
        return res.status(400).json({ ok: false });
      }
      await recordPageView(portal);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false });
    }
  });

  app.get("/api/admin/analytics/monthly", requireAdminOrManager, async (req, res) => {
    try {
      const portal = String(req.query.portal || "group");
      if (!isPortalId(portal)) {
        return res.status(400).json({ message: "Portal không hợp lệ" });
      }
      const now = new Date();
      const year = Number(req.query.year) || now.getFullYear();
      const month = Number(req.query.month) || now.getMonth() + 1;
      const data = await getMonthlyAnalytics(portal as PortalId, year, month);
      res.json(data);
    } catch (error) {
      console.error("analytics monthly:", error);
      res.status(500).json({ message: "Không tải được thống kê" });
    }
  });

  app.get("/api/admin/dashboard-summary", requireAdminOrManager, async (req, res) => {
    try {
      const portal = req.query.portal ? String(req.query.portal) : null;
      const allowed = sessionAllowedPortals((req as any).user || (req.session as any)?.user);
      let portals: string[] | null = null;
      if (portal && isPortalId(portal)) {
        portals = [portal];
      } else if (allowed) {
        portals = allowed;
      }

      const p = (portal && isPortalId(portal) ? portal : "group") as PortalId;
      const now = new Date();

      let unreadMessages = 0;
      try {
        unreadMessages = await storage.getContactUnreadCount(portals);
      } catch (err) {
        console.error("dashboard-summary unreadMessages:", err);
      }

      let pendingOrders = 0;
      let paidOrders = 0;
      try {
        const orderStats = await getOrderStats(
          portal && isPortalId(portal) ? { portal } : undefined,
        );
        pendingOrders = orderStats.orderCounts.pending;
        paidOrders = orderStats.orderCounts.paid;
      } catch (err) {
        console.error("dashboard-summary orderStats:", err);
      }

      let todayViews = 0;
      let analytics: Awaited<ReturnType<typeof getMonthlyAnalytics>>;
      try {
        todayViews = await getTodayViews(p);
        analytics = await getMonthlyAnalytics(p, now.getFullYear(), now.getMonth() + 1);
      } catch (err) {
        console.error("dashboard-summary analytics:", err);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        analytics = {
          month: `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`,
          totalViews: 0,
          daily: Array.from({ length: lastDay }, (_, i) => ({ day: i + 1, views: 0 })),
        };
      }

      res.json({
        unreadMessages,
        pendingOrders,
        paidOrders,
        todayViews,
        monthViews: analytics.totalViews,
        analytics,
      });
    } catch (error) {
      console.error("dashboard-summary:", error);
      res.status(500).json({ message: "Không tải được tổng quan" });
    }
  });

  // Article routes
  app.get("/api/articles", async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const allPortals = req.query.all === "1";
      const portal = allPortals ? undefined : req.portal;
      const sessionUser = (req.session as any)?.user;
      const allowed = isAdminOrManager(sessionUser)
        ? sessionAllowedPortals(sessionUser)
        : null;

      if (allowed && !allPortals && !canAccessPortal(allowed, portal)) {
        return denyPortalAccess(res);
      }

      let articles = category
        ? await storage.getArticlesByCategory(category, portal)
        : await storage.getAllArticles(portal);

      if (allowed && allPortals) {
        articles = articles.filter((a) => canAccessPortal(allowed, a.portal));
      }

      res.json(articles);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Không thể lấy danh sách thông tin" 
      });
    }
  });

  // Testimonials (homepage CMS)
  app.get("/api/testimonials", async (req, res) => {
    try {
      const allPortals = req.query.all === "1";
      const portal = allPortals
        ? undefined
        : normalizePortalAlias(req.query.portal as string) || req.portal;
      const list = await storage.ensureDefaultTestimonials(portal);
      res.json(list);
    } catch (error) {
      console.error("Error fetching testimonials:", error);
      res.status(500).json({ message: "Không thể lấy danh sách đánh giá" });
    }
  });

  app.post("/api/testimonials", requireAdminOrManager, async (req, res) => {
    try {
      const data = insertTestimonialSchema.parse(req.body);
      const created = await storage.createTestimonial(data);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: error.errors });
      }
      console.error("Error creating testimonial:", error);
      res.status(500).json({ message: "Không thể tạo đánh giá" });
    }
  });

  app.put("/api/testimonials/:id", requireAdminOrManager, async (req, res) => {
    try {
      const data = updateTestimonialSchema.parse(req.body);
      const updated = await storage.updateTestimonial(req.params.id, data);
      if (!updated) {
        return res.status(404).json({ message: "Không tìm thấy đánh giá" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: error.errors });
      }
      console.error("Error updating testimonial:", error);
      res.status(500).json({ message: "Không thể cập nhật đánh giá" });
    }
  });

  app.delete("/api/testimonials/:id", requireAdminOrManager, async (req, res) => {
    try {
      const deleted = await storage.deleteTestimonial(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Không tìm thấy đánh giá" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting testimonial:", error);
      res.status(500).json({ message: "Không thể xóa đánh giá" });
    }
  });

  // Custom CMS block pages (admin-created)
  app.get("/api/cms-pages", async (req, res) => {
    try {
      const allPortals = req.query.all === "1";
      const portal = allPortals
        ? undefined
        : normalizePortalAlias(req.query.portal as string) || req.portal;
      const rows = await listCmsPages(portal);
      res.json(rows.map(cmsPageToContentEntry));
    } catch (error) {
      console.error("Error fetching cms pages:", error);
      res.status(500).json({ message: "Không thể tải danh sách trang" });
    }
  });

  app.get("/api/cms-pages/by-slug/:slug", async (req, res) => {
    try {
      const portal = normalizePortalAlias(req.query.portal as string) || req.portal;
      if (!portal) {
        return res.status(400).json({ message: "Thiếu portal" });
      }
      const row = await getCmsPageBySlug(portal, req.params.slug);
      if (!row) {
        return res.status(404).json({ message: "Không tìm thấy trang" });
      }
      res.json(cmsPageToContentEntry(row));
    } catch (error) {
      console.error("Error fetching cms page:", error);
      res.status(500).json({ message: "Không thể tải trang" });
    }
  });

  app.post("/api/cms-pages", requireAdminOrManager, async (req, res) => {
    try {
      const created = await createCmsPage(req.body);
      res.status(201).json(cmsPageToContentEntry(created));
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Không thể tạo trang";
      if (msg.includes("Slug") || msg.includes("slug")) {
        return res.status(400).json({ message: msg });
      }
      console.error("Error creating cms page:", error);
      res.status(500).json({ message: msg });
    }
  });

  app.delete("/api/cms-pages/:id", requireAdminOrManager, async (req, res) => {
    try {
      const result = await deleteCmsPage(req.params.id);
      if (!result.deleted) {
        return res.status(404).json({ message: "Không tìm thấy trang" });
      }
      res.json({ ok: true, images: result.images });
    } catch (error) {
      console.error("Error deleting cms page:", error);
      res.status(500).json({ message: "Không thể xóa trang" });
    }
  });

  // Site contents (editable homepage / page copy)
  app.get("/api/site-contents", async (req, res) => {
    try {
      const page = (req.query.page as string) || "home";
      const allPortals = req.query.all === "1";
      const portal = allPortals
        ? undefined
        : normalizePortalAlias(req.query.portal as string) || req.portal;
      const rows = await storage.getSiteContents(page, portal);
      const map: Record<string, string> = {};
      for (const row of rows) {
        map[row.key] = row.value;
      }
      res.json(map);
    } catch (error) {
      console.error("Error fetching site contents:", error);
      res.status(500).json({ message: "Không thể lấy nội dung trang" });
    }
  });

  app.put("/api/site-contents", requireAdminOrManager, async (req, res) => {
    try {
      const data = upsertSiteContentSchema.parse(req.body);
      const portal = data.portal || req.portal;
      const row = await storage.upsertSiteContent(
        data.page,
        data.key,
        data.value,
        portal,
      );
      res.json(row);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: error.errors });
      }
      console.error("Error upserting site content:", error);
      res.status(500).json({ message: "Không thể lưu nội dung" });
    }
  });

  app.put("/api/site-contents/bulk", requireAdminOrManager, async (req, res) => {
    try {
      const data = bulkUpsertSiteContentSchema.parse(req.body);
      const portal = data.portal || req.portal;
      const rows = await storage.bulkUpsertSiteContents(
        data.page,
        data.entries,
        portal,
      );
      res.json(rows);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: error.errors });
      }
      console.error("Error bulk upserting site contents:", error);
      res.status(500).json({ message: "Không thể lưu nội dung" });
    }
  });

  // Page layouts (section catalog)
  app.get("/api/page-layouts", async (req, res) => {
    try {
      const page = (req.query.page as string) || "group";
      const portal =
        (req.query.portal as string) ||
        (isLayoutPageId(page) ? page : req.portal) ||
        "group";
      if (!page.trim()) {
        return res.status(400).json({ message: "Trang không hợp lệ" });
      }
      const layout = await getPageLayout(page, portal);
      res.json(layout);
    } catch (error) {
      console.error("Error fetching page layout:", error);
      res.status(500).json({ message: "Không thể tải bố cục trang" });
    }
  });

  app.put("/api/page-layouts", requireAdminOrManager, async (req, res) => {
    try {
      const data = savePageLayoutSchema.parse(req.body);
      const portal = data.portal || data.page;
      const layout = await savePageLayout(data.page, portal, data.sections);
      res.json(layout);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Dữ liệu không hợp lệ", errors: error.errors });
      }
      console.error("Error saving page layout:", error);
      res.status(500).json({ message: "Không thể lưu bố cục trang" });
    }
  });

  app.post("/api/page-layouts/reset", requireAdminOrManager, async (req, res) => {
    try {
      const page = (req.body?.page as string) || "group";
      const portal = (req.body?.portal as string) || page;
      if (!page.trim()) {
        return res.status(400).json({ message: "Trang không hợp lệ" });
      }
      const layout = await resetPageLayout(page, portal);
      res.json(layout);
    } catch (error) {
      console.error("Error resetting page layout:", error);
      res.status(500).json({ message: "Không thể đặt lại bố cục" });
    }
  });

  app.post("/api/articles", requireAdminOrManager, async (req, res) => {
    try {
      const { title, content, category, portal: bodyPortal } = req.body;
      
      if (!title || !content || !category) {
        return res.status(400).json({ message: "Title, content, and category are required" });
      }

      const promotedContent = await promoteArticleContentImages(
        typeof content === "string" ? content : "",
      );
      const imageUrl = firstArticleImageUrl(promotedContent);
      const portal =
        normalizePortalAlias(bodyPortal) ||
        portalFromArticleCategory(category);

      const allowed = sessionAllowedPortals((req as any).user);
      if (!canAccessPortal(allowed, portal)) {
        return denyPortalAccess(res);
      }

      const article = await storage.createArticle({
        title,
        content: promotedContent,
        category,
        imageUrl,
        portal,
        videoUrl: null,
      });

      res.status(201).json({ article });
    } catch (error) {
      if (error instanceof MediaPromoteError) {
        return res.status(422).json({ message: error.message, code: "MEDIA_PROMOTE_FAILED" });
      }
      console.error("Error creating article:", error);
      res.status(500).json({ message: "Failed to create article" });
    }
  });

  // Article image upload → R2 temp folder (promoted to article-images on save)
  app.post("/api/upload/image", requireImageEditPermission, upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No image file provided" });
      }
      if (!file.mimetype.startsWith("image/")) {
        return res.status(400).json({ message: "Only image files are allowed" });
      }
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "Image size cannot exceed 5MB" });
      }

      const timestamp = Date.now();
      const fileExtension = file.originalname.split(".").pop() || "jpg";
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const folder = "article-temp-images";

      const uploadResult = await multiR2Storage.uploadFile(
        file.buffer,
        fileName,
        file.mimetype,
        {
          provider: "primary",
          folder,
          allowedTypes: ["image/*"],
          maxSizeBytes: 5 * 1024 * 1024,
        },
      );

      if (!uploadResult.success) {
        return res
          .status(500)
          .json({ message: uploadResult.error || "Failed to upload image to R2" });
      }

      const imageUrl = `/api/${folder}/${fileName}`;
      res.json({
        imageUrl,
        originalFileName: file.originalname || "image",
      });
    } catch (error) {
      console.error("Error uploading article image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  app.get("/api/article-temp-images/:filename", async (req, res) => {
    await handleFileDownload(
      "article-temp-images",
      req.params.filename,
      res,
      "image/jpeg",
      300,
    );
  });

  app.post("/api/article-temp-images/cleanup", requireImageEditPermission, async (req, res) => {
    try {
      const { filenames } = req.body;
      if (!Array.isArray(filenames)) {
        return res.status(400).json({ message: "filenames must be an array" });
      }
      const results = [];
      for (const filename of filenames) {
        const objectKey = `article-temp-images/${filename}`;
        const result = await multiR2Storage.deleteFile("primary", objectKey);
        results.push({ filename, success: result.success, error: result.error });
      }
      res.json({ results });
    } catch (error) {
      console.error("Error cleaning up article temp images:", error);
      res.status(500).json({ message: "Failed to cleanup temporary files" });
    }
  });

  /** Extract <img src> URLs from HTML/markdown content */
  function extractContentImageUrls(content: string): string[] {
    if (!content) return [];
    const urls: string[] = [];
    for (const match of content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
      if (match[1]) urls.push(match[1]);
    }
    for (const match of content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
      if (match[1]) urls.push(match[1]);
    }
    return Array.from(new Set(urls));
  }

  /** Promote article-temp-images → article-images and rewrite content URLs */
  async function promoteArticleContentImages(content: string): Promise<string> {
    let next = content || "";
    const tempUrls = extractContentImageUrls(next).filter((u) =>
      u.includes("/api/article-temp-images/"),
    );
    for (const tempUrl of tempUrls) {
      const filename = tempUrl.split("/").pop();
      if (!filename) continue;
      const moved = await multiR2Storage.moveFile(
        "primary",
        `article-temp-images/${filename}`,
        `article-images/${filename}`,
      );
      if (!moved.success) {
        throw new MediaPromoteError(
          "Không thể lưu ảnh bài viết. Vui lòng tải lại ảnh rồi thử lại.",
        );
      }
      const permanent = `/api/article-images/${filename}`;
      next = next.split(tempUrl).join(permanent);
    }
    return next;
  }

  function firstArticleImageUrl(content: string): string | null {
    const urls = extractContentImageUrls(content);
    return urls[0] || null;
  }

  app.get("/api/articles/:id", async (req, res) => {
    try {
      const article = await storage.getArticle(req.params.id);
      if (!article) {
        return res.status(404).json({ 
          success: false, 
          message: "Không tìm thấy thông tin" 
        });
      }
      res.json(article);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Không thể lấy thông tin" 
      });
    }
  });

  app.put("/api/articles/:id", requireAdminOrManager, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, content, category, portal: bodyPortal } = req.body;
      
      if (!title || !content || !category) {
        return res.status(400).json({ message: "Title, content, and category are required" });
      }

      const existing = await storage.getArticle(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy thông tin để cập nhật",
        });
      }

      const promotedContent = await promoteArticleContentImages(
        typeof content === "string" ? content : "",
      );
      const imageUrl = firstArticleImageUrl(promotedContent);

      // Delete permanent article images removed from content
      const oldPermanent = extractContentImageUrls(existing.content || "").filter((u) =>
        u.includes("/api/article-images/"),
      );
      if (existing.imageUrl?.includes("/api/article-images/")) {
        oldPermanent.push(existing.imageUrl);
      }
      const newPermanent = new Set(
        extractContentImageUrls(promotedContent).filter((u) =>
          u.includes("/api/article-images/"),
        ),
      );
      for (const url of Array.from(new Set(oldPermanent))) {
        if (!newPermanent.has(url)) {
          const filename = url.split("/").pop();
          if (filename) {
            await multiR2Storage.deleteFile("primary", `article-images/${filename}`);
          }
        }
      }

      const portal =
        normalizePortalAlias(bodyPortal) ||
        normalizePortalAlias(existing.portal) ||
        portalFromArticleCategory(category);

      const allowed = sessionAllowedPortals((req as any).user);
      if (!canAccessPortal(allowed, existing.portal) || !canAccessPortal(allowed, portal)) {
        return denyPortalAccess(res);
      }

      const updatedArticle = await storage.updateArticle(id, {
        title,
        content: promotedContent,
        category,
        imageUrl,
        portal,
      });

      res.json({ article: updatedArticle });
    } catch (error) {
      if (error instanceof MediaPromoteError) {
        return res.status(422).json({ message: error.message, code: "MEDIA_PROMOTE_FAILED" });
      }
      console.error("Error updating article:", error);
      res.status(500).json({ message: "Failed to update article" });
    }
  });

  app.delete("/api/articles/:id", requireAdminOrManager, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get article first to extract images before deleting
      const article = await storage.getArticle(id);
      if (!article) {
        return res.status(404).json({ success: false, message: "Không tìm thấy thông tin để xóa" });
      }

      // Extract all image URLs from content and thumbnail
      const imageUrls: string[] = [];
      
      // Add thumbnail if exists
      if (article.imageUrl) {
        imageUrls.push(article.imageUrl);
      }
      
      // Extract all images from content (HTML TipTap + legacy markdown)
      const htmlImgMatches = article.content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
      for (const match of htmlImgMatches) {
        if (match[1]) imageUrls.push(match[1]);
      }
      const imageMatches = article.content.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
      if (imageMatches) {
        imageMatches.forEach(match => {
          const urlMatch = match.match(/!\[([^\]]*)\]\(([^)]+)\)/);
          if (urlMatch && urlMatch[2]) {
            imageUrls.push(urlMatch[2]);
          }
        });
      }

      // Delete images from storage (R2 article-images + legacy /objects/)
      const objectStorageService = new ObjectStorageService();
      const uniqueUrls = Array.from(new Set(imageUrls));
      for (const imageUrl of uniqueUrls) {
        try {
          if (imageUrl.includes("/api/article-images/") || imageUrl.includes("/api/article-temp-images/")) {
            const filename = imageUrl.split("/").pop();
            if (filename) {
              const folder = imageUrl.includes("article-temp")
                ? "article-temp-images"
                : "article-images";
              await multiR2Storage.deleteFile("primary", `${folder}/${filename}`);
              console.log(`Deleted R2 article image: ${filename}`);
            }
          } else if (imageUrl.startsWith("/objects/")) {
            const objectFile = await objectStorageService.getObjectEntityFile(imageUrl);
            await objectFile.delete();
            console.log(`Deleted legacy image: ${imageUrl}`);
          }
        } catch (error) {
          console.error(`Failed to delete image ${imageUrl}:`, error);
        }
      }

      // Delete the article
      const deleted = await storage.deleteArticle(id);
      
      if (deleted) {
        res.json({ success: true, message: "Đã xóa thông tin và hình ảnh thành công" });
      } else {
        res.status(404).json({ success: false, message: "Không tìm thấy thông tin" });
      }
    } catch (error) {
      console.error("Error deleting article:", error);
      res.status(500).json({ success: false, message: "Có lỗi xảy ra khi xóa thông tin" });
    }
  });

  // Move article order
  app.patch("/api/articles/:id/move", async (req, res) => {
    try {
      const { id } = req.params;
      const { direction } = req.body;
      
      if (!direction || !['up', 'down'].includes(direction)) {
        return res.status(400).json({ 
          success: false, 
          message: "Direction must be 'up' or 'down'" 
        });
      }

      const success = await storage.moveArticleOrder(id, direction);
      
      if (!success) {
        return res.status(404).json({ 
          success: false, 
          message: "Không tìm thấy thông tin hoặc không thể di chuyển" 
        });
      }

      res.json({ 
        success: true, 
        message: "Đã cập nhật thứ tự thông tin" 
      });
    } catch (error) {
      console.error("Error moving article:", error);
      res.status(500).json({ 
        success: false, 
        message: "Không thể thay đổi thứ tự thông tin" 
      });
    }
  });

  // Reset article order - assign sortOrder based on creation date
  app.post("/api/articles/reset-order", requireAdminOrManager, async (req, res) => {
    try {
      const allArticles = await storage.getAllArticles();
      
      // Sort by creation date (oldest first) and assign sortOrder
      const sortedByDate = allArticles.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      // Update each article with new sortOrder
      for (let i = 0; i < sortedByDate.length; i++) {
        await storage.updateArticle(sortedByDate[i].id, {
          title: sortedByDate[i].title,
          content: sortedByDate[i].content,
          category: sortedByDate[i].category,
          imageUrl: sortedByDate[i].imageUrl,
          sortOrder: i
        });
      }
      
      res.json({ 
        success: true, 
        message: `Đã cập nhật thứ tự cho ${sortedByDate.length} bài viết`,
        updated: sortedByDate.length
      });
    } catch (error) {
      console.error("Error resetting article order:", error);
      res.status(500).json({ 
        success: false, 
        message: "Không thể cập nhật thứ tự bài viết" 
      });
    }
  });

  // Endpoint to serve uploaded objects from object storage  
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Object Storage endpoints for media upload
  
  // Endpoint to serve public assets from R2 storage
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    console.log(`Serving public object: ${filePath}`);
    
    try {
      // Check if it's an article image
      if (filePath.startsWith("article-images/")) {
        const fileName = filePath.replace("article-images/", "");
        
        // Try to get from external R2 first (primary)
        const downloadUrl = await multiR2Storage.getDownloadUrl("primary", `article-images/${fileName}`);
        
        if (downloadUrl) {
          console.log(`Proxying R2 URL: ${downloadUrl}`);
          
          // Proxy the image instead of redirecting
          try {
            const imageResponse = await fetch(downloadUrl);
            if (imageResponse.ok) {
              const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
              res.set({
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
                'Access-Control-Allow-Origin': '*'
              });
              
              // Stream the image data
              const imageBuffer = await imageResponse.arrayBuffer();
              return res.send(Buffer.from(imageBuffer));
            } else {
              console.log(`R2 image not found: ${imageResponse.status}`);
            }
          } catch (proxyError) {
            console.error("Error proxying R2 image:", proxyError);
          }
        }
      }
      
      // Fallback to legacy object storage
      const objectStorageService = new ObjectStorageService();
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        console.log(`File not found: ${filePath}`);
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error serving public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint to serve private objects (for articles)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Endpoint to get upload URL for media files (supports multiple R2 providers)
  app.post("/api/media/upload", requireAdminOrManager, async (req, res) => {
    try {
      const { provider = "primary", folder = "uploads", maxSize = 50 * 1024 * 1024 } = req.body;
      
      const result = await multiR2Storage.getUploadUrl({
        provider,
        folder,
        allowedTypes: ["image/*", "video/*"],
        maxSizeBytes: maxSize
      });

      if (result.success) {
        res.json({ 
          uploadURL: result.url,
          provider: result.provider,
          path: result.path
        });
      } else {
        res.status(500).json({ error: result.error || "Failed to get upload URL" });
      }
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Endpoint to get available storage providers
  app.get("/api/storage/providers", requireAdminOrManager, async (req, res) => {
    try {
      const providers = multiR2Storage.getAvailableProviders();
      const connectionTests = await multiR2Storage.testAllConnections();
      
      const providersWithStatus = providers.map(provider => ({
        ...provider,
        connected: connectionTests[provider.id] || false
      }));

      res.json({ providers: providersWithStatus });
    } catch (error) {
      console.error("Error getting storage providers:", error);
      res.status(500).json({ error: "Failed to get storage providers" });
    }
  });

  // Endpoint to test R2 connections
  app.post("/api/storage/test", requireAdminOrManager, async (req, res) => {
    try {
      const { provider } = req.body;
      
      if (provider) {
        const isConnected = await multiR2Storage.testAllConnections();
        res.json({ 
          provider,
          connected: isConnected[provider] || false 
        });
      } else {
        const allConnections = await multiR2Storage.testAllConnections();
        res.json({ connections: allConnections });
      }
    } catch (error) {
      console.error("Error testing storage connections:", error);
      res.status(500).json({ error: "Failed to test connections" });
    }
  });

  // Endpoint to set object ACL after upload
  app.put("/api/media/finalize", requireAdminOrManager, async (req, res) => {
    if (!req.body.mediaURL) {
      return res.status(400).json({ error: "mediaURL is required" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.mediaURL,
        {
          owner: "system", // Default owner for article media
          visibility: "public", // Media files are public by default
        }
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error finalizing media upload:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint to upload existing article images (legacy one-off — module not shipped)
  app.post("/api/articles/upload-images", async (_req, res) => {
    res.status(501).json({
      success: false,
      error: "Legacy upload script is not available. Use media upload endpoints instead.",
    });
  });

  // Upload service images to R2 (legacy one-off — module not shipped)
  app.post("/api/upload-service-images", async (_req, res) => {
    res.status(501).json({
      success: false,
      error: "Legacy upload script is not available. Use media upload endpoints instead.",
    });
  });

  // UI Images Management API endpoints

  // Get list of uploaded images from R2 storage
  app.get("/api/images/list", requireImageEditPermission, async (req, res) => {
    try {
      const { provider = "primary" } = req.query;
      const images = await multiR2Storage.listFiles(provider as string, "ui-images");
      res.json(images);
    } catch (error) {
      console.error("Error listing images:", error);
      res.status(500).json({ error: "Failed to list images" });
    }
  });

  // Get all UI images 
  app.get("/api/ui-images", async (req, res) => {
    try {
      const allPortals = req.query.all === "1";
      const portal = allPortals
        ? undefined
        : normalizePortalAlias(req.query.portal as string) || req.portal;
      const uiImages = await storage.getAllUiImages(portal);
      res.json(uiImages);
    } catch (error) {
      console.error("Error fetching UI images:", error);
      res.status(500).json({ error: "Failed to fetch UI images" });
    }
  });

  // Initialize default UI images with sample URLs
  app.post("/api/ui-images/initialize", requireImageEditPermission, async (req, res) => {
    try {
      const defaultImages = [
        {
          imageType: "hero-banner",
          imageUrl: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=2074&q=80",
          altText: "Hero banner - Dịch vụ tư vấn du học và visa",
          description: "Hình ảnh chính trên trang chủ"
        },
        {
          imageType: "about-company",
          imageUrl: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=2126&q=80",
          altText: "Về công ty N&P",
          description: "Hình ảnh giới thiệu công ty"
        },
        {
          imageType: "why-choose-us",
          imageUrl: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2084&q=80",
          altText: "Tại sao chọn chúng tôi",
          description: "Hình ảnh phần lợi ích dịch vụ"
        },
        {
          imageType: "visa-service",
          imageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80",
          altText: "Dịch vụ visa",
          description: "Hình ảnh dịch vụ làm visa"
        },
        {
          imageType: "study-abroad",
          imageUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80",
          altText: "Du học",
          description: "Hình ảnh dịch vụ tư vấn du học"
        },
        {
          imageType: "japanese-training",
          imageUrl: "https://images.unsplash.com/photo-1528164344705-47542687000d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2092&q=80",
          altText: "Đào tạo tiếng Nhật",
          description: "Hình ảnh khóa học tiếng Nhật"
        },
        {
          imageType: "service",
          imageUrl: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=2074&q=80",
          altText: "Vé máy bay",
          description: "Hình ảnh dịch vụ bán vé máy bay"
        },
        {
          imageType: "contact-banner",
          imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2069&q=80",
          altText: "Liên hệ chúng tôi",
          description: "Hình ảnh banner trang liên hệ"
        }
      ];

      const createdImages = [];
      for (const imageData of defaultImages) {
        // Check if image already exists
        const existing = await storage.getUiImageByType(imageData.imageType);
        if (!existing) {
          const created = await storage.createUiImage(imageData);
          createdImages.push(created);
        }
      }

      res.json({
        success: true,
        message: `Đã tạo ${createdImages.length} hình ảnh mặc định`,
        images: createdImages
      });
    } catch (error) {
      console.error("Error initializing UI images:", error);
      res.status(500).json({ error: "Failed to initialize UI images" });
    }
  });

  // Update UI image metadata
  app.put("/api/ui-images/:id", requireImageEditPermission, async (req, res) => {
    try {
      const { id } = req.params;
      const { altText, description } = req.body;
      
      const updatedImage = await storage.updateUiImage(id, {
        altText,
        description
      });
      
      if (updatedImage) {
        res.json(updatedImage);
      } else {
        res.status(404).json({ error: "UI image not found" });
      }
    } catch (error) {
      console.error("Error updating UI image:", error);
      res.status(500).json({ error: "Failed to update UI image" });
    }
  });

  // Server-side upload to R2 (similar to article uploads)
  app.post("/api/ui-images/server-upload", requireImageEditPermission, upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      const { imageType, altText, portal: bodyPortal } = req.body;
      const portal = normalizePortalAlias(bodyPortal) || req.portal || "group";
      
      if (!file || !imageType) {
        return res.status(400).json({ error: "Missing file or imageType" });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = file.originalname.split('.').pop();
      const uniqueFileName = `${imageType}-${timestamp}.${fileExtension}`;
      
      // Upload directly to R2 from server using multiR2Storage
      const uploadConfig: MediaUploadConfig = {
        provider: "primary",
        folder: "ui-images",
        allowedTypes: ["image/*"],
        maxSizeBytes: 10 * 1024 * 1024
      };
      
      const uploadResult = await multiR2Storage.uploadFile(file.buffer, uniqueFileName, file.mimetype, uploadConfig);
      
      if (!uploadResult.success) {
        return res.status(500).json({ error: uploadResult.error || "Upload to R2 failed" });
      }

      // Public URL must go through proxy (raw /api/ui-images/* is not a file route)
      const publicUrl = `/api/proxy-image/primary/ui-images/${uniqueFileName}`;
      
      // Upsert by imageType + portal so slots don't duplicate
      let uiImage = await storage.updateUiImageByType(imageType, {
        imageUrl: publicUrl,
        altText: altText || null,
        description: null,
        portal,
      });
      if (!uiImage) {
        uiImage = await storage.createUiImage({
          imageUrl: publicUrl,
          imageType,
          portal,
          altText: altText || null,
          description: null,
        });
      }
      
      res.json({
        success: true,
        imageUrl: publicUrl,
        imageType: imageType,
        uiImage: uiImage
      });
      
    } catch (error) {
      console.error("Error in server upload:", error);
      res.status(500).json({ error: "Server upload failed" });
    }
  });

  // Get upload URL for UI images (stored in ui-images folder on R2)
  app.post("/api/ui-images/upload", requireImageEditPermission, async (req, res) => {
    try {
      const { fileName, contentType, imageType, config = "primary" } = req.body;
      
      if (!fileName || !contentType || !imageType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Generate unique filename to prevent conflicts
      const timestamp = Date.now();
      const uniqueFileName = `${imageType}-${timestamp}-${fileName}`;
      
      // Get upload URL to ui-images folder
      const uploadConfig: MediaUploadConfig = {
        provider: config as "primary" | "secondary",
        folder: "ui-images",
        allowedTypes: ["image/*"],
        maxSizeBytes: 10 * 1024 * 1024 // 10MB
      };
      
      const result = await multiR2Storage.getUploadUrl(uploadConfig);
      
      if (result.success) {
        res.json({
          uploadURL: result.url,
          provider: result.provider,
          path: result.path || `ui-images/${uniqueFileName}`,
          fileName: uniqueFileName
        });
      } else {
        res.status(500).json({ error: result.error || "Failed to get upload URL" });
      }
    } catch (error) {
      console.error("Error getting UI image upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Delete UI image from R2
  app.delete("/api/ui-images/:fileName", requireImageEditPermission, async (req, res) => {
    try {
      const { fileName } = req.params;
      const { config = "primary" } = req.query;
      
      const result = await multiR2Storage.deleteFile(config as string, `ui-images/${fileName}`);
      
      if (result.success) {
        res.json({ success: true, message: "Đã xóa hình ảnh thành công" });
      } else {
        res.status(500).json({ error: result.error || "Failed to delete image" });
      }
    } catch (error) {
      console.error("Error deleting UI image:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  });

  // Update UI image metadata (assign existing R2/public URL to an imageType slot)
  app.put("/api/ui-images", requireImageEditPermission, async (req, res) => {
    try {
      const { imageUrl, imageType, altText, description, portal: bodyPortal } = req.body;
      const portal = normalizePortalAlias(bodyPortal) || req.portal || "group";
      
      if (!imageUrl || !imageType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const publicUrl = normalizeUiImagePublicUrl(imageUrl);

      // Try to update existing UI image first
      let updatedImage = await storage.updateUiImageByType(imageType, {
        imageUrl: publicUrl,
        altText: altText || null,
        description: description || null,
        portal,
      });
      
      // If not found, create a new UI image
      if (!updatedImage) {
        console.log(`Creating new UI image for type: ${imageType}`);
        updatedImage = await storage.createUiImage({
          imageType,
          imageUrl: publicUrl,
          portal,
          altText: altText || null,
          description: description || null
        });
      }
      
      res.json(updatedImage);
    } catch (error) {
      console.error("Error updating UI image:", error);
      res.status(500).json({ error: "Failed to update UI image" });
    }
  });

  // Proxy images from R2 storage
  app.get("/api/proxy-image/:provider/:path(*)", async (req, res) => {
    try {
      const { provider, path } = req.params;

      const config = EXTERNAL_R2_CONFIGS[provider as keyof typeof EXTERNAL_R2_CONFIGS];
      if (!config) {
        return res.status(404).json({ error: "Provider not found" });
      }

      // Generate presigned download URL
      const downloadUrl = await multiR2Storage.getDownloadUrl(provider, path);
      
      if (!downloadUrl) {
        return res.status(404).json({ error: "File not found or cannot generate download URL" });
      }

      // Fetch and proxy the image
      const imageResponse = await fetch(downloadUrl);
      
      if (!imageResponse.ok) {
        return res.status(404).json({ error: "Image not found" });
      }

      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const cacheControl = imageResponse.headers.get('cache-control') || 'public, max-age=3600';
      
      res.set({
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'Access-Control-Allow-Origin': '*'
      });

      // Stream the image
      const imageBuffer = await imageResponse.arrayBuffer();
      res.send(Buffer.from(imageBuffer));

    } catch (error) {
      console.error("Error proxying image:", error);
      res.status(500).json({ error: "Failed to proxy image" });
    }
  });

  // Delete UI image from R2 storage  
  app.delete("/api/ui-images/:fileName", requireImageEditPermission, async (req, res) => {
    try {
      const fileName = req.params.fileName;
      
      // Delete from R2 storage
      const deleteResult = await multiR2Storage.deleteFile("primary", `ui-images/${fileName}`);
      
      if (!deleteResult.success) {
        console.error("Failed to delete from R2:", deleteResult.error);
        return res.status(500).json({ 
          error: "Failed to delete image from storage",
          details: deleteResult.error 
        });
      }

      // Note: We're not removing from database as this is a simple file manager
      // If needed in the future, add database cleanup here
      
      res.json({ 
        success: true, 
        message: "Image deleted successfully from storage",
        fileName: fileName
      });
      
    } catch (error) {
      console.error("Error deleting UI image:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  });

  // Serve UI images from R2 storage
  app.get("/ui-images/:fileName", async (req, res) => {
    try {
      const fileName = req.params.fileName;
      
      // Get download URL from R2
      const downloadUrl = await multiR2Storage.getDownloadUrl("primary", `ui-images/${fileName}`);
      
      if (downloadUrl) {
        // Proxy the image
        try {
          const imageResponse = await fetch(downloadUrl);
          if (imageResponse.ok) {
            const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
            res.set({
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': '*'
            });
            
            // Stream the image data
            const imageBuffer = await imageResponse.arrayBuffer();
            return res.send(Buffer.from(imageBuffer));
          }
        } catch (proxyError) {
          console.error("Error proxying UI image:", proxyError);
        }
      }
      
      // Fallback to 404 if image not found
      res.status(404).json({ error: "UI image not found" });
    } catch (error) {
      console.error("Error serving UI image:", error);
      res.status(500).json({ error: "Failed to serve UI image" });
    }
  });

  // Helper function to get folder name based on context
  const getContextFolder = (baseFolder: string, context?: string) => {
    const ctx = context || 'qbank'; // Default to question bank
    if (ctx === 'exam') {
      return `exam-${baseFolder}`;
    }
    return `qbank-${baseFolder}`;
  };

  // Generic download handler for R2 files
  // Uses redirect to presigned URL for large files to bypass proxy body size limits
  const handleFileDownload = async (folder: string, filename: string, res: any, contentType: string = 'application/octet-stream', cacheMaxAge: number = 3600) => {
    try {
      const objectKey = `${folder}/${filename}`;
      const downloadUrl = await r2Manager.generateDownloadUrl("primary", objectKey);
      
      if (downloadUrl) {
        // Check if this is an audio file (potentially large) - redirect to presigned URL
        const isAudioFile = contentType.startsWith('audio/') || folder.includes('audio');
        
        if (isAudioFile) {
          // For audio files, redirect directly to R2 presigned URL to avoid proxy body size limits
          console.log(`Redirecting to R2 presigned URL for: ${objectKey}`);
          return res.redirect(downloadUrl);
        }
        
        // For small files (images), proxy through server for caching benefits
        try {
          const response = await fetch(downloadUrl);
          if (response.ok) {
            const actualContentType = response.headers.get('content-type') || contentType;
            res.set({
              'Content-Type': actualContentType,
              'Cache-Control': `public, max-age=${cacheMaxAge}`,
              'Access-Control-Allow-Origin': '*'
            });
            
            const buffer = await response.arrayBuffer();
            return res.send(Buffer.from(buffer));
          }
        } catch (proxyError) {
          console.error(`Error proxying file from ${folder}:`, proxyError);
          // Fallback to redirect on proxy error
          return res.redirect(downloadUrl);
        }
      }
      
      res.status(404).json({ error: "File not found" });
    } catch (error) {
      console.error(`Error serving file from ${folder}:`, error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  };

  // Question image upload endpoint (direct upload using multipart/form-data)
  // Supports context parameter: ?context=qbank (default) or ?context=exam
  app.post("/api/question-images/upload-direct", upload.single('file'), async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const context = req.query.context as string || req.body.context || 'qbank';
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Validate file type
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: "Only image files are allowed" });
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "Image size cannot exceed 5MB" });
      }

      const timestamp = Date.now();
      const fileExtension = file.originalname.split('.').pop() || 'jpg';
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const folder = getContextFolder('temp-images', context);
      
      try {
        const uploadConfig: MediaUploadConfig = {
          provider: "primary",
          folder: folder,
          allowedTypes: ["image/*"],
          maxSizeBytes: 5 * 1024 * 1024
        };
        
        const uploadResult = await multiR2Storage.uploadFile(
          file.buffer,
          fileName,
          file.mimetype,
          uploadConfig
        );

        if (!uploadResult.success) {
          return res.status(500).json({ message: uploadResult.error || "Failed to upload image" });
        }

        const imageUrl = `/api/${folder}/${fileName}`;
        res.json({ 
          imageUrl,
          originalFileName: file.originalname || 'image file',
          context
        });
      } catch (error) {
        console.error("Error uploading question image:", error);
        res.status(500).json({ message: "Failed to upload image" });
      }
    } catch (error) {
      console.error("Error handling question image upload:", error);
      res.status(500).json({ message: "Failed to process image upload request" });
    }
  });

  // Description image upload endpoint (direct upload using multipart/form-data)
  // Supports context parameter: ?context=qbank (default) or ?context=exam
  app.post("/api/description-images/upload-direct", upload.single('file'), async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const context = req.query.context as string || req.body.context || 'qbank';
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Validate file type
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: "Only image files are allowed" });
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "Image size cannot exceed 5MB" });
      }

      const timestamp = Date.now();
      const fileExtension = file.originalname.split('.').pop() || 'jpg';
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const folder = getContextFolder('temp-description-images', context);
      
      try {
        const uploadConfig: MediaUploadConfig = {
          provider: "primary",
          folder: folder,
          allowedTypes: ["image/*"],
          maxSizeBytes: 5 * 1024 * 1024
        };
        
        const uploadResult = await multiR2Storage.uploadFile(
          file.buffer,
          fileName,
          file.mimetype,
          uploadConfig
        );

        if (!uploadResult.success) {
          return res.status(500).json({ message: uploadResult.error || "Failed to upload image" });
        }

        const imageUrl = `/api/${folder}/${fileName}`;
        res.json({ 
          imageUrl,
          url: imageUrl,
          originalFileName: file.originalname || 'image file',
          context
        });
      } catch (error) {
        console.error("Error uploading description image:", error);
        res.status(500).json({ message: "Failed to upload image" });
      }
    } catch (error) {
      console.error("Error handling description image upload:", error);
      res.status(500).json({ message: "Failed to process image upload request" });
    }
  });

  // Answer choice image upload endpoint (direct upload using multipart/form-data)
  // Supports context parameter: ?context=qbank (default) or ?context=exam
  app.post("/api/answer-images/upload-direct", upload.single('image'), async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const context = req.query.context as string || req.body.context || 'qbank';
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Validate file type
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: "Only image files are allowed" });
      }

      // Validate file size (max 3MB for answer images)
      if (file.size > 3 * 1024 * 1024) {
        return res.status(400).json({ message: "Image size cannot exceed 3MB" });
      }

      const timestamp = Date.now();
      const fileExtension = file.originalname.split('.').pop() || 'jpg';
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const folder = getContextFolder('temp-answer-images', context);
      
      try {
        const uploadConfig: MediaUploadConfig = {
          provider: "primary",
          folder: folder,
          allowedTypes: ["image/*"],
          maxSizeBytes: 5 * 1024 * 1024
        };
        
        const uploadResult = await multiR2Storage.uploadFile(
          file.buffer,
          fileName,
          file.mimetype,
          uploadConfig
        );

        if (!uploadResult.success) {
          return res.status(500).json({ message: uploadResult.error || "Failed to upload image" });
        }

        const imageUrl = `/api/${folder}/${fileName}`;
        res.json({ 
          imageUrl,
          originalFileName: file.originalname || 'image file',
          context
        });
      } catch (error) {
        console.error("Error uploading answer image:", error);
        res.status(500).json({ message: "Failed to upload image" });
      }
    } catch (error) {
      console.error("Error handling answer image upload:", error);
      res.status(500).json({ message: "Failed to process image upload request" });
    }
  });

  // Description audio upload endpoint (direct upload using multipart/form-data)
  // Supports context parameter: ?context=qbank (default) or ?context=exam
  app.post("/api/description-audio/upload-direct", upload.single('file'), async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const context = req.query.context as string || req.body.context || 'qbank';
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      // Validate file type
      if (!file.mimetype.startsWith('audio/')) {
        return res.status(400).json({ message: "Only audio files are allowed" });
      }

      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        return res.status(400).json({ message: "Audio size cannot exceed 50MB" });
      }

      const timestamp = Date.now();
      const fileExtension = file.originalname.split('.').pop() || 'mp3';
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const folder = getContextFolder('temp-description-audio', context);
      
      try {
        const uploadConfig: MediaUploadConfig = {
          provider: "primary",
          folder: folder,
          allowedTypes: ["audio/*"],
          maxSizeBytes: 50 * 1024 * 1024
        };
        
        const uploadResult = await multiR2Storage.uploadFile(
          file.buffer,
          fileName,
          file.mimetype,
          uploadConfig
        );

        if (!uploadResult.success) {
          return res.status(500).json({ message: uploadResult.error || "Failed to upload audio" });
        }

        const audioUrl = `/api/${folder}/${fileName}`;
        res.json({ 
          audioUrl,
          originalFileName: file.originalname || 'audio file',
          context
        });
      } catch (error) {
        console.error("Error uploading description audio:", error);
        res.status(500).json({ message: "Failed to upload audio" });
      }
    } catch (error) {
      console.error("Error handling description audio upload:", error);
      res.status(500).json({ message: "Failed to process audio upload request" });
    }
  });

  // Audio upload via server proxy (alternative to presigned URL)
  // Supports context parameter: ?context=qbank (default) or ?context=exam
  app.post("/api/audio/upload-direct", upload.single('audio'), async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const context = req.query.context as string || req.body.context || 'qbank';
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      const file = req.file;
      
      // Validate audio file type
      if (!file.mimetype.startsWith('audio/')) {
        return res.status(400).json({ message: "Only audio files are allowed" });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = file.originalname.split('.').pop() || 'mp3';
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const folder = getContextFolder('temp-audio', context);
      
      try {
        // Upload to temporary location first
        const uploadResult = await multiR2Storage.uploadFile(
          file.buffer,
          fileName,
          file.mimetype,
          {
            provider: "primary",
            folder: folder,
            allowedTypes: ["audio/*"],
            maxSizeBytes: 50 * 1024 * 1024
          }
        );
        
        if (!uploadResult.success) {
          return res.status(500).json({ error: uploadResult.error || "Upload failed" });
        }
        
        // Return temporary audio URL
        const audioUrl = `/api/${folder}/${fileName}`;
        res.json({ 
          audioUrl,
          originalFileName: file.originalname || 'audio file',
          context
        });
        
      } catch (uploadError) {
        console.error("Direct upload error:", uploadError);
        res.status(500).json({ error: "Failed to upload audio file" });
      }
    } catch (error) {
      console.error("Audio upload endpoint error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Audio upload endpoint (presigned URL) - supports all audio upload types
  // target: questionAudio, descriptionAudio, sectionAudio (determines folder)
  // context: qbank, exam (determines prefix)
  app.post("/api/audio/upload", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { fileName, fileType, fileSize, target, context } = req.body;
      
      if (!fileName || !fileType || !fileSize) {
        return res.status(400).json({ message: "File name, type, and size are required" });
      }

      // Validate audio file type
      if (!fileType.startsWith('audio/')) {
        return res.status(400).json({ message: "Only audio files are allowed" });
      }

      // Validate file size (max 50MB)
      if (fileSize > 50 * 1024 * 1024) {
        return res.status(400).json({ message: "File size cannot exceed 50MB" });
      }

      try {
        // Determine folder based on target and context
        const uploadContext = context || 'qbank';
        const uploadTarget = target || 'questionAudio';
        
        // Map target to folder
        const folderMap: Record<string, string> = {
          'questionAudio': 'temp-audio',
          'descriptionAudio': 'temp-description-audio',
          'sectionAudio': 'temp-description-audio'
        };
        
        const baseFolder = folderMap[uploadTarget] || 'temp-audio';
        const folder = getContextFolder(baseFolder, uploadContext);
        
        console.log(`Audio presigned upload: target=${uploadTarget}, context=${uploadContext}, folder=${folder}`);
        
        const uploadResult = await multiR2Storage.getUploadUrl({
          provider: "primary",
          folder: folder,
          allowedTypes: ["audio/*"],
          maxSizeBytes: 50 * 1024 * 1024 // 50MB
        }, fileType);
        
        console.log("Upload result:", uploadResult);
        
        if (!uploadResult.success) {
          console.error("Upload URL generation failed:", uploadResult.error);
          return res.status(500).json({ 
            uploadUrl: { success: false, error: uploadResult.error || "Failed to generate upload URL" }
          });
        }
        
        const uploadUrl = uploadResult.url;
        // Build the download URL based on folder
        const audioUrl = `/api/${folder}/${uploadResult.path?.split('/').pop() || ''}`;

        console.log(`Generated upload URL: ${uploadUrl}`);
        console.log(`Audio URL will be: ${audioUrl}`);

        res.json({
          uploadUrl,
          audioUrl,
          folder,
          context: uploadContext,
          target: uploadTarget
        });
      } catch (error) {
        console.error("Error generating audio upload URL:", error);
        res.status(500).json({ message: "Failed to generate upload URL" });
      }
    } catch (error) {
      console.error("Error handling audio upload:", error);
      res.status(500).json({ message: "Failed to process audio upload request" });
    }
  });

  // Streaming audio upload endpoint - bypasses body size limits by streaming directly to R2
  // Uses raw binary body instead of multipart form data
  app.put("/api/audio/stream-upload", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const target = req.query.target as string || 'questionAudio';
      const context = req.query.context as string || 'qbank';
      const contentType = req.headers['content-type'] || 'audio/mpeg';
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);

      // Validate content type
      if (!contentType.startsWith('audio/')) {
        return res.status(400).json({ message: "Only audio files are allowed" });
      }

      // Validate file size (max 50MB)
      if (contentLength > 50 * 1024 * 1024) {
        return res.status(400).json({ message: "File size cannot exceed 50MB" });
      }

      console.log(`Stream upload: target=${target}, context=${context}, contentType=${contentType}, size=${contentLength}`);

      // Determine folder based on target and context
      const folderMap: Record<string, string> = {
        'questionAudio': 'temp-audio',
        'descriptionAudio': 'temp-description-audio',
        'sectionAudio': 'temp-description-audio'
      };
      
      const baseFolder = folderMap[target] || 'temp-audio';
      const folder = getContextFolder(baseFolder, context);
      const fileId = randomUUID();
      const filePath = `${folder}/${fileId}`;

      try {
        // Collect chunks from stream (needed for S3 SDK)
        const chunks: Buffer[] = [];
        
        req.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        await new Promise<void>((resolve, reject) => {
          req.on('end', resolve);
          req.on('error', reject);
        });

        const fileBuffer = Buffer.concat(chunks);
        console.log(`Received ${fileBuffer.length} bytes for streaming upload`);

        // Upload to R2
        const uploadResult = await multiR2Storage.uploadFile(
          fileBuffer,
          fileId,
          contentType,
          {
            provider: "primary",
            folder: folder,
            allowedTypes: ["audio/*"],
            maxSizeBytes: 50 * 1024 * 1024
          }
        );

        if (!uploadResult.success) {
          console.error("Stream upload to R2 failed:", uploadResult.error);
          return res.status(500).json({ error: uploadResult.error || "Upload failed" });
        }

        const audioUrl = `/api/${folder}/${uploadResult.path?.split('/').pop() || fileId}`;
        console.log(`Stream upload success: ${audioUrl}`);

        res.json({
          success: true,
          audioUrl,
          folder,
          context,
          target
        });
      } catch (uploadError) {
        console.error("Stream upload error:", uploadError);
        res.status(500).json({ error: "Failed to upload audio file" });
      }
    } catch (error) {
      console.error("Stream upload endpoint error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============ CHUNKED UPLOAD FOR LARGE FILES ============
  // Store chunks in memory during upload (will be cleared after completion)
  const chunkedUploads: Map<string, { 
    chunks: Map<number, Buffer>, 
    totalChunks: number, 
    contentType: string,
    target: string,
    context: string,
    createdAt: number 
  }> = new Map();

  // Clean up stale uploads every 10 minutes
  setInterval(() => {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    for (const [uploadId, upload] of chunkedUploads.entries()) {
      if (now - upload.createdAt > maxAge) {
        console.log(`Cleaning up stale chunked upload: ${uploadId}`);
        chunkedUploads.delete(uploadId);
      }
    }
  }, 10 * 60 * 1000);

  // Initialize chunked upload
  app.post("/api/audio/chunked-upload/init", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { totalChunks, contentType, target, context, totalSize } = req.body;

      if (!totalChunks || totalChunks < 1) {
        return res.status(400).json({ message: "Invalid totalChunks" });
      }

      if (totalSize > 50 * 1024 * 1024) {
        return res.status(400).json({ message: "File size cannot exceed 50MB" });
      }

      const uploadId = randomUUID();
      chunkedUploads.set(uploadId, {
        chunks: new Map(),
        totalChunks,
        contentType: contentType || 'audio/mpeg',
        target: target || 'questionAudio',
        context: context || 'qbank',
        createdAt: Date.now()
      });

      console.log(`Chunked upload initialized: ${uploadId}, totalChunks=${totalChunks}, size=${totalSize}`);
      res.json({ uploadId, totalChunks });
    } catch (error) {
      console.error("Chunked upload init error:", error);
      res.status(500).json({ error: "Failed to initialize upload" });
    }
  });

  // Upload a single chunk (small body, bypasses 413)
  app.post("/api/audio/chunked-upload/chunk", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const uploadId = req.query.uploadId as string;
      const chunkIndex = parseInt(req.query.chunkIndex as string, 10);

      if (!uploadId || !chunkedUploads.has(uploadId)) {
        return res.status(400).json({ message: "Invalid upload ID" });
      }

      if (isNaN(chunkIndex) || chunkIndex < 0) {
        return res.status(400).json({ message: "Invalid chunk index" });
      }

      const upload = chunkedUploads.get(uploadId)!;

      // Collect the raw body
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      
      await new Promise<void>((resolve, reject) => {
        req.on('end', resolve);
        req.on('error', reject);
      });

      const chunkBuffer = Buffer.concat(chunks);
      upload.chunks.set(chunkIndex, chunkBuffer);

      console.log(`Chunk ${chunkIndex + 1}/${upload.totalChunks} received for upload ${uploadId}, size=${chunkBuffer.length}`);

      res.json({ 
        success: true, 
        chunkIndex, 
        receivedChunks: upload.chunks.size,
        totalChunks: upload.totalChunks 
      });
    } catch (error) {
      console.error("Chunk upload error:", error);
      res.status(500).json({ error: "Failed to upload chunk" });
    }
  });

  // Complete chunked upload - assemble and upload to R2
  app.post("/api/audio/chunked-upload/complete", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { uploadId } = req.body;

      if (!uploadId || !chunkedUploads.has(uploadId)) {
        return res.status(400).json({ message: "Invalid upload ID" });
      }

      const upload = chunkedUploads.get(uploadId)!;

      // Verify all chunks received
      if (upload.chunks.size !== upload.totalChunks) {
        return res.status(400).json({ 
          message: `Missing chunks: received ${upload.chunks.size}/${upload.totalChunks}` 
        });
      }

      // Assemble chunks in order
      const sortedChunks: Buffer[] = [];
      for (let i = 0; i < upload.totalChunks; i++) {
        const chunk = upload.chunks.get(i);
        if (!chunk) {
          return res.status(400).json({ message: `Missing chunk ${i}` });
        }
        sortedChunks.push(chunk);
      }

      const fileBuffer = Buffer.concat(sortedChunks);
      console.log(`Assembled ${fileBuffer.length} bytes from ${upload.totalChunks} chunks for upload ${uploadId}`);

      // Determine folder
      const folderMap: Record<string, string> = {
        'questionAudio': 'temp-audio',
        'descriptionAudio': 'temp-description-audio',
        'sectionAudio': 'temp-description-audio'
      };
      
      const baseFolder = folderMap[upload.target] || 'temp-audio';
      const folder = getContextFolder(baseFolder, upload.context);
      
      // Generate filename with timestamp and extension (same format as direct upload)
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      // Determine extension from content type (strip params e.g. "audio/webm;codecs=opus")
      const extensionMap: Record<string, string> = {
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/wav': 'wav',
        'audio/wave': 'wav',
        'audio/x-wav': 'wav',
        'audio/ogg': 'ogg',
        'audio/webm': 'webm',
        'audio/aac': 'aac',
        'audio/m4a': 'm4a',
        'audio/mp4': 'm4a',
        'audio/x-m4a': 'm4a',
        'audio/opus': 'opus',
      };
      const baseContentType = (upload.contentType || 'audio/mpeg')
        .split(';')[0]
        .trim()
        .toLowerCase();
      const fileExtension = extensionMap[baseContentType] || 'mp3';
      const fileName = `${timestamp}-${randomStr}.${fileExtension}`;

      // Upload to R2
      const uploadResult = await multiR2Storage.uploadFile(
        fileBuffer,
        fileName,
        baseContentType,
        {
          provider: "primary",
          folder: folder,
          allowedTypes: ["audio/*"],
          maxSizeBytes: 50 * 1024 * 1024
        }
      );

      // Clean up
      chunkedUploads.delete(uploadId);

      if (!uploadResult.success) {
        console.error("Chunked upload to R2 failed:", uploadResult.error);
        return res.status(500).json({ error: uploadResult.error || "Upload failed" });
      }

      const audioUrl = `/api/${folder}/${fileName}`;
      console.log(`Chunked upload complete: ${audioUrl}`);

      res.json({
        success: true,
        audioUrl,
        folder,
        context: upload.context,
        target: upload.target
      });
    } catch (error) {
      console.error("Chunked upload complete error:", error);
      res.status(500).json({ error: "Failed to complete upload" });
    }
  });

  // Cancel/abort chunked upload
  app.post("/api/audio/chunked-upload/abort", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { uploadId } = req.body;

      if (uploadId && chunkedUploads.has(uploadId)) {
        chunkedUploads.delete(uploadId);
        console.log(`Chunked upload aborted: ${uploadId}`);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Chunked upload abort error:", error);
      res.status(500).json({ error: "Failed to abort upload" });
    }
  });

  // ============ DOWNLOAD ENDPOINTS FOR CONTEXT-SPECIFIC FOLDERS ============

  app.get("/api/article-images/:filename", async (req, res) => {
    await handleFileDownload("article-images", req.params.filename, res, "image/jpeg", 31536000);
  });
  
  // Question Bank download endpoints
  app.get("/api/qbank-temp-images/:filename", async (req, res) => {
    await handleFileDownload('qbank-temp-images', req.params.filename, res, 'image/jpeg', 300);
  });
  
  app.get("/api/qbank-temp-answer-images/:filename", async (req, res) => {
    await handleFileDownload('qbank-temp-answer-images', req.params.filename, res, 'image/jpeg', 300);
  });
  
  app.get("/api/qbank-temp-audio/:filename", async (req, res) => {
    await handleFileDownload('qbank-temp-audio', req.params.filename, res, 'audio/mpeg', 300);
  });
  
  app.get("/api/qbank-temp-description-images/:filename", async (req, res) => {
    await handleFileDownload('qbank-temp-description-images', req.params.filename, res, 'image/jpeg', 300);
  });
  
  app.get("/api/qbank-temp-description-audio/:filename", async (req, res) => {
    await handleFileDownload('qbank-temp-description-audio', req.params.filename, res, 'audio/mpeg', 300);
  });
  
  app.get("/api/qbank-images/:filename", async (req, res) => {
    await handleFileDownload('qbank-images', req.params.filename, res, 'image/jpeg', 31536000); // 1 year
  });
  
  app.get("/api/qbank-answer-images/:filename", async (req, res) => {
    await handleFileDownload('qbank-answer-images', req.params.filename, res, 'image/jpeg', 31536000);
  });
  
  app.get("/api/qbank-audio/:filename", async (req, res) => {
    await handleFileDownload('qbank-audio', req.params.filename, res, 'audio/mpeg', 31536000);
  });
  
  app.get("/api/qbank-description-images/:filename", async (req, res) => {
    await handleFileDownload('qbank-description-images', req.params.filename, res, 'image/jpeg', 31536000);
  });
  
  app.get("/api/qbank-description-audio/:filename", async (req, res) => {
    await handleFileDownload('qbank-description-audio', req.params.filename, res, 'audio/mpeg', 31536000);
  });
  
  // Exam download endpoints
  app.get("/api/exam-temp-images/:filename", async (req, res) => {
    await handleFileDownload('exam-temp-images', req.params.filename, res, 'image/jpeg', 300);
  });
  
  app.get("/api/exam-temp-answer-images/:filename", async (req, res) => {
    await handleFileDownload('exam-temp-answer-images', req.params.filename, res, 'image/jpeg', 300);
  });
  
  app.get("/api/exam-temp-audio/:filename", async (req, res) => {
    await handleFileDownload('exam-temp-audio', req.params.filename, res, 'audio/mpeg', 300);
  });
  
  app.get("/api/exam-temp-description-images/:filename", async (req, res) => {
    await handleFileDownload('exam-temp-description-images', req.params.filename, res, 'image/jpeg', 300);
  });
  
  app.get("/api/exam-temp-description-audio/:filename", async (req, res) => {
    await handleFileDownload('exam-temp-description-audio', req.params.filename, res, 'audio/mpeg', 300);
  });
  
  app.get("/api/exam-images/:filename", async (req, res) => {
    await handleFileDownload('exam-images', req.params.filename, res, 'image/jpeg', 31536000);
  });
  
  app.get("/api/exam-answer-images/:filename", async (req, res) => {
    await handleFileDownload('exam-answer-images', req.params.filename, res, 'image/jpeg', 31536000);
  });
  
  app.get("/api/exam-audio/:filename", async (req, res) => {
    await handleFileDownload('exam-audio', req.params.filename, res, 'audio/mpeg', 31536000);
  });
  
  app.get("/api/exam-description-images/:filename", async (req, res) => {
    await handleFileDownload('exam-description-images', req.params.filename, res, 'image/jpeg', 31536000);
  });
  
  app.get("/api/exam-description-audio/:filename", async (req, res) => {
    await handleFileDownload('exam-description-audio', req.params.filename, res, 'audio/mpeg', 31536000);
  });

  // ============ STREAMING AUDIO ENDPOINT ============
  
  // Audio stream info endpoint - returns presigned URL and metadata for streaming
  app.get("/api/audio/stream-info", async (req, res) => {
    try {
      const { url } = req.query;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL parameter is required" });
      }

      // Extract folder and filename from the URL
      // Supports formats: /api/xxx-audio/filename, /api/xxx-description-audio/filename
      const urlMatch = url.match(/\/api\/([^/]+)\/([^/]+)$/);
      if (!urlMatch) {
        return res.status(400).json({ error: "Invalid audio URL format" });
      }

      const [, folder, filename] = urlMatch;
      
      // Map API path to R2 folder
      const folderMapping: { [key: string]: string } = {
        'audio': 'audio',
        'temp-audio': 'temp-audio',
        'description-audio': 'description-audio',
        'temp-description-audio': 'temp-description-audio',
        'qbank-audio': 'qbank-audio',
        'qbank-temp-audio': 'qbank-temp-audio',
        'qbank-description-audio': 'qbank-description-audio',
        'qbank-temp-description-audio': 'qbank-temp-description-audio',
        'exam-audio': 'exam-audio',
        'exam-temp-audio': 'exam-temp-audio',
        'exam-description-audio': 'exam-description-audio',
        'exam-temp-description-audio': 'exam-temp-description-audio',
      };

      const r2Folder = folderMapping[folder];
      if (!r2Folder) {
        return res.status(400).json({ error: "Unknown audio folder" });
      }

      const objectKey = `${r2Folder}/${filename}`;
      console.log(`Getting stream info for: ${objectKey}`);
      
      const downloadUrl = await r2Manager.generateDownloadUrl("primary", objectKey);
      
      if (!downloadUrl) {
        console.log(`No download URL generated for: ${objectKey}`);
        return res.status(404).json({ error: "Audio file not found" });
      }

      console.log(`Generated presigned URL for streaming: ${objectKey}`);

      // Try to get file metadata (content-length) via HEAD request
      // But don't fail if HEAD doesn't work - just return the URL
      let contentLength: number | null = null;
      let contentType = 'audio/mpeg';
      let supportsRange = true; // R2 supports range requests by default

      try {
        const headResponse = await fetch(downloadUrl, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (headResponse.ok) {
          const lengthHeader = headResponse.headers.get('content-length');
          contentLength = lengthHeader ? parseInt(lengthHeader, 10) : null;
          contentType = headResponse.headers.get('content-type') || 'audio/mpeg';
          supportsRange = headResponse.headers.get('accept-ranges') === 'bytes';
          console.log(`HEAD request successful - size: ${contentLength}, type: ${contentType}`);
        } else {
          console.log(`HEAD request returned ${headResponse.status}, using defaults`);
        }
      } catch (headError) {
        console.log("HEAD request failed, using defaults:", headError);
        // Continue with defaults - don't fail the request
      }

      return res.json({
        url: downloadUrl,
        contentLength,
        contentType,
        supportsRange
      });
    } catch (error) {
      console.error("Error generating stream info:", error);
      res.status(500).json({ error: "Failed to generate stream info" });
    }
  });

  // ============ LEGACY DOWNLOAD ENDPOINTS (kept for backward compatibility) ============
  
  // Audio download endpoint
  app.get("/api/audio/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const objectKey = `audio/${filename}`;
      
      const downloadUrl = await r2Manager.generateDownloadUrl("primary", objectKey);
      
      if (!downloadUrl) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      // Redirect to R2 presigned URL to avoid proxy body size limits
      console.log(`Redirecting to R2 presigned URL for: ${objectKey}`);
      return res.redirect(downloadUrl);
    } catch (error) {
      console.error("Error serving audio file:", error);
      res.status(500).json({ message: "Failed to serve audio file" });
    }
  });

  // Temporary question images download endpoint
  app.get("/api/temp-question-images/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const objectKey = `temp-question-images/${filename}`;
      
      const downloadUrl = await r2Manager.generateDownloadUrl("primary", objectKey);
      
      if (downloadUrl) {
        // Proxy the image
        try {
          const response = await fetch(downloadUrl);
          if (response.ok) {
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            res.set({
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': '*'
            });
            
            const buffer = await response.arrayBuffer();
            return res.send(Buffer.from(buffer));
          }
        } catch (proxyError) {
          console.error("Error proxying question image:", proxyError);
        }
      }
      
      res.status(404).json({ error: "Question image not found" });
    } catch (error) {
      console.error("Error serving question image:", error);
      res.status(500).json({ error: "Failed to serve question image" });
    }
  });

  // Temporary answer images download endpoint
  app.get("/api/temp-answer-images/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const objectKey = `temp-answer-images/${filename}`;
      
      const downloadUrl = await r2Manager.generateDownloadUrl("primary", objectKey);
      
      if (downloadUrl) {
        // Proxy the image
        try {
          const response = await fetch(downloadUrl);
          if (response.ok) {
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            res.set({
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': '*'
            });
            
            const buffer = await response.arrayBuffer();
            return res.send(Buffer.from(buffer));
          }
        } catch (proxyError) {
          console.error("Error proxying answer image:", proxyError);
        }
      }
      
      res.status(404).json({ error: "Answer image not found" });
    } catch (error) {
      console.error("Error serving answer image:", error);
      res.status(500).json({ error: "Failed to serve answer image" });
    }
  });

  // Permanent question images download endpoint
  app.get("/api/question-images/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const objectKey = `question-images/${filename}`;
      
      const downloadUrl = await r2Manager.generateDownloadUrl("primary", objectKey);
      
      if (downloadUrl) {
        // Proxy the image
        try {
          const response = await fetch(downloadUrl);
          if (response.ok) {
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            res.set({
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400', // 24 hour cache for permanent files
              'Access-Control-Allow-Origin': '*'
            });
            
            const buffer = await response.arrayBuffer();
            return res.send(Buffer.from(buffer));
          }
        } catch (proxyError) {
          console.error("Error proxying permanent question image:", proxyError);
        }
      }
      
      res.status(404).json({ error: "Question image not found" });
    } catch (error) {
      console.error("Error serving permanent question image:", error);
      res.status(500).json({ error: "Failed to serve question image" });
    }
  });

  // Permanent answer images download endpoint
  app.get("/api/answer-images/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const objectKey = `answer-images/${filename}`;
      
      const downloadUrl = await r2Manager.generateDownloadUrl("primary", objectKey);
      
      if (downloadUrl) {
        // Proxy the image
        try {
          const response = await fetch(downloadUrl);
          if (response.ok) {
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            res.set({
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400', // 24 hour cache for permanent files
              'Access-Control-Allow-Origin': '*'
            });
            
            const buffer = await response.arrayBuffer();
            return res.send(Buffer.from(buffer));
          }
        } catch (proxyError) {
          console.error("Error proxying permanent answer image:", proxyError);
        }
      }
      
      res.status(404).json({ error: "Answer image not found" });
    } catch (error) {
      console.error("Error serving permanent answer image:", error);
      res.status(500).json({ error: "Failed to serve answer image" });
    }
  });

  // Permanent description images download endpoint
  app.get("/api/description-images/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const objectKey = `description-images/${filename}`;
      
      const downloadUrl = await r2Manager.generateDownloadUrl("primary", objectKey);
      
      if (downloadUrl) {
        // Proxy the image
        try {
          const response = await fetch(downloadUrl);
          if (response.ok) {
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            res.set({
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400', // 24 hour cache for permanent files
              'Access-Control-Allow-Origin': '*'
            });
            
            const buffer = await response.arrayBuffer();
            return res.send(Buffer.from(buffer));
          }
        } catch (proxyError) {
          console.error("Error proxying permanent description image:", proxyError);
        }
      }
      
      res.status(404).json({ error: "Description image not found" });
    } catch (error) {
      console.error("Error serving permanent description image:", error);
      res.status(500).json({ error: "Failed to serve description image" });
    }
  });

  // Permanent description audio download endpoint
  app.get("/api/description-audio/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const objectKey = `description-audio/${filename}`;
      
      const downloadUrl = await r2Manager.generateDownloadUrl("primary", objectKey);
      
      if (!downloadUrl) {
        return res.status(404).json({ message: "Description audio file not found" });
      }

      // Redirect to R2 presigned URL to avoid proxy body size limits
      console.log(`Redirecting to R2 presigned URL for: ${objectKey}`);
      return res.redirect(downloadUrl);
    } catch (error) {
      console.error("Error serving description audio file:", error);
      res.status(500).json({ message: "Failed to serve description audio file" });
    }
  });

  // Temporary audio download endpoint
  app.get("/api/temp-audio/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const objectKey = `temp-audio/${filename}`;
      
      const downloadUrl = await r2Manager.generateDownloadUrl("primary", objectKey);
      
      if (!downloadUrl) {
        return res.status(404).json({ message: "Temporary audio file not found" });
      }

      // Redirect to R2 presigned URL to avoid proxy body size limits
      console.log(`Redirecting to R2 presigned URL for: ${objectKey}`);
      return res.redirect(downloadUrl);
    } catch (error) {
      console.error("Error serving temporary audio file:", error);
      res.status(500).json({ message: "Failed to serve temporary audio file" });
    }
  });

  // Cleanup temporary audio files endpoint
  app.post("/api/temp-audio/cleanup", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      let filenames;
      
      // Handle both regular JSON and sendBeacon text requests
      if (typeof req.body === 'string') {
        try {
          const parsed = JSON.parse(req.body);
          filenames = parsed.filenames;
        } catch (e) {
          return res.status(400).json({ message: "Invalid JSON in request body" });
        }
      } else {
        filenames = req.body.filenames;
      }

      if (!Array.isArray(filenames)) {
        return res.status(400).json({ message: "Filenames array is required" });
      }

      // Get context from query string for context-based folder structure
      const context = req.query.context as 'qbank' | 'exam' | undefined;
      const folderName = context ? getContextFolder('temp-audio', context) : 'temp-audio';

      const results = [];
      for (const filename of filenames) {
        const objectKey = `${folderName}/${filename}`;
        const result = await multiR2Storage.deleteFile("primary", objectKey);
        results.push({ filename, success: result.success, error: result.error });
        
        if (result.success) {
          console.log(`✓ Cleaned up temporary audio file: ${filename} from ${folderName}`);
        } else {
          console.warn(`✗ Failed to cleanup temporary audio file: ${filename} from ${folderName} - ${result.error}`);
        }
      }

      res.json({ results });
    } catch (error) {
      console.error("Error cleaning up temporary audio files:", error);
      res.status(500).json({ message: "Failed to cleanup temporary files" });
    }
  });

  // Cleanup temporary question images  
  app.post("/api/temp-question-images/cleanup", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { filenames } = req.body;
      
      if (!Array.isArray(filenames)) {
        return res.status(400).json({ message: "filenames must be an array" });
      }

      // Must match upload folder: getContextFolder('temp-images') → qbank-temp-images / exam-temp-images
      const context = req.query.context as 'qbank' | 'exam' | undefined;
      const folderName = context ? getContextFolder('temp-images', context) : 'temp-question-images';

      const results = [];
      for (const filename of filenames) {
        const objectKey = `${folderName}/${filename}`;
        const result = await multiR2Storage.deleteFile("primary", objectKey);
        results.push({ filename, success: result.success, error: result.error });
        
        if (result.success) {
          console.log(`✓ Cleaned up temporary question image: ${filename} from ${folderName}`);
        } else {
          console.warn(`✗ Failed to cleanup temporary question image: ${filename} from ${folderName} - ${result.error}`);
        }
      }

      res.json({ results });
    } catch (error) {
      console.error("Error cleaning up temporary question images:", error);
      res.status(500).json({ message: "Failed to cleanup temporary files" });
    }
  });

  // Cleanup temporary answer images  
  app.post("/api/temp-answer-images/cleanup", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { filenames } = req.body;
      
      if (!Array.isArray(filenames)) {
        return res.status(400).json({ message: "filenames must be an array" });
      }

      // Get context from query string for context-based folder structure
      const context = req.query.context as 'qbank' | 'exam' | undefined;
      const folderName = context ? getContextFolder('temp-answer-images', context) : 'temp-answer-images';

      const results = [];
      for (const filename of filenames) {
        const objectKey = `${folderName}/${filename}`;
        const result = await multiR2Storage.deleteFile("primary", objectKey);
        results.push({ filename, success: result.success, error: result.error });
        
        if (result.success) {
          console.log(`✓ Cleaned up temporary answer image: ${filename} from ${folderName}`);
        } else {
          console.warn(`✗ Failed to cleanup temporary answer image: ${filename} from ${folderName} - ${result.error}`);
        }
      }

      res.json({ results });
    } catch (error) {
      console.error("Error cleaning up temporary answer images:", error);
      res.status(500).json({ message: "Failed to cleanup temporary files" });
    }
  });

  // ---- Temp media URL helpers (qbank/exam context + legacy paths) ----
  const TEMP_QUESTION_IMAGE_MARKERS = [
    "/api/temp-question-images/",
    "/api/qbank-temp-images/",
    "/api/exam-temp-images/",
  ];
  const TEMP_ANSWER_IMAGE_MARKERS = [
    "/api/temp-answer-images/",
    "/api/qbank-temp-answer-images/",
    "/api/exam-temp-answer-images/",
  ];
  const TEMP_AUDIO_MARKERS = [
    "/api/temp-audio/",
    "/api/qbank-temp-audio/",
    "/api/exam-temp-audio/",
  ];
  const TEMP_DESCRIPTION_IMAGE_MARKERS = [
    "/api/temp-description-images/",
    "/api/qbank-temp-description-images/",
    "/api/exam-temp-description-images/",
  ];
  const TEMP_DESCRIPTION_AUDIO_MARKERS = [
    "/api/temp-description-audio/",
    "/api/qbank-temp-description-audio/",
    "/api/exam-temp-description-audio/",
  ];

  const isTempMediaUrl = (url: string | null | undefined, markers: string[]) =>
    Boolean(url && markers.some((m) => url.includes(m)));

  /** Promote a temp URL or throw — never silently drop media on save. */
  async function promoteTempOrThrow(
    url: string,
    markers: string[],
    mover: (u: string) => Promise<string | null>,
    label: string,
  ): Promise<string> {
    if (!isTempMediaUrl(url, markers)) return url;
    let result: string | null = null;
    try {
      result = await mover(url);
    } catch (error) {
      console.error(`Promote failed for ${label}:`, error);
      throw new MediaPromoteError(
        `Không thể lưu ${label}. Vui lòng tải lại file rồi thử lại.`,
      );
    }
    if (!result) {
      throw new MediaPromoteError(
        `Không thể lưu ${label}. File tạm có thể đã hết hạn — vui lòng tải lại rồi thử lại.`,
      );
    }
    return result;
  }

  async function promoteTempListOrThrow(
    urls: string[],
    markers: string[],
    mover: (u: string) => Promise<string | null>,
    label: string,
  ): Promise<string[]> {
    return Promise.all(
      urls
        .filter((u): u is string => typeof u === "string" && u.length > 0)
        .map((url) => promoteTempOrThrow(url, markers, mover, label)),
    );
  }

  async function promoteOptionImagesOrThrow(options: any): Promise<any> {
    if (!Array.isArray(options)) return options;
    return Promise.all(
      options.map(async (opt: any) => {
        if (typeof opt === "object" && opt?.imageUrls && Array.isArray(opt.imageUrls)) {
          const imageUrls = await promoteTempListOrThrow(
            opt.imageUrls,
            TEMP_ANSWER_IMAGE_MARKERS,
            moveTemporaryAnswerImageToPermanent,
            "ảnh đáp án",
          );
          return { ...opt, imageUrls };
        }
        return opt;
      }),
    );
  }

  // Generic helper to move file from temp to permanent with context support
  async function moveTemporaryFileToPermanent(
    tempUrl: string, 
    tempFolderPattern: string, 
    _contentType: string,
    _maxSizeBytes: number,
    _context: 'qbank' | 'exam' = 'qbank'
  ): Promise<string | null> {
    if (!tempUrl || !tempUrl.includes(tempFolderPattern)) {
      return tempUrl; // Already permanent or invalid
    }

    try {
      const filename = tempUrl.split('/').pop();
      if (!filename) return null;

      // Extract the base folder name from temp pattern (e.g., 'temp-images' from '/api/qbank-temp-images/')
      const match = tempUrl.match(/\/api\/(qbank|exam)-(temp-[^/]+)\//);
      if (!match) {
        console.warn(`Could not extract folder pattern from: ${tempUrl}`);
        return null;
      }

      const actualContext = match[1] as 'qbank' | 'exam';
      const tempBaseName = match[2]; // e.g., 'temp-images'
      const finalBaseName = tempBaseName.replace('temp-', ''); // e.g., 'images'
      
      const tempFolder = `${actualContext}-${tempBaseName}`;
      const finalFolder = `${actualContext}-${finalBaseName}`;
      const tempObjectKey = `${tempFolder}/${filename}`;
      const finalObjectKey = `${finalFolder}/${filename}`;

      // Promote via server-side CopyObject (no download/re-upload)
      const moved = await multiR2Storage.moveFile("primary", tempObjectKey, finalObjectKey);
      if (!moved.success) {
        console.warn(`Failed to move ${tempObjectKey} → ${finalObjectKey}: ${moved.error}`);
        return null;
      }

      console.log(`✓ Moved file: ${tempObjectKey} → ${finalObjectKey}`);
      return `/api/${finalFolder}/${filename}`;
    } catch (error) {
      console.error("Error moving temporary file to permanent:", error);
      return null;
    }
  }

  async function moveLegacyTempKeyToPermanent(
    tempObjectKey: string,
    finalObjectKey: string,
    publicPath: string,
  ): Promise<string | null> {
    const moved = await multiR2Storage.moveFile("primary", tempObjectKey, finalObjectKey);
    if (!moved.success) {
      console.warn(`Failed to move ${tempObjectKey} → ${finalObjectKey}: ${moved.error}`);
      return null;
    }
    return publicPath;
  }

  // Helper function to move temporary question images to permanent location (LEGACY - kept for backward compatibility)
  async function moveTemporaryQuestionImageToPermanent(tempUrl: string): Promise<string | null> {
    // Handle both new context-specific and old format
    if (tempUrl?.includes('/api/qbank-temp-images/') || tempUrl?.includes('/api/exam-temp-images/')) {
      return moveTemporaryFileToPermanent(tempUrl, 'temp-images', 'image/jpeg', 5 * 1024 * 1024);
    }
    
    // Legacy format handling
    if (!tempUrl || !tempUrl.includes('/api/temp-question-images/')) {
      return tempUrl;
    }

    try {
      const filename = tempUrl.split('/').pop();
      if (!filename) return null;
      return await moveLegacyTempKeyToPermanent(
        `temp-question-images/${filename}`,
        `question-images/${filename}`,
        `/api/question-images/${filename}`,
      );
    } catch (error) {
      console.error("Error moving temporary question image to permanent:", error);
      return null;
    }
  }

  // Helper function to move temporary answer images to permanent location
  async function moveTemporaryAnswerImageToPermanent(tempUrl: string): Promise<string | null> {
    // Handle both new context-specific and old format
    if (tempUrl?.includes('/api/qbank-temp-answer-images/') || tempUrl?.includes('/api/exam-temp-answer-images/')) {
      return moveTemporaryFileToPermanent(tempUrl, 'temp-answer-images', 'image/jpeg', 3 * 1024 * 1024);
    }
    
    // Legacy format handling
    if (!tempUrl || !tempUrl.includes('/api/temp-answer-images/')) {
      return tempUrl;
    }

    try {
      const filename = tempUrl.split('/').pop();
      if (!filename) return null;
      return await moveLegacyTempKeyToPermanent(
        `temp-answer-images/${filename}`,
        `answer-images/${filename}`,
        `/api/answer-images/${filename}`,
      );
    } catch (error) {
      console.error("Error moving temporary answer image to permanent:", error);
      return null;
    }
  }

  // Helper function to move temporary audio to permanent location
  async function moveTemporaryAudioToPermanent(tempUrl: string): Promise<string | null> {
    // Handle both new context-specific and old format
    if (tempUrl?.includes('/api/qbank-temp-audio/') || tempUrl?.includes('/api/exam-temp-audio/')) {
      return moveTemporaryFileToPermanent(tempUrl, 'temp-audio', 'audio/mpeg', 10 * 1024 * 1024);
    }
    
    // Legacy format handling
    if (!tempUrl || !tempUrl.includes('/api/temp-audio/')) {
      return tempUrl;
    }

    try {
      const filename = tempUrl.split('/').pop();
      if (!filename) return null;
      return await moveLegacyTempKeyToPermanent(
        `temp-audio/${filename}`,
        `audio/${filename}`,
        `/api/audio/${filename}`,
      );
    } catch (error) {
      console.error("Error moving temporary audio to permanent:", error);
      return null;
    }
  }

  // Helper function to move temporary description images to permanent location
  async function moveTemporaryDescriptionImageToPermanent(tempUrl: string): Promise<string | null> {
    // Handle both new context-specific and old format
    if (tempUrl?.includes('/api/qbank-temp-description-images/') || tempUrl?.includes('/api/exam-temp-description-images/')) {
      return moveTemporaryFileToPermanent(tempUrl, 'temp-description-images', 'image/jpeg', 5 * 1024 * 1024);
    }
    
    // Legacy format handling
    if (!tempUrl || !tempUrl.includes('/api/temp-description-images/')) {
      return tempUrl;
    }

    try {
      const filename = tempUrl.split('/').pop();
      if (!filename) return null;
      return await moveLegacyTempKeyToPermanent(
        `temp-description-images/${filename}`,
        `description-images/${filename}`,
        `/api/description-images/${filename}`,
      );
    } catch (error) {
      console.error("Error moving temporary description image to permanent:", error);
      return null;
    }
  }

  // Helper function to move temporary description audio to permanent location
  async function moveTemporaryDescriptionAudioToPermanent(tempUrl: string): Promise<string | null> {
    // Handle both new context-specific and old format
    if (tempUrl?.includes('/api/qbank-temp-description-audio/') || tempUrl?.includes('/api/exam-temp-description-audio/')) {
      return moveTemporaryFileToPermanent(tempUrl, 'temp-description-audio', 'audio/mpeg', 10 * 1024 * 1024);
    }
    
    // Legacy format handling
    if (!tempUrl || !tempUrl.includes('/api/temp-description-audio/')) {
      return tempUrl;
    }

    try {
      const filename = tempUrl.split('/').pop();
      if (!filename) return null;
      return await moveLegacyTempKeyToPermanent(
        `temp-description-audio/${filename}`,
        `description-audio/${filename}`,
        `/api/description-audio/${filename}`,
      );
    } catch (error) {
      console.error("Error moving temporary description audio to permanent:", error);
      return null;
    }
  }

  // Promote temp section description media → permanent URLs before saving exam JSONB
  async function promoteExamSectionMedia(section: any): Promise<{
    descriptionImageUrls: string[];
    descriptionAudioUrl: string;
  }> {
    const rawImages = (section.descriptionImageUrls || []).filter(
      (url: unknown): url is string => typeof url === "string" && url.length > 0,
    );
    const descriptionImageUrls = await promoteTempListOrThrow(
      rawImages,
      TEMP_DESCRIPTION_IMAGE_MARKERS,
      moveTemporaryDescriptionImageToPermanent,
      "ảnh mô tả phần thi",
    );

    let descriptionAudioUrl = "";
    if (section.descriptionAudioUrl && typeof section.descriptionAudioUrl === "string") {
      descriptionAudioUrl = await promoteTempOrThrow(
        section.descriptionAudioUrl,
        TEMP_DESCRIPTION_AUDIO_MARKERS,
        moveTemporaryDescriptionAudioToPermanent,
        "audio mô tả phần thi",
      );
    }
    return { descriptionImageUrls, descriptionAudioUrl };
  }

  function resolveQuestionSetIds(qs: any): string[] {
    if (Array.isArray(qs.questionIds) && qs.questionIds.length > 0) {
      return qs.questionIds.filter(Boolean);
    }
    if (Array.isArray(qs.questions)) {
      return qs.questions
        .map((q: any) => (typeof q === "string" ? q : q?.id))
        .filter(Boolean);
    }
    return [];
  }

  function validateExamSectionsPayload(sections: any[]): string | null {
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return "At least one section is required";
    }
    for (const section of sections) {
      const questionIds = extractQuestionIds(section);
      const hasName = section.sectionName || section.type;
      if (!hasName || !section.timeLimit || questionIds.length === 0) {
        return "Each section must have sectionName (or type), timeLimit, and at least one question";
      }
      if (section.questionSets) {
        if (!Array.isArray(section.questionSets)) {
          return "questionSets must be an array";
        }
        for (const qSet of section.questionSets) {
          const ids = resolveQuestionSetIds(qSet);
          if (!Array.isArray(ids)) {
            return "Each question set must have a questionIds (or questions) array";
          }
        }
      }
    }
    return null;
  }

  async function sanitizeExamSectionsForStorage(sections: any[]): Promise<any[]> {
    const sanitized = [];
    for (const section of sections) {
      const media = await promoteExamSectionMedia(section);
      sanitized.push({
        id: section.id,
        sectionName: section.sectionName || section.type || "",
        timeLimit: section.timeLimit || 10,
        passingScore: section.passingScore,
        content: section.content || "",
        descriptionImageUrls: media.descriptionImageUrls,
        descriptionAudioUrl: media.descriptionAudioUrl,
        questionSets: (section.questionSets || []).map((qs: any) => ({
          id: qs.id,
          name: qs.name || "",
          questionIds: resolveQuestionSetIds(qs),
        })),
      });
    }
    return sanitized;
  }

  // Create exam endpoint
  app.post("/api/exams", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { title, description, isDemo, sections, passingScore, level, isLevelTrial, packageId } = req.body;

      console.log("Creating exam with sections:", JSON.stringify(sections, null, 2));

      if (!title) {
        return res.status(400).json({ 
          message: "Title is required" 
        });
      }

      const sectionError = validateExamSectionsPayload(sections);
      if (sectionError) {
        return res.status(400).json({ message: sectionError });
      }

      const sanitizedSections = await sanitizeExamSectionsForStorage(sections);
      console.log("Sanitized sections for exam creation:", JSON.stringify(sanitizedSections, null, 2));

      // Calculate legacy fields for backward compatibility
      // Match by sectionName (new) or type (legacy)
      const vocabularySection = sanitizedSections.find((s: any) => 
        (s.sectionName && s.sectionName.toLowerCase().includes("từ vựng")) || 
        (s.type && s.type.toLowerCase() === "từ vựng")
      );
      const grammarSection = sanitizedSections.find((s: any) => 
        (s.sectionName && s.sectionName.toLowerCase().includes("ngữ pháp")) || 
        (s.type && s.type.toLowerCase() === "ngữ pháp")
      );
      const listeningSection = sanitizedSections.find((s: any) => 
        (s.sectionName && s.sectionName.toLowerCase().includes("nghe")) || 
        (s.type && s.type.toLowerCase() === "nghe hiểu")
      );
      const readingSection = sanitizedSections.find((s: any) => 
        (s.sectionName && s.sectionName.toLowerCase().includes("đọc")) || 
        (s.type && s.type.toLowerCase() === "đọc hiểu")
      );

      // Create the exam with flexible sections and legacy fields
      const exam = await storage.createExam({
        title,
        description: description || null,
        isDemo: isDemo || false,
        level: isExamLevel(level) ? level : null,
        isLevelTrial: Boolean(isLevelTrial) && !isDemo,
        packageId:
          typeof packageId === "string" && packageId.trim()
            ? packageId.trim()
            : null,
        sections: sanitizedSections,
        isActive: true,
        passingScore: passingScore !== undefined ? passingScore : null,
        createdBy: sessionUser.id,
        // Legacy fields for backward compatibility (extract question IDs from questionSets or use questionIds)
        vocabularyTimeLimit: vocabularySection?.timeLimit || 0,
        vocabularyQuestions: vocabularySection ? extractQuestionIds(vocabularySection) : [],
        grammarTimeLimit: grammarSection?.timeLimit || 0,
        grammarQuestions: grammarSection ? extractQuestionIds(grammarSection) : [],
        listeningTimeLimit: listeningSection?.timeLimit || 0,
        listeningQuestions: listeningSection ? extractQuestionIds(listeningSection) : [],
        readingTimeLimit: readingSection?.timeLimit || 0,
        readingQuestions: readingSection ? extractQuestionIds(readingSection) : [],
      });

      res.json({
        exam,
        message: "Exam created successfully"
      });
    } catch (error) {
      if (error instanceof MediaPromoteError) {
        return res.status(422).json({ message: error.message, code: "MEDIA_PROMOTE_FAILED" });
      }
      console.error("Error creating exam:", error);
      res.status(500).json({ message: "Failed to create exam" });
    }
  });

  // Update exam endpoint
  app.put("/api/exams/:id", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { title, description, isDemo, sections, isActive, passingScore, level, isLevelTrial, packageId } = req.body;

      if (!title) {
        return res.status(400).json({ 
          message: "Title is required" 
        });
      }

      // Get old exam to compare audio files
      const oldExam = await storage.getExam(id);
      if (!oldExam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      // Collect old audio URLs from sections
      const oldAudioUrls = new Set<string>();
      if (oldExam.sections && Array.isArray(oldExam.sections)) {
        for (const section of oldExam.sections as any[]) {
          if (section.descriptionAudioUrl) {
            oldAudioUrls.add(section.descriptionAudioUrl);
          }
        }
      }

      let sanitizedSections = undefined;
      const newAudioUrls = new Set<string>();
      if (sections !== undefined) {
        const sectionError = validateExamSectionsPayload(sections);
        if (sectionError) {
          return res.status(400).json({ message: sectionError });
        }
        sanitizedSections = await sanitizeExamSectionsForStorage(sections);
        for (const section of sanitizedSections) {
          if (section.descriptionAudioUrl) {
            newAudioUrls.add(section.descriptionAudioUrl);
          }
        }
        console.log("Sanitized sections for exam update:", JSON.stringify(sanitizedSections, null, 2));
      }

      // Find audio files that were removed or changed (in old but not in new)
      const audioUrlsToDelete =
        sanitizedSections !== undefined
          ? [...oldAudioUrls].filter((url) => !newAudioUrls.has(url))
          : [];
      
      // Delete old audio files from R2
      for (const audioUrl of audioUrlsToDelete) {
        try {
          // Extract folder and filename from URL like "/api/exam-description-audio/filename.mp3"
          const urlParts = audioUrl.split('/');
          const filename = urlParts.pop();
          const folderType = urlParts.pop(); // e.g., "exam-description-audio", "description-audio"
          
          if (filename && folderType) {
            const objectKey = `${folderType}/${filename}`;
            console.log(`Deleting old section audio: ${objectKey}`);
            const deleteResult = await multiR2Storage.deleteFile("primary", objectKey);
            if (deleteResult.success) {
              console.log(`✓ Successfully deleted old section audio: ${objectKey}`);
            } else {
              console.warn(`✗ Failed to delete old section audio ${objectKey}:`, deleteResult.error);
            }
          }
        } catch (err) {
          console.error(`Error deleting audio file ${audioUrl}:`, err);
        }
      }

      const updatePayload: Record<string, unknown> = {
        title,
        description: description || null,
        isDemo: isDemo || false,
        passingScore: passingScore !== undefined ? passingScore : undefined,
        level: level === null || level === "" ? null : isExamLevel(level) ? level : undefined,
        isLevelTrial:
          isLevelTrial !== undefined
            ? Boolean(isLevelTrial) && !isDemo
            : undefined,
        packageId:
          packageId === null || packageId === ""
            ? null
            : typeof packageId === "string"
              ? packageId
              : undefined,
      };
      if (sanitizedSections !== undefined) {
        updatePayload.sections = sanitizedSections;
      }
      // Only change isActive when client explicitly sends it (do not force true)
      if (isActive !== undefined) {
        updatePayload.isActive = isActive;
      }

      const updatedExam = await storage.updateExam(id, updatePayload);

      if (!updatedExam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      res.json({
        exam: updatedExam,
        message: "Exam updated successfully"
      });
    } catch (error) {
      if (error instanceof MediaPromoteError) {
        return res.status(422).json({ message: error.message, code: "MEDIA_PROMOTE_FAILED" });
      }
      console.error("Error updating exam:", error);
      res.status(500).json({ message: "Failed to update exam" });
    }
  });

  // Delete exam endpoint
  app.delete("/api/exams/:id", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      
      // Get exam to delete section audio files
      const exam = await storage.getExam(id);
      if (exam && exam.sections && Array.isArray(exam.sections)) {
        for (const section of exam.sections as any[]) {
          if (section.descriptionAudioUrl) {
            try {
              const urlParts = section.descriptionAudioUrl.split('/');
              const filename = urlParts.pop();
              const folderType = urlParts.pop();
              
              if (filename && folderType) {
                const objectKey = `${folderType}/${filename}`;
                console.log(`Deleting section audio: ${objectKey}`);
                const deleteResult = await multiR2Storage.deleteFile("primary", objectKey);
                if (deleteResult.success) {
                  console.log(`✓ Successfully deleted section audio: ${objectKey}`);
                } else {
                  console.warn(`✗ Failed to delete section audio ${objectKey}:`, deleteResult.error);
                }
              }
            } catch (err) {
              console.error(`Error deleting section audio:`, err);
            }
          }
        }
      }
      
      // Get all questions for this exam to delete audio files
      const questions = await storage.getQuestionsByExamId(id);
      
      // Delete audio files from R2 storage
      for (const question of questions) {
        if (question.audioUrl) {
          // Extract filename from audioUrl like "/api/audio/1756824740827-0xk22e.mp3"
          const filename = question.audioUrl.split('/').pop();
          if (filename) {
            console.log(`Deleting audio file: ${filename}`);
            const deleteResult = await multiR2Storage.deleteAudio(filename);
            if (!deleteResult.success) {
              console.warn(`Failed to delete audio file ${filename}:`, deleteResult.error);
            } else {
              console.log(`Successfully deleted audio file: ${filename}`);
            }
          }
        }
      }
      
      const success = await storage.deleteExam(id);

      if (!success) {
        return res.status(404).json({ message: "Exam not found" });
      }

      res.json({ message: "Exam deleted successfully" });
    } catch (error) {
      console.error("Error deleting exam:", error);
      res.status(500).json({ message: "Failed to delete exam" });
    }
  });

  // Create question endpoint (supports both standalone and exam-linked questions)
  app.post("/api/questions", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { examId, category, questionTitle, description, descriptionImageUrl, descriptionImageUrls, descriptionAudioUrl, questionText, questionType, imageUrl, imageUrls, audioUrl, options, correctAnswer, explanation, sortOrder, language, points, parentId, subQuestions } = req.body;

      // For new question bank: category and questionText are required
      // For old exam questions: examId and questionText are required  
      if (!questionText || !options || !correctAnswer) {
        return res.status(400).json({ 
          message: "Question text, options, and correct answer are required" 
        });
      }

      if (!examId && !category) {
        return res.status(400).json({ 
          message: "Either examId or category is required" 
        });
      }

      // Promote all parent-level media — fail the request if any temp→permanent move fails
      const [
        finalAudioUrl,
        finalImageUrl,
        finalImageUrls,
        finalDescriptionImageUrl,
        finalDescriptionImageUrls,
        finalDescriptionAudioUrl,
      ] = await Promise.all([
        audioUrl
          ? promoteTempOrThrow(
              audioUrl,
              TEMP_AUDIO_MARKERS,
              moveTemporaryAudioToPermanent,
              "audio câu hỏi",
            )
          : Promise.resolve(audioUrl),
        imageUrl
          ? promoteTempOrThrow(
              imageUrl,
              TEMP_QUESTION_IMAGE_MARKERS,
              moveTemporaryQuestionImageToPermanent,
              "ảnh câu hỏi",
            )
          : Promise.resolve(imageUrl),
        imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0
          ? promoteTempListOrThrow(
              imageUrls,
              TEMP_QUESTION_IMAGE_MARKERS,
              moveTemporaryQuestionImageToPermanent,
              "ảnh câu hỏi",
            )
          : Promise.resolve(imageUrls),
        descriptionImageUrl
          ? promoteTempOrThrow(
              descriptionImageUrl,
              TEMP_DESCRIPTION_IMAGE_MARKERS,
              moveTemporaryDescriptionImageToPermanent,
              "ảnh mô tả",
            )
          : Promise.resolve(descriptionImageUrl),
        descriptionImageUrls &&
        Array.isArray(descriptionImageUrls) &&
        descriptionImageUrls.length > 0
          ? promoteTempListOrThrow(
              descriptionImageUrls,
              TEMP_DESCRIPTION_IMAGE_MARKERS,
              moveTemporaryDescriptionImageToPermanent,
              "ảnh mô tả",
            )
          : Promise.resolve(descriptionImageUrls),
        descriptionAudioUrl
          ? promoteTempOrThrow(
              descriptionAudioUrl,
              TEMP_DESCRIPTION_AUDIO_MARKERS,
              moveTemporaryDescriptionAudioToPermanent,
              "audio mô tả",
            )
          : Promise.resolve(descriptionAudioUrl),
      ]);

      const processedCreateOptions = await promoteOptionImagesOrThrow(options);

      // Get max sortOrder to put new questions at the end
      let newSortOrder = sortOrder;
      if (!sortOrder) {
        const allQuestions = await storage.getAllQuestions();
        const maxSortOrder = Math.max(0, ...allQuestions.map(q => q.sortOrder || 0));
        newSortOrder = maxSortOrder + 1;
      }

      // If this is a parent question with sub-questions, create them all
      if (subQuestions && Array.isArray(subQuestions) && subQuestions.length > 0) {
        // Create parent question first
        const parentQuestion = await storage.createQuestion({
          examId: examId || null,
          category: category || "ngữ pháp",
          language: language || "japanese",
          questionTitle: questionTitle || null,
          description: description || null,
          descriptionImageUrl: finalDescriptionImageUrl || null,
          descriptionImageUrls: finalDescriptionImageUrls || null,
          descriptionAudioUrl: finalDescriptionAudioUrl || null,
          questionText, // Parent question text
          questionType: questionType || "multiple_choice",
          imageUrl: finalImageUrl || null,
          imageUrls: finalImageUrls || null,
          audioUrl: finalAudioUrl || null,
          options: processedCreateOptions,
          correctAnswer,
          explanation: explanation || null,
          points: points !== undefined ? points : 1,
          sortOrder: newSortOrder,
          parentId: null, // This is a parent question
        });

        // OPTIMIZED: Process and create all sub-questions in parallel
        const createdSubQuestions = await Promise.all(
          subQuestions.map(async (subQ, i) => {
            const [subFinalImageUrl, subFinalImageUrls, subFinalAudioUrl, processedOptions] =
              await Promise.all([
                subQ.imageUrl
                  ? promoteTempOrThrow(
                      subQ.imageUrl,
                      TEMP_QUESTION_IMAGE_MARKERS,
                      moveTemporaryQuestionImageToPermanent,
                      "ảnh câu hỏi con",
                    )
                  : Promise.resolve(subQ.imageUrl),
                subQ.imageUrls && Array.isArray(subQ.imageUrls) && subQ.imageUrls.length > 0
                  ? promoteTempListOrThrow(
                      subQ.imageUrls,
                      TEMP_QUESTION_IMAGE_MARKERS,
                      moveTemporaryQuestionImageToPermanent,
                      "ảnh câu hỏi con",
                    )
                  : Promise.resolve(subQ.imageUrls),
                subQ.audioUrl
                  ? promoteTempOrThrow(
                      subQ.audioUrl,
                      TEMP_AUDIO_MARKERS,
                      moveTemporaryAudioToPermanent,
                      "audio câu hỏi con",
                    )
                  : Promise.resolve(subQ.audioUrl),
                promoteOptionImagesOrThrow(subQ.options),
              ]);
            
            // Create the sub-question with processed media
            return await storage.createQuestion({
              examId: examId || null,
              category: category || "ngữ pháp",
              language: language || "japanese",
              description: null,
              descriptionImageUrl: null,
              descriptionImageUrls: null,
              descriptionAudioUrl: null,
              questionText: subQ.questionText,
              questionType: questionType || "multiple_choice",
              imageUrl: subFinalImageUrl || null,
              imageUrls: subFinalImageUrls || null,
              audioUrl: subFinalAudioUrl || null,
              options: processedOptions,
              correctAnswer: subQ.correctAnswer,
              explanation: subQ.explanation || null,
              points: subQ.points !== undefined ? subQ.points : 1,
              sortOrder: newSortOrder + i + 1,
              parentId: parentQuestion.id,
            });
          })
        );

        res.status(201).json({
          question: parentQuestion,
          subQuestions: createdSubQuestions,
          message: `Question group created successfully with ${createdSubQuestions.length} sub-questions`
        });
      } else {
        // Create single standalone question
        const question = await storage.createQuestion({
          examId: examId || null,
          category: category || "ngữ pháp",
          language: language || "japanese",
          questionTitle: questionTitle || null,
          description: description || null,
          descriptionImageUrl: finalDescriptionImageUrl || null,
          descriptionImageUrls: finalDescriptionImageUrls || null,
          descriptionAudioUrl: finalDescriptionAudioUrl || null,
          questionText,
          questionType: questionType || "multiple_choice",
          imageUrl: finalImageUrl || null,
          imageUrls: finalImageUrls || null,
          audioUrl: finalAudioUrl || null,
          options: processedCreateOptions,
          correctAnswer,
          explanation: explanation || null,
          points: points !== undefined ? points : 1,
          sortOrder: newSortOrder,
          parentId: parentId || null,
        });

        res.status(201).json({
          question,
          message: "Question created successfully"
        });
      }
    } catch (error) {
      if (error instanceof MediaPromoteError) {
        return res.status(422).json({ message: error.message, code: "MEDIA_PROMOTE_FAILED" });
      }
      console.error("Error creating question:", error);
      res.status(500).json({ message: "Failed to create question" });
    }
  });

  // Update question endpoint
  app.put("/api/questions/:id", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const {
        category,
        questionTitle,
        description,
        descriptionImageUrls,
        descriptionAudioUrl,
        questionText,
        questionType,
        imageUrl,
        imageUrls,
        audioUrl,
        options,
        correctAnswer,
        explanation,
        sortOrder,
        language,
        points,
        subQuestions
      } = req.body;

      if (!questionText || !options || !correctAnswer) {
        return res.status(400).json({ 
          message: "Question text, options, and correct answer are required" 
        });
      }

      // Check if question exists
      const existingQuestion = await storage.getQuestion(id);
      if (!existingQuestion) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Helper function to delete audio file from R2
      const deleteAudioFile = async (audioUrl: string | null | undefined) => {
        if (!audioUrl) return;
        try {
          const urlParts = audioUrl.split('/');
          const filename = urlParts.pop();
          const folderType = urlParts.pop();
          
          if (filename && folderType) {
            const objectKey = `${folderType}/${filename}`;
            console.log(`Deleting old audio file: ${objectKey}`);
            const deleteResult = await multiR2Storage.deleteFile("primary", objectKey);
            if (deleteResult.success) {
              console.log(`✓ Successfully deleted old audio: ${objectKey}`);
            } else {
              console.warn(`✗ Failed to delete old audio ${objectKey}:`, deleteResult.error);
            }
          }
        } catch (err) {
          console.error(`Error deleting audio file ${audioUrl}:`, err);
        }
      };

      // Delete old audio files if they are being changed
      const audioFilesToDelete: string[] = [];
      
      // Check audioUrl change
      if (audioUrl !== undefined && existingQuestion.audioUrl && audioUrl !== existingQuestion.audioUrl) {
        audioFilesToDelete.push(existingQuestion.audioUrl);
      }
      
      // Check descriptionAudioUrl change
      if (descriptionAudioUrl !== undefined && existingQuestion.descriptionAudioUrl && descriptionAudioUrl !== existingQuestion.descriptionAudioUrl) {
        audioFilesToDelete.push(existingQuestion.descriptionAudioUrl);
      }
      
      // Delete old audio files in parallel
      if (audioFilesToDelete.length > 0) {
        await Promise.all(audioFilesToDelete.map(deleteAudioFile));
      }

      // Promote media — fail the request if any temp→permanent move fails
      let processedImageUrls = imageUrls;
      if (imageUrls !== undefined) {
        if (Array.isArray(imageUrls) && imageUrls.length > 0) {
          processedImageUrls = await promoteTempListOrThrow(
            imageUrls,
            TEMP_QUESTION_IMAGE_MARKERS,
            moveTemporaryQuestionImageToPermanent,
            "ảnh câu hỏi",
          );
        } else {
          processedImageUrls = null;
        }
      } else {
        processedImageUrls = undefined;
      }

      let processedImageUrl = imageUrl;
      if (imageUrl !== undefined && imageUrl) {
        processedImageUrl = await promoteTempOrThrow(
          imageUrl,
          TEMP_QUESTION_IMAGE_MARKERS,
          moveTemporaryQuestionImageToPermanent,
          "ảnh câu hỏi",
        );
      }

      let processedAudioUrl = audioUrl;
      if (audioUrl !== undefined && audioUrl) {
        processedAudioUrl = await promoteTempOrThrow(
          audioUrl,
          TEMP_AUDIO_MARKERS,
          moveTemporaryAudioToPermanent,
          "audio câu hỏi",
        );
      }

      let processedDescriptionAudioUrl = descriptionAudioUrl;
      if (descriptionAudioUrl !== undefined && descriptionAudioUrl) {
        processedDescriptionAudioUrl = await promoteTempOrThrow(
          descriptionAudioUrl,
          TEMP_DESCRIPTION_AUDIO_MARKERS,
          moveTemporaryDescriptionAudioToPermanent,
          "audio mô tả",
        );
      }

      let processedDescriptionImageUrls = descriptionImageUrls;
      if (descriptionImageUrls !== undefined) {
        if (Array.isArray(descriptionImageUrls) && descriptionImageUrls.length > 0) {
          processedDescriptionImageUrls = await promoteTempListOrThrow(
            descriptionImageUrls,
            TEMP_DESCRIPTION_IMAGE_MARKERS,
            moveTemporaryDescriptionImageToPermanent,
            "ảnh mô tả",
          );
        }
      }

      let processedOptions = options;
      if (options !== undefined) {
        processedOptions = await promoteOptionImagesOrThrow(options);
      }

      // If this is a parent question with sub-questions, handle them
      if (subQuestions && Array.isArray(subQuestions)) {
        // Get existing sub-questions
        const existingSubQuestions = await storage.getSubQuestions(id);
        const existingSubIds = new Set(existingSubQuestions.map(sq => sq.id));
        const payloadSubIds = new Set(subQuestions.filter(sq => sq.id).map(sq => sq.id));
        
        // 1. Update parent question
        const updatedQuestion = await storage.updateQuestion(id, {
          category: category || existingQuestion.category,
          questionTitle: questionTitle !== undefined ? questionTitle : (existingQuestion as any).questionTitle,
          description: description !== undefined ? description : existingQuestion.description,
          descriptionImageUrls: descriptionImageUrls !== undefined ? processedDescriptionImageUrls : existingQuestion.descriptionImageUrls,
          descriptionAudioUrl: descriptionAudioUrl !== undefined ? processedDescriptionAudioUrl : existingQuestion.descriptionAudioUrl,
          questionText,
          questionType: questionType || existingQuestion.questionType,
          imageUrl: imageUrl !== undefined ? processedImageUrl : existingQuestion.imageUrl,
          imageUrls: imageUrls !== undefined ? processedImageUrls : existingQuestion.imageUrls,
          audioUrl: audioUrl !== undefined ? processedAudioUrl : existingQuestion.audioUrl,
          options: options !== undefined ? processedOptions : options,
          correctAnswer,
          explanation: explanation !== undefined ? explanation : existingQuestion.explanation,
          sortOrder: sortOrder !== undefined ? sortOrder : existingQuestion.sortOrder,
          language: language || existingQuestion.language,
          points: points !== undefined ? points : (existingQuestion as any).points || 1,
          parentId: null, // Ensure parent questions have null parentId
        });

        // 2. OPTIMIZED: Delete sub-questions in parallel
        await Promise.all(
          existingSubQuestions.map(async (existingSub) => {
            if (!payloadSubIds.has(existingSub.id)) {
              await storage.deleteQuestion(existingSub.id);
            }
          })
        );

        // 3. OPTIMIZED: Update existing or create new sub-questions in parallel
        const processedSubQuestions = await Promise.all(
          subQuestions.map(async (subQ, i) => {
            let subProcessedImageUrls = subQ.imageUrls;
            if (subQ.imageUrls !== undefined) {
              if (Array.isArray(subQ.imageUrls) && subQ.imageUrls.length > 0) {
                subProcessedImageUrls = await promoteTempListOrThrow(
                  subQ.imageUrls,
                  TEMP_QUESTION_IMAGE_MARKERS,
                  moveTemporaryQuestionImageToPermanent,
                  "ảnh câu hỏi con",
                );
              } else {
                subProcessedImageUrls = null;
              }
            } else {
              subProcessedImageUrls = undefined;
            }

            let subProcessedImageUrl = subQ.imageUrl;
            if (subQ.imageUrl !== undefined && subQ.imageUrl) {
              subProcessedImageUrl = await promoteTempOrThrow(
                subQ.imageUrl,
                TEMP_QUESTION_IMAGE_MARKERS,
                moveTemporaryQuestionImageToPermanent,
                "ảnh câu hỏi con",
              );
            }

            let subProcessedAudioUrl = subQ.audioUrl;
            if (subQ.audioUrl !== undefined && subQ.audioUrl) {
              subProcessedAudioUrl = await promoteTempOrThrow(
                subQ.audioUrl,
                TEMP_AUDIO_MARKERS,
                moveTemporaryAudioToPermanent,
                "audio câu hỏi con",
              );
            }

            const subProcessedOptions = Array.isArray(subQ.options)
              ? await promoteOptionImagesOrThrow(subQ.options)
              : subQ.options;
            
            if (subQ.id && existingSubIds.has(subQ.id)) {
              // UPDATE existing sub-question
              return await storage.updateQuestion(subQ.id, {
                questionText: subQ.questionText,
                imageUrl: subQ.imageUrl !== undefined ? subProcessedImageUrl : null,
                imageUrls: subProcessedImageUrls !== undefined ? subProcessedImageUrls : null,
                audioUrl: subQ.audioUrl !== undefined ? subProcessedAudioUrl : null,
                options: subProcessedOptions,
                correctAnswer: subQ.correctAnswer,
                explanation: subQ.explanation !== undefined ? subQ.explanation : null,
                points: subQ.points !== undefined ? subQ.points : 1,
                sortOrder: (sortOrder || existingQuestion.sortOrder) + i + 1,
              });
            } else {
              // CREATE new sub-question
              return await storage.createQuestion({
                examId: existingQuestion.examId,
                category: category || existingQuestion.category,
                language: language || existingQuestion.language,
                description: null,
                descriptionImageUrl: null,
                descriptionImageUrls: null,
                descriptionAudioUrl: null,
                questionText: subQ.questionText,
                questionType: questionType || "multiple_choice",
                imageUrl: subProcessedImageUrl || null,
                imageUrls: subProcessedImageUrls || null,
                audioUrl: subProcessedAudioUrl || null,
                options: subProcessedOptions,
                correctAnswer: subQ.correctAnswer,
                explanation: subQ.explanation || null,
                points: subQ.points !== undefined ? subQ.points : 1,
                sortOrder: (sortOrder || existingQuestion.sortOrder) + i + 1,
                parentId: id,
              });
            }
          })
        );

        res.json({
          question: updatedQuestion,
          subQuestions: processedSubQuestions,
          message: `Question updated successfully with ${processedSubQuestions.length} sub-questions`
        });
      } else {
        // Update single standalone question
        const updatedQuestion = await storage.updateQuestion(id, {
          category: category || existingQuestion.category,
          questionTitle: questionTitle !== undefined ? questionTitle : (existingQuestion as any).questionTitle,
          description: description !== undefined ? description : existingQuestion.description,
          descriptionImageUrls: descriptionImageUrls !== undefined ? processedDescriptionImageUrls : existingQuestion.descriptionImageUrls,
          descriptionAudioUrl: descriptionAudioUrl !== undefined ? processedDescriptionAudioUrl : existingQuestion.descriptionAudioUrl,
          questionText,
          questionType: questionType || existingQuestion.questionType,
          imageUrl: imageUrl !== undefined ? processedImageUrl : existingQuestion.imageUrl,
          imageUrls: imageUrls !== undefined ? processedImageUrls : existingQuestion.imageUrls,
          audioUrl: audioUrl !== undefined ? processedAudioUrl : existingQuestion.audioUrl,
          options: options !== undefined ? processedOptions : options,
          correctAnswer,
          explanation: explanation !== undefined ? explanation : existingQuestion.explanation,
          sortOrder: sortOrder !== undefined ? sortOrder : existingQuestion.sortOrder,
          language: language || existingQuestion.language,
          points: points !== undefined ? points : (existingQuestion as any).points || 1
        });

        if (!updatedQuestion) {
          return res.status(404).json({ message: "Question not found" });
        }

        res.json({
          question: updatedQuestion,
          message: "Question updated successfully"
        });
      }
    } catch (error) {
      if (error instanceof MediaPromoteError) {
        return res.status(422).json({ message: error.message, code: "MEDIA_PROMOTE_FAILED" });
      }
      console.error("Error updating question:", error);
      res.status(500).json({ message: "Failed to update question" });
    }
  });

  // Delete question endpoint
  app.delete("/api/questions/:id", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      
      // Get question to check for files before deleting
      const question = await storage.getQuestion(id);
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }
      
      // Helper function to delete audio file from R2
      const deleteAudioFile = async (audioUrl: string | null | undefined) => {
        if (!audioUrl) return;
        try {
          const urlParts = audioUrl.split('/');
          const filename = urlParts.pop();
          const folderType = urlParts.pop();
          
          if (filename && folderType) {
            const objectKey = `${folderType}/${filename}`;
            console.log(`Deleting audio file: ${objectKey}`);
            const deleteResult = await multiR2Storage.deleteFile("primary", objectKey);
            if (deleteResult.success) {
              console.log(`✓ Successfully deleted audio: ${objectKey}`);
            } else {
              console.warn(`✗ Failed to delete audio ${objectKey}:`, deleteResult.error);
            }
          }
        } catch (err) {
          console.error(`Error deleting audio file ${audioUrl}:`, err);
        }
      };

      // Delete audio files from R2 storage if exist
      await Promise.all([
        deleteAudioFile(question.audioUrl),
        deleteAudioFile(question.descriptionAudioUrl)
      ]);

      // Delete image file from R2 storage if exists  
      if (question.imageUrl) {
        const filename = question.imageUrl.split('/').pop();
        if (filename) {
          console.log(`Deleting image file for question: ${filename}`);
          try {
            // Try to delete from both locations (temporary and permanent)
            await multiR2Storage.deleteFile("primary", `temp-question-images/${filename}`);
            await multiR2Storage.deleteFile("primary", `question-images/${filename}`);
            console.log(`✓ Cleaned up question image file: ${filename}`);
          } catch (error) {
            console.warn(`Failed to cleanup question image file: ${filename}`, error);
          }
        }
      }
      
      const success = await storage.deleteQuestion(id);

      if (!success) {
        return res.status(404).json({ message: "Question not found" });
      }

      res.json({ message: "Question deleted successfully" });
    } catch (error) {
      console.error("Error deleting question:", error);
      res.status(500).json({ message: "Failed to delete question" });
    }
  });

  // Contact Info endpoints
  // Get all contact info (public)
  app.get("/api/contact-info", async (req, res) => {
    try {
      const contactInfos = await storage.getContactInfo();
      res.json(contactInfos);
    } catch (error) {
      console.error("Error fetching contact info:", error);
      res.status(500).json({ message: "Failed to fetch contact info" });
    }
  });

  // Create contact info (admin/manager only)
  app.post("/api/contact-info", requireImageEditPermission, async (req, res) => {
    try {
      const contactInfoData: InsertContactInfo = req.body;
      const newContactInfo = await storage.createContactInfo(contactInfoData);
      res.status(201).json(newContactInfo);
    } catch (error) {
      console.error("Error creating contact info:", error);
      res.status(500).json({ message: "Failed to create contact info" });
    }
  });

  // Update contact info (admin/manager only)
  app.put("/api/contact-info/:id", requireImageEditPermission, async (req, res) => {
    try {
      const { id } = req.params;
      const contactInfoData: Partial<InsertContactInfo> = req.body;
      contactInfoData.updatedAt = new Date();
      
      const updatedContactInfo = await storage.updateContactInfo(id, contactInfoData);
      if (!updatedContactInfo) {
        return res.status(404).json({ message: "Contact info not found" });
      }
      res.json(updatedContactInfo);
    } catch (error) {
      console.error("Error updating contact info:", error);
      res.status(500).json({ message: "Failed to update contact info" });
    }
  });

  // Delete contact info (admin/manager only)
  app.delete("/api/contact-info/:id", requireImageEditPermission, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteContactInfo(id);
      if (!deleted) {
        return res.status(404).json({ message: "Contact info not found" });
      }
      res.json({ message: "Contact info deleted successfully" });
    } catch (error) {
      console.error("Error deleting contact info:", error);
      res.status(500).json({ message: "Failed to delete contact info" });
    }
  });

  // Seed default contact info if none exists
  app.post("/api/contact-info/seed", requireImageEditPermission, async (req, res) => {
    try {
      const existingContactInfo = await storage.getContactInfo();
      if (existingContactInfo.length > 0) {
        return res.status(400).json({ message: "Contact info already exists" });
      }

      const defaultContactInfo: InsertContactInfo[] = [
        {
          type: "main_office",
          title: "Văn phòng chính",
          content: ["123 Nguyễn Huệ, Quận 1, TP.HCM"],
          displayOrder: 1,
          isActive: true
        },
        {
          type: "hotline",
          title: "Hotline",
          content: ["1900 1234 (24/7)", "028 3822 5678"],
          displayOrder: 2,
          isActive: true
        },
        {
          type: "email",
          title: "Email",
          content: ["info@npcompany.vn", "support@npcompany.vn"],
          displayOrder: 3,
          isActive: true
        },
        {
          type: "business_hours",
          title: "Giờ hoạt động",
          content: ["T2-T6: 8:00 - 18:00", "T7-CN: 8:00 - 17:00"],
          displayOrder: 4,
          isActive: true
        }
      ];

      const createdContactInfo = await Promise.all(
        defaultContactInfo.map(info => storage.createContactInfo(info))
      );

      res.status(201).json(createdContactInfo);
    } catch (error) {
      console.error("Error seeding contact info:", error);
      res.status(500).json({ message: "Failed to seed contact info" });
    }
  });

  // R2 Configuration Debug Endpoint (public for debugging)
  app.get("/api/debug/r2-status", async (req, res) => {
    try {

      const r2Status = {
        primary: {
          hasAccessKey: !!process.env.R2_PRIMARY_ACCESS_KEY_ID,
          hasSecretKey: !!process.env.R2_PRIMARY_SECRET_ACCESS_KEY,
          hasBucketName: !!process.env.R2_PRIMARY_BUCKET_NAME,
          hasEndpoint: !!process.env.R2_PRIMARY_ENDPOINT,
          clientInitialized: r2Manager.getClient("primary") !== null,
        },
        secondary: {
          hasAccessKey: !!process.env.R2_SECONDARY_ACCESS_KEY_ID,
          hasSecretKey: !!process.env.R2_SECONDARY_SECRET_ACCESS_KEY,
          hasBucketName: !!process.env.R2_SECONDARY_BUCKET_NAME,
          hasEndpoint: !!process.env.R2_SECONDARY_ENDPOINT,
          clientInitialized: r2Manager.getClient("secondary") !== null,
        }
      };

      res.json(r2Status);
    } catch (error) {
      console.error("Error getting R2 status:", error);
      res.status(500).json({ message: "Failed to get R2 status" });
    }
  });

  // ============ DESCRIPTION MEDIA UPLOAD ROUTES ============
  
  // Upload temporary description images
  // Supports context parameter: ?context=qbank (default) or ?context=exam
  app.post("/api/temp-description-images/upload", upload.single('file'), async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const context = req.query.context as string || req.body.context || 'qbank';
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Validate file type
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: "Only image files are allowed" });
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "Image size cannot exceed 5MB" });
      }

      const timestamp = Date.now();
      const fileExtension = file.originalname.split('.').pop() || 'jpg';
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const folder = getContextFolder('temp-description-images', context);
      
      const uploadConfig: MediaUploadConfig = {
        provider: "primary",
        folder: folder,
        allowedTypes: ["image/*"],
        maxSizeBytes: 5 * 1024 * 1024
      };
      
      const uploadResult = await multiR2Storage.uploadFile(
        file.buffer,
        fileName,
        file.mimetype,
        uploadConfig
      );

      if (uploadResult.success) {
        console.log(`✓ Uploaded temporary description image: ${fileName} (${context})`);
        const imageUrl = `/api/${folder}/${fileName}`;
        res.json({
          success: true,
          filename: fileName,
          imageUrl,
          url: imageUrl,
          message: "Tạm lưu hình ảnh mô tả thành công",
          context
        });
      } else {
        console.error("Description image upload failed:", uploadResult.error);
        res.status(400).json({
          success: false,
          message: uploadResult.error || "Tải lên hình ảnh mô tả thất bại"
        });
      }
    } catch (error) {
      console.error("Error uploading temporary description image:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi server khi tải lên hình ảnh mô tả"
      });
    }
  });

  // Upload temporary description audio
  // Supports context parameter: ?context=qbank (default) or ?context=exam
  app.post("/api/temp-description-audio/upload", upload.single('file'), async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const context = req.query.context as string || req.body.context || 'qbank';
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      // Validate file type
      if (!file.mimetype.startsWith('audio/')) {
        return res.status(400).json({ message: "Only audio files are allowed" });
      }

      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        return res.status(400).json({ message: "Audio size cannot exceed 50MB" });
      }

      const timestamp = Date.now();
      const fileExtension = file.originalname.split('.').pop() || 'mp3';
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const folder = getContextFolder('temp-description-audio', context);
      
      const uploadConfig: MediaUploadConfig = {
        provider: "primary",
        folder: folder,
        allowedTypes: ["audio/*"],
        maxSizeBytes: 50 * 1024 * 1024
      };
      
      const uploadResult = await multiR2Storage.uploadFile(
        file.buffer,
        fileName,
        file.mimetype,
        uploadConfig
      );

      if (uploadResult.success) {
        console.log(`✓ Uploaded temporary description audio: ${fileName} (${context})`);
        const audioUrl = `/api/${folder}/${fileName}`;
        res.json({
          success: true,
          filename: fileName,
          url: audioUrl,
          audioUrl,
          message: "Tạm lưu audio mô tả thành công",
          context
        });
      } else {
        console.error("Description audio upload failed:", uploadResult.error);
        res.status(400).json({
          success: false,
          message: uploadResult.error || "Tải lên audio mô tả thất bại"
        });
      }
    } catch (error) {
      console.error("Error uploading temporary description audio:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi server khi tải lên audio mô tả"
      });
    }
  });

  // Temporary description images download endpoint
  app.get("/api/temp-description-images/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const objectKey = `temp-description-images/${filename}`;
      
      const downloadUrl = await r2Manager.generateDownloadUrl("primary", objectKey);
      
      if (downloadUrl) {
        // Proxy the image
        try {
          const response = await fetch(downloadUrl);
          if (response.ok) {
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            res.set({
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=300', // 5 minute cache for temp files
              'Access-Control-Allow-Origin': '*'
            });
            
            const buffer = await response.arrayBuffer();
            return res.send(Buffer.from(buffer));
          }
        } catch (proxyError) {
          console.error("Error proxying temporary description image:", proxyError);
        }
      }
      
      res.status(404).json({ error: "Temporary description image not found" });
    } catch (error) {
      console.error("Error serving temporary description image:", error);
      res.status(500).json({ error: "Failed to serve temporary description image" });
    }
  });

  // Temporary description audio download endpoint
  app.get("/api/temp-description-audio/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const objectKey = `temp-description-audio/${filename}`;
      
      const downloadUrl = await r2Manager.generateDownloadUrl("primary", objectKey);
      
      if (!downloadUrl) {
        return res.status(404).json({ error: "Temporary description audio not found" });
      }

      // Redirect to R2 presigned URL to avoid proxy body size limits
      console.log(`Redirecting to R2 presigned URL for: ${objectKey}`);
      return res.redirect(downloadUrl);
    } catch (error) {
      console.error("Error serving temporary description audio:", error);
      res.status(500).json({ error: "Failed to serve temporary description audio" });
    }
  });

  // Cleanup temporary description images  
  app.post("/api/temp-description-images/cleanup", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { filenames } = req.body;
      
      if (!Array.isArray(filenames)) {
        return res.status(400).json({ message: "filenames must be an array" });
      }

      // Get context from query string for context-based folder structure
      const context = req.query.context as 'qbank' | 'exam' | undefined;
      const folderName = context ? getContextFolder('temp-description-images', context) : 'temp-description-images';

      const results = [];
      for (const filename of filenames) {
        const objectKey = `${folderName}/${filename}`;
        const result = await multiR2Storage.deleteFile("primary", objectKey);
        results.push({ filename, success: result.success, error: result.error });
        
        if (result.success) {
          console.log(`✓ Cleaned up temporary description image: ${filename} from ${folderName}`);
        } else {
          console.warn(`✗ Failed to cleanup temporary description image: ${filename} from ${folderName} - ${result.error}`);
        }
      }

      res.json({ results });
    } catch (error) {
      console.error("Error cleaning up temporary description images:", error);
      res.status(500).json({ message: "Failed to cleanup temporary files" });
    }
  });

  // Cleanup temporary description audio  
  app.post("/api/temp-description-audio/cleanup", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { filenames } = req.body;
      
      if (!Array.isArray(filenames)) {
        return res.status(400).json({ message: "filenames must be an array" });
      }

      // Get context from query string for context-based folder structure
      const context = req.query.context as 'qbank' | 'exam' | undefined;
      const folderName = context ? getContextFolder('temp-description-audio', context) : 'temp-description-audio';

      const results = [];
      for (const filename of filenames) {
        const objectKey = `${folderName}/${filename}`;
        const result = await multiR2Storage.deleteFile("primary", objectKey);
        results.push({ filename, success: result.success, error: result.error });
        
        if (result.success) {
          console.log(`✓ Cleaned up temporary description audio: ${filename} from ${folderName}`);
        } else {
          console.warn(`✗ Failed to cleanup temporary description audio: ${filename} from ${folderName} - ${result.error}`);
        }
      }

      res.json({ results });
    } catch (error) {
      console.error("Error cleaning up temporary description audio:", error);
      res.status(500).json({ message: "Failed to cleanup temporary files" });
    }
  });

  const httpServer = createServer(app);

  // Manual / scheduled temp media GC
  app.post("/api/admin/cleanup-temp-media", requireAdminOrManager, async (req, res) => {
    try {
      const maxAgeHours = Number(req.body?.maxAgeHours) || undefined;
      const result = await cleanupAbandonedTempMedia(maxAgeHours);
      res.json({ success: true, result });
    } catch (error) {
      console.error("Error running temp media GC:", error);
      res.status(500).json({ message: "Failed to cleanup temp media" });
    }
  });

  if (process.env.TEMP_MEDIA_GC_DISABLED !== "1") {
    startTempMediaGcScheduler();
  }

  return httpServer;
}
