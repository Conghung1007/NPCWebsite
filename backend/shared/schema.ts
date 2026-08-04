import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, numeric, doublePrecision, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  fullName: text("full_name"), // Optional full name for certificate display
  email: text("email").unique(),
  phone: text("phone").unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // user, manager, admin
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contactRequests = pgTable("contact_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  service: text("service"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const articles = pgTable("articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"), // Add video URL field
  category: text("category").notNull(), // visa-services, study-abroad, japanese-training
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const uiImages = pgTable("ui_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imageUrl: text("image_url").notNull(),
  imageType: text("image_type").notNull(), // hero, service, testimonial, feature, ui
  altText: text("alt_text"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const registrationRequests = pgTable("registration_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  fullName: text("full_name"), // Optional full name for certificate display
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  password: text("password").notNull(), // Will be hashed
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by"), // Admin ID who reviewed
  rejectionReason: text("rejection_reason"),
});

// Online exam system tables
export const exams = pgTable("exams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  isDemo: boolean("is_demo").default(false), // Demo exams don't require login
  isActive: boolean("is_active").default(true),
  passingScore: integer("passing_score"), // Overall exam passing score (number of correct answers needed)
  
  // New flexible sections structure
  sections: jsonb("sections"), // Array of {id, sectionName, timeLimit, passingScore, content?, descriptionImageUrls?, descriptionAudioUrl?, questionSets: {id, name, questionIds}[]}
  
  // Legacy fields for backward compatibility (optional)
  vocabularyTimeLimit: integer("vocabulary_time_limit"), // Time limit in minutes
  vocabularyQuestions: jsonb("vocabulary_questions"), // Array of question IDs
  
  grammarTimeLimit: integer("grammar_time_limit"), // Time limit in minutes
  grammarQuestions: jsonb("grammar_questions"), // Array of question IDs
  
  listeningTimeLimit: integer("listening_time_limit"), // Time limit in minutes
  listeningQuestions: jsonb("listening_questions"), // Array of question IDs
  
  readingTimeLimit: integer("reading_time_limit"), // Time limit in minutes  
  readingQuestions: jsonb("reading_questions"), // Array of question IDs
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").notNull(), // Admin/Manager ID
});

export const questions = pgTable("questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentId: varchar("parent_id"), // NULL for parent questions, ID for sub-questions
  examId: varchar("exam_id"), // Now nullable - questions can exist independently
  category: text("category").notNull(), // từ vựng, ngữ pháp, đọc hiểu, nghe hiểu
  language: text("language").notNull().default("japanese"), // japanese, english, german
  questionTitle: text("question_title"), // Optional short title for easy identification and searching
  
  // Parent-level fields (only used when parentId is NULL)
  description: text("description"), // Mô tả hoặc ghi chú cho câu hỏi chính
  descriptionImageUrl: text("description_image_url"), // Legacy single image URL for backward compatibility
  descriptionImageUrls: jsonb("description_image_urls"), // Array of image URLs for description
  descriptionAudioUrl: text("description_audio_url"), // Optional audio for description
  
  // Question-level fields (used for both parent and sub-questions)
  questionText: text("question_text").notNull(),
  questionType: text("question_type").notNull().default("multiple_choice"), // multiple_choice, true_false
  imageUrl: text("image_url"), // Legacy single image URL for backward compatibility
  imageUrls: jsonb("image_urls"), // Array of image URLs for question
  audioUrl: text("audio_url"), // Optional audio for question
  options: jsonb("options").notNull(), // Array of answer options with potential image URLs
  correctAnswer: text("correct_answer").notNull(), // Index or value of correct answer
  explanation: text("explanation"), // Optional explanation for answer
  points: numeric("points", { precision: 10, scale: 2 }).notNull().default("1.0"), // Point value for this question (default 1.0, supports decimals like 1.5, 2.25)
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Junction table to link exams with questions from question bank
export const examQuestions = pgTable("exam_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  examId: varchar("exam_id").notNull(),
  questionId: varchar("question_id").notNull(),
  sortOrder: integer("sort_order").default(0), // Order of question in exam
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const examAttempts = pgTable("exam_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  examId: varchar("exam_id").notNull(),
  userId: varchar("user_id"), // Null for demo exams (anonymous)

  // in_progress | completed — in_progress = server-side draft/session
  status: text("status").notNull().default("completed"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  currentSectionId: varchar("current_section_id"),
  sectionStartedAt: timestamp("section_started_at"),
  lastSectionCompletedAt: timestamp("last_section_completed_at"),
  // UI resume payload (question order, indices, etc.)
  clientState: jsonb("client_state"),
  // Frozen correctAnswer/points (+ section pass thresholds) at submit time
  scoringSnapshot: jsonb("scoring_snapshot"),
  
  // New dynamic section results structure
  sectionResults: jsonb("section_results").notNull().default('[]'), // Array of { sectionId, type, answers, timeSpent, score }
  
  // Legacy section-specific answers and timing (kept for backward compatibility, now nullable)
  vocabularyAnswers: jsonb("vocabulary_answers"), // User's answers for vocabulary section
  vocabularyTimeSpent: integer("vocabulary_time_spent"), // Time spent in seconds
  vocabularyScore: integer("vocabulary_score"), // Score for vocabulary section
  
  grammarAnswers: jsonb("grammar_answers"), // User's answers for grammar section  
  grammarTimeSpent: integer("grammar_time_spent"), // Time spent in seconds
  grammarScore: integer("grammar_score"), // Score for grammar section
  
  listeningAnswers: jsonb("listening_answers"), // User's answers for listening section
  listeningTimeSpent: integer("listening_time_spent"), // Time spent in seconds  
  listeningScore: integer("listening_score"), // Score for listening section
  
  readingAnswers: jsonb("reading_answers"), // User's answers for reading section
  readingTimeSpent: integer("reading_time_spent"), // Time spent in seconds
  readingScore: integer("reading_score"), // Score for reading section
  
  // Total scores and timing (supports decimal question points like 1.5)
  totalScore: doublePrecision("total_score").notNull().default(0), // Final total score (points earned)
  totalTimeSpent: integer("total_time_spent").notNull().default(0), // Total time spent in seconds
  waitTimeBetweenSections: integer("wait_time_between_sections").notNull().default(0), // Wait time between sections in seconds
  
  completedAt: timestamp("completed_at"), // Null while in_progress
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  fullName: true,
  email: true,
  phone: true,
  password: true,
  role: true,
});


export const insertRegistrationRequestSchema = createInsertSchema(registrationRequests).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
  reviewedBy: true,
  rejectionReason: true,
  status: true,
});

// Registration form validation schema
export const registrationFormSchema = z.object({
  username: z.string()
    .min(8, "Tên đăng nhập phải có ít nhất 8 ký tự")
    .max(15, "Tên đăng nhập không được quá 15 ký tự")
    .regex(/^[a-zA-Z0-9_]+$/, "Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới"),
  fullName: z.string().optional(), // Optional full name for certificate display
  email: z.string()
    .email("Email không đúng định dạng")
    .min(1, "Email là bắt buộc"),
  phone: z.string()
    .regex(/^[0-9]{10,11}$/, "Số điện thoại phải có 10 hoặc 11 chữ số"),
  password: z.string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
    .regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, "Mật khẩu phải có ít nhất 1 chữ hoa, 1 số và 1 ký tự đặc biệt"),
  confirmPassword: z.string(),
  agreeToTerms: z.boolean().refine(val => val === true, "Bạn phải đồng ý với điều khoản dịch vụ"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Xác nhận mật khẩu không khớp",
  path: ["confirmPassword"],
});

export const insertContactRequestSchema = createInsertSchema(contactRequests).omit({
  id: true,
  createdAt: true,
});

export const insertArticleSchema = createInsertSchema(articles).omit({
  id: true,
  createdAt: true,
});

export const insertUiImageSchema = createInsertSchema(uiImages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Exam system schemas
export const insertExamSchema = createInsertSchema(exams).omit({
  id: true,
  createdAt: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
  createdAt: true,
});

export const insertExamQuestionSchema = createInsertSchema(examQuestions).omit({
  id: true,
  createdAt: true,
});

// Section result type for dynamic sections
export const sectionResultSchema = z.object({
  sectionId: z.string(),
  type: z.string(),
  answers: z.record(z.string(), z.string()), // questionId -> answer
  timeSpent: z.number(),
  score: z.number(),
});

export const insertExamAttemptSchema = createInsertSchema(examAttempts).omit({
  id: true,
  // Omit legacy fields - use sectionResults instead
  vocabularyAnswers: true,
  vocabularyTimeSpent: true,
  vocabularyScore: true,
  grammarAnswers: true,
  grammarTimeSpent: true,
  grammarScore: true,
  listeningAnswers: true,
  listeningTimeSpent: true,
  listeningScore: true,
  readingAnswers: true,
  readingTimeSpent: true,
  readingScore: true,
}).extend({
  sectionResults: z.array(sectionResultSchema),
  status: z.enum(["in_progress", "completed"]).optional(),
  completedAt: z.date().nullable().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Contact information table
export const contactInfo = pgTable("contact_info", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(), // 'main_office', 'hotline', 'email', 'business_hours'
  title: varchar("title").notNull(),
  content: text("content").array().notNull().default(sql`'{}'::text[]`),
  mapUrl: text("map_url"), // Google Maps embed URL for office locations
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ContactInfo = typeof contactInfo.$inferSelect;
export type InsertContactInfo = typeof contactInfo.$inferInsert;
export type ContactRequest = typeof contactRequests.$inferSelect;
export type InsertContactRequest = z.infer<typeof insertContactRequestSchema>;
export type Article = typeof articles.$inferSelect;
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type UiImage = typeof uiImages.$inferSelect;
export type InsertUiImage = z.infer<typeof insertUiImageSchema>;
export type RegistrationRequest = typeof registrationRequests.$inferSelect;
export type InsertRegistrationRequest = z.infer<typeof insertRegistrationRequestSchema>;
export type RegistrationFormData = z.infer<typeof registrationFormSchema>;

// Homepage testimonials (CMS)
export const testimonials = pgTable("testimonials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  avatarUrl: text("avatar_url"),
  rating: integer("rating").default(5),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTestimonialSchema = createInsertSchema(testimonials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTestimonialSchema = insertTestimonialSchema.partial();

export type Testimonial = typeof testimonials.$inferSelect;
export type InsertTestimonial = z.infer<typeof insertTestimonialSchema>;

// Editable page copy (CMS key/value, replaces localStorage)
export const siteContents = pgTable(
  "site_contents",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    page: text("page").notNull().default("home"),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pageKeyIdx: uniqueIndex("site_contents_page_key_idx").on(table.page, table.key),
  }),
);

export const upsertSiteContentSchema = z.object({
  page: z.string().min(1).default("home"),
  key: z.string().min(1),
  value: z.string(),
});

export const bulkUpsertSiteContentSchema = z.object({
  page: z.string().min(1).default("home"),
  entries: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string(),
    }),
  ),
});

export type SiteContent = typeof siteContents.$inferSelect;
export type UpsertSiteContent = z.infer<typeof upsertSiteContentSchema>;

// --- Japanese class catalog + commerce ---

export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  level: text("level").notNull().default("N5"), // N5, N4, N3, N2, N1, other
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  isPublished: boolean("is_published").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const classSessions = pgTable("class_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  title: text("title").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  scheduleText: text("schedule_text"), // e.g. T2–T4 18:00–20:00
  locationNote: text("location_note"), // offline address / online note
  priceVnd: integer("price_vnd").notNull().default(0),
  capacity: integer("capacity").notNull().default(10),
  enrolledCount: integer("enrolled_count").notNull().default(0),
  reservedCount: integer("reserved_count").notNull().default(0), // pending checkouts
  status: text("status").notNull().default("draft"), // draft | published | full | closed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const carts = pgTable("carts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guestToken: text("guest_token"),
  userId: varchar("user_id"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    cartId: varchar("cart_id").notNull(),
    classSessionId: varchar("class_session_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    cartClassUnique: uniqueIndex("cart_items_cart_class_idx").on(
      table.cartId,
      table.classSessionId,
    ),
  }),
);

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // human-readable e.g. NPC-...
  payosOrderCode: integer("payos_order_code").notNull().unique(), // PayOS numeric orderCode
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  note: text("note"),
  userId: varchar("user_id"),
  totalVnd: integer("total_vnd").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending | paid | failed | cancelled | expired
  paymentLinkId: text("payment_link_id"),
  checkoutUrl: text("checkout_url"),
  paidAt: timestamp("paid_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  classSessionId: varchar("class_session_id").notNull(),
  title: text("title").notNull(),
  scheduleText: text("schedule_text"),
  priceVnd: integer("price_vnd").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const enrollments = pgTable(
  "enrollments",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    classSessionId: varchar("class_session_id").notNull(),
    orderId: varchar("order_id").notNull(),
    userId: varchar("user_id"),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    classPhoneUnique: uniqueIndex("enrollments_class_phone_idx").on(
      table.classSessionId,
      table.phone,
    ),
  }),
);

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClassSessionSchema = createInsertSchema(classSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  enrolledCount: true,
  reservedCount: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type ClassSession = typeof classSessions.$inferSelect;
export type InsertClassSession = z.infer<typeof insertClassSessionSchema>;
export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;


// Exam system types
export type Exam = typeof exams.$inferSelect;
export type InsertExam = z.infer<typeof insertExamSchema>;
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type ExamQuestion = typeof examQuestions.$inferSelect;
export type InsertExamQuestion = z.infer<typeof insertExamQuestionSchema>;
export type ExamAttempt = typeof examAttempts.$inferSelect;
export type InsertExamAttempt = z.infer<typeof insertExamAttemptSchema>;

// Question Set in the exam editor UI (hydrated with Question objects)
export interface QuestionSet {
  id: string;
  name: string;
  questions: Question[];
}

// Question Set as stored in exams.sections JSONB
export interface StoredQuestionSet {
  id: string;
  name: string;
  questionIds: string[];
}
