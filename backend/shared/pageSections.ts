import { z } from "zod";
import type { PortalId } from "./portal";

/** Catalog of marketing page section types (structured blocks). */
export const SECTION_TYPES = [
  "hero",
  "rich_text",
  "feature_grid",
  "cards",
  "testimonials",
  "articles",
  "cta_form",
  "exam_packages",
  "exam_list",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export function isSectionType(value: unknown): value is SectionType {
  return (
    typeof value === "string" &&
    (SECTION_TYPES as readonly string[]).includes(value)
  );
}

export const SECTION_META: Record<
  SectionType,
  { label: string; description: string; settings: string }
> = {
  hero: {
    label: "Hero",
    description: "Banner / carousel đầu trang với thương hiệu và nút CTA",
    settings:
      "Thương hiệu, tiêu đề, mô tả, prefix ảnh, CTA chính/phụ (chữ + link)",
  },
  rich_text: {
    label: "Nội dung chữ",
    description: "Khối văn bản giới thiệu, có thể kèm ảnh minh họa",
    settings: "Tiêu đề, nội dung, mã ảnh CMS (tùy chọn)",
  },
  feature_grid: {
    label: "Nổi bật",
    description: "Lưới các điểm nổi bật / lý do chọn (nền tối)",
    settings: "Tiêu đề, mô tả, danh sách mục (tiêu đề + mô tả), sắp xếp ↑↓",
  },
  cards: {
    label: "Thẻ liên kết",
    description: "Các thẻ dịch vụ / hướng đi kèm ảnh và nút",
    settings: "Tiêu đề, mô tả, thẻ (nhãn, tiêu đề, mô tả, CTA, link, ảnh)",
  },
  testimonials: {
    label: "Phản hồi",
    description: "Lấy đánh giá đang bật từ Cpanel theo portal",
    settings: "Tiêu đề, mô tả, số lượng hiển thị (1–12)",
  },
  articles: {
    label: "Tin bài",
    description: "Danh sách bài viết theo chuyên mục",
    settings: "Tiêu đề, mô tả, chuyên mục bài viết",
  },
  cta_form: {
    label: "Form tư vấn",
    description: "Form đăng ký / liên hệ trên trang",
    settings: "Tiêu đề, mô tả, dịch vụ mặc định (theo portal)",
  },
  exam_packages: {
    label: "Gói đề thi",
    description: "Danh sách gói đề bán trên cổng Luyện thi (dữ liệu Cpanel)",
    settings: "Tiêu đề, mô tả, căn lề, hiện/ẩn quy trình quyền thi",
  },
  exam_list: {
    label: "Danh sách đề thi",
    description: "Lưới đề thi + lọc / tìm kiếm (dữ liệu Cpanel)",
    settings: "Tiêu đề, mô tả, căn lề",
  },
};

/** Pages that can have a block layout */
export const LAYOUT_PAGES = [
  "group",
  "huongnghiep",
  "dichvu",
  "luyenthi",
  "japanese",
] as const;

export type LayoutPageId = (typeof LAYOUT_PAGES)[number];

export function isLayoutPageId(value: unknown): value is LayoutPageId {
  return (
    typeof value === "string" &&
    (LAYOUT_PAGES as readonly string[]).includes(value)
  );
}

export const LAYOUT_PAGE_LABELS: Record<LayoutPageId, string> = {
  group: "Trí Nhân Academy (trang chủ)",
  huongnghiep: "Hướng nghiệp",
  dichvu: "Dịch vụ",
  luyenthi: "Luyện thi",
  japanese: "Đào tạo TNJS",
};

/** ui_images prefix when adding new blocks on a layout page */
export const LAYOUT_PAGE_IMAGE_PREFIX: Record<LayoutPageId, string> = {
  group: "group",
  huongnghiep: "huongnghiep",
  dichvu: "dichvu",
  luyenthi: "exam",
  japanese: "japanese",
};

/** Suggested first card image slot per layout page */
export const LAYOUT_PAGE_CARD_IMAGE: Record<LayoutPageId, string> = {
  group: "group-pillar-0",
  huongnghiep: "huongnghiep-track-0",
  dichvu: "dichvu-service-0",
  luyenthi: "exam-feature-0",
  japanese: "japanese-course-0",
};

/** Allowed section types per page (Storyblok-style whitelist). */
export const PAGE_SECTION_WHITELIST: Record<LayoutPageId, SectionType[]> = {
  group: [
    "hero",
    "rich_text",
    "feature_grid",
    "cards",
    "testimonials",
    "articles",
    "cta_form",
  ],
  huongnghiep: [
    "hero",
    "rich_text",
    "feature_grid",
    "cards",
    "testimonials",
    "articles",
    "cta_form",
  ],
  dichvu: [
    "hero",
    "rich_text",
    "feature_grid",
    "cards",
    "testimonials",
    "cta_form",
  ],
  luyenthi: [
    "hero",
    "rich_text",
    "feature_grid",
    "cards",
    "exam_packages",
    "exam_list",
    "articles",
    "cta_form",
  ],
  japanese: [
    "hero",
    "rich_text",
    "feature_grid",
    "cards",
    "testimonials",
    "articles",
    "cta_form",
  ],
};

const linkItemSchema = z.object({
  label: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  cta: z.string().optional(),
  href: z.string().optional(),
  imageType: z.string().optional(),
  external: z.boolean().optional(),
});

const featureItemSchema = z.object({
  title: z.string(),
  body: z.string().optional(),
});

export const pageSectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(SECTION_TYPES),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  props: z.record(z.unknown()).default({}),
});

