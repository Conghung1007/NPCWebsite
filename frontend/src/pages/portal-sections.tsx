import { Link } from "wouter";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { portalHref, portalPath, resolvePortal, type PortalId } from "@/lib/portal";
import { ArticleSection } from "@/components/ArticleSection";
import { ContactForm } from "@/components/ui/contact-form";
import { useSiteContents } from "@/hooks/useSiteContents";
import {
  mergePortalSectionContent,
  portalSectionPageId,
} from "@/lib/portalSectionContent";

export type PortalSectionDef = {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  /** Short lead under title */
  lead?: string;
  bullets?: string[];
  rows?: { label: string; value: string }[];
  /** Feature / market cards */
  cards?: { title: string; body: string; meta?: string }[];
  /** Numbered process */
  steps?: { title: string; body: string }[];
  faq?: { question: string; answer: string }[];
  note?: string;
  homeHash?: string;
  articleCategory?: string;
  ctaLabel?: string;
  ctaHref?: string;
  showContactForm?: boolean;
  contactDefaultService?: string;
};

export const DUHOC_SECTIONS: PortalSectionDef[] = [
  {
    slug: "countries",
    title: "Quốc gia du học",
    shortTitle: "Quốc gia",
    description:
      "Trí Nhân Academy đồng hành các thị trường chủ lực — chọn quốc gia phù hợp hồ sơ, ngân sách và mục tiêu nghề nghiệp.",
    lead: "Mỗi thị trường có yêu cầu ngôn ngữ, kỳ nhập học và chiến lược visa riêng. Chúng tôi tư vấn lộ trình rõ ràng trước khi bạn nộp hồ sơ.",
    cards: [
      {
        title: "Nhật Bản",
        meta: "Ưu tiên",
        body: "Trường ngôn ngữ, cao đẳng, đại học, kỹ sư / vừa học vừa làm. Tập trung JLPT hoặc học tiếng tại chỗ, hồ sơ minh bạch.",
      },
      {
        title: "Hàn Quốc",
        meta: "Đại học · Cao đẳng",
        body: "TOPIK, học bổng theo trường, trao đổi văn hóa. Phù hợp sinh viên muốn môi trường Hàn và lộ trình bằng cấp.",
      },
      {
        title: "Mỹ · Canada",
        meta: "Bằng cấp quốc tế",
        body: "IELTS/TOEFL, ngân sách học phí & sinh hoạt, chọn ngành và bang/tỉnh phù hợp. Lộ trình visa theo loại chương trình.",
      },
      {
        title: "Anh · Úc · Châu Âu",
        meta: "Định hướng 1-1",
        body: "Yêu cầu đầu vào và chi phí khác nhau theo quốc gia. Tư vấn case-by-case theo GPA, ngành và khả năng tài chính.",
      },
    ],
    steps: [
      {
        title: "Đánh giá hồ sơ",
        body: "Học lực, ngoại ngữ, ngân sách, mục tiêu nghề — chốt thị trường khả thi.",
      },
      {
        title: "Chọn quốc gia & kỳ",
        body: "So sánh điều kiện visa, kỳ nhập học và chi phí tham khảo.",
      },
      {
        title: "Lên lộ trình",
        body: "Ngôn ngữ bổ trợ (nếu cần), danh sách trường, timeline nộp hồ sơ.",
      },
    ],
    articleCategory: "study-abroad",
    homeHash: "study-countries",
    ctaLabel: "Tư vấn chọn quốc gia",
    ctaHref: "/contact",
    showContactForm: true,
    contactDefaultService: "study-abroad",
  },
  {
    slug: "schools",
    title: "Trường học đối tác",
    shortTitle: "Trường học",
    description:
      "Gợi ý trường / học viện phù hợp hồ sơ — ngôn ngữ, cao đẳng, đại học theo ngành và ngân sách.",
    lead: "Không chỉ liệt kê trường: chúng tôi lọc theo GPA, ngoại ngữ, thành phố và mục tiêu của bạn, rồi hỗ trợ liên hệ và nộp hồ sơ.",
    cards: [
      {
        title: "Trường ngôn ngữ (Nhật)",
        meta: "Tokyo · Osaka · Fukuoka…",
        body: "Môi trường học tiếng, chuẩn bị vào cao đẳng/đại học hoặc kỹ năng giao tiếp cho công việc.",
      },
      {
        title: "Cao đẳng / Đại học",
        meta: "Theo ngành & GPA",
        body: "Lọc trường theo chuyên ngành, điều kiện đầu vào và cơ hội việc làm sau tốt nghiệp.",
      },
      {
        title: "Chương trình quốc tế",
        meta: "Phương Tây",
        body: "Định hướng trường phù hợp IELTS/TOEFL và ngân sách — báo cáo gợi ý trước khi nộp.",
      },
    ],
    rows: [
      { label: "Tiêu chí lọc", value: "Ngành · thành phố · học phí · kỳ nhập học" },
      { label: "Hỗ trợ", value: "Liên hệ nhà trường · chuẩn bị hồ sơ nộp" },
      { label: "Cam kết", value: "Tư vấn trung thực — không hứa ảo" },
    ],
    steps: [
      { title: "Brief hồ sơ", body: "Thu thập điểm mạnh / hạn chế và ưu tiên của bạn." },
      { title: "Danh sách ngắn", body: "3–7 trường phù hợp kèm lý do chọn." },
      { title: "Nộp hồ sơ", body: "Checklist giấy tờ, deadline và theo dõi kết quả." },
    ],
    articleCategory: "study-abroad",
    ctaLabel: "Nhận gợi ý trường",
    ctaHref: "/contact",
    showContactForm: true,
    contactDefaultService: "study-abroad",
  },
  {
    slug: "costs",
    title: "Chi phí du học",
    shortTitle: "Chi phí",
    description:
      "Khung tham khảo minh bạch — số liệu thực tế phụ thuộc trường, kỳ và lối sống. Nhận bảng chi tiết khi tư vấn.",
    lead: "Chi phí gồm học phí, sinh hoạt, bảo hiểm, vé máy bay và phí dịch vụ. Chúng tôi tách rõ từng hạng mục trước khi bạn quyết định.",
    rows: [
      {
        label: "Nhật — học phí ngôn ngữ / năm",
        value: "~70–120 triệu VNĐ (tham khảo)",
      },
      {
        label: "Nhật — sinh hoạt / tháng",
        value: "~15–25 triệu VNĐ tùy thành phố",
      },
      {
        label: "Hàn Quốc — khung tham khảo",
        value: "Học phí + ký túc / thuê nhà theo trường — báo giá 1-1",
      },
      {
        label: "Mỹ / Canada / Anh / Úc",
        value: "Biên độ rộng theo trường công/tư — lập ngân sách trước",
      },
      {
        label: "Phí dịch vụ Trí Nhân",
        value: "Theo gói hồ sơ — báo trước khi ký, không phát sinh ẩn",
      },
    ],
    bullets: [
      "Học bổng / hỗ trợ tài chính khi đủ điều kiện trường",
      "Lịch đóng phí theo milestone hồ sơ (không gom một lần nếu không cần)",
      "Tư vấn tối ưu ngân sách: thành phố, loại trường, kỳ nhập học",
    ],
    note: "Số liệu mang tính tham khảo tại thời điểm tư vấn. Bảng chi tiết theo hồ sơ sẽ được gửi riêng.",
    articleCategory: "study-abroad",
    ctaLabel: "Nhận tư vấn chi phí",
    ctaHref: "/contact",
    showContactForm: true,
    contactDefaultService: "study-abroad",
  },
  {
    slug: "documents",
    title: "Hồ sơ du học",
    shortTitle: "Hồ sơ",
    description:
      "Checklist và quy trình hoàn thiện hồ sơ đúng hạn — từ giấy tờ cá nhân đến thư mời và visa.",
    lead: "Hồ sơ thiếu hoặc sai format là lý do trễ phổ biến. Trí Nhân Academy checklist theo quốc gia và theo dõi từng mốc.",
    cards: [
      {
        title: "Giấy tờ cá nhân",
        body: "Hộ chiếu, ảnh, giấy khai sinh / căn cước (theo yêu cầu từng nước).",
      },
      {
        title: "Học thuật",
        body: "Bằng cấp, bảng điểm, chứng chỉ ngoại ngữ (JLPT / IELTS / TOPIK…).",
      },
      {
        title: "Động cơ & kế hoạch",
        body: "Thư động cơ, kế hoạch học tập — chỉnh theo brief từng trường.",
      },
      {
        title: "Tài chính",
        body: "Chứng minh tài chính theo tiêu chuẩn quốc gia / lãnh sự.",
      },
    ],
    steps: [
      {
        title: "Kick-off checklist",
        body: "Danh sách giấy tờ theo quốc gia + deadline từng bước.",
      },
      {
        title: "Hoàn thiện & dịch thuật",
        body: "Rà soát bản dịch công chứng (nếu cần) và format nộp.",
      },
      {
        title: "Nộp trường → thư mời",
        body: "Theo dõi phản hồi, bổ sung khi nhà trường yêu cầu.",
      },
      {
        title: "Visa du học",
        body: "Chuẩn bị bộ visa và lịch hẹn — xem thêm trang Visa.",
      },
    ],
    homeHash: "study-process",
    articleCategory: "study-abroad",
    ctaLabel: "Đặt lịch hỗ trợ hồ sơ",
    ctaHref: "/contact",
    showContactForm: true,
    contactDefaultService: "study-abroad",
  },
  {
    slug: "faq",
    title: "Câu hỏi thường gặp",
    shortTitle: "FAQ",
    description: "Giải đáp nhanh trước khi đặt lịch tư vấn 1-1.",
    faq: [
      {
        question: "Cần IELTS / JLPT / TOPIK mức nào?",
        answer:
          "Tùy quốc gia và trường. Nhật thường cần JLPT hoặc học ngôn ngữ tại chỗ; Hàn cần TOPIK; Mỹ/Canada/Anh/Úc thường cần IELTS/TOEFL. Chúng tôi đánh giá hồ sơ rồi chốt mục tiêu ngôn ngữ.",
      },
      {
        question: "Mất bao lâu để có thư mời?",
        answer:
          "Thường vài tuần đến vài tháng tùy kỳ nhập học và độ hoàn thiện hồ sơ. Lịch cụ thể được lên khi tư vấn.",
      },
      {
        question: "Có hỗ trợ visa không?",
        answer:
          "Có — visa du học nằm trong cổng Du học (trang Visa). Trí Nhân Academy đồng hành từ hồ sơ trường đến nộp visa.",
      },
      {
        question: "Phí dịch vụ tính thế nào?",
        answer:
          "Theo gói rõ ràng, báo trước khi ký. Không thu phí ẩn; các khoản nộp trường / lãnh sự tách bạch với phí tư vấn.",
      },
      {
        question: "Có hỗ trợ sau khi nhập học không?",
        answer:
          "Hỗ trợ định hướng chỗ ở, giấy tờ ban đầu và kênh liên hệ khi bạn đã sang nước ngoài (theo gói dịch vụ).",
      },
      {
        question: "Tôi chưa rõ chọn Nhật hay Hàn?",
        answer:
          "Buổi tư vấn đầu sẽ so sánh điều kiện, chi phí và mục tiêu nghề để chốt hướng phù hợp — không ép thị trường.",
      },
    ],
    ctaLabel: "Hỏi tư vấn viên",
    ctaHref: "/contact",
    showContactForm: true,
    contactDefaultService: "study-abroad",
  },
];

