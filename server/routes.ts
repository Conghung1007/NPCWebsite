import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { insertContactRequestSchema, insertArticleSchema, registrationFormSchema, ContactInfo, InsertContactInfo, insertExamAttemptSchema } from "@shared/schema";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { multiR2Storage, type MediaUploadConfig, type FileInfo } from "./multiR2Storage";
import { r2Manager, EXTERNAL_R2_CONFIGS } from "./r2Config";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

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
          questions: section.questionIds
        }],
        questionIds: undefined // Remove legacy field
      };
    }
    return section;
  });
};

// Helper function to extract all question IDs from question sets (supports both formats)
const extractQuestionIds = (section: any): string[] => {
  // New structure: questionSets array with questionIds
  if (section.questionSets && Array.isArray(section.questionSets)) {
    return section.questionSets.flatMap((set: any) => set.questionIds || []);
  }
  // Legacy structure: questionIds array
  if (section.questionIds && Array.isArray(section.questionIds)) {
    return section.questionIds;
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth endpoint - returns current user information
  app.get("/api/auth/user", async (req, res) => {
    try {
      // Check if user is authenticated via session
      const sessionUser = (req.session as any)?.user;
      
      if (!sessionUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = sessionUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  // Registration endpoint
  app.post("/api/auth/register", async (req, res) => {
    try {
      // Validate form data
      const formData = registrationFormSchema.parse(req.body);
      
      // Check for duplicates
      const [usernameExists, emailExists, phoneExists] = await Promise.all([
        storage.checkUsernameExists(formData.username.toLowerCase()),
        storage.checkEmailExists(formData.email.toLowerCase()),
        storage.checkPhoneExists(formData.phone)
      ]);

      if (usernameExists) {
        return res.status(409).json({
          success: false,
          message: "Tên đăng nhập đã tồn tại"
        });
      }

      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: "Email đã được sử dụng"
        });
      }

      if (phoneExists) {
        return res.status(409).json({
          success: false,
          message: "Số điện thoại đã được sử dụng"
        });
      }

      // Create registration request
      const registrationRequest = await storage.createRegistrationRequest({
        username: formData.username.toLowerCase(),
        fullName: formData.fullName || null, // Optional full name for certificate
        email: formData.email.toLowerCase(),
        phone: formData.phone,
        password: formData.password, // In real app, hash this password
      });

      res.json({
        success: true,
        message: "Đăng ký thành công! Vui lòng chờ xác nhận từ nhân viên tư vấn trong vòng 48h."
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        res.status(400).json({
          success: false,
          message: firstError.message
        });
      } else {
        console.error("Registration error:", error);
        res.status(500).json({
          success: false,
          message: "Có lỗi xảy ra, vui lòng thử lại sau"
        });
      }
    }
  });

  // Check availability endpoints
  app.post("/api/auth/check-username", async (req, res) => {
    try {
      const { username } = req.body;
      if (!username || username.length < 8 || username.length > 15) {
        return res.status(400).json({ available: false, message: "Tên đăng nhập phải có từ 8-15 ký tự" });
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
      if (!phone) {
        return res.status(400).json({ available: false, message: "Số điện thoại không hợp lệ" });
      }
      
      const exists = await storage.checkPhoneExists(phone);
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
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Include passwords for admin panel display
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy danh sách người dùng" });
    }
  });

  // Create new user
  app.post("/api/users", async (req, res) => {
    try {
      const { username, email, phone, password, role } = req.body;
      
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
        email: email || null,
        phone: phone || null,
        password, 
        role 
      });
      const { password: _, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Update user
  app.put("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { username, email, phone, password, role } = req.body;
      
      if (!username || !password || !role) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const updatedUser = await storage.updateUser(id, { 
        username: username.toLowerCase(), 
        email: email || null,
        phone: phone || null,
        password, 
        role 
      });
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user
  app.delete("/api/users/:id", async (req, res) => {
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
  app.get("/api/registration-requests", async (req, res) => {
    try {
      const registrations = await storage.getAllRegistrationRequests();
      res.json(registrations);
    } catch (error) {
      console.error("Error fetching registration requests:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy danh sách đăng ký" });
    }
  });

  app.post("/api/registration-requests/:id/approve", async (req, res) => {
    try {
      const { id } = req.params;
      const sessionUser = (req.session as any)?.user;
      
      if (!sessionUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get registration request
      const registrationRequest = await storage.getRegistrationRequest(id);
      if (!registrationRequest || registrationRequest.status !== 'pending') {
        return res.status(404).json({ message: "Registration request not found or already processed" });
      }

      // Create user account
      const newUser = await storage.createUser({
        username: registrationRequest.username, // Already lowercase from registration
        fullName: registrationRequest.fullName || null, // Optional full name for certificate
        email: registrationRequest.email, // Already lowercase from registration
        phone: registrationRequest.phone,
        password: registrationRequest.password, // In real app, this should be hashed
        role: "user"
      });

      // Delete registration request after creating user successfully
      await storage.deleteRegistrationRequest(id);

      res.json({ 
        success: true, 
        message: "Đã duyệt đăng ký và tạo tài khoản thành công",
        user: newUser
      });
    } catch (error) {
      console.error("Error approving registration:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi duyệt đăng ký" });
    }
  });

  app.delete("/api/registration-requests/:id", async (req, res) => {
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
      const exams = await storage.getActiveExams();
      // Migrate legacy sections to question sets structure and calculate computed fields
      const migratedExams = exams.map(exam => {
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

  app.get("/api/exams/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const exam = await storage.getExam(id);
      if (!exam) {
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
      
      // First get the exam to access its sections with questionSets
      const exam = await storage.getExam(id);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }
      
      // Extract all question IDs from sections (supports both questionSets and legacy questionIds)
      let allQuestionIds: string[] = [];
      
      if (exam.sections && Array.isArray(exam.sections)) {
        for (const section of exam.sections) {
          const questionIds = extractQuestionIds(section);
          allQuestionIds.push(...questionIds);
        }
      }
      
      // Fallback to legacy format if no sections
      if (allQuestionIds.length === 0) {
        const legacyQuestions = await storage.getQuestionsByExamId(id);
        const questionsWithSubs = await Promise.all(
          legacyQuestions.map(async (question) => {
            const subQuestions = await storage.getSubQuestions(question.id);
            return {
              ...question,
              subQuestions: subQuestions.length > 0 ? subQuestions : undefined
            };
          })
        );
        return res.json(questionsWithSubs);
      }
      
      // Fetch questions by their IDs
      const questions = await Promise.all(
        allQuestionIds.map(async (qId) => {
          const question = await storage.getQuestion(qId);
          if (!question) return null;
          
          const subQuestions = await storage.getSubQuestions(question.id);
          return {
            ...question,
            subQuestions: subQuestions.length > 0 ? subQuestions : undefined
          };
        })
      );
      
      // Filter out null values (questions that weren't found)
      const validQuestions = questions.filter(q => q !== null);
      
      console.log(`Returning ${validQuestions.length} questions for exam ${id}`);
      res.json(validQuestions);
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

  app.post("/api/exam-attempts", async (req, res) => {
    try {
      const { 
        examId,
        sectionResults,
        totalScore, 
        totalTimeSpent, 
        waitTimeBetweenSections
      } = req.body;
      const sessionUser = (req.session as any)?.user;
      
      // Validate request body using the new schema
      const validation = insertExamAttemptSchema.safeParse({
        examId,
        sectionResults,
        totalScore,
        totalTimeSpent,
        waitTimeBetweenSections,
        userId: sessionUser?.id || null,
      });

      if (!validation.success) {
        return res.status(400).json({ 
          message: "Dữ liệu không hợp lệ", 
          errors: validation.error.errors 
        });
      }
      
      // OPTIMIZED: Only fetch metadata instead of full exam data
      const examMetadata = await storage.getExamMetadata(examId);
      if (!examMetadata) {
        return res.status(404).json({ message: "Không tìm thấy đề thi" });
      }

      // For official exams, require authentication
      if (!examMetadata.isDemo && !sessionUser) {
        return res.status(401).json({ message: "Cần đăng nhập để thi đề chính thức" });
      }

      // Create exam attempt with dynamic section data
      const attempt = await storage.createExamAttempt(validation.data);

      res.json(attempt);
    } catch (error) {
      console.error("Error submitting exam:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi nộp bài thi" });
    }
  });

  app.get("/api/exam-attempts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const attempt = await storage.getExamAttempt(id);
      if (!attempt) {
        return res.status(404).json({ message: "Không tìm thấy kết quả thi" });
      }
      res.json(attempt);
    } catch (error) {
      console.error("Error fetching exam attempt:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy kết quả thi" });
    }
  });

  app.get("/api/exam-attempts/:id/details", async (req, res) => {
    try {
      const { id } = req.params;
      const attempt = await storage.getExamAttempt(id);
      if (!attempt) {
        return res.status(404).json({ message: "Không tìm thấy kết quả thi" });
      }

      // Get exam to access section question arrays
      const exam = await storage.getExam(attempt.examId);
      if (!exam) {
        return res.status(404).json({ message: "Không tìm thấy đề thi" });
      }

      const questions = await storage.getQuestionsByExamId(attempt.examId);
      
      // Create ordered question list from all sections
      let sectionQuestionIds: string[] = [];
      let allAnswers: Record<string, string> = {};
      
      console.log("=== EXAM ATTEMPT DETAILS DEBUG ===");
      console.log("Total questions from storage:", questions.length);
      console.log("Question IDs from storage:", questions.map(q => q.id));
      console.log("Exam sections:", exam.sections);
      console.log("Attempt sectionResults:", attempt.sectionResults);
      console.log("sectionResults type:", typeof attempt.sectionResults);
      console.log("sectionResults isArray:", Array.isArray(attempt.sectionResults));
      
      // Check if exam uses new sections format or legacy format
      if (exam.sections && Array.isArray(exam.sections) && exam.sections.length > 0) {
        // New sections format (supports both questionIds and questionSets)
        exam.sections.forEach((section: any) => {
          const questionIds = extractQuestionIds(section);
          sectionQuestionIds.push(...questionIds);
        });
        
        console.log("Section question IDs:", sectionQuestionIds);
        
        // Get answers from sectionResults
        if (attempt.sectionResults && typeof attempt.sectionResults === 'object') {
          Object.values(attempt.sectionResults as Record<string, any>).forEach((sectionResult: any) => {
            if (sectionResult.answers) {
              Object.assign(allAnswers, sectionResult.answers);
            }
          });
        }
        
        console.log("All answers:", allAnswers);
      } else {
        // Legacy format
        sectionQuestionIds = [
          ...(Array.isArray(exam.vocabularyQuestions) ? exam.vocabularyQuestions : []),
          ...(Array.isArray(exam.grammarQuestions) ? exam.grammarQuestions : []),
          ...(Array.isArray(exam.listeningQuestions) ? exam.listeningQuestions : []),
          ...(Array.isArray(exam.readingQuestions) ? exam.readingQuestions : [])
        ].filter((id): id is string => typeof id === 'string');
        
        // Combine all section answers
        allAnswers = {
          ...(attempt.vocabularyAnswers as Record<string, string> || {}),
          ...(attempt.grammarAnswers as Record<string, string> || {}),
          ...(attempt.listeningAnswers as Record<string, string> || {}),
          ...(attempt.readingAnswers as Record<string, string> || {})
        };
      }

      // Get parent questions in order
      console.log("Looking for parent questions with IDs:", sectionQuestionIds);
      const parentQuestionsInOrder = sectionQuestionIds.map(questionId => {
        const found = questions.find(q => q.id === questionId);
        if (!found) {
          console.log(`  ✗ Question ${questionId} NOT FOUND in storage`);
        }
        return found;
      }).filter(Boolean);
      console.log("Found parent questions:", parentQuestionsInOrder.length);
      
      // Use all questions from storage (includes both parent and sub-questions)
      const allQuestions = questions;

      // Group sub-questions under parent questions
      // Use parent questions in the specified order
      const parentQuestions = parentQuestionsInOrder;
      const subQuestionsMap = new Map<string, any[]>();
      
      // Organize sub-questions by parent ID (from ALL questions)
      allQuestions.forEach(q => {
        if (q.parentId) {
          if (!subQuestionsMap.has(q.parentId)) {
            subQuestionsMap.set(q.parentId, []);
          }
          subQuestionsMap.get(q.parentId)!.push(q);
        }
      });

      // Build questions with answers (including parent + sub structure)
      const questionsWithAnswers = parentQuestions.map(question => {
        const subQuestions = subQuestionsMap.get(question!.id) || [];
        
        // Sort sub-questions by sortOrder
        subQuestions.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        
        // Add userAnswer to sub-questions
        const subQuestionsWithAnswers = subQuestions.map(sq => ({
          ...sq,
          userAnswer: allAnswers[sq.id] || null,
        }));
        
        return {
          question: {
            ...question,
            subQuestions: subQuestionsWithAnswers.length > 0 ? subQuestionsWithAnswers : undefined
          },
          userAnswer: allAnswers[question!.id] || null,
        };
      });

      res.json(questionsWithAnswers);
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

  // Get attempt count for all exams (for admin/manager)
  app.get("/api/exams/attempt-counts", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const exams = await storage.getExams();
      const counts: Record<string, number> = {};
      
      await Promise.all(
        exams.map(async (exam) => {
          const attempts = await storage.getExamAttemptsByExamId(exam.id);
          counts[exam.id] = attempts.length;
        })
      );

      res.json(counts);
    } catch (error) {
      console.error("Error fetching attempt counts:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy số lượng lượt thi" });
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
        // Store user in session
        (req.session as any).user = user;
        
        // Don't send password back to client
        const { password: _, ...userWithoutPassword } = user;
        res.json({
          success: true,
          message: "Đăng nhập thành công",
          user: userWithoutPassword
        });
      } else {
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
      const contactData = insertContactRequestSchema.parse(req.body);
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
  app.get("/api/contact", async (req, res) => {
    try {
      const requests = await storage.getContactRequests();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Không thể lấy danh sách yêu cầu" 
      });
    }
  });

  // Delete contact request
  app.delete("/api/contact/:id", async (req, res) => {
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

  // Article routes
  app.get("/api/articles", async (req, res) => {
    try {
      const category = req.query.category as string;
      const articles = category 
        ? await storage.getArticlesByCategory(category)
        : await storage.getAllArticles();
      res.json(articles);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Không thể lấy danh sách thông tin" 
      });
    }
  });

  app.post("/api/articles", async (req, res) => {
    try {
      const { title, content, category } = req.body;
      
      if (!title || !content || !category) {
        return res.status(400).json({ message: "Title, content, and category are required" });
      }

      // Extract first image from content for thumbnail
      const imageMatch = content.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      const imageUrl = imageMatch ? imageMatch[2] : null;

      const article = await storage.createArticle({
        title,
        content,
        category,
        imageUrl,
        videoUrl: null,
      });

      res.status(201).json({ article });
    } catch (error) {
      console.error("Error creating article:", error);
      res.status(500).json({ message: "Failed to create article" });
    }
  });

  // Image upload endpoint
  app.post("/api/upload/image", requireImageEditPermission, async (req, res) => {
    try {
      const { filename, contentType } = req.body;
      
      if (!filename || !contentType) {
        return res.status(400).json({ message: "Filename and content type are required" });
      }

      // Validate content type
      if (!contentType.startsWith('image/')) {
        return res.status(400).json({ message: "Only image files are allowed" });
      }

      const objectStorageService = new ObjectStorageService();
      const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
      
      // Generate the final image URL that will be accessible
      const imageUrl = uploadUrl.replace(/\?.*$/, ''); // Remove query parameters to get clean URL
      const objectPath = imageUrl.split('/').slice(-2).join('/'); // Get the object path
      const publicImageUrl = `/objects/${objectPath}`;

      res.json({
        uploadUrl,
        imageUrl: publicImageUrl
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

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

  app.put("/api/articles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { title, content, category } = req.body;
      
      if (!title || !content || !category) {
        return res.status(400).json({ message: "Title, content, and category are required" });
      }

      // Extract first image from content for thumbnail
      const imageMatch = content.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      const imageUrl = imageMatch ? imageMatch[2] : null;

      const updatedArticle = await storage.updateArticle(id, { title, content, category, imageUrl });

      if (!updatedArticle) {
        return res.status(404).json({ 
          success: false, 
          message: "Không tìm thấy thông tin để cập nhật" 
        });
      }

      res.json({ article: updatedArticle });
    } catch (error) {
      console.error("Error updating article:", error);
      res.status(500).json({ message: "Failed to update article" });
    }
  });

  app.delete("/api/articles/:id", async (req, res) => {
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
      
      // Extract all images from content
      const imageMatches = article.content.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
      if (imageMatches) {
        imageMatches.forEach(match => {
          const urlMatch = match.match(/!\[([^\]]*)\]\(([^)]+)\)/);
          if (urlMatch && urlMatch[2]) {
            imageUrls.push(urlMatch[2]);
          }
        });
      }

      // Delete images from object storage
      const objectStorageService = new ObjectStorageService();
      for (const imageUrl of imageUrls) {
        try {
          if (imageUrl.startsWith('/objects/')) {
            const objectFile = await objectStorageService.getObjectEntityFile(imageUrl);
            await objectFile.delete();
            console.log(`Deleted image: ${imageUrl}`);
          }
        } catch (error) {
          console.error(`Failed to delete image ${imageUrl}:`, error);
          // Continue with deletion even if some images fail
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
  app.post("/api/articles/reset-order", async (req, res) => {
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
      
      // Fallback to Replit object storage
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
  app.post("/api/media/upload", async (req, res) => {
    try {
      const { provider = "replit", folder = "uploads", maxSize = 50 * 1024 * 1024 } = req.body;
      
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
  app.get("/api/storage/providers", async (req, res) => {
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
  app.post("/api/storage/test", async (req, res) => {
    try {
      const { provider } = req.body;
      
      if (provider && provider !== "replit") {
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
  app.put("/api/media/finalize", async (req, res) => {
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

  // Endpoint to upload existing article images
  app.post("/api/articles/upload-images", async (req, res) => {
    try {
      const { provider = "replit" } = req.body;
      
      const { uploadExistingArticleImages } = await import("./uploadExistingImages");
      const uploadCount = await uploadExistingArticleImages(provider);
      
      res.json({ 
        success: true, 
        message: `Đã upload ${uploadCount} hình ảnh thành công`,
        uploadCount 
      });
    } catch (error) {
      console.error("Error uploading article images:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to upload article images" 
      });
    }
  });

  // Upload service images to R2
  app.post("/api/upload-service-images", async (req, res) => {
    try {
      const { uploadServiceImages } = await import("./uploadServiceImages");
      const result = await uploadServiceImages();
      
      res.json({ 
        success: result.success, 
        message: `Đã upload ${result.successCount}/4 hình ảnh service thành công`,
        uploadCount: result.successCount,
        results: result.results
      });
    } catch (error) {
      console.error("Error uploading service images:", error);
      res.status(500).json({ 
        success: false, 
        error: `Failed to upload service images: ${error instanceof Error ? error.message : "Unknown error"}` 
      });
    }
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
      const uiImages = await storage.getAllUiImages();
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
  app.put("/api/ui-images/:id", async (req, res) => {
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
      const { imageType, altText } = req.body;
      
      if (!file || !imageType) {
        return res.status(400).json({ error: "Missing file or imageType" });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = file.originalname.split('.').pop();
      const uniqueFileName = `${imageType}-${timestamp}.${fileExtension}`;
      const fullPath = `ui-images/${uniqueFileName}`;
      
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
      
      // Save to database/storage
      const uiImage = await storage.createUiImage({
        imageUrl: uploadResult.url!,
        imageType: imageType,
        altText: altText || null,
        description: null
      });
      
      res.json({
        success: true,
        imageUrl: uploadResult.url,
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
        provider: config as "replit" | "primary" | "secondary",
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

  // Get existing UI images from R2
  app.get("/api/ui-images", async (req, res) => {
    try {
      const { config = "primary" } = req.query;
      const images = await multiR2Storage.listFiles(config as string, "ui-images/");
      res.json(images);
    } catch (error) {
      console.error("Error listing UI images:", error);
      res.status(500).json({ error: "Failed to list images" });
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

  // Update UI image metadata
  app.put("/api/ui-images", requireImageEditPermission, async (req, res) => {
    try {
      const { imageUrl, imageType, altText, description } = req.body;
      
      if (!imageUrl || !imageType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Try to update existing UI image first
      let updatedImage = await storage.updateUiImageByType(imageType, {
        imageUrl,
        altText: altText || null,
        description: description || null
      });
      
      // If not found, create a new UI image
      if (!updatedImage) {
        console.log(`Creating new UI image for type: ${imageType}`);
        updatedImage = await storage.createUiImage({
          imageType,
          imageUrl,
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
      
      if (provider === "replit") {
        return res.status(404).json({ error: "Replit storage not supported yet" });
      }

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
      // Determine extension from content type
      const extensionMap: Record<string, string> = {
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
        'audio/webm': 'webm',
        'audio/aac': 'aac',
        'audio/m4a': 'm4a',
        'audio/x-m4a': 'm4a'
      };
      const fileExtension = extensionMap[upload.contentType] || 'mp3';
      const fileName = `${timestamp}-${randomStr}.${fileExtension}`;

      // Upload to R2
      const uploadResult = await multiR2Storage.uploadFile(
        fileBuffer,
        fileName,
        upload.contentType,
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

      // Get context from query string for context-based folder structure
      const context = req.query.context as 'qbank' | 'exam' | undefined;
      const folderName = context ? getContextFolder('temp-question-images', context) : 'temp-question-images';

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

  // Generic helper to move file from temp to permanent with context support
  async function moveTemporaryFileToPermanent(
    tempUrl: string, 
    tempFolderPattern: string, 
    contentType: string,
    maxSizeBytes: number,
    context: 'qbank' | 'exam' = 'qbank'
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

      // Download from temp location
      const downloadUrl = await r2Manager.generateDownloadUrl("primary", tempObjectKey);
      if (!downloadUrl) {
        console.warn(`Temporary file not found: ${tempObjectKey}`);
        return null;
      }

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        console.warn(`Failed to download temporary file: ${tempObjectKey}`);
        return null;
      }

      const buffer = await response.arrayBuffer();

      // Upload to final location
      const uploadResult = await multiR2Storage.uploadFile(
        Buffer.from(buffer),
        filename,
        contentType,
        {
          provider: "primary",
          folder: finalFolder,
          allowedTypes: contentType.startsWith('image') ? ["image/*"] : ["audio/*"],
          maxSizeBytes
        }
      );

      if (uploadResult.success) {
        // Delete temporary file
        await multiR2Storage.deleteFile("primary", tempObjectKey);
        console.log(`✓ Moved file: ${tempFolder}/${filename} → ${finalFolder}/${filename}`);
        return `/api/${finalFolder}/${filename}`;
      }

      return null;
    } catch (error) {
      console.error("Error moving temporary file to permanent:", error);
      return null;
    }
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

      const tempObjectKey = `temp-question-images/${filename}`;
      const finalObjectKey = `question-images/${filename}`;

      const downloadUrl = await r2Manager.generateDownloadUrl("primary", tempObjectKey);
      if (!downloadUrl) {
        console.warn(`Temporary question image not found: ${tempObjectKey}`);
        return null;
      }

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        console.warn(`Failed to download temporary question image: ${tempObjectKey}`);
        return null;
      }

      const buffer = await response.arrayBuffer();

      const uploadResult = await multiR2Storage.uploadFile(
        Buffer.from(buffer),
        filename,
        "image/jpeg",
        {
          provider: "primary",
          folder: "question-images",
          allowedTypes: ["image/*"],
          maxSizeBytes: 5 * 1024 * 1024
        }
      );

      if (uploadResult.success) {
        await multiR2Storage.deleteFile("primary", tempObjectKey);
        return `/api/question-images/${filename}`;
      }

      return null;
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

      const tempObjectKey = `temp-answer-images/${filename}`;
      const finalObjectKey = `answer-images/${filename}`;

      const downloadUrl = await r2Manager.generateDownloadUrl("primary", tempObjectKey);
      if (!downloadUrl) {
        console.warn(`Temporary answer image not found: ${tempObjectKey}`);
        return null;
      }

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        console.warn(`Failed to download temporary answer image: ${tempObjectKey}`);
        return null;
      }

      const buffer = await response.arrayBuffer();

      const uploadResult = await multiR2Storage.uploadFile(
        Buffer.from(buffer),
        filename,
        "image/jpeg",
        {
          provider: "primary",
          folder: "answer-images",
          allowedTypes: ["image/*"],
          maxSizeBytes: 3 * 1024 * 1024
        }
      );

      if (uploadResult.success) {
        await multiR2Storage.deleteFile("primary", tempObjectKey);
        return `/api/answer-images/${filename}`;
      }

      return null;
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

      const tempObjectKey = `temp-audio/${filename}`;
      const finalObjectKey = `audio/${filename}`;

      const downloadUrl = await r2Manager.generateDownloadUrl("primary", tempObjectKey);
      if (!downloadUrl) {
        console.warn(`Temporary file not found: ${tempObjectKey}`);
        return null;
      }

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        console.warn(`Failed to download temporary file: ${tempObjectKey}`);
        return null;
      }

      const buffer = await response.arrayBuffer();

      const uploadResult = await multiR2Storage.uploadFile(
        Buffer.from(buffer),
        filename,
        "audio/mpeg",
        {
          provider: "primary",
          folder: "audio",
          allowedTypes: ["audio/*"],
          maxSizeBytes: 10 * 1024 * 1024
        }
      );

      if (uploadResult.success) {
        await multiR2Storage.deleteFile("primary", tempObjectKey);
        return `/api/audio/${filename}`;
      }

      return null;
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

      const tempObjectKey = `temp-description-images/${filename}`;
      const finalObjectKey = `description-images/${filename}`;

      const downloadUrl = await r2Manager.generateDownloadUrl("primary", tempObjectKey);
      if (!downloadUrl) {
        console.warn(`Temporary description image not found: ${tempObjectKey}`);
        return null;
      }

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        console.warn(`Failed to download temporary description image: ${tempObjectKey}`);
        return null;
      }

      const buffer = await response.arrayBuffer();

      const uploadResult = await multiR2Storage.uploadFile(
        Buffer.from(buffer),
        filename,
        "image/*",
        {
          provider: "primary",
          folder: "description-images",
          allowedTypes: ["image/*"],
          maxSizeBytes: 5 * 1024 * 1024
        }
      );

      if (uploadResult.success) {
        await multiR2Storage.deleteFile("primary", tempObjectKey);
        return `/api/description-images/${filename}`;
      }

      return null;
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

      const tempObjectKey = `temp-description-audio/${filename}`;
      const finalObjectKey = `description-audio/${filename}`;

      const downloadUrl = await r2Manager.generateDownloadUrl("primary", tempObjectKey);
      if (!downloadUrl) {
        console.warn(`Temporary description audio not found: ${tempObjectKey}`);
        return null;
      }

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        console.warn(`Failed to download temporary description audio: ${tempObjectKey}`);
        return null;
      }

      const buffer = await response.arrayBuffer();

      const uploadResult = await multiR2Storage.uploadFile(
        Buffer.from(buffer),
        filename,
        "audio/mpeg",
        {
          provider: "primary",
          folder: "description-audio",
          allowedTypes: ["audio/*"],
          maxSizeBytes: 10 * 1024 * 1024
        }
      );

      if (uploadResult.success) {
        await multiR2Storage.deleteFile("primary", tempObjectKey);
        return `/api/description-audio/${filename}`;
      }

      return null;
    } catch (error) {
      console.error("Error moving temporary description audio to permanent:", error);
      return null;
    }
  }

  // Create exam endpoint
  app.post("/api/exams", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { title, description, isDemo, sections, passingScore } = req.body;

      console.log("Creating exam with sections:", JSON.stringify(sections, null, 2));

      if (!title) {
        return res.status(400).json({ 
          message: "Title is required" 
        });
      }

      if (!sections || !Array.isArray(sections) || sections.length === 0) {
        return res.status(400).json({ 
          message: "At least one section is required" 
        });
      }

      // Validate sections
      for (const section of sections) {
        const questionIds = extractQuestionIds(section);
        // Accept either sectionName (new) or type (legacy)
        const hasName = section.sectionName || section.type;
        console.log("Validating section:", { 
          hasName, 
          sectionName: section.sectionName, 
          type: section.type, 
          timeLimit: section.timeLimit, 
          questionIdsCount: questionIds.length,
          questionSets: section.questionSets 
        });
        if (!hasName || !section.timeLimit || questionIds.length === 0) {
          return res.status(400).json({ 
            message: "Each section must have sectionName (or type), timeLimit, and at least one question" 
          });
        }
        
        // Validate questionSets structure if present
        if (section.questionSets) {
          if (!Array.isArray(section.questionSets)) {
            return res.status(400).json({
              message: "questionSets must be an array"
            });
          }
          for (const qSet of section.questionSets) {
            // Accept either questionIds (from frontend) or questions (legacy)
            if (!qSet.questionIds || !Array.isArray(qSet.questionIds)) {
              return res.status(400).json({
                message: "Each question set must have a questionIds array"
              });
            }
          }
        }
      }

      // Sanitize sections to ensure only questionIds are stored, not full question objects
      const sanitizedSections = sections.map((section: any) => ({
        id: section.id,
        sectionName: section.sectionName || section.type || "",
        timeLimit: section.timeLimit || 10,
        passingScore: section.passingScore,
        content: section.content || "",
        descriptionImageUrls: section.descriptionImageUrls || [],
        descriptionAudioUrl: section.descriptionAudioUrl || "",
        questionSets: (section.questionSets || []).map((qs: any) => ({
          id: qs.id,
          name: qs.name || "",
          // Ensure we only store questionIds, not full question objects
          questionIds: qs.questionIds || 
            (qs.questions ? qs.questions.map((q: any) => typeof q === 'string' ? q : q.id) : [])
        }))
      }));
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
      const { title, description, isDemo, sections, isActive, passingScore } = req.body;

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

      // Sanitize sections to ensure only questionIds are stored, not full question objects
      let sanitizedSections = undefined;
      const newAudioUrls = new Set<string>();
      if (sections && Array.isArray(sections)) {
        sanitizedSections = sections.map((section: any) => {
          if (section.descriptionAudioUrl) {
            newAudioUrls.add(section.descriptionAudioUrl);
          }
          return {
            id: section.id,
            sectionName: section.sectionName || "",
            timeLimit: section.timeLimit || 10,
            passingScore: section.passingScore,
            content: section.content || "",
            descriptionImageUrls: section.descriptionImageUrls || [],
            descriptionAudioUrl: section.descriptionAudioUrl || "",
            questionSets: (section.questionSets || []).map((qs: any) => ({
              id: qs.id,
              name: qs.name || "",
              // Ensure we only store questionIds, not full question objects
              // Handle both: questionIds array or questions array with id property
              questionIds: qs.questionIds || 
                (qs.questions ? qs.questions.map((q: any) => typeof q === 'string' ? q : q.id) : [])
            }))
          };
        });
        console.log("Sanitized sections for exam update:", JSON.stringify(sanitizedSections, null, 2));
      }

      // Find audio files that were removed or changed (in old but not in new)
      const audioUrlsToDelete = [...oldAudioUrls].filter(url => !newAudioUrls.has(url));
      
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

      const updatedExam = await storage.updateExam(id, {
        title,
        description: description || null,
        isDemo: isDemo || false,
        sections: sanitizedSections,
        isActive: isActive !== undefined ? isActive : true,
        passingScore: passingScore !== undefined ? passingScore : undefined,
      });

      if (!updatedExam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      res.json({
        exam: updatedExam,
        message: "Exam updated successfully"
      });
    } catch (error) {
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

      // OPTIMIZED: Process all parent-level media files in parallel
      const [
        finalAudioUrl,
        finalImageUrl,
        finalImageUrls,
        finalDescriptionImageUrl,
        finalDescriptionAudioUrl
      ] = await Promise.all([
        // Audio file
        (async () => {
          if (audioUrl && audioUrl.includes('/api/temp-audio/')) {
            try {
              const result = await moveTemporaryAudioToPermanent(audioUrl);
              return result || null;
            } catch (error) {
              console.error("Error moving temporary audio:", error);
              return null;
            }
          }
          return audioUrl;
        })(),
        
        // Single image URL
        (async () => {
          if (imageUrl && imageUrl.includes('/api/temp-question-images/')) {
            try {
              const result = await moveTemporaryQuestionImageToPermanent(imageUrl);
              return result || null;
            } catch (error) {
              console.error("Error moving temporary question image:", error);
              return null;
            }
          }
          return imageUrl;
        })(),
        
        // Image URLs array (process in parallel)
        (async () => {
          if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
            const results = await Promise.all(
              imageUrls.map(async (imgUrl) => {
                if (imgUrl && (imgUrl.includes('/api/temp-question-images/') || imgUrl.includes('/api/qbank-temp-images/') || imgUrl.includes('/api/exam-temp-images/'))) {
                  try {
                    return await moveTemporaryQuestionImageToPermanent(imgUrl);
                  } catch (error) {
                    console.error("Error moving question imageUrl:", error);
                    return null;
                  }
                }
                return imgUrl;
              })
            );
            const filtered = results.filter(url => url !== null);
            return filtered.length > 0 ? filtered : null;
          }
          return imageUrls;
        })(),
        
        // Description image
        (async () => {
          if (descriptionImageUrl && descriptionImageUrl.includes('/api/temp-description-images/')) {
            try {
              const result = await moveTemporaryDescriptionImageToPermanent(descriptionImageUrl);
              return result || null;
            } catch (error) {
              console.error("Error moving temporary description image:", error);
              return null;
            }
          }
          return descriptionImageUrl;
        })(),
        
        // Description audio
        (async () => {
          if (descriptionAudioUrl && descriptionAudioUrl.includes('/api/temp-description-audio/')) {
            try {
              const result = await moveTemporaryDescriptionAudioToPermanent(descriptionAudioUrl);
              return result || null;
            } catch (error) {
              console.error("Error moving temporary description audio:", error);
              return null;
            }
          }
          return descriptionAudioUrl;
        })()
      ]);

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
          descriptionImageUrls: descriptionImageUrls || null,
          descriptionAudioUrl: finalDescriptionAudioUrl || null,
          questionText, // Parent question text
          questionType: questionType || "multiple_choice",
          imageUrl: finalImageUrl || null,
          imageUrls: finalImageUrls || null,
          audioUrl: finalAudioUrl || null,
          options,
          correctAnswer,
          explanation: explanation || null,
          points: points !== undefined ? points : 1,
          sortOrder: newSortOrder,
          parentId: null, // This is a parent question
        });

        // OPTIMIZED: Process and create all sub-questions in parallel
        const createdSubQuestions = await Promise.all(
          subQuestions.map(async (subQ, i) => {
            // Process all media files for this sub-question in parallel
            const [subFinalImageUrl, subFinalImageUrls, subFinalAudioUrl, processedOptions] = await Promise.all([
              // Single image URL
              (async () => {
                if (subQ.imageUrl && subQ.imageUrl.includes('/api/temp-question-images/')) {
                  try {
                    return await moveTemporaryQuestionImageToPermanent(subQ.imageUrl);
                  } catch (error) {
                    console.error("Error moving sub-question image:", error);
                    return null;
                  }
                }
                return subQ.imageUrl;
              })(),
              
              // Image URLs array
              (async () => {
                if (subQ.imageUrls && Array.isArray(subQ.imageUrls) && subQ.imageUrls.length > 0) {
                  const results = await Promise.all(
                    subQ.imageUrls.map(async (imgUrl: string) => {
                      if (imgUrl && (imgUrl.includes('/api/temp-question-images/') || imgUrl.includes('/api/qbank-temp-images/') || imgUrl.includes('/api/exam-temp-images/'))) {
                        try {
                          return await moveTemporaryQuestionImageToPermanent(imgUrl);
                        } catch (error) {
                          console.error("Error moving sub-question imageUrl:", error);
                          return null;
                        }
                      }
                      return imgUrl;
                    })
                  );
                  const filtered = results.filter(url => url !== null);
                  return filtered.length > 0 ? filtered : null;
                }
                return subQ.imageUrls;
              })(),
              
              // Audio URL
              (async () => {
                if (subQ.audioUrl && subQ.audioUrl.includes('/api/temp-audio/')) {
                  try {
                    return await moveTemporaryAudioToPermanent(subQ.audioUrl);
                  } catch (error) {
                    console.error("Error moving sub-question audio:", error);
                    return null;
                  }
                }
                return subQ.audioUrl;
              })(),
              
              // Answer options with images
              (async () => {
                if (Array.isArray(subQ.options)) {
                  return await Promise.all(subQ.options.map(async (opt: any) => {
                    if (typeof opt === 'object' && opt.imageUrls && Array.isArray(opt.imageUrls)) {
                      const imageResults = await Promise.all(
                        opt.imageUrls.map(async (imgUrl: string) => {
                          if (imgUrl && imgUrl.includes('/api/temp-answer-images/')) {
                            try {
                              return await moveTemporaryAnswerImageToPermanent(imgUrl);
                            } catch (error) {
                              console.error("Error moving answer image:", error);
                              return null;
                            }
                          }
                          return imgUrl;
                        })
                      );
                      return { ...opt, imageUrls: imageResults.filter(url => url !== null) };
                    }
                    return opt;
                  }));
                }
                return subQ.options;
              })()
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
          descriptionImageUrls: descriptionImageUrls || null,
          descriptionAudioUrl: finalDescriptionAudioUrl || null,
          questionText,
          questionType: questionType || "multiple_choice",
          imageUrl: finalImageUrl || null,
          imageUrls: finalImageUrls || null,
          audioUrl: finalAudioUrl || null,
          options,
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

      // OPTIMIZED: Process imageUrls array in parallel if provided
      let processedImageUrls = imageUrls;
      if (imageUrls !== undefined) {
        if (Array.isArray(imageUrls) && imageUrls.length > 0) {
          const results = await Promise.all(
            imageUrls.map(async (imgUrl: string) => {
              if (imgUrl && (imgUrl.includes('/api/temp-question-images/') || imgUrl.includes('/api/qbank-temp-images/') || imgUrl.includes('/api/exam-temp-images/'))) {
                try {
                  return await moveTemporaryQuestionImageToPermanent(imgUrl);
                } catch (error) {
                  console.error("Error moving question imageUrl in update:", error);
                  return null;
                }
              }
              return imgUrl;
            })
          );
          const filtered = results.filter(url => url !== null);
          processedImageUrls = filtered.length > 0 ? filtered : null;
        } else {
          processedImageUrls = null;
        }
      } else {
        processedImageUrls = undefined;
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
          descriptionImageUrls: descriptionImageUrls !== undefined ? descriptionImageUrls : existingQuestion.descriptionImageUrls,
          descriptionAudioUrl: descriptionAudioUrl !== undefined ? descriptionAudioUrl : existingQuestion.descriptionAudioUrl,
          questionText,
          questionType: questionType || existingQuestion.questionType,
          imageUrl: imageUrl !== undefined ? imageUrl : existingQuestion.imageUrl,
          imageUrls: imageUrls !== undefined ? processedImageUrls : existingQuestion.imageUrls,
          audioUrl: audioUrl !== undefined ? audioUrl : existingQuestion.audioUrl,
          options: options,
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
            // Process sub-question imageUrls in parallel
            let subProcessedImageUrls = subQ.imageUrls;
            if (subQ.imageUrls !== undefined) {
              if (Array.isArray(subQ.imageUrls) && subQ.imageUrls.length > 0) {
                const results = await Promise.all(
                  subQ.imageUrls.map(async (imgUrl) => {
                    if (imgUrl && (imgUrl.includes('/api/temp-question-images/') || imgUrl.includes('/api/qbank-temp-images/') || imgUrl.includes('/api/exam-temp-images/'))) {
                      try {
                        return await moveTemporaryQuestionImageToPermanent(imgUrl);
                      } catch (error) {
                        console.error("Error moving sub-question imageUrl in update:", error);
                        return null;
                      }
                    }
                    return imgUrl;
                  })
                );
                const filtered = results.filter(url => url !== null);
                subProcessedImageUrls = filtered.length > 0 ? filtered : null;
              } else {
                subProcessedImageUrls = null;
              }
            } else {
              subProcessedImageUrls = undefined;
            }
            
            if (subQ.id && existingSubIds.has(subQ.id)) {
              // UPDATE existing sub-question
              return await storage.updateQuestion(subQ.id, {
                questionText: subQ.questionText,
                imageUrl: subQ.imageUrl !== undefined ? subQ.imageUrl : null,
                imageUrls: subProcessedImageUrls !== undefined ? subProcessedImageUrls : null,
                audioUrl: subQ.audioUrl !== undefined ? subQ.audioUrl : null,
                options: subQ.options,
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
                imageUrl: subQ.imageUrl || null,
                imageUrls: subProcessedImageUrls || null,
                audioUrl: subQ.audioUrl || null,
                options: subQ.options,
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
          descriptionImageUrls: descriptionImageUrls !== undefined ? descriptionImageUrls : existingQuestion.descriptionImageUrls,
          descriptionAudioUrl: descriptionAudioUrl !== undefined ? descriptionAudioUrl : existingQuestion.descriptionAudioUrl,
          questionText,
          questionType: questionType || existingQuestion.questionType,
          imageUrl: imageUrl !== undefined ? imageUrl : existingQuestion.imageUrl,
          imageUrls: imageUrls !== undefined ? processedImageUrls : existingQuestion.imageUrls,
          audioUrl: audioUrl !== undefined ? audioUrl : existingQuestion.audioUrl,
          options: options,
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
        res.json({
          success: true,
          filename: fileName,
          url: `/api/${folder}/${fileName}`,
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
        res.json({
          success: true,
          filename: fileName,
          url: `/api/${folder}/${fileName}`,
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
  return httpServer;
}
