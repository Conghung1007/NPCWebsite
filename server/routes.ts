import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactRequestSchema, insertArticleSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Users endpoint - for managers only
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const safeUsers = users.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi lấy danh sách người dùng" });
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

      const user = await storage.authenticateUser(username, password);
      
      if (user) {
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
  app.get("/api/contact-requests", async (req, res) => {
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
        message: "Không thể lấy danh sách bài viết" 
      });
    }
  });

  app.get("/api/articles/:id", async (req, res) => {
    try {
      const article = await storage.getArticle(req.params.id);
      if (!article) {
        return res.status(404).json({ 
          success: false, 
          message: "Không tìm thấy bài viết" 
        });
      }
      res.json(article);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Không thể lấy bài viết" 
      });
    }
  });

  app.post("/api/articles", async (req, res) => {
    try {
      const articleData = insertArticleSchema.parse(req.body);
      const article = await storage.createArticle(articleData);
      res.json({ success: true, article });
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
          message: "Có lỗi xảy ra khi tạo bài viết" 
        });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
