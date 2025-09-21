import { type User, type InsertUser, type ContactRequest, type InsertContactRequest, type ContactInfo, type InsertContactInfo, type Article, type InsertArticle, type UiImage, type InsertUiImage, type RegistrationRequest, type InsertRegistrationRequest, type Exam, type InsertExam, type Question, type InsertQuestion, type ExamAttempt, type InsertExamAttempt } from "@shared/schema";
import { users, contactRequests, contactInfo, articles, uiImages, registrationRequests, exams, questions, examAttempts } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, userData: Partial<InsertUser>): Promise<User | null>;
  deleteUser(id: string): Promise<boolean>;
  authenticateUser(username: string, password: string): Promise<User | null>;
  getAllUsers(): Promise<User[]>;
  
  createContactRequest(request: InsertContactRequest): Promise<ContactRequest>;
  getContactRequests(): Promise<ContactRequest[]>;
  deleteContactRequest(id: string): Promise<boolean>;
  
  // Contact Info methods
  createContactInfo(contactInfo: InsertContactInfo): Promise<ContactInfo>;
  getContactInfo(): Promise<ContactInfo[]>;
  getContactInfoById(id: string): Promise<ContactInfo | undefined>;
  updateContactInfo(id: string, updateData: Partial<InsertContactInfo>): Promise<ContactInfo | null>;
  deleteContactInfo(id: string): Promise<boolean>;
  
  createArticle(article: InsertArticle): Promise<Article>;
  getArticlesByCategory(category: string): Promise<Article[]>;
  getAllArticles(): Promise<Article[]>;
  getArticles(): Promise<Article[]>;
  getArticle(id: string): Promise<Article | undefined>;
  updateArticle(id: string, updateData: { title: string; content: string; category: string; imageUrl?: string | null; sortOrder?: number }): Promise<Article | null>;
  deleteArticle(id: string): Promise<boolean>;
  moveArticleOrder(id: string, direction: 'up' | 'down'): Promise<boolean>;
  
  // UI Images methods
  createUiImage(uiImage: InsertUiImage): Promise<UiImage>;
  getUiImagesByType(imageType: string): Promise<UiImage[]>;
  getAllUiImages(): Promise<UiImage[]>;
  updateUiImage(id: string, updateData: Partial<InsertUiImage>): Promise<UiImage | null>;
  updateUiImageByType(imageType: string, updateData: Partial<InsertUiImage>): Promise<UiImage | null>;
  deleteUiImage(id: string): Promise<boolean>;
  getUiImageByType(imageType: string): Promise<UiImage | undefined>;
  
  // Registration request methods
  createRegistrationRequest(request: InsertRegistrationRequest): Promise<RegistrationRequest>;
  getAllRegistrationRequests(): Promise<RegistrationRequest[]>;
  getRegistrationRequest(id: string): Promise<RegistrationRequest | undefined>;
  updateRegistrationRequestStatus(id: string, status: 'approved' | 'rejected', reviewedBy: string, rejectionReason?: string): Promise<RegistrationRequest | null>;
  deleteRegistrationRequest(id: string): Promise<boolean>;
  checkUsernameExists(username: string): Promise<boolean>;
  checkEmailExists(email: string): Promise<boolean>;
  checkPhoneExists(phone: string): Promise<boolean>;
  
  // Exam system methods
  createExam(exam: InsertExam): Promise<Exam>;
  getExam(id: string): Promise<Exam | undefined>;
  getAllExams(): Promise<Exam[]>;
  getActiveExams(): Promise<Exam[]>;
  updateExam(id: string, updateData: Partial<InsertExam>): Promise<Exam | null>;
  deleteExam(id: string): Promise<boolean>;
  
  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestion(id: string): Promise<Question | undefined>;
  getAllQuestions(): Promise<Question[]>;
  getQuestionsByCategory(category: string): Promise<Question[]>;
  searchQuestions(searchTerm: string): Promise<Question[]>;
  getQuestionsByExamId(examId: string): Promise<Question[]>;
  updateQuestion(id: string, updateData: Partial<InsertQuestion>): Promise<Question | null>;
  deleteQuestion(id: string): Promise<boolean>;
  
  // Exam-Question junction table methods
  addQuestionToExam(examId: string, questionId: string, sortOrder?: number): Promise<boolean>;
  removeQuestionFromExam(examId: string, questionId: string): Promise<boolean>;
  getExamQuestions(examId: string): Promise<Question[]>;
  
  createExamAttempt(attempt: InsertExamAttempt): Promise<ExamAttempt>;
  getExamAttempt(id: string): Promise<ExamAttempt | undefined>;
  getExamAttemptsByUserId(userId: string): Promise<ExamAttempt[]>;
  getExamAttemptsByExamId(examId: string): Promise<ExamAttempt[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private contactRequests: Map<string, ContactRequest>;
  private contactInfos: Map<string, ContactInfo>;
  private articles: Map<string, Article>;
  private uiImages: Map<string, UiImage>;
  private registrationRequests: Map<string, RegistrationRequest>;
  private exams: Map<string, Exam>;
  private questions: Map<string, Question>;
  private examAttempts: Map<string, ExamAttempt>;

  constructor() {
    this.users = new Map();
    this.contactRequests = new Map();
    this.contactInfos = new Map();
    this.articles = new Map();
    this.uiImages = new Map();
    this.registrationRequests = new Map();
    this.exams = new Map();
    this.questions = new Map();
    this.examAttempts = new Map();
    this.seedUsers();
    this.seedArticles();
    this.seedExams();
    console.log(`Seeded ${this.articles.size} articles and ${this.exams.size} exams`);
  }



  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      email: insertUser.email ?? null,
      phone: insertUser.phone ?? null,
      role: insertUser.role || "user",
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async authenticateUser(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (user && user.password === password) {
      return user;
    }
    return null;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | null> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      return null;
    }
    
    const updatedUser: User = {
      ...existingUser,
      ...userData,
      id, // Keep original id
      createdAt: existingUser.createdAt, // Keep original creation date
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    // Get user info before deleting
    const user = this.users.get(id);
    if (!user) return false;
    
    // Delete the user
    const userDeleted = this.users.delete(id);
    
    // Also delete any registration request with the same username (regardless of status)
    const registrationToDelete = Array.from(this.registrationRequests.entries()).find(
      ([, request]) => request.username.toLowerCase() === user.username.toLowerCase()
    );
    
    if (registrationToDelete) {
      this.registrationRequests.delete(registrationToDelete[0]);
    }
    
    return userDeleted;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createContactRequest(insertRequest: InsertContactRequest): Promise<ContactRequest> {
    const id = randomUUID();
    const request: ContactRequest = {
      ...insertRequest,
      id,
      service: insertRequest.service || null,
      createdAt: new Date(),
    };
    this.contactRequests.set(id, request);
    return request;
  }

  async getContactRequests(): Promise<ContactRequest[]> {
    return Array.from(this.contactRequests.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async deleteContactRequest(id: string): Promise<boolean> {
    return this.contactRequests.delete(id);
  }

  // ContactInfo methods for MemStorage
  async createContactInfo(contactInfoData: InsertContactInfo): Promise<ContactInfo> {
    const id = randomUUID();
    const contactInfo: ContactInfo = {
      ...contactInfoData,
      id,
      content: contactInfoData.content ?? [],
      mapUrl: contactInfoData.mapUrl ?? null,
      displayOrder: contactInfoData.displayOrder ?? null,
      isActive: contactInfoData.isActive ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.contactInfos.set(id, contactInfo);
    return contactInfo;
  }

  async getContactInfo(): Promise<ContactInfo[]> {
    return Array.from(this.contactInfos.values())
      .filter(info => info.isActive)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  async getContactInfoById(id: string): Promise<ContactInfo | undefined> {
    return this.contactInfos.get(id);
  }

  async updateContactInfo(id: string, updateData: Partial<InsertContactInfo>): Promise<ContactInfo | null> {
    const existingInfo = this.contactInfos.get(id);
    if (!existingInfo) {
      return null;
    }

    const updatedInfo: ContactInfo = {
      ...existingInfo,
      ...updateData,
      id,
      updatedAt: new Date(),
    };

    this.contactInfos.set(id, updatedInfo);
    return updatedInfo;
  }

  async deleteContactInfo(id: string): Promise<boolean> {
    return this.contactInfos.delete(id);
  }

  async createArticle(insertArticle: InsertArticle): Promise<Article> {
    const id = randomUUID();
    const article: Article = {
      ...insertArticle,
      id,
      imageUrl: insertArticle.imageUrl || null,
      videoUrl: insertArticle.videoUrl ?? null,
      sortOrder: insertArticle.sortOrder || 0,
      createdAt: new Date(),
    };
    this.articles.set(id, article);
    return article;
  }

  async getArticlesByCategory(category: string): Promise<Article[]> {
    return Array.from(this.articles.values())
      .filter(article => article.category === category)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAllArticles(): Promise<Article[]> {
    return Array.from(this.articles.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getArticle(id: string): Promise<Article | undefined> {
    return this.articles.get(id);
  }

  async getArticles(): Promise<Article[]> {
    return this.getAllArticles();
  }

  async updateArticle(id: string, updateData: { title: string; content: string; category: string; imageUrl?: string | null; sortOrder?: number }): Promise<Article | null> {
    const existingArticle = this.articles.get(id);
    if (!existingArticle) {
      return null;
    }
    
    const updatedArticle = {
      ...existingArticle,
      title: updateData.title,
      content: updateData.content,
      category: updateData.category,
      imageUrl: updateData.imageUrl !== undefined ? updateData.imageUrl : existingArticle.imageUrl,
      sortOrder: updateData.sortOrder !== undefined ? updateData.sortOrder : existingArticle.sortOrder,
    };
    
    this.articles.set(id, updatedArticle);
    return updatedArticle;
  }

  async deleteArticle(id: string): Promise<boolean> {
    return this.articles.delete(id);
  }

  async moveArticleOrder(id: string, direction: 'up' | 'down'): Promise<boolean> {
    const article = this.articles.get(id);
    if (!article) return false;

    const allArticles = Array.from(this.articles.values());
    const sortedArticles = allArticles.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const currentIndex = sortedArticles.findIndex(a => a.id === id);
    
    if (currentIndex === -1) return false;
    
    let targetIndex: number;
    if (direction === 'up' && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    } else if (direction === 'down' && currentIndex < sortedArticles.length - 1) {
      targetIndex = currentIndex + 1;
    } else {
      return false; // Can't move further
    }

    // Swap sort orders
    const currentOrder = sortedArticles[currentIndex].sortOrder || 0;
    const targetOrder = sortedArticles[targetIndex].sortOrder || 0;
    
    const updatedCurrent = { ...sortedArticles[currentIndex], sortOrder: targetOrder };
    const updatedTarget = { ...sortedArticles[targetIndex], sortOrder: currentOrder };
    
    this.articles.set(updatedCurrent.id, updatedCurrent);
    this.articles.set(updatedTarget.id, updatedTarget);
    
    return true;
  }

  private seedUsers(): void {
    const defaultUsers = [
      {
        id: randomUUID(),
        username: "manager1",
        password: "123456",
        role: "manager",
        createdAt: new Date()
      },
      {
        id: randomUUID(),
        username: "manager2", 
        password: "123456",
        role: "manager",
        createdAt: new Date()
      },
      {
        id: randomUUID(),
        username: "admin1",
        password: "123456", 
        role: "admin",
        createdAt: new Date()
      },
      {
        id: randomUUID(),
        username: "admin2",
        password: "123456",
        role: "admin", 
        createdAt: new Date()
      },
      {
        id: randomUUID(),
        username: "admin3",
        password: "123456",
        role: "admin",
        createdAt: new Date()
      }
    ];

    defaultUsers.forEach(user => {
      this.users.set(user.id, user as User);
    });
  }

  private seedArticles(): void {
    const visaArticles = [
      {
        id: "b8626045-b352-42ef-a92d-9cc61658450b",
        title: "Hướng dẫn xin visa du lịch Nhật Bản",
        content: "Quy trình xin visa du lịch Nhật Bản đơn giản và nhanh chóng với N&P Company...",
        imageUrl: null as string | null,
        category: "visa-services",
        createdAt: new Date("2025-08-02T05:14:15.817Z")
      },
      {
        id: randomUUID(),
        title: "Hướng dẫn xin visa du lịch Nhật Bản 2024",
        content: "Visa du lịch Nhật Bản là loại visa ngắn hạn cho phép bạn nhập cảnh vào Nhật Bản với mục đích du lịch, thăm thân, tham dự hội nghị... Thời gian lưu trú tối đa là 90 ngày. Để xin visa du lịch Nhật Bản, bạn cần chuẩn bị đầy đủ hồ sơ theo quy định của Lãnh sự quán Nhật Bản tại Việt Nam.",
        imageUrl: null as string | null,
        category: "visa-services",
        createdAt: new Date(Date.now() - 86400000 * 1)
      },
      {
        id: randomUUID(),
        title: "Thủ tục xin visa Hàn Quốc nhanh chóng",
        content: "Visa Hàn Quốc hiện được nhiều người Việt Nam quan tâm do chính sách visa thuận lợi và mối quan hệ tốt đẹp giữa hai nước. Chúng tôi cung cấp dịch vụ hỗ trợ xin visa Hàn Quốc với tỷ lệ thành công cao và thời gian xử lý nhanh chóng.",
        imageUrl: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=400&fit=crop" as string | null,
        category: "visa-services",
        createdAt: new Date(Date.now() - 86400000 * 2)
      },
      {
        id: randomUUID(),
        title: "Visa Úc - Cơ hội định cư và làm việc",
        content: "Úc là một trong những điểm đến hấp dẫn nhất cho việc định cư và làm việc. Với chính sách nhập cư mở và nhiều cơ hội việc làm, visa Úc đang được rất nhiều người quan tâm. Chúng tôi tư vấn các loại visa Úc phù hợp với từng trường hợp.",
        imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop" as string | null,
        category: "visa-services",
        createdAt: new Date(Date.now() - 86400000 * 3)
      },
      {
        id: randomUUID(),
        title: "Visa Schengen - Khám phá 27 nước Châu Âu",
        content: "Với một visa Schengen, bạn có thể tự do di chuyển giữa 27 quốc gia thành viên trong khu vực Schengen. Đây là lựa chọn tuyệt vời cho những ai muốn khám phá nhiều nước Châu Âu trong một chuyến đi duy nhất.",
        imageUrl: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800&h=400&fit=crop" as string | null,
        category: "visa-services",
        createdAt: new Date(Date.now() - 86400000 * 4)
      },
      {
        id: randomUUID(),
        title: "Cập nhật quy định visa Mỹ mới nhất",
        content: "Chính phủ Mỹ đã có những thay đổi quan trọng trong quy định thị thực năm 2024. Thời gian xét duyệt đã được rút ngắn và có thêm nhiều loại visa mới dành cho các ngành nghề chuyên môn cao, tạo thuận lợi cho người Việt Nam.",
        imageUrl: "https://images.unsplash.com/photo-1542224566-6e85f2e6772f?w=800&h=400&fit=crop" as string | null,
        category: "visa-services",
        createdAt: new Date(Date.now() - 86400000 * 5)
      },
      {
        id: randomUUID(),
        title: "Visa transit - Khi nào cần và cách làm",
        content: "Visa transit cần thiết khi bạn quá cảnh tại một số quốc gia trên đường đến điểm đến cuối cùng. Tìm hiểu khi nào cần visa transit và cách chuẩn bị hồ sơ phù hợp để tránh những rắc rối không mong muốn.",
        imageUrl: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&h=400&fit=crop" as string | null,
        category: "visa-services",
        createdAt: new Date(Date.now() - 86400000 * 6)
      }
    ];

    const studyArticles = [
      {
        id: "053842fe-3da6-4978-aba1-b6463c54a022",
        title: "Du học Nhật Bản - Cơ hội vàng",
        content: "Chương trình du học Nhật Bản với học bổng hấp dẫn và cơ hội việc làm cao...",
        imageUrl: null as string | null,
        category: "study-abroad",
        createdAt: new Date("2025-08-02T05:14:15.817Z")
      },
      {
        id: randomUUID(),
        title: "Du học Nhật Bản - Cơ hội vàng năm 2024",
        content: "Nhật Bản với nền giáo dục chất lượng cao, môi trường học tập an toàn và nhiều cơ hội việc làm sau tốt nghiệp đang thu hút ngày càng nhiều sinh viên Việt Nam. Chúng tôi tư vấn miễn phí về các trường đại học, học phí và thủ tục du học Nhật Bản.",
        imageUrl: null as string | null,
        category: "study-abroad",
        createdAt: new Date(Date.now() - 86400000 * 1)
      },
      {
        id: randomUUID(),
        title: "Du học Canada - Chương trình CES mới nhất",
        content: "Canada với chính sách nhập cư thuận lợi và chất lượng giáo dục hàng đầu thế giới là lựa chọn tuyệt vời cho du học sinh. Chương trình CES (Canadian Experience Class) tạo cơ hội định cư sau khi tốt nghiệp cho sinh viên quốc tế.",
        imageUrl: "https://images.unsplash.com/photo-1503614472-8c93d56cd601?w=800&h=400&fit=crop" as string | null,
        category: "study-abroad",
        createdAt: new Date(Date.now() - 86400000 * 2)
      },
      {
        id: randomUUID(),
        title: "Du học Đức - Học phí thấp, chất lượng cao",
        content: "Đức nổi tiếng với hệ thống giáo dục đại học miễn phí học phí cho sinh viên quốc tế tại các trường đại học công lập. Đây là cơ hội tuyệt vời để có được bằng cấp chất lượng châu Âu với chi phí thấp.",
        imageUrl: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800&h=400&fit=crop" as string | null,
        category: "study-abroad",
        createdAt: new Date(Date.now() - 86400000 * 3)
      },
      {
        id: randomUUID(),
        title: "Du học Mỹ - Hệ thống giáo dục hàng đầu",
        content: "Mỹ là điểm đến du học hàng đầu với nhiều trường đại học danh tiếng thế giới. Chúng tôi hỗ trợ sinh viên từ việc chọn trường, chuẩn bị hồ sơ, đến xin học bổng và visa F-1 để thực hiện ước mơ du học Mỹ.",
        imageUrl: "https://images.unsplash.com/photo-1569950044794-e4bfcf66a5e4?w=800&h=400&fit=crop" as string | null,
        category: "study-abroad",
        createdAt: new Date(Date.now() - 86400000 * 4)
      },
      {
        id: randomUUID(),
        title: "Du học Úc - Môi trường học tập lý tưởng",
        content: "Úc với môi trường học tập an toàn, chất lượng giáo dục cao và chính sách định cư thuận lợi đang trở thành lựa chọn hàng đầu của sinh viên Việt Nam. Nhiều trường đại học Úc nằm trong top thế giới với học bổng hấp dẫn.",
        imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop" as string | null,
        category: "study-abroad",
        createdAt: new Date(Date.now() - 86400000 * 5)
      },
      {
        id: randomUUID(),
        title: "Du học Singapore - Trung tâm giáo dục Đông Nam Á",
        content: "Singapore với vị trí địa lý thuận lợi, nền giáo dục chất lượng cao và nhiều cơ hội việc làm sau tốt nghiệp là lựa chọn tuyệt vời cho du học sinh. Chi phí du học hợp lý và gần Việt Nam tạo thuận lợi cho gia đình.",
        imageUrl: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&h=400&fit=crop" as string | null,
        category: "study-abroad",
        createdAt: new Date(Date.now() - 86400000 * 6)
      }
    ];

    const japaneseArticles = [
      {
        id: "ef59f661-131a-4e90-9d73-3e42d2791da4",
        title: "Khóa học tiếng Nhật cơ bản",
        content: "Học tiếng Nhật từ cơ bản đến nâng cao với giáo viên bản ngữ...",
        imageUrl: null as string | null,
        category: "japanese-training",
        createdAt: new Date("2025-08-02T05:14:15.817Z")
      },
      {
        id: randomUUID(),
        title: "Khóa học tiếng Nhật N5 cơ bản",
        content: "Khóa học tiếng Nhật N5 dành cho người mới bắt đầu, giúp học viên nắm vững các kiến thức cơ bản về ngữ pháp, từ vựng và Hiragana, Katakana. Sau khóa học, học viên có thể đạt trình độ N5 theo tiêu chuẩn JLPT.",
        imageUrl: null as string | null,
        category: "japanese-training",
        createdAt: new Date(Date.now() - 86400000 * 1)
      },
      {
        id: randomUUID(),
        title: "Luyện thi JLPT N3 - Bước đệm quan trọng",
        content: "Trình độ N3 là bước đệm quan trọng trong việc học tiếng Nhật, đánh dấu sự chuyển từ trình độ cơ bản lên trung cấp. Khóa học này tập trung vào ngữ pháp phức tạp và từ vựng chuyên ngành, chuẩn bị tốt nhất cho kỳ thi JLPT.",
        imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=400&fit=crop" as string | null,
        category: "japanese-training",
        createdAt: new Date(Date.now() - 86400000 * 2)
      },
      {
        id: randomUUID(),
        title: "Tiếng Nhật giao tiếp dành cho người đi làm",
        content: "Khóa học tiếng Nhật giao tiếp thực tế trong môi trường làm việc, giúp học viên tự tin giao tiếp với đồng nghiệp và khách hàng Nhật Bản. Nội dung bao gồm keigo (kính ngữ), email business và presentation.",
        imageUrl: "https://images.unsplash.com/photo-1515378791036-0648a814c963?w=800&h=400&fit=crop" as string | null,
        category: "japanese-training",
        createdAt: new Date(Date.now() - 86400000 * 3)
      },
      {
        id: randomUUID(),
        title: "Luyện thi JLPT N2 - Nâng cao kỹ năng",
        content: "Trình độ N2 là mục tiêu của nhiều người học tiếng Nhật để có thể làm việc tại Nhật Bản. Khóa học N2 tập trung vào kanji phức tạp, ngữ pháp nâng cao và kỹ năng đọc hiểu văn bản chuyên môn.",
        imageUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=400&fit=crop" as string | null,
        category: "japanese-training",
        createdAt: new Date(Date.now() - 86400000 * 4)
      },
      {
        id: randomUUID(),
        title: "Tiếng Nhật cho trẻ em - Học qua trò chơi",
        content: "Khóa học tiếng Nhật dành riêng cho trẻ em từ 6-12 tuổi với phương pháp học qua trò chơi, hình ảnh và hoạt động vui nhộn. Giúp trẻ phát triển tự nhiên khả năng ngôn ngữ và tình yêu với văn hóa Nhật Bản.",
        imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=400&fit=crop" as string | null,
        category: "japanese-training",
        createdAt: new Date(Date.now() - 86400000 * 5)
      },
      {
        id: randomUUID(),
        title: "Kỹ năng phỏng vấn xin việc bằng tiếng Nhật",
        content: "Chuẩn bị kỹ năng phỏng vấn bằng tiếng Nhật để gia tăng cơ hội xin việc thành công. Khóa học bao gồm cách trả lời câu hỏi phổ biến, ngôn ngữ cơ thể và cách thể hiện bản thân một cách ấn tượng.",
        imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=400&fit=crop" as string | null,
        category: "japanese-training",
        createdAt: new Date(Date.now() - 86400000 * 6)
      }
    ];



    const allArticles = [...visaArticles, ...studyArticles, ...japaneseArticles];
    console.log(`Creating ${allArticles.length} articles`);
    allArticles.forEach(article => {
      console.log(`Adding article: ${article.title}`);
      this.articles.set(article.id, article as Article);
    });
  }

  // UI Images methods
  async createUiImage(uiImageData: InsertUiImage): Promise<UiImage> {
    const id = randomUUID();
    const uiImage: UiImage = {
      ...uiImageData,
      id,
      altText: uiImageData.altText ?? null,
      description: uiImageData.description ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.uiImages.set(id, uiImage);
    return uiImage;
  }

  async getUiImagesByType(imageType: string): Promise<UiImage[]> {
    return Array.from(this.uiImages.values()).filter(
      (image) => image.imageType === imageType
    );
  }

  async getAllUiImages(): Promise<UiImage[]> {
    return Array.from(this.uiImages.values());
  }

  async updateUiImage(id: string, updateData: Partial<InsertUiImage>): Promise<UiImage | null> {
    const existingImage = this.uiImages.get(id);
    if (!existingImage) {
      return null;
    }

    const updatedImage: UiImage = {
      ...existingImage,
      ...updateData,
      updatedAt: new Date()
    };

    this.uiImages.set(id, updatedImage);
    return updatedImage;
  }

  async updateUiImageByType(imageType: string, updateData: Partial<InsertUiImage>): Promise<UiImage | null> {
    const existingImage = Array.from(this.uiImages.values()).find(img => img.imageType === imageType);
    if (!existingImage) {
      return null;
    }

    const updatedImage: UiImage = {
      ...existingImage,
      ...updateData,
      updatedAt: new Date()
    };

    this.uiImages.set(existingImage.id, updatedImage);
    return updatedImage;
  }

  async deleteUiImage(id: string): Promise<boolean> {
    return this.uiImages.delete(id);
  }

  async getUiImageByType(imageType: string): Promise<UiImage | undefined> {
    return Array.from(this.uiImages.values()).find(
      (image) => image.imageType === imageType
    );
  }

  // Registration request methods
  async createRegistrationRequest(request: InsertRegistrationRequest): Promise<RegistrationRequest> {
    const id = randomUUID();
    const registrationRequest: RegistrationRequest = {
      ...request,
      id,
      status: "pending",
      createdAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null
    };
    this.registrationRequests.set(id, registrationRequest);
    return registrationRequest;
  }

  async getAllRegistrationRequests(): Promise<RegistrationRequest[]> {
    return Array.from(this.registrationRequests.values());
  }

  async getRegistrationRequest(id: string): Promise<RegistrationRequest | undefined> {
    return this.registrationRequests.get(id);
  }

  async updateRegistrationRequestStatus(id: string, status: 'approved' | 'rejected', reviewedBy: string, rejectionReason?: string): Promise<RegistrationRequest | null> {
    const request = this.registrationRequests.get(id);
    if (!request) {
      return null;
    }

    const updatedRequest: RegistrationRequest = {
      ...request,
      status,
      reviewedAt: new Date(),
      reviewedBy,
      rejectionReason: rejectionReason || null
    };

    this.registrationRequests.set(id, updatedRequest);
    return updatedRequest;
  }

  async deleteRegistrationRequest(id: string): Promise<boolean> {
    return this.registrationRequests.delete(id);
  }

  async checkUsernameExists(username: string): Promise<boolean> {
    // Check both existing users and pending registration requests only
    const existingUser = Array.from(this.users.values()).find(user => 
      user.username.toLowerCase() === username.toLowerCase()
    );
    const existingRequest = Array.from(this.registrationRequests.values()).find(request => 
      request.username.toLowerCase() === username.toLowerCase() && request.status === 'pending'
    );
    return !!(existingUser || existingRequest);
  }

  async checkEmailExists(email: string): Promise<boolean> {
    // Check both existing users and pending registration requests only
    const existingUser = Array.from(this.users.values()).find(user => 
      user.email?.toLowerCase() === email.toLowerCase()
    );
    const existingRequest = Array.from(this.registrationRequests.values()).find(request => 
      request.email.toLowerCase() === email.toLowerCase() && request.status === 'pending'
    );
    return !!(existingUser || existingRequest);
  }

  async checkPhoneExists(phone: string): Promise<boolean> {
    // Check both existing users and pending registration requests only
    const existingUser = Array.from(this.users.values()).find(user => 
      user.phone === phone
    );
    const existingRequest = Array.from(this.registrationRequests.values()).find(request => 
      request.phone === phone && request.status === 'pending'
    );
    return !!(existingUser || existingRequest);
  }

  // Exam system methods
  async createExam(insertExam: InsertExam): Promise<Exam> {
    const id = randomUUID();
    const exam: Exam = {
      ...insertExam,
      id,
      description: insertExam.description ?? null,
      isDemo: insertExam.isDemo ?? null,
      isActive: insertExam.isActive ?? null,
      createdAt: new Date(),
    };
    this.exams.set(id, exam);
    return exam;
  }

  async getExam(id: string): Promise<Exam | undefined> {
    return this.exams.get(id);
  }

  async getAllExams(): Promise<Exam[]> {
    return Array.from(this.exams.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getActiveExams(): Promise<Exam[]> {
    return Array.from(this.exams.values()).filter(exam => exam.isActive);
  }

  async updateExam(id: string, updateData: Partial<InsertExam>): Promise<Exam | null> {
    const existingExam = this.exams.get(id);
    if (!existingExam) {
      return null;
    }

    const updatedExam: Exam = {
      ...existingExam,
      ...updateData,
      id,
      createdAt: existingExam.createdAt,
    };

    this.exams.set(id, updatedExam);
    return updatedExam;
  }

  async deleteExam(id: string): Promise<boolean> {
    // Also delete related questions
    const examQuestions = Array.from(this.questions.values()).filter(q => q.examId === id);
    examQuestions.forEach(question => this.questions.delete(question.id));
    
    return this.exams.delete(id);
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const id = randomUUID();
    const question: Question = {
      ...insertQuestion,
      id,
      examId: insertQuestion.examId ?? null,
      description: insertQuestion.description ?? null,
      imageUrl: insertQuestion.imageUrl ?? null,
      audioUrl: insertQuestion.audioUrl ?? null,
      explanation: insertQuestion.explanation ?? null,
      sortOrder: insertQuestion.sortOrder ?? null,
      questionType: insertQuestion.questionType ?? "multiple_choice",
      createdAt: new Date(),
    };
    this.questions.set(id, question);
    return question;
  }

  async getQuestion(id: string): Promise<Question | undefined> {
    return this.questions.get(id);
  }

  async getAllQuestions(): Promise<Question[]> {
    return Array.from(this.questions.values()).sort(
      (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
    );
  }
  
  async getQuestionsByCategory(category: string): Promise<Question[]> {
    return Array.from(this.questions.values()).filter(
      question => question.category === category
    ).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }
  
  async searchQuestions(searchTerm: string): Promise<Question[]> {
    const term = searchTerm.toLowerCase();
    return Array.from(this.questions.values()).filter(
      question => 
        question.questionText.toLowerCase().includes(term) ||
        (question.description && question.description.toLowerCase().includes(term))
    ).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async getQuestionsByExamId(examId: string): Promise<Question[]> {
    return Array.from(this.questions.values()).filter(
      question => question.examId === examId
    ).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }
  
  async addQuestionToExam(examId: string, questionId: string, sortOrder: number = 0): Promise<boolean> {
    // For MemStorage, we'll just update the question's examId and sortOrder
    const question = this.questions.get(questionId);
    if (!question) return false;
    
    const updatedQuestion: Question = {
      ...question,
      examId,
      sortOrder,
    };
    this.questions.set(questionId, updatedQuestion);
    return true;
  }
  
  async removeQuestionFromExam(examId: string, questionId: string): Promise<boolean> {
    const question = this.questions.get(questionId);
    if (!question || question.examId !== examId) return false;
    
    const updatedQuestion: Question = {
      ...question,
      examId: null, // Remove from exam, make it independent
      sortOrder: 0,
    };
    this.questions.set(questionId, updatedQuestion);
    return true;
  }
  
  async getExamQuestions(examId: string): Promise<Question[]> {
    return this.getQuestionsByExamId(examId);
  }

  async updateQuestion(id: string, updateData: Partial<InsertQuestion>): Promise<Question | null> {
    const existingQuestion = this.questions.get(id);
    if (!existingQuestion) {
      return null;
    }

    const updatedQuestion: Question = {
      ...existingQuestion,
      ...updateData,
      id,
      createdAt: existingQuestion.createdAt,
    };

    this.questions.set(id, updatedQuestion);
    return updatedQuestion;
  }

  async deleteQuestion(id: string): Promise<boolean> {
    return this.questions.delete(id);
  }

  async createExamAttempt(insertAttempt: InsertExamAttempt): Promise<ExamAttempt> {
    const id = randomUUID();
    const attempt: ExamAttempt = {
      ...insertAttempt,
      id,
      userId: insertAttempt.userId ?? null,
      timeSpent: insertAttempt.timeSpent ?? null,
      completedAt: new Date(),
    };
    this.examAttempts.set(id, attempt);
    return attempt;
  }

  async getExamAttempt(id: string): Promise<ExamAttempt | undefined> {
    return this.examAttempts.get(id);
  }

  async getExamAttemptsByUserId(userId: string): Promise<ExamAttempt[]> {
    return Array.from(this.examAttempts.values()).filter(
      attempt => attempt.userId === userId
    ).sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  }

  async getExamAttemptsByExamId(examId: string): Promise<ExamAttempt[]> {
    return Array.from(this.examAttempts.values()).filter(
      attempt => attempt.examId === examId
    ).sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  }

  seedExams() {
    // This method will be implemented by seedExamData.ts
    console.log("seedExams called from MemStorage - exam seeding handled externally");
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        role: insertUser.role || "user" // Ensure role defaults to "user" if not provided
      })
      .returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | null> {
    const [user] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user || null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  async authenticateUser(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (user && user.password === password) {
      return user;
    }
    return null;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createContactRequest(insertRequest: InsertContactRequest): Promise<ContactRequest> {
    const [request] = await db
      .insert(contactRequests)
      .values(insertRequest)
      .returning();
    return request;
  }

  async getContactRequests(): Promise<ContactRequest[]> {
    return await db.select().from(contactRequests);
  }

  async deleteContactRequest(id: string): Promise<boolean> {
    const result = await db.delete(contactRequests).where(eq(contactRequests.id, id));
    return (result.rowCount || 0) > 0;
  }

  async createArticle(insertArticle: InsertArticle): Promise<Article> {
    const articleData = {
      ...insertArticle,
      sortOrder: insertArticle.sortOrder || 0
    };
    const [article] = await db
      .insert(articles)
      .values(articleData)
      .returning();
    return article;
  }

  async getArticlesByCategory(category: string): Promise<Article[]> {
    return await db.select().from(articles).where(eq(articles.category, category));
  }

  async getAllArticles(): Promise<Article[]> {
    return await db.select().from(articles);
  }

  async getArticle(id: string): Promise<Article | undefined> {
    const [article] = await db.select().from(articles).where(eq(articles.id, id));
    return article || undefined;
  }

  async getArticles(): Promise<Article[]> {
    return this.getAllArticles();
  }

  async updateArticle(id: string, updateData: { title: string; content: string; category: string; imageUrl?: string | null; sortOrder?: number }): Promise<Article | null> {
    const [updatedArticle] = await db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, id))
      .returning();
    return updatedArticle || null;
  }

  async deleteArticle(id: string): Promise<boolean> {
    const result = await db.delete(articles).where(eq(articles.id, id));
    return (result.rowCount || 0) > 0;
  }

  async moveArticleOrder(id: string, direction: 'up' | 'down'): Promise<boolean> {
    // Get all articles sorted by order (then by creation date as secondary sort)
    const allArticles = await db.select().from(articles);
    const sortedArticles = allArticles.sort((a, b) => {
      const aOrder = a.sortOrder || 0;
      const bOrder = b.sortOrder || 0;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      // If sortOrder is the same, sort by creation date (oldest first)
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    
    const currentIndex = sortedArticles.findIndex(a => a.id === id);
    if (currentIndex === -1) return false;
    
    let targetIndex: number;
    if (direction === 'up' && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    } else if (direction === 'down' && currentIndex < sortedArticles.length - 1) {
      targetIndex = currentIndex + 1;
    } else {
      return false; // Can't move further
    }

    // Instead of swapping, assign new sequential sort orders
    // This ensures proper ordering even when multiple items have the same sortOrder
    const updates: Promise<any>[] = [];
    
    for (let i = 0; i < sortedArticles.length; i++) {
      let newSortOrder: number;
      
      if (i === currentIndex) {
        // Current item moves to target position
        newSortOrder = targetIndex;
      } else if (i === targetIndex) {
        // Target item moves to current position  
        newSortOrder = currentIndex;
      } else if (direction === 'up' && i >= targetIndex && i < currentIndex) {
        // Items between target and current shift down
        newSortOrder = i + 1;
      } else if (direction === 'down' && i > currentIndex && i <= targetIndex) {
        // Items between current and target shift up
        newSortOrder = i - 1;
      } else {
        // All other items maintain their relative position
        newSortOrder = i;
      }
      
      if (newSortOrder !== i) {
        updates.push(
          db.update(articles)
            .set({ sortOrder: newSortOrder })
            .where(eq(articles.id, sortedArticles[i].id))
        );
      }
    }
    
    // Execute all updates
    await Promise.all(updates);
    return true;
  }

  // UI Images methods for DatabaseStorage
  async createUiImage(insertUiImage: InsertUiImage): Promise<UiImage> {
    const [uiImage] = await db
      .insert(uiImages)
      .values(insertUiImage)
      .returning();
    return uiImage;
  }

  async getUiImagesByType(imageType: string): Promise<UiImage[]> {
    return await db.select().from(uiImages).where(eq(uiImages.imageType, imageType));
  }

  async getAllUiImages(): Promise<UiImage[]> {
    return await db.select().from(uiImages);
  }

  async updateUiImage(id: string, updateData: Partial<InsertUiImage>): Promise<UiImage | null> {
    const [uiImage] = await db
      .update(uiImages)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(uiImages.id, id))
      .returning();
    return uiImage || null;
  }

  async updateUiImageByType(imageType: string, updateData: Partial<InsertUiImage>): Promise<UiImage | null> {
    const [uiImage] = await db
      .update(uiImages)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(uiImages.imageType, imageType))
      .returning();
    return uiImage || null;
  }

  async deleteUiImage(id: string): Promise<boolean> {
    const result = await db.delete(uiImages).where(eq(uiImages.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getUiImageByType(imageType: string): Promise<UiImage | undefined> {
    const [uiImage] = await db.select().from(uiImages).where(eq(uiImages.imageType, imageType));
    return uiImage || undefined;
  }

  // Registration request methods for DatabaseStorage
  async createRegistrationRequest(request: InsertRegistrationRequest): Promise<RegistrationRequest> {
    const [registrationRequest] = await db
      .insert(registrationRequests)
      .values(request)
      .returning();
    return registrationRequest;
  }

  async getAllRegistrationRequests(): Promise<RegistrationRequest[]> {
    return await db.select().from(registrationRequests);
  }

  async getRegistrationRequest(id: string): Promise<RegistrationRequest | undefined> {
    const [request] = await db.select().from(registrationRequests).where(eq(registrationRequests.id, id));
    return request || undefined;
  }

  async updateRegistrationRequestStatus(
    id: string, 
    status: 'approved' | 'rejected', 
    reviewedBy: string, 
    rejectionReason?: string
  ): Promise<RegistrationRequest | null> {
    const [request] = await db
      .update(registrationRequests)
      .set({ 
        status, 
        reviewedBy, 
        reviewedAt: new Date(),
        rejectionReason: rejectionReason || null
      })
      .where(eq(registrationRequests.id, id))
      .returning();
    return request || null;
  }

  async deleteRegistrationRequest(id: string): Promise<boolean> {
    const result = await db.delete(registrationRequests).where(eq(registrationRequests.id, id));
    return (result.rowCount || 0) > 0;
  }

  async checkUsernameExists(username: string): Promise<boolean> {
    // Check in users table
    const [existingUser] = await db.select().from(users).where(eq(users.username, username));
    if (existingUser) return true;

    // Check in pending registration requests
    const [existingRequest] = await db.select().from(registrationRequests)
      .where(eq(registrationRequests.username, username));
    return !!existingRequest;
  }

  async checkEmailExists(email: string): Promise<boolean> {
    // Check in users table
    const [existingUser] = await db.select().from(users).where(eq(users.email, email));
    if (existingUser) return true;

    // Check in pending registration requests
    const [existingRequest] = await db.select().from(registrationRequests)
      .where(eq(registrationRequests.email, email));
    return !!existingRequest;
  }

  async checkPhoneExists(phone: string): Promise<boolean> {
    // Check in users table
    const [existingUser] = await db.select().from(users).where(eq(users.phone, phone));
    if (existingUser) return true;

    // Check in pending registration requests
    const [existingRequest] = await db.select().from(registrationRequests)
      .where(eq(registrationRequests.phone, phone));
    return !!existingRequest;
  }

  // Exam system methods
  async createExam(examData: InsertExam): Promise<Exam> {
    const [exam] = await db
      .insert(exams)
      .values({
        ...examData,
        id: randomUUID(),
        createdAt: new Date(),
      })
      .returning();
    return exam;
  }

  async getExam(id: string): Promise<Exam | undefined> {
    const [exam] = await db.select().from(exams).where(eq(exams.id, id));
    return exam;
  }

  async getAllExams(): Promise<Exam[]> {
    return await db.select().from(exams);
  }

  async getActiveExams(): Promise<Exam[]> {
    return await db.select().from(exams).where(eq(exams.isActive, true));
  }

  async updateExam(id: string, updateData: Partial<InsertExam>): Promise<Exam | null> {
    const [exam] = await db
      .update(exams)
      .set(updateData)
      .where(eq(exams.id, id))
      .returning();
    return exam || null;
  }

  async deleteExam(id: string): Promise<boolean> {
    const result = await db.delete(exams).where(eq(exams.id, id));
    return (result as any).rowCount > 0;
  }

  async createQuestion(questionData: InsertQuestion): Promise<Question> {
    const [question] = await db
      .insert(questions)
      .values({
        ...questionData,
        id: randomUUID(),
        createdAt: new Date(),
      })
      .returning();
    return question;
  }

  async getQuestion(id: string): Promise<Question | undefined> {
    const [question] = await db.select().from(questions).where(eq(questions.id, id));
    return question;
  }

  async getQuestionsByExamId(examId: string): Promise<Question[]> {
    return await db.select().from(questions).where(eq(questions.examId, examId));
  }

  async updateQuestion(id: string, updateData: Partial<InsertQuestion>): Promise<Question | null> {
    const [question] = await db
      .update(questions)
      .set(updateData)
      .where(eq(questions.id, id))
      .returning();
    return question || null;
  }

  async deleteQuestion(id: string): Promise<boolean> {
    const result = await db.delete(questions).where(eq(questions.id, id));
    return (result as any).rowCount > 0;
  }

  async getAllQuestions(): Promise<Question[]> {
    return await db.select().from(questions).orderBy(questions.sortOrder);
  }

  async getQuestionsByCategory(category: string): Promise<Question[]> {
    return await db.select().from(questions)
      .where(eq(questions.category, category))
      .orderBy(questions.sortOrder);
  }

  async searchQuestions(searchTerm: string): Promise<Question[]> {
    const term = `%${searchTerm.toLowerCase()}%`;
    return await db.select().from(questions)
      .where(
        sql`LOWER(${questions.questionText}) LIKE ${term} OR LOWER(${questions.description}) LIKE ${term}`
      )
      .orderBy(questions.sortOrder);
  }

  async addQuestionToExam(examId: string, questionId: string, sortOrder: number = 0): Promise<boolean> {
    try {
      // For DatabaseStorage with the new schema, we update the question's examId and sortOrder
      const result = await db
        .update(questions)
        .set({ examId, sortOrder })
        .where(eq(questions.id, questionId));
      return (result as any).rowCount > 0;
    } catch (error) {
      console.error('Error adding question to exam:', error);
      return false;
    }
  }

  async removeQuestionFromExam(examId: string, questionId: string): Promise<boolean> {
    try {
      const result = await db
        .update(questions)
        .set({ examId: null, sortOrder: 0 })
        .where(
          sql`${questions.id} = ${questionId} AND ${questions.examId} = ${examId}`
        );
      return (result as any).rowCount > 0;
    } catch (error) {
      console.error('Error removing question from exam:', error);
      return false;
    }
  }

  async getExamQuestions(examId: string): Promise<Question[]> {
    return this.getQuestionsByExamId(examId);
  }

  async createExamAttempt(attemptData: InsertExamAttempt): Promise<ExamAttempt> {
    const [attempt] = await db
      .insert(examAttempts)
      .values({
        ...attemptData,
        id: randomUUID(),
        completedAt: new Date(),
      })
      .returning();
    return attempt;
  }

  async getExamAttempt(id: string): Promise<ExamAttempt | undefined> {
    const [attempt] = await db.select().from(examAttempts).where(eq(examAttempts.id, id));
    return attempt;
  }

  async getExamAttemptsByUserId(userId: string): Promise<ExamAttempt[]> {
    return await db.select().from(examAttempts).where(eq(examAttempts.userId, userId));
  }

  async getExamAttemptsByExamId(examId: string): Promise<ExamAttempt[]> {
    return await db.select().from(examAttempts).where(eq(examAttempts.examId, examId));
  }

  // Contact Info methods for DatabaseStorage
  async createContactInfo(contactInfoData: InsertContactInfo): Promise<ContactInfo> {
    const [newContactInfo] = await db
      .insert(contactInfo)
      .values(contactInfoData)
      .returning();
    return newContactInfo;
  }

  async getContactInfo(): Promise<ContactInfo[]> {
    return await db.select().from(contactInfo)
      .where(eq(contactInfo.isActive, true))
      .orderBy(contactInfo.displayOrder);
  }

  async getContactInfoById(id: string): Promise<ContactInfo | undefined> {
    const [result] = await db.select().from(contactInfo).where(eq(contactInfo.id, id));
    return result || undefined;
  }

  async updateContactInfo(id: string, updateData: Partial<InsertContactInfo>): Promise<ContactInfo | null> {
    const [updatedContactInfo] = await db
      .update(contactInfo)
      .set(updateData)
      .where(eq(contactInfo.id, id))
      .returning();
    return updatedContactInfo || null;
  }

  async deleteContactInfo(id: string): Promise<boolean> {
    const result = await db.delete(contactInfo).where(eq(contactInfo.id, id));
    return (result.rowCount || 0) > 0;
  }
}

export const storage = new DatabaseStorage();