export const DAOTAO_SECTIONS: PortalSectionDef[] = [
  {
    slug: "courses",
    title: "Khóa học kỹ năng mềm",
    shortTitle: "Khóa học",
    description:
      "Chương trình thực hành: giao tiếp, thuyết trình, làm việc nhóm và sẵn sàng môi trường chuyên nghiệp.",
    lead: "Sĩ số nhỏ, ưu tiên luyện tập và phản hồi. Có thể học trực tiếp hoặc online theo lịch mở lớp.",
    cards: [
      {
        title: "Giao tiếp & thuyết trình",
        meta: "8–12 buổi",
        body: "Tự tin nói trước nhóm, cấu trúc bài nói, kiểm soát giọng và ngôn ngữ cơ thể.",
      },
      {
        title: "Làm việc nhóm",
        meta: "Workshop",
        body: "Phối hợp, phản hồi xây dựng, phân vai và trách nhiệm trong dự án nhỏ.",
      },
      {
        title: "Tư duy nghề nghiệp",
        meta: "CV · phỏng vấn",
        body: "Hồ sơ xin việc, trả lời phỏng vấn, thái độ làm việc và kỳ vọng thực tế.",
      },
      {
        title: "Lãnh đạo nền tảng",
        meta: "Team lead mới",
        body: "Điều phối nhóm nhỏ, đặt mục tiêu, họp hiệu quả — dành cho người mới nhận vai trò.",
      },
    ],
    bullets: [
      "Lớp trực tiếp hoặc online",
      "Sĩ số nhỏ để thực hành nhiều",
      "Có thể gắn chứng nhận hoàn thành (theo khóa)",
      "Có thể kết hợp tiếng Nhật doanh nghiệp qua TNJS khi cần",
    ],
    steps: [
      { title: "Tư vấn nhu cầu", body: "Chọn khóa / lộ trình theo mục tiêu cá nhân hoặc team." },
      { title: "Xếp lớp", body: "Ghép ca phù hợp lịch của bạn." },
      { title: "Học & đánh giá", body: "Thực hành, phản hồi, bài tập áp dụng." },
    ],
    articleCategory: "soft-skills",
    ctaLabel: "Đăng ký tư vấn khóa",
    ctaHref: "/contact",
    showContactForm: true,
    contactDefaultService: "soft-skills",
  },
  {
    slug: "schedule",
    title: "Lịch học",
    shortTitle: "Lịch học",
    description:
      "Các khung giờ thường mở — xác nhận lịch khai giảng cụ thể khi đăng ký.",
    lead: "Lịch linh hoạt cho người đi học và đi làm. Doanh nghiệp có thể đặt ca in-house riêng.",
    rows: [
      { label: "Tối trong tuần", value: "19:00–21:00 · 2–3 buổi/tuần" },
      { label: "Cuối tuần", value: "Sáng hoặc chiều · phù hợp người đi làm" },
      { label: "Online", value: "Ca linh hoạt theo nhóm đã xếp" },
      { label: "In-house DN", value: "Theo lịch doanh nghiệp (onsite / hybrid)" },
    ],
    steps: [
      {
        title: "Đăng ký quan tâm",
        body: "Để lại SĐT / form — nhận thông báo lớp sắp mở.",
      },
      {
        title: "Xác nhận ca",
        body: "Chốt khung giờ và số buổi trước khi khai giảng.",
      },
      {
        title: "Khai giảng",
        body: "Nhận tài liệu và lịch chi tiết từng buổi.",
      },
    ],
    note: "Lịch khai giảng thay đổi theo kỳ. Liên hệ để nhận lịch gần nhất.",
    articleCategory: "soft-skills",
    ctaLabel: "Đăng ký nhận lịch",
    ctaHref: "/contact",
    showContactForm: true,
    contactDefaultService: "soft-skills",
  },
  {
    slug: "enterprise",
    title: "Đào tạo doanh nghiệp",
    shortTitle: "Doanh nghiệp",
    description:
      "Chương trình in-house: kỹ năng mềm, văn hóa làm việc và phát triển đội ngũ theo brief HR / vận hành.",
    lead: "Thiết kế theo mục tiêu của bạn — không gói cứng. Có báo cáo tham dự và đánh giá sau khóa.",
    cards: [
      {
        title: "Onboarding & văn hóa",
        body: "Định hướng nhân viên mới, chuẩn giao tiếp nội bộ và kỳ vọng công việc.",
      },
      {
        title: "Kỹ năng làm việc",
        body: "Họp hiệu quả, phản hồi, làm việc nhóm, thuyết trình nội bộ.",
      },
      {
        title: "Lãnh đạo tuyến đầu",
        body: "Cho team lead / supervisor: giao việc, coaching nhẹ, xử lý xung đột cơ bản.",
      },
      {
        title: "Kết hợp tiếng Nhật DN",
        meta: "Qua TNJS",
        body: "Khi team cần giao tiếp Nhật tại môi trường doanh nghiệp — phối hợp cổng TNJS.",
      },
    ],
    steps: [
      { title: "Brief & khảo sát", body: "Mục tiêu HR, đối tượng học, ràng buộc lịch." },
      { title: "Đề xuất chương trình", body: "Nội dung, số buổi, hình thức onsite/hybrid/online." },
      { title: "Triển khai", body: "Giảng dạy, điểm danh, thu thập phản hồi." },
      { title: "Báo cáo", body: "Tóm tắt tham dự và gợi ý bước tiếp theo." },
    ],
    bullets: [
      "Onsite, hybrid hoặc online",
      "Linh hoạt theo ca sản xuất / văn phòng",
      "NDA và bảo mật nội dung nội bộ khi yêu cầu",
    ],
    articleCategory: "soft-skills",
    ctaLabel: "Liên hệ doanh nghiệp",
    ctaHref: "/contact",
    showContactForm: true,
    contactDefaultService: "enterprise",
  },
];