export type PageSection = z.infer<typeof pageSectionSchema>;

export const savePageLayoutSchema = z.object({
  /** Built-in layout id or custom cms page uuid */
  page: z.string().min(1).max(128),
  portal: z.string().min(1).max(64),
  sections: z.array(pageSectionSchema),
});

export type SavePageLayoutInput = z.infer<typeof savePageLayoutSchema>;

function nid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSection(
  type: SectionType,
  props?: Record<string, unknown>,
  sortOrder = 0,
  page?: LayoutPageId,
): PageSection {
  return {
    id: nid(type),
    type,
    enabled: true,
    sortOrder,
    props: props ?? defaultPropsForType(type, page),
  };
}

export function defaultPropsForType(
  type: SectionType,
  page?: LayoutPageId,
): Record<string, unknown> {
  const prefix = page ? LAYOUT_PAGE_IMAGE_PREFIX[page] : "group";
  const cardImage = page ? LAYOUT_PAGE_CARD_IMAGE[page] : "group-pillar-0";
  const articleCategory =
    page === "huongnghiep"
      ? "study-abroad"
      : page === "dichvu"
        ? "soft-skills"
        : "japanese-training";
  const defaultService =
    page === "huongnghiep"
      ? "study-abroad"
      : page === "dichvu"
        ? "interpreting"
        : page === "luyenthi"
          ? "online-exam"
          : page === "japanese"
            ? "japanese"
            : "";
  switch (type) {
    case "hero":
      return {
        brandName: "Trí Nhân",
        title: "Tiêu đề hero",
        description: "Mô tả ngắn hỗ trợ tiêu đề.",
        imageTypePrefix: prefix,
        ctaPrimaryLabel: "Tìm hiểu thêm",
        ctaPrimaryHref: "/contact",
        ctaSecondaryLabel: "Liên hệ",
        ctaSecondaryHref: "/contact",
      };
    case "rich_text":
      return {
        title: "Tiêu đề nội dung",
        body: "Viết nội dung giới thiệu tại đây.",
        imageType: "",
      };
    case "feature_grid":
      return {
        title: "Điểm nổi bật",
        description: "",
        items: [
          { id: nid("fg"), title: "Điểm 1", body: "Mô tả ngắn." },
          { id: nid("fg"), title: "Điểm 2", body: "Mô tả ngắn." },
          { id: nid("fg"), title: "Điểm 3", body: "Mô tả ngắn." },
        ],
      };
    case "cards":
      return {
        title: "Chọn hướng phù hợp",
        description: "",
        items: [
          {
            id: nid("card"),
            label: "Mục 1",
            title: "Tiêu đề thẻ",
            description: "Mô tả.",
            cta: "Xem thêm",
            href: "/contact",
            imageType: cardImage,
          },
        ],
      };
    case "testimonials":
      return {
        title: "Phản hồi học viên",
        description: "",
        limit: 3,
      };
    case "articles":
      return {
        title: "Tin tức",
        description: "",
        category: articleCategory,
      };
    case "cta_form":
      return {
        title: "Đăng ký tư vấn",
        description: "Để lại thông tin — chúng tôi sẽ liên hệ sớm.",
        defaultService,
      };
    case "exam_packages":
      return {
        title: "Gói đề luyện thi",
        description: "",
        showAccessGuide: true,
        align: "center",
      };
    case "exam_list":
      return {
        title: "Danh sách đề thi",
        description: "Chọn đề miễn phí hoặc đề chính thức theo trình độ của bạn.",
        align: "center",
      };
    default:
      return {};
  }
}

