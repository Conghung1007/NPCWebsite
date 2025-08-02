import { type User, type InsertUser, type ContactRequest, type InsertContactRequest, type Article, type InsertArticle } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  authenticateUser(username: string, password: string): Promise<User | null>;
  
  createContactRequest(request: InsertContactRequest): Promise<ContactRequest>;
  getContactRequests(): Promise<ContactRequest[]>;
  
  createArticle(article: InsertArticle): Promise<Article>;
  getArticlesByCategory(category: string): Promise<Article[]>;
  getAllArticles(): Promise<Article[]>;
  getArticle(id: string): Promise<Article | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private contactRequests: Map<string, ContactRequest>;
  private articles: Map<string, Article>;

  constructor() {
    this.users = new Map();
    this.contactRequests = new Map();
    this.articles = new Map();
    this.seedUsers();
    this.seedArticles();
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

  async createArticle(insertArticle: InsertArticle): Promise<Article> {
    const id = randomUUID();
    const article: Article = {
      ...insertArticle,
      id,
      imageUrl: insertArticle.imageUrl || null,
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
        id: randomUUID(),
        title: "Hướng dẫn xin visa du lịch Nhật Bản 2024",
        content: "Visa du lịch Nhật Bản là loại visa ngắn hạn cho phép bạn nhập cảnh vào Nhật Bản với mục đích du lịch, thăm thân, tham dự hội nghị... Thời gian lưu trú tối đa là 90 ngày. Để xin visa du lịch Nhật Bản, bạn cần chuẩn bị đầy đủ hồ sơ theo quy định của Lãnh sự quán Nhật Bản tại Việt Nam.",
        imageUrl: "https://images.unsplash.com/photo-1493780474015-ba834fd0ce2f?w=800&h=400&fit=crop" as string | null,
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
        id: randomUUID(),
        title: "Du học Nhật Bản - Cơ hội vàng năm 2024",
        content: "Nhật Bản với nền giáo dục chất lượng cao, môi trường học tập an toàn và nhiều cơ hội việc làm sau tốt nghiệp đang thu hút ngày càng nhiều sinh viên Việt Nam. Chúng tôi tư vấn miễn phí về các trường đại học, học phí và thủ tục du học Nhật Bản.",
        imageUrl: "https://images.unsplash.com/photo-1528164344705-47542687000d?w=800&h=400&fit=crop" as string | null,
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
        id: randomUUID(),
        title: "Khóa học tiếng Nhật N5 cơ bản",
        content: "Khóa học tiếng Nhật N5 dành cho người mới bắt đầu, giúp học viên nắm vững các kiến thức cơ bản về ngữ pháp, từ vựng và Hiragana, Katakana. Sau khóa học, học viên có thể đạt trình độ N5 theo tiêu chuẩn JLPT.",
        imageUrl: "https://images.unsplash.com/photo-1528164344705-47542687000d?w=800&h=400&fit=crop" as string | null,
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

    const flightArticles = [
      {
        id: randomUUID(),
        title: "Vé máy bay giá rẻ đi Nhật Bản tháng 3",
        content: "Tháng 3 là thời điểm lý tưởng để du lịch Nhật Bản với thời tiết ôn hòa và mùa hoa anh đào nở. Chúng tôi cung cấp vé máy bay giá rẻ từ các hãng hàng không uy tín như Vietnam Airlines, Jetstar, ANA với giá cả cạnh tranh nhất thị trường.",
        imageUrl: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&h=400&fit=crop" as string | null,
        category: "flight-tickets",
        createdAt: new Date(Date.now() - 86400000 * 1)
      },
      {
        id: randomUUID(),
        title: "Hướng dẫn đặt vé máy bay online tiết kiệm",
        content: "Việc đặt vé máy bay online đã trở nên phổ biến và tiện lợi. Chúng tôi chia sẻ những mẹo nhỏ để bạn có thể đặt được vé máy bay với giá tốt nhất, từ việc chọn thời điểm bay đến so sánh giá giữa các hãng hàng không.",
        imageUrl: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=400&fit=crop" as string | null,
        category: "flight-tickets",
        createdAt: new Date(Date.now() - 86400000 * 2)
      },
      {
        id: randomUUID(),
        title: "Chính sách hành lý của các hãng hàng không",
        content: "Mỗi hãng hàng không có quy định riêng về hành lý xách tay và ký gửi. Hiểu rõ các quy định này sẽ giúp bạn tránh được những phí phát sinh không mong muốn và chuẩn bị hành lý một cách hợp lý nhất.",
        imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=400&fit=crop" as string | null,
        category: "flight-tickets",
        createdAt: new Date(Date.now() - 86400000 * 3)
      },
      {
        id: randomUUID(),
        title: "Khuyến mãi vé máy bay cuối năm - Tiết kiệm đến 50%",
        content: "Mùa du lịch cuối năm đang đến gần, đây là thời điểm các hãng hàng không tung ra nhiều chương trình khuyến mãi hấp dẫn. Đặt vé sớm để nhận được ưu đãi tốt nhất cho chuyến du lịch của bạn.",
        imageUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&h=400&fit=crop" as string | null,
        category: "flight-tickets",
        createdAt: new Date(Date.now() - 86400000 * 4)
      },
      {
        id: randomUUID(),
        title: "Bảo hiểm du lịch khi mua vé máy bay",
        content: "Bảo hiểm du lịch là sự bảo vệ quan trọng cho chuyến đi của bạn. Tìm hiểu các loại bảo hiểm phù hợp và cách mua bảo hiểm khi đặt vé máy bay để có chuyến đi an toàn và yên tâm nhất.",
        imageUrl: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=400&fit=crop" as string | null,
        category: "flight-tickets",
        createdAt: new Date(Date.now() - 86400000 * 5)
      },
      {
        id: randomUUID(),
        title: "Check-in online và chọn chỗ ngồi trên máy bay",
        content: "Hướng dẫn chi tiết cách thực hiện check-in online, chọn chỗ ngồi yêu thích và in thẻ lên máy bay tại nhà. Tiết kiệm thời gian tại sân bay và có trải nghiệm bay thoải mái nhất.",
        imageUrl: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=800&h=400&fit=crop" as string | null,
        category: "flight-tickets",
        createdAt: new Date(Date.now() - 86400000 * 6)
      }
    ];

    [...visaArticles, ...studyArticles, ...japaneseArticles, ...flightArticles].forEach(article => {
      this.articles.set(article.id, article as Article);
    });
  }
}

export const storage = new MemStorage();