/** Career tracks under Hướng nghiệp (beyond classic du học detail pages) */
export const HUONGNGHIEP_TRACKS: PortalSectionDef[] = [
  {
    slug: "du-hoc",
    title: "Du học",
    shortTitle: "Du học",
    description:
      "Tư vấn quốc gia, trường, chi phí, hồ sơ và visa — lộ trình rõ ràng theo mục tiêu của bạn.",
    lead: "Bắt đầu từ đánh giá hồ sơ, chọn thị trường khả thi, rồi triển khai nộp hồ sơ và visa.",
    cards: [
      {
        title: "Quốc gia & trường",
        body: "So sánh thị trường, lọc trường theo ngành, GPA và ngân sách.",
      },
      {
        title: "Hồ sơ & visa",
        body: "Checklist giấy tờ, timeline nộp và hỗ trợ xin visa du học.",
      },
      {
        title: "Chi phí tham khảo",
        body: "Học phí, sinh hoạt và các khoản phát sinh theo quốc gia.",
      },
    ],
    steps: [
      { title: "Tư vấn 1-1", body: "Đánh giá hồ sơ và mục tiêu." },
      { title: "Chọn lộ trình", body: "Quốc gia, kỳ nhập học, danh sách trường." },
      { title: "Nộp hồ sơ & visa", body: "Theo dõi đến khi có kết quả." },
    ],
    articleCategory: "study-abroad",
    ctaLabel: "Tư vấn du học",
    ctaHref: "/contact",
    showContactForm: true,
    contactDefaultService: "study-abroad",
  },
  {
    slug: "di-lam",
    title: "Đi làm",
    shortTitle: "Đi làm",
    description:
      "Định hướng nghề nghiệp, hồ sơ xin việc và chuẩn bị phỏng vấn — gắn với năng lực thực tế.",
    lead: "Không chỉ “tìm việc”: làm rõ mục tiêu, làm sạch CV, luyện phỏng vấn và kết nối cơ hội phù hợp.",
    cards: [
      {
        title: "Định hướng nghề",
        body: "Đánh giá kỹ năng, sở thích và thị trường — chọn hướng đi khả thi.",
      },
      {
        title: "CV & hồ sơ",
        body: "Chỉnh CV, portfolio ngắn và thư xin việc theo ngành.",
      },
      {
        title: "Phỏng vấn",
        body: "Luyện câu hỏi thường gặp, thái độ và storytelling.",
      },
    ],
    steps: [
      { title: "Brief nghề nghiệp", body: "Mục tiêu 6–12 tháng và ràng buộc thực tế." },
      { title: "Chuẩn bị hồ sơ", body: "CV, LinkedIn / portfolio theo brief." },
      { title: "Ứng tuyển & follow-up", body: "Gợi ý kênh và cách theo dõi kết quả." },
    ],
    articleCategory: "study-abroad",
    ctaLabel: "Tư vấn đi làm",
    ctaHref: "/contact",
    showContactForm: true,
    contactDefaultService: "career",
  },
  {
    slug: "dao-tao-nghe",
    title: "Đào tạo nghề",
    shortTitle: "Đào tạo nghề",
    description:
      "Lộ trình kỹ năng nghề gắn nhu cầu doanh nghiệp — thực hành, có định hướng đầu ra.",
    lead: "Chọn nghề phù hợp năng lực và thị trường, rồi theo lộ trình học ngắn hạn / trung hạn.",
    cards: [
      {
        title: "Chọn nghề",
        body: "Tư vấn nghề theo sở thích, sức khỏe và nhu cầu tuyển dụng.",
      },
      {
        title: "Lộ trình học",
        body: "Khóa ngắn hạn, chứng chỉ liên quan và lịch học linh hoạt.",
      },
      {
        title: "Gắn doanh nghiệp",
        body: "Định hướng thực tập / việc làm khi đủ điều kiện.",
      },
    ],
    steps: [
      { title: "Tư vấn nghề", body: "Chốt hướng nghề phù hợp." },
      { title: "Đăng ký lộ trình", body: "Lịch học và yêu cầu đầu vào." },
      { title: "Học & hỗ trợ đầu ra", body: "Theo dõi tiến độ và cơ hội việc làm." },
    ],
    articleCategory: "soft-skills",
    ctaLabel: "Tư vấn đào tạo nghề",
    ctaHref: "/contact",
    showContactForm: true,
    contactDefaultService: "vocational",
  },
];