/** Minimal blocks for admin-created CMS pages (not full portal homepage). */
export function defaultCustomPageLayout(
  template: LayoutPageId,
  opts: { title: string; description?: string; imagePrefix: string },
): PageSection[] {
  const prefix = opts.imagePrefix.replace(/[^a-z0-9-]/g, "-") || "page";
  return [
    createSection(
      "hero",
      {
        brandName: "Trí Nhân",
        title: opts.title,
        description: opts.description || "",
        imageTypePrefix: prefix,
        ctaPrimaryLabel: "Liên hệ",
        ctaPrimaryHref: "/contact",
        ctaSecondaryLabel: "",
        ctaSecondaryHref: "",
      },
      0,
      template,
    ),
    createSection(
      "rich_text",
      {
        title: opts.title,
        body: opts.description || "Thêm nội dung trang tại đây.",
        imageType: "",
      },
      1,
      template,
    ),
  ];
}

/** Default layouts seed — mirrors current portal homes. */
export function defaultLayoutForPage(page: LayoutPageId): PageSection[] {
  switch (page) {
    case "group":
      return [
        createSection(
          "hero",
          {
            brandName: "Trí Nhân Academy",
            title: "Một thương hiệu. Bốn hướng chuyên môn.",
            description:
              "Đào tạo tiếng Nhật (TNJS), hướng nghiệp, dịch vụ và luyện thi — cùng tiêu chuẩn hỗ trợ của Trí Nhân Academy.",
            imageTypePrefix: "group",
            ctaPrimaryLabel: "Đào tạo tiếng Nhật",
            ctaPrimaryHref: "https://tnjs.vn/",
            ctaSecondaryLabel: "Tư vấn miễn phí",
            ctaSecondaryHref: "/contact",
          },
          0,
        ),
        createSection(
          "cards",
          {
            title: "Chọn hướng phù hợp",
            description:
              "Mỗi cổng là một mặt tiền chuyên sâu — quản trị chung bởi Trí Nhân Academy.",
            items: [
              {
                label: "Đào tạo",
                title: "Tiếng Nhật — TNJS",
                description:
                  "Khóa học tiếng Nhật N5–N1, lộ trình JLPT và đăng ký tư vấn ngay tại Trí Nhân Academy.",
                cta: "Xem đào tạo",
                href: "https://tnjs.vn/",
                imageType: "group-pillar-0",
                external: false,
              },
              {
                label: "Hướng nghiệp",
                title: "Du học · Đi làm · Đào tạo nghề",
                description:
                  "Định hướng nghề nghiệp: du học, việc làm và đào tạo nghề theo mục tiêu của bạn.",
                cta: "Vào Hướng nghiệp",
                href: "portal:huongnghiep:/",
                imageType: "group-pillar-1",
                external: true,
              },
              {
                label: "Dịch vụ",
                title: "Biên phiên dịch · Kỹ năng · Doanh nghiệp",
                description:
                  "Biên phiên dịch, kỹ năng mềm và tư vấn doanh nghiệp — liên hệ đội ngũ Trí Nhân Academy.",
                cta: "Vào Dịch vụ",
                href: "portal:dichvu:/",
                imageType: "group-pillar-2",
                external: true,
              },
              {
                label: "Luyện thi",
                title: "Thi thử & luyện đề",
                description:
                  "Luyện thi trực tuyến, theo dõi tiến độ và chuẩn bị kỳ thi cùng Trí Nhân Academy.",
                cta: "Vào Luyện thi",
                href: "portal:luyenthi:/",
                imageType: "group-pillar-3",
                external: true,
              },
            ],
          },
          1,
        ),
        createSection(
          "cta_form",
          {
            title: "Tư vấn miễn phí",
            description: "Để lại thông tin — đội ngũ Trí Nhân Academy sẽ liên hệ trong giờ hành chính.",
            defaultService: "",
          },
          2,
        ),
      ];
    case "huongnghiep":
      return [
        createSection(
          "hero",
          {
            brandName: "Hướng nghiệp Trí Nhân",
            title: "Du học · Đi làm · Đào tạo nghề",
            description:
              "Đồng hành chọn hướng đi phù hợp năng lực, ngân sách và mục tiêu dài hạn.",
            imageTypePrefix: "huongnghiep",
            ctaPrimaryLabel: "Bắt đầu với Du học",
            ctaPrimaryHref: "/du-hoc",
            ctaSecondaryLabel: "Tư vấn miễn phí",
            ctaSecondaryHref: "/contact",
          },
          0,
        ),
        createSection(
          "cards",
          {
            title: "Ba hướng chính",
            description: "Chọn hướng phù hợp — mỗi trang có nội dung và form tư vấn riêng.",
            items: [
              {
                label: "",
                title: "Du học",
                description:
                  "Chọn quốc gia, trường, hồ sơ và visa — lộ trình rõ ràng theo mục tiêu của bạn.",
                cta: "Xem du học",
                href: "/du-hoc",
                imageType: "huongnghiep-track-0",
              },
              {
                label: "",
                title: "Đi làm",
                description:
                  "Định hướng nghề, CV, phỏng vấn và kết nối cơ hội việc làm phù hợp hồ sơ.",
                cta: "Xem đi làm",
                href: "/di-lam",
                imageType: "huongnghiep-track-1",
              },
              {
                label: "",
                title: "Đào tạo nghề",
                description:
                  "Lộ trình kỹ năng nghề thực tế — gắn với nhu cầu thị trường và doanh nghiệp.",
                cta: "Xem đào tạo nghề",
                href: "/dao-tao-nghe",
                imageType: "huongnghiep-track-2",
              },
            ],
          },
          1,
        ),
        createSection(
          "articles",
          {
            title: "Tin hướng nghiệp & du học",
            description: "",
            category: "study-abroad",
          },
          2,
        ),
        createSection(
          "cta_form",
          {
            title: "Đăng ký tư vấn",
            description:
              "Để lại thông tin — đội ngũ hướng nghiệp sẽ liên hệ trong giờ hành chính.",
            defaultService: "study-abroad",
          },
          3,
        ),
      ];
    case "dichvu":
      return [
        createSection(
          "hero",
          {
            brandName: "Dịch vụ Trí Nhân",
            title: "Biên phiên dịch · Kỹ năng mềm · Tư vấn DN",
            description:
              "Ba nhóm dịch vụ — mỗi mục dẫn thẳng tới form liên hệ để đội ngũ Trí Nhân Academy hỗ trợ nhanh.",
            imageTypePrefix: "dichvu",
            ctaPrimaryLabel: "Liên hệ ngay",
            ctaPrimaryHref: "/contact",
            ctaSecondaryLabel: "",
            ctaSecondaryHref: "",
          },
          0,
        ),
        createSection(
          "cards",
          {
            title: "Chọn dịch vụ",
            description:
              "Nhấn vào dịch vụ cần hỗ trợ — form liên hệ sẽ được điền sẵn loại yêu cầu.",
            items: [
              {
                title: "Biên phiên dịch",
                description:
                  "Biên dịch tài liệu và phiên dịch sự kiện / họp — liên hệ để nhận báo giá theo nhu cầu.",
                cta: "Liên hệ biên phiên dịch",
                href: "/contact?service=interpreting",
                imageType: "dichvu-service-0",
              },
              {
                title: "Kỹ năng mềm",
                description:
                  "Giao tiếp, thuyết trình, làm việc nhóm — đăng ký tư vấn khóa hoặc lịch học.",
                cta: "Liên hệ kỹ năng mềm",
                href: "/contact?service=soft-skills",
                imageType: "dichvu-service-1",
              },
              {
                title: "Tư vấn doanh nghiệp",
                description:
                  "Đào tạo in-house và tư vấn phát triển đội ngũ theo brief HR / vận hành.",
                cta: "Liên hệ doanh nghiệp",
                href: "/contact?service=enterprise",
                imageType: "dichvu-service-2",
              },
            ],
          },
          1,
        ),
        createSection(
          "cta_form",
          {
            title: "Form liên hệ dịch vụ",
            description: "Chọn loại dịch vụ và để lại thông tin — chúng tôi phản hồi sớm.",
            defaultService: "",
          },
          2,
        ),
      ];
    case "luyenthi":
      return [
        createSection(
          "hero",
          {
            brandName: "Luyện thi Trí Nhân",
            title: "Thi thử & luyện đề trực tuyến",
            description:
              "Luyện đề, theo dõi kết quả và chuẩn bị kỳ thi cùng Trí Nhân Academy.",
            imageTypePrefix: "exam",
            ctaPrimaryLabel: "Vào thi trực tuyến",
            ctaPrimaryHref: "#exam-list",
            ctaSecondaryLabel: "Tư vấn lộ trình",
            ctaSecondaryHref: "/contact",
          },
          0,
        ),
        createSection(
          "feature_grid",
          {
            title: "Vì sao luyện thi tại Trí Nhân",
            description: "",
            items: [
              {
                title: "Thi thử online",
                body: "Làm đề trên hệ thống, xem điểm và lịch sử làm bài.",
              },
              {
                title: "Theo dõi tiến độ",
                body: "Xem lại bài làm, điểm yếu và kế hoạch ôn tập.",
              },
              {
                title: "Học tiếng Nhật",
                body: "Khóa đào tạo chuyên sâu trên trang Đào tạo TNJS.",
              },
            ],
          },
          1,
        ),
        createSection(
          "exam_packages",
          {
            title: "Gói đề luyện thi",
            description: "",
            showAccessGuide: true,
            align: "center",
          },
          2,
        ),
        createSection(
          "exam_list",
          {
            title: "Danh sách đề thi",
            description:
              "Chọn đề miễn phí hoặc đề chính thức theo trình độ của bạn.",
            align: "center",
          },
          3,
        ),
        createSection(
          "articles",
          {
            title: "Tin luyện thi & đào tạo",
            category: "japanese-training",
          },
          4,
        ),
        createSection(
          "cta_form",
          {
            title: "Tư vấn luyện thi",
            description:
              "Để lại SĐT — chúng tôi gợi ý lộ trình ôn phù hợp trình độ của bạn.",
            defaultService: "online-exam",
          },
          5,
        ),
      ];
    case "japanese":
      return [
        createSection(
          "hero",
          {
            brandName: "TNJS",
            title: "Đào tạo tiếng Nhật",
            description:
              "Từ sơ cấp đến JLPT — sensei bản ngữ dẫn dắt, trợ giảng Việt hỗ trợ, lớp nhỏ dễ theo sát",
            imageTypePrefix: "japanese",
            ctaPrimaryLabel: "Đăng ký tư vấn",
            ctaPrimaryHref: "#jp-tu-van",
            ctaSecondaryLabel: "Xem khóa học",
            ctaSecondaryHref: "#jp-courses",
          },
          0,
        ),
        createSection(
          "feature_grid",
          {
            title: "Vì sao chọn TNJS",
            description: "Những lý do bạn nên chọn dịch vụ của trung tâm chúng tôi",
            items: [
              {
                title: "Chương trình chất lượng",
                body: "Giáo trình chuẩn, bám sát đầu ra JLPT — lý thuyết gắn thực hành.",
              },
              {
                title: "Giáo viên tận tâm",
                body: "Giảng viên trình độ cao; đồng hành sát từng học viên.",
              },
              {
                title: "Lớp nhỏ, lịch linh hoạt",
                body: "Tối đa khoảng 10 học viên/lớp; nhiều ca học.",
              },
            ],
          },
          1,
        ),
        createSection(
          "testimonials",
          {
            title: "Câu chuyện học viên",
            description: "Chia sẻ từ học viên đã học tại TNJS",
            limit: 3,
          },
          2,
        ),
        createSection(
          "articles",
          {
            title: "Tin đào tạo",
            category: "japanese-training",
          },
          3,
        ),
        createSection(
          "cta_form",
          {
            title: "Đăng ký học / tư vấn",
            description: "Để lại thông tin — tư vấn viên TNJS sẽ liên hệ.",
            defaultService: "japanese",
          },
          4,
        ),
      ];
    default:
      return [];
  }
}

