import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactRequestSchema, insertArticleSchema, registrationFormSchema, ContactInfo, InsertContactInfo } from "@shared/schema";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { multiR2Storage, type MediaUploadConfig, type FileInfo } from "./multiR2Storage";
import { r2Manager, EXTERNAL_R2_CONFIGS } from "./r2Config";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
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
      res.json(exams);
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
      res.json(exam);
    } catch (error) {
      console.error("Error fetching exam:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy thông tin đề thi" });
    }
  });

  app.get("/api/exams/:id/questions", async (req, res) => {
    try {
      const { id } = req.params;
      const questions = await storage.getQuestionsByExamId(id);
      res.json(questions);
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
      
      let questions;
      if (q && typeof q === 'string') {
        questions = await storage.searchQuestions(q);
      } else if (category && typeof category === 'string') {
        questions = await storage.getQuestionsByCategory(category);
      } else {
        questions = await storage.getAllQuestions();
      }
      
      res.json(questions);
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
        vocabularyAnswers, vocabularyTimeSpent, vocabularyScore,
        grammarAnswers, grammarTimeSpent, grammarScore,
        listeningAnswers, listeningTimeSpent, listeningScore,
        readingAnswers, readingTimeSpent, readingScore,
        totalScore, totalTimeSpent, waitTimeBetweenSections
      } = req.body;
      const sessionUser = (req.session as any)?.user;
      
      // Get exam
      const exam = await storage.getExam(examId);
      if (!exam) {
        return res.status(404).json({ message: "Không tìm thấy đề thi" });
      }

      // For official exams, require authentication
      if (!exam.isDemo && !sessionUser) {
        return res.status(401).json({ message: "Cần đăng nhập để thi đề chính thức" });
      }

      // Create exam attempt with 4-section data
      const attempt = await storage.createExamAttempt({
        examId,
        userId: sessionUser?.id || null,
        vocabularyAnswers,
        vocabularyTimeSpent,
        vocabularyScore,
        grammarAnswers,
        grammarTimeSpent,
        grammarScore,
        listeningAnswers,
        listeningTimeSpent,
        listeningScore,
        readingAnswers,
        readingTimeSpent,
        readingScore,
        totalScore,
        totalTimeSpent,
        waitTimeBetweenSections,
      });

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

      const questions = await storage.getQuestionsByExamId(attempt.examId);
      const questionOrder = attempt.questionOrder as string[];
      
      // Order questions according to the attempt's question order
      const orderedQuestions = questionOrder.map(questionId => 
        questions.find(q => q.id === questionId)
      ).filter(Boolean);

      const questionsWithAnswers = orderedQuestions.map(question => {
        if (!question) return null;
        return {
          question,
          userAnswer: (attempt.userAnswers as Record<string, string>)[question.id],
        };
      }).filter(Boolean);

      res.json(questionsWithAnswers);
    } catch (error) {
      console.error("Error fetching exam attempt details:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy chi tiết kết quả thi" });
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

  // Question image upload endpoint (direct upload using multipart/form-data)
  app.post("/api/question-images/upload-direct", upload.single('image'), async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

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
      
      try {
        const uploadResult = await multiR2Storage.uploadFile({
          provider: "primary",
          key: `temp-question-images/${fileName}`,
          body: file.buffer,
          contentType: file.mimetype
        });

        if (!uploadResult.success) {
          return res.status(500).json({ message: uploadResult.error || "Failed to upload image" });
        }

        const imageUrl = `/api/temp-question-images/${fileName}`;
        res.json({ 
          imageUrl,
          originalFileName: file.originalname || 'image file'
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

  // Answer choice image upload endpoint (direct upload using multipart/form-data)
  app.post("/api/answer-images/upload-direct", upload.single('image'), async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

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
      
      try {
        const uploadResult = await multiR2Storage.uploadFile({
          provider: "primary",
          key: `temp-answer-images/${fileName}`,
          body: file.buffer,
          contentType: file.mimetype
        });

        if (!uploadResult.success) {
          return res.status(500).json({ message: uploadResult.error || "Failed to upload image" });
        }

        const imageUrl = `/api/temp-answer-images/${fileName}`;
        res.json({ 
          imageUrl,
          originalFileName: file.originalname || 'image file'
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

  // Audio upload via server proxy (alternative to presigned URL)
  app.post("/api/audio/upload-direct", upload.single('audio'), async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

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
      
      try {
        // Upload to temporary location first
        const uploadResult = await multiR2Storage.uploadFile(
          file.buffer,
          fileName,
          file.mimetype,
          {
            provider: "primary",
            folder: "temp-audio",
            allowedTypes: ["audio/*"],
            maxSizeBytes: 10 * 1024 * 1024
          }
        );
        
        if (!uploadResult.success) {
          return res.status(500).json({ error: uploadResult.error || "Upload failed" });
        }
        
        // Return temporary audio URL
        const audioUrl = `/api/temp-audio/${fileName}`;
        res.json({ 
          audioUrl,
          originalFileName: file.originalname || 'audio file'
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

  // Audio upload endpoint (presigned URL)
  app.post("/api/audio/upload", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { fileName, fileType, fileSize } = req.body;
      
      if (!fileName || !fileType || !fileSize) {
        return res.status(400).json({ message: "File name, type, and size are required" });
      }

      // Validate audio file type
      if (!fileType.startsWith('audio/')) {
        return res.status(400).json({ message: "Only audio files are allowed" });
      }

      // Validate file size (max 10MB)
      if (fileSize > 10 * 1024 * 1024) {
        return res.status(400).json({ message: "File size cannot exceed 10MB" });
      }

      try {
        // Generate upload URL using R2 storage
        const timestamp = Date.now();
        const fileExtension = fileName.split('.').pop() || 'mp3';
        const objectKey = `audio/${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
        
        console.log(`Audio upload request: fileName=${fileName}, fileType=${fileType}, objectKey=${objectKey}`);
        
        const uploadResult = await multiR2Storage.getUploadUrl({
          provider: "primary",
          folder: "temp-audio",
          allowedTypes: ["audio/*"],
          maxSizeBytes: 10 * 1024 * 1024 // 10MB
        }, fileType);
        
        console.log("Upload result:", uploadResult);
        
        if (!uploadResult.success) {
          console.error("Upload URL generation failed:", uploadResult.error);
          return res.status(500).json({ 
            uploadUrl: { success: false, error: uploadResult.error || "Failed to generate upload URL" }
          });
        }
        
        const uploadUrl = uploadResult.url;
        const audioUrl = uploadResult.path;

        console.log(`Generated upload URL: ${uploadUrl}`);
        console.log(`Audio URL will be: ${audioUrl}`);

        res.json({
          uploadUrl,
          audioUrl
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

  // Audio download endpoint
  app.get("/api/audio/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const objectKey = `audio/${filename}`;
      
      const downloadUrl = await r2Manager.generateDownloadUrl("primary", objectKey);
      
      if (!downloadUrl) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      // Proxy the audio file
      const audioResponse = await fetch(downloadUrl);
      if (!audioResponse.ok) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';
      const contentLength = audioResponse.headers.get('content-length');
      
      res.set({
        'Content-Type': contentType,
        'Content-Length': contentLength || '',
        'Cache-Control': 'public, max-age=31536000', // 1 year cache
      });

      // Stream the audio data
      const audioBuffer = await audioResponse.arrayBuffer();
      return res.send(Buffer.from(audioBuffer));
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

      // Proxy the audio file
      const audioResponse = await fetch(downloadUrl);
      if (!audioResponse.ok) {
        return res.status(404).json({ message: "Description audio file not found" });
      }

      const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';
      const contentLength = audioResponse.headers.get('content-length');
      
      res.set({
        'Content-Type': contentType,
        'Content-Length': contentLength || '',
        'Cache-Control': 'public, max-age=86400', // 24 hour cache for permanent files
      });

      // Stream the audio data
      const audioBuffer = await audioResponse.arrayBuffer();
      return res.send(Buffer.from(audioBuffer));
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

      // Proxy the audio file
      const audioResponse = await fetch(downloadUrl);
      if (!audioResponse.ok) {
        return res.status(404).json({ message: "Temporary audio file not found" });
      }

      const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';
      const contentLength = audioResponse.headers.get('content-length');
      
      res.set({
        'Content-Type': contentType,
        'Content-Length': contentLength || '',
        'Cache-Control': 'public, max-age=300', // 5 minute cache for temp files
      });

      // Stream the audio data
      const audioBuffer = await audioResponse.arrayBuffer();
      return res.send(Buffer.from(audioBuffer));
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

      const results = [];
      for (const filename of filenames) {
        const objectKey = `temp-audio/${filename}`;
        const result = await multiR2Storage.deleteFile("primary", objectKey);
        results.push({ filename, success: result.success, error: result.error });
        
        if (result.success) {
          console.log(`✓ Cleaned up temporary audio file: ${filename}`);
        } else {
          console.warn(`✗ Failed to cleanup temporary audio file: ${filename} - ${result.error}`);
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

      const results = [];
      for (const filename of filenames) {
        const objectKey = `temp-question-images/${filename}`;
        const result = await multiR2Storage.deleteFile("primary", objectKey);
        results.push({ filename, success: result.success, error: result.error });
        
        if (result.success) {
          console.log(`✓ Cleaned up temporary question image: ${filename}`);
        } else {
          console.warn(`✗ Failed to cleanup temporary question image: ${filename} - ${result.error}`);
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

      const results = [];
      for (const filename of filenames) {
        const objectKey = `temp-answer-images/${filename}`;
        const result = await multiR2Storage.deleteFile("primary", objectKey);
        results.push({ filename, success: result.success, error: result.error });
        
        if (result.success) {
          console.log(`✓ Cleaned up temporary answer image: ${filename}`);
        } else {
          console.warn(`✗ Failed to cleanup temporary answer image: ${filename} - ${result.error}`);
        }
      }

      res.json({ results });
    } catch (error) {
      console.error("Error cleaning up temporary answer images:", error);
      res.status(500).json({ message: "Failed to cleanup temporary files" });
    }
  });

  // Helper function to move temporary question images to permanent location
  async function moveTemporaryQuestionImageToPermanent(tempUrl: string): Promise<string | null> {
    if (!tempUrl || !tempUrl.includes('/api/temp-question-images/')) {
      return tempUrl; // Already permanent or invalid
    }

    try {
      const filename = tempUrl.split('/').pop();
      if (!filename) return null;

      const tempObjectKey = `temp-question-images/${filename}`;
      const finalObjectKey = `question-images/${filename}`;

      // Download from temp location
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

      // Upload to final location
      const uploadResult = await multiR2Storage.uploadFile(
        Buffer.from(buffer),
        filename,
        "image/jpeg", // Default content type, can be adjusted
        {
          provider: "primary",
          folder: "question-images",
          allowedTypes: ["image/*"],
          maxSizeBytes: 5 * 1024 * 1024
        }
      );

      if (uploadResult.success) {
        // Delete temporary file
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
    if (!tempUrl || !tempUrl.includes('/api/temp-answer-images/')) {
      return tempUrl; // Already permanent or invalid
    }

    try {
      const filename = tempUrl.split('/').pop();
      if (!filename) return null;

      const tempObjectKey = `temp-answer-images/${filename}`;
      const finalObjectKey = `answer-images/${filename}`;

      // Download from temp location
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

      // Upload to final location
      const uploadResult = await multiR2Storage.uploadFile(
        Buffer.from(buffer),
        filename,
        "image/jpeg", // Default content type, can be adjusted
        {
          provider: "primary",
          folder: "answer-images",
          allowedTypes: ["image/*"],
          maxSizeBytes: 3 * 1024 * 1024
        }
      );

      if (uploadResult.success) {
        // Delete temporary file
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
    if (!tempUrl || !tempUrl.includes('/api/temp-audio/')) {
      return tempUrl; // Already permanent or invalid
    }

    try {
      const filename = tempUrl.split('/').pop();
      if (!filename) return null;

      const tempObjectKey = `temp-audio/${filename}`;
      const finalObjectKey = `audio/${filename}`;

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
        "audio/mpeg",
        {
          provider: "primary",
          folder: "audio",
          allowedTypes: ["audio/*"],
          maxSizeBytes: 10 * 1024 * 1024
        }
      );

      if (uploadResult.success) {
        // Delete temporary file using multiR2Storage
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
    if (!tempUrl || !tempUrl.includes('/api/temp-description-images/')) {
      return tempUrl; // Already permanent or invalid
    }

    try {
      const filename = tempUrl.split('/').pop();
      if (!filename) return null;

      const tempObjectKey = `temp-description-images/${filename}`;
      const finalObjectKey = `description-images/${filename}`;

      // Download from temp location
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

      // Upload to final location
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
        // Delete temporary file
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
    if (!tempUrl || !tempUrl.includes('/api/temp-description-audio/')) {
      return tempUrl; // Already permanent or invalid
    }

    try {
      const filename = tempUrl.split('/').pop();
      if (!filename) return null;

      const tempObjectKey = `temp-description-audio/${filename}`;
      const finalObjectKey = `description-audio/${filename}`;

      // Download from temp location
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

      // Upload to final location
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
        // Delete temporary file
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

      const { title, description, isDemo, timeLimit, questions, questionCount } = req.body;

      if (!title || !timeLimit) {
        return res.status(400).json({ 
          message: "Title and time limit are required" 
        });
      }

      // Support both old format (with questions array) and new format (with questionCount)
      let finalQuestionCount;
      let hasInlineQuestions = questions && Array.isArray(questions) && questions.length > 0;
      
      if (hasInlineQuestions) {
        // Old format - inline question creation
        finalQuestionCount = questions.length;
      } else if (questionCount !== undefined && questionCount > 0) {
        // New format - question bank integration
        finalQuestionCount = questionCount;
      } else {
        return res.status(400).json({ 
          message: "Must have at least one question or specify questionCount" 
        });
      }

      // Create the exam
      const exam = await storage.createExam({
        title,
        description: description || null,
        isDemo: isDemo || false,
        timeLimit,
        questionCount: finalQuestionCount,
        isActive: true,
        createdBy: sessionUser.id,
      });

      // Create questions for the exam if using old inline format
      const createdQuestions = [];
      if (hasInlineQuestions) {
        for (let i = 0; i < questions.length; i++) {
          const questionData = questions[i];
          
          // Move temporary audio to permanent location if exists
          let finalAudioUrl = questionData.audioUrl;
          if (questionData.audioUrl && questionData.audioUrl.includes('/api/temp-audio/')) {
            finalAudioUrl = await moveTemporaryAudioToPermanent(questionData.audioUrl);
          }

          // Move temporary question image to permanent location if exists
          let finalImageUrl = questionData.imageUrl;
          if (questionData.imageUrl && questionData.imageUrl.includes('/api/temp-question-images/')) {
            finalImageUrl = await moveTemporaryQuestionImageToPermanent(questionData.imageUrl);
          }
          
          const question = await storage.createQuestion({
            examId: exam.id,
            questionText: questionData.questionText,
            questionType: questionData.questionType || "multiple_choice",
            imageUrl: finalImageUrl || null,
            audioUrl: finalAudioUrl || null,
            options: questionData.options,
            correctAnswer: questionData.correctAnswer,
            explanation: questionData.explanation || null,
            sortOrder: i,
          });
          createdQuestions.push(question);
        }
      }

      res.json({
        exam,
        questions: createdQuestions,
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
      const { title, description, isDemo, timeLimit, isActive } = req.body;

      if (!title || !timeLimit) {
        return res.status(400).json({ 
          message: "Title and time limit are required" 
        });
      }

      const updatedExam = await storage.updateExam(id, {
        title,
        description: description || null,
        isDemo: isDemo || false,
        timeLimit,
        isActive: isActive !== undefined ? isActive : true,
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

      const { examId, category, description, descriptionImageUrl, descriptionAudioUrl, questionText, questionType, imageUrl, audioUrl, options, correctAnswer, explanation, sortOrder } = req.body;

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

      // Handle temporary audio file - move to permanent location
      let finalAudioUrl = audioUrl;
      if (audioUrl && audioUrl.includes('/api/temp-audio/')) {
        console.log(`Moving temporary audio: ${audioUrl}`);
        try {
          finalAudioUrl = await moveTemporaryAudioToPermanent(audioUrl);
          console.log(`Move result: ${finalAudioUrl}`);
          if (!finalAudioUrl) {
            console.warn("Failed to move temporary audio, setting to null");
            finalAudioUrl = null;
          }
        } catch (error) {
          console.error("Error moving temporary audio:", error);
          finalAudioUrl = null;
        }
      }

      // Handle temporary question image - move to permanent location
      let finalImageUrl = imageUrl;
      if (imageUrl && imageUrl.includes('/api/temp-question-images/')) {
        console.log(`Moving temporary question image: ${imageUrl}`);
        try {
          finalImageUrl = await moveTemporaryQuestionImageToPermanent(imageUrl);
          console.log(`Image move result: ${finalImageUrl}`);
          if (!finalImageUrl) {
            console.warn("Failed to move temporary question image, setting to null");
            finalImageUrl = null;
          }
        } catch (error) {
          console.error("Error moving temporary question image:", error);
          finalImageUrl = null;
        }
      }

      // Handle temporary description image - move to permanent location
      let finalDescriptionImageUrl = descriptionImageUrl;
      if (descriptionImageUrl && descriptionImageUrl.includes('/api/temp-description-images/')) {
        console.log(`Moving temporary description image: ${descriptionImageUrl}`);
        try {
          finalDescriptionImageUrl = await moveTemporaryDescriptionImageToPermanent(descriptionImageUrl);
          console.log(`Description image move result: ${finalDescriptionImageUrl}`);
          if (!finalDescriptionImageUrl) {
            console.warn("Failed to move temporary description image, setting to null");
            finalDescriptionImageUrl = null;
          }
        } catch (error) {
          console.error("Error moving temporary description image:", error);
          finalDescriptionImageUrl = null;
        }
      }

      // Handle temporary description audio - move to permanent location
      let finalDescriptionAudioUrl = descriptionAudioUrl;
      if (descriptionAudioUrl && descriptionAudioUrl.includes('/api/temp-description-audio/')) {
        console.log(`Moving temporary description audio: ${descriptionAudioUrl}`);
        try {
          finalDescriptionAudioUrl = await moveTemporaryDescriptionAudioToPermanent(descriptionAudioUrl);
          console.log(`Description audio move result: ${finalDescriptionAudioUrl}`);
          if (!finalDescriptionAudioUrl) {
            console.warn("Failed to move temporary description audio, setting to null");
            finalDescriptionAudioUrl = null;
          }
        } catch (error) {
          console.error("Error moving temporary description audio:", error);
          finalDescriptionAudioUrl = null;
        }
      }

      const question = await storage.createQuestion({
        examId: examId || null, // Can be null for standalone questions
        category: category || "ngữ pháp", // Default category if not provided
        description: description || null,
        descriptionImageUrl: finalDescriptionImageUrl || null,
        descriptionAudioUrl: finalDescriptionAudioUrl || null,
        questionText,
        questionType: questionType || "multiple_choice",
        imageUrl: finalImageUrl || null,
        audioUrl: finalAudioUrl || null,
        options,
        correctAnswer,
        explanation: explanation || null,
        sortOrder: sortOrder || 0,
      });

      res.status(201).json({
        question,
        message: "Question created successfully"
      });
    } catch (error) {
      console.error("Error creating question:", error);
      res.status(500).json({ message: "Failed to create question" });
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
      
      // Delete audio file from R2 storage if exists
      if (question.audioUrl) {
        const filename = question.audioUrl.split('/').pop();
        if (filename) {
          console.log(`Deleting audio file for question: ${filename}`);
          const deleteResult = await multiR2Storage.deleteAudio(filename);
          if (!deleteResult.success) {
            console.warn(`Failed to delete audio file ${filename}:`, deleteResult.error);
          } else {
            console.log(`Successfully deleted audio file: ${filename}`);
          }
        }
      }

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
  app.post("/api/temp-description-images/upload", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const uploadResult = await multiR2Storage.handleUpload(
        req,
        {
          provider: "primary",
          folder: "temp-description-images",
          allowedTypes: ["image/*"],
          maxSizeBytes: 5 * 1024 * 1024 // 5MB
        }
      );

      if (uploadResult.success && uploadResult.files && uploadResult.files.length > 0) {
        const file = uploadResult.files[0];
        console.log(`✓ Uploaded temporary description image: ${file.filename}`);
        res.json({
          success: true,
          filename: file.filename,
          url: `/api/temp-description-images/${file.filename}`,
          message: "Tạm lưu hình ảnh mô tả thành công"
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
  app.post("/api/temp-description-audio/upload", async (req, res) => {
    try {
      const sessionUser = (req.session as any)?.user;
      if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'manager')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const uploadResult = await multiR2Storage.handleUpload(
        req,
        {
          provider: "primary",
          folder: "temp-description-audio",
          allowedTypes: ["audio/*"],
          maxSizeBytes: 10 * 1024 * 1024 // 10MB
        }
      );

      if (uploadResult.success && uploadResult.files && uploadResult.files.length > 0) {
        const file = uploadResult.files[0];
        console.log(`✓ Uploaded temporary description audio: ${file.filename}`);
        res.json({
          success: true,
          filename: file.filename,
          url: `/api/temp-description-audio/${file.filename}`,
          message: "Tạm lưu audio mô tả thành công"
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
      
      if (downloadUrl) {
        // Proxy the audio
        try {
          const response = await fetch(downloadUrl);
          if (response.ok) {
            const contentType = response.headers.get('content-type') || 'audio/mpeg';
            res.set({
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=300', // 5 minute cache for temp files
              'Access-Control-Allow-Origin': '*'
            });
            
            const buffer = await response.arrayBuffer();
            return res.send(Buffer.from(buffer));
          }
        } catch (proxyError) {
          console.error("Error proxying temporary description audio:", proxyError);
        }
      }
      
      res.status(404).json({ error: "Temporary description audio not found" });
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

      const results = [];
      for (const filename of filenames) {
        const objectKey = `temp-description-images/${filename}`;
        const result = await multiR2Storage.deleteFile("primary", objectKey);
        results.push({ filename, success: result.success, error: result.error });
        
        if (result.success) {
          console.log(`✓ Cleaned up temporary description image: ${filename}`);
        } else {
          console.warn(`✗ Failed to cleanup temporary description image: ${filename} - ${result.error}`);
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

      const results = [];
      for (const filename of filenames) {
        const objectKey = `temp-description-audio/${filename}`;
        const result = await multiR2Storage.deleteFile("primary", objectKey);
        results.push({ filename, success: result.success, error: result.error });
        
        if (result.success) {
          console.log(`✓ Cleaned up temporary description audio: ${filename}`);
        } else {
          console.warn(`✗ Failed to cleanup temporary description audio: ${filename} - ${result.error}`);
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