/** Dich vu service pages → contact-first */
export const DICHVU_SECTIONS: PortalSectionDef[] = [
  {
    slug: "bien-phien-dich",
    title: "Biên phiên dịch",
    shortTitle: "Biên phiên dịch",
    description:
      "Biên dịch tài liệu và phiên dịch sự kiện / họp — báo giá theo khối lượng và lĩnh vực.",
    lead: "Để lại nhu cầu (loại tài liệu / sự kiện, ngôn ngữ, deadline) — chúng tôi phản hồi sớm.",
    bullets: [
      "Biên dịch tài liệu chuyên ngành",
      "Phiên dịch họp / sự kiện",
      "Báo giá theo trang hoặc theo giờ",
    ],
    ctaLabel: "Liên hệ biên phiên dịch",
    ctaHref: "/contact",
    showContactForm: true,
    contactDefaultService: "interpreting",
  },
  {
    slug: "ky-nang-mem",
    title: "Kỹ năng mềm",
    shortTitle: "Kỹ năng mềm",
    description:
      "Giao tiếp, thuyết trình, làm việc nhóm — đăng ký tư vấn khóa hoặc lịch học.",
    lead: "Sĩ số nhỏ, ưu tiên thực hành. Có thể học trực tiếp hoặc online.",
    articleCategory: "soft-skills",
    ctaLabel: "Liên hệ kỹ năng mềm",
    ctaHref: "/contact",
    showContactForm: true,
    contactDefaultService: "soft-skills",
  },
  {
    slug: "tu-van-doanh-nghiep",
    title: "Tư vấn doanh nghiệp",
    shortTitle: "Tư vấn DN",
    description:
      "Đào tạo in-house và tư vấn phát triển đội ngũ theo brief HR / vận hành.",
    lead: "Thiết kế theo mục tiêu của bạn — không gói cứng.",
    articleCategory: "soft-skills",
    ctaLabel: "Liên hệ doanh nghiệp",
    ctaHref: "/contact",
    showContactForm: true,
    contactDefaultService: "enterprise",
  },
];