export function normalizeSections(
  page: LayoutPageId | string,
  sections: PageSection[],
  templatePage?: LayoutPageId,
): PageSection[] {
  const whitelistKey: LayoutPageId = isLayoutPageId(page)
    ? page
    : templatePage && isLayoutPageId(templatePage)
      ? templatePage
      : "group";
  const allowed = new Set(PAGE_SECTION_WHITELIST[whitelistKey] || []);
  return sections
    .filter((s) => allowed.has(s.type))
    .map((s, i) => ({
      ...s,
      enabled: s.enabled !== false,
      sortOrder: typeof s.sortOrder === "number" ? s.sortOrder : i,
      props: s.props && typeof s.props === "object" ? s.props : {},
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s, i) => ({ ...s, sortOrder: i }));
}

const HERO_SLIDE_COUNT = 5;

function addHeroPrefixSlots(types: Set<string>, prefix: string) {
  const p = prefix.trim();
  if (!p) return;
  types.add(`${p}-hero`);
  for (let i = 1; i <= HERO_SLIDE_COUNT; i++) {
    types.add(`${p}-hero-${i}`);
  }
}

/** Collect ui_images slot keys referenced by block layout JSON. */
export function collectImageTypesFromSections(
  sections: PageSection[],
  options?: { imagePrefix?: string },
): string[] {
  const types = new Set<string>();
  if (options?.imagePrefix) {
    addHeroPrefixSlots(types, options.imagePrefix);
  }
  for (const section of sections) {
    const p =
      section.props && typeof section.props === "object" ? section.props : {};
    if (typeof p.imageType === "string" && p.imageType.trim()) {
      types.add(p.imageType.trim());
    }
    if (typeof p.imageTypePrefix === "string" && p.imageTypePrefix.trim()) {
      addHeroPrefixSlots(types, p.imageTypePrefix);
    }
    if (Array.isArray(p.items)) {
      for (const raw of p.items) {
        if (!raw || typeof raw !== "object") continue;
        const item = raw as Record<string, unknown>;
        if (typeof item.imageType === "string" && item.imageType.trim()) {
          types.add(item.imageType.trim());
        }
      }
    }
  }
  return [...types];
}

/** Resolve R2 filename from a CMS ui_images URL (proxy or legacy path). */
export function r2FileNameFromUiImageUrl(url: string): string | null {
  if (!url || /^https?:\/\//i.test(url)) return null;
  const match = url.match(/\/ui-images\/([^/?]+)$/i);
  return match?.[1] ?? null;
}

/** Resolve href: portal:huongnghiep:/path → caller uses portalHref */
export function parsePortalHref(
  href: string | undefined,
): { portal: PortalId; path: string } | null {
  if (!href?.startsWith("portal:")) return null;
  const rest = href.slice("portal:".length);
  const idx = rest.indexOf(":");
  if (idx < 0) return null;
  const portal = rest.slice(0, idx);
  const path = rest.slice(idx + 1) || "/";
  if (
    portal === "group" ||
    portal === "huongnghiep" ||
    portal === "dichvu" ||
    portal === "luyenthi"
  ) {
    return { portal, path };
  }
  return null;
}

// silence unused — keep schemas available for future validation
void linkItemSchema;
void featureItemSchema;