export function getSectionBySlug(
  portal: PortalId,
  slug: string,
): PortalSectionDef | undefined {
  if (portal === "huongnghiep") {
    return (
      HUONGNGHIEP_TRACKS.find((s) => s.slug === slug) ||
      DUHOC_SECTIONS.find((s) => s.slug === slug)
    );
  }
  if (portal === "dichvu") {
    return (
      DICHVU_SECTIONS.find((s) => s.slug === slug) ||
      DAOTAO_SECTIONS.find((s) => s.slug === slug)
    );
  }
  return undefined;
}

type PortalSectionPageProps = {
  section: PortalSectionDef;
  portalLabel: string;
};

export function PortalSectionPage({
  section: fallback,
  portalLabel,
}: PortalSectionPageProps) {
  const portal = resolvePortal();
  const pageId = portalSectionPageId(fallback.slug);
  const { data: remoteContents = {} } = useSiteContents(pageId);
  const section = useMemo(
    () => mergePortalSectionContent(fallback, remoteContents),
    [fallback, remoteContents],
  );
  const rawCta = section.ctaHref;
  const ctaHref =
    rawCta && (rawCta.includes("#") || rawCta.startsWith("/"))
      ? portalPath(portal, rawCta)
      : rawCta;

  return (
    <div className="bg-[linear-gradient(180deg,#f8faf9_0%,#eef5f1_38%,#ffffff_100%)]">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-8">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-3">
          {portalLabel}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight home-fade-up">
          {section.title}
        </h1>
        <p className="mt-4 text-muted-foreground text-base sm:text-lg leading-relaxed home-fade-up">
          {section.description}
        </p>
        {section.lead && (
          <p className="mt-3 text-sm sm:text-base text-foreground/80 leading-relaxed home-fade-up">
            {section.lead}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3 home-fade-up">
          {ctaHref &&
            (ctaHref.includes("?") || ctaHref.includes("#") ? (
              <a href={ctaHref}>
                <Button size="lg" className="gap-2">
                  {section.ctaLabel || "Tìm hiểu thêm"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            ) : (
              <Link href={ctaHref}>
                <Button size="lg" className="gap-2">
                  {section.ctaLabel || "Tìm hiểu thêm"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ))}
          <a href={portalHref(portal, "/")}>
            <Button size="lg" variant="outline">
              Về trang chủ {portalLabel}
            </Button>
          </a>
        </div>
      </section>

      {section.cards && section.cards.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-6">
            Chi tiết
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {section.cards.map((card, i) => (
              <article
                key={card.title}
                className="border-t border-foreground/10 pt-5 home-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {card.meta && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1.5">
                    {card.meta}
                  </p>
                )}
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {card.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {card.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {section.rows && section.rows.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-4">
            Thông tin nhanh
          </h2>
          <dl className="space-y-0">
            {section.rows.map((row) => (
              <div
                key={row.label}
                className="border-t border-foreground/10 py-4 flex flex-col sm:flex-row sm:gap-6"
              >
                <dt className="sm:w-52 shrink-0 font-semibold text-foreground text-sm">
                  {row.label}
                </dt>
                <dd className="text-sm text-muted-foreground mt-1 sm:mt-0 leading-relaxed">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {section.steps && section.steps.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-6">
            Quy trình
          </h2>
          <ol className="space-y-6">
            {section.steps.map((step, i) => (
              <li key={step.title} className="flex gap-4 home-fade-up">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {section.bullets && section.bullets.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-4">
            Điểm nổi bật
          </h2>
          <ul className="space-y-3">
            {section.bullets.map((b) => (
              <li
                key={b}
                className="flex gap-3 text-sm sm:text-base text-foreground/90"
              >
                <span
                  className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0"
                  aria-hidden
                />
                {b}
              </li>
            ))}
          </ul>
        </section>
      )}

      {section.faq && section.faq.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-4">
            Câu hỏi thường gặp
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {section.faq.map((item, i) => (
              <AccordionItem key={item.question} value={`faq-${i}`}>
                <AccordionTrigger className="text-left font-semibold text-foreground">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {section.note && (
        <p className="max-w-4xl mx-auto px-4 sm:px-6 pb-6 text-xs text-muted-foreground italic">
          {section.note}
        </p>
      )}

      {section.articleCategory && (
        <ArticleSection
          category={section.articleCategory}
          title="Tin liên quan"
          description="Cập nhật mới từ Trí Nhân Academy"
        />
      )}

      {section.showContactForm && (
        <section className="py-14 sm:py-16 bg-primary" id="section-tu-van">
          <div className="max-w-xl mx-auto px-4 sm:px-6">
            <ContactForm
              variant="hero"
              defaultService={section.contactDefaultService || ""}
              submitMessage={`Tư vấn từ trang ${section.title}`}
            />
          </div>
        </section>
      )}

      <p className="text-center py-8 text-sm text-muted-foreground">
        <a
          href={portalHref("group", "/")}
          className="text-primary font-medium hover:underline"
        >
          ← Về Trí Nhân Academy
        </a>
      </p>
    </div>
  );
}

export function PortalNewsPage({
  category,
  title,
  description,
}: {
  category: string;
  title: string;
  description: string;
}) {
  const portal = resolvePortal();

  return (
    <div className="bg-[linear-gradient(180deg,#f8faf9_0%,#eef5f1_40%,#ffffff_100%)]">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-2">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-3">
          Tin tức
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          {title}
        </h1>
        <p className="mt-3 text-muted-foreground text-base sm:text-lg max-w-2xl">
          {description}
        </p>
      </section>

      <ArticleSection
        category={category}
        title="Bài viết mới"
        description="Cập nhật từ Trí Nhân Academy"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-12 flex flex-wrap gap-3 justify-center">
        <a href={portalHref(portal, "/")}>
          <Button variant="outline">Về trang chủ cổng</Button>
        </a>
        <a href={portalHref("group", "/")}>
          <Button variant="ghost">Trí Nhân Academy</Button>
        </a>
      </div>
    </div>
  );
}
