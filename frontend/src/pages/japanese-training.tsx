import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EditableText } from "@/components/ui/editable-text";
import { ContactForm } from "@/components/ui/contact-form";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { ArticleSection } from "@/components/ArticleSection";
import { ImageManager } from "@/components/ui/image-manager";
import { InstructorCard } from "@/components/ui/instructor-card";
import { useUiImages } from "@/hooks/useUiImages";
import { useAuth } from "@/hooks/useAuth";
import {
  useSiteContents,
  useUpsertSiteContent,
  useBulkUpsertSiteContents,
} from "@/hooks/useSiteContents";
import { apiRequest } from "@/lib/queryClient";
import { testimonialKeys } from "@/lib/queryKeys";
import type { ClassSession, Testimonial } from "@shared/schema";
import { Link } from "wouter";
import { useCart, formatVnd } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { resolvePortal } from "@/lib/portal";
import { apiFetch } from "@/lib/queryClient";
import {
  Target,
  MessageSquare,
  Briefcase,
  User,
  Users,
  Laptop,
  Globe,
  Edit,
  Calendar,
  ShoppingCart,
} from "lucide-react";

type OpenSession = ClassSession & { courseTitle?: string; courseLevel?: string };

function OpenClassesSection() {
  const { toast } = useToast();
  const { addItem } = useCart();
  const { data: sessions = [], isLoading } = useQuery<OpenSession[]>({
    queryKey: ["/api/class-sessions"],
    queryFn: async () => {
      const res = await apiFetch("/api/class-sessions");
      if (!res.ok) throw new Error("Không tải lớp");
      return res.json();
    },
  });

  const preview = sessions.slice(0, 3);

  return (
    <section id="jp-open-classes" className="py-16 sm:py-20 bg-white border-y border-emerald-100/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              Lớp đang tuyển sinh
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Đăng ký và thanh toán online — số lượng chỗ có hạn
            </p>
          </div>
          <Link href="/classes">
            <Button variant="outline">Xem tất cả lớp</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : preview.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Hiện chưa có lớp mở đăng ký. Liên hệ tư vấn để nhận lịch khai giảng sớm nhất.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {preview.map((s) => (
              <div
                key={s.id}
                className="p-5 rounded-xl bg-neutral border border-border/70 flex flex-col"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  {s.courseLevel && (
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {s.courseLevel}
                    </span>
                  )}
                  <span className="font-bold text-primary">{formatVnd(s.priceVnd)}</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  <Link href={`/classes/${s.id}`} className="hover:text-primary">
                    {s.title}
                  </Link>
                </h3>
                {s.scheduleText && (
                  <p className="text-sm text-muted-foreground flex gap-2 mb-4">
                    <Calendar className="w-4 h-4 shrink-0 mt-0.5" />
                    {s.scheduleText}
                  </p>
                )}
                <Button
                  className="mt-auto"
                  onClick={async () => {
                    try {
                      await addItem.mutateAsync(s.id);
                      toast({ title: "Đã thêm vào giỏ hàng" });
                    } catch (e: any) {
                      toast({
                        title: "Không thêm được",
                        description: e?.message,
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={addItem.isPending}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Thêm vào giỏ
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const JP_DEFAULTS: Record<string, string> = {
  heroTitle: "Đào tạo tiếng Nhật",
  heroDescription:
    "Từ sơ cấp đến JLPT — sensei bản ngữ dẫn dắt, trợ giảng Việt hỗ trợ, lớp nhỏ dễ theo sát",
  "why-title": "Vì sao chọn TNJS",
  "why-description": "Bốn lý do học viên và phụ huynh tin tưởng lộ trình tại TNJS",
  "why-0-title": "Chương trình chất lượng",
  "why-0-description":
    "Giáo trình chuẩn, bám sát đầu ra JLPT — lý thuyết gắn thực hành để dùng được ngay.",
  "why-1-title": "Giáo viên tận tâm",
  "why-1-description":
    "Giảng viên trình độ cao, nhiều người từng học / làm việc tại Nhật; đồng hành sát từng học viên.",
  "why-2-title": "Lớp nhỏ, lịch linh hoạt",
  "why-2-description":
    "Tối đa khoảng 10 học viên/lớp; ca sáng, tối, cuối tuần và online cho học sinh lẫn người đi làm.",
  "why-3-title": "Đồng hành thi & định hướng",
  "why-3-description":
    "Hỗ trợ luyện thi JLPT và định hướng du học / việc làm khi bạn sẵn sàng bước tiếp.",
  "courses-title": "Khóa học theo nhu cầu",
  "courses-description":
    "Chọn đúng đối tượng và mục tiêu — đăng ký tư vấn để xếp lớp phù hợp",
  "course-0-title": "Thiếu nhi & thiếu niên",
  "course-0-description":
    "Lộ trình vui, nền tảng chữ cái và giao tiếp sớm; phù hợp học sinh muốn thêm ngoại ngữ.",
  "course-0-meta": "6–15 tuổi",
  "course-1-title": "Luyện thi JLPT",
  "course-1-description":
    "N5–N1: từ vựng, ngữ pháp, đọc, nghe — ôn sát cấu trúc đề và kỹ năng thi.",
  "course-1-meta": "N5 → N1",
  "course-2-title": "Giao tiếp & cấp tốc",
  "course-2-description":
    "Tăng phản xạ nói với sensei; lớp cấp tốc rút ngắn thời gian trước khi đi Nhật.",
  "course-2-meta": "Linh hoạt",
  "course-3-title": "Doanh nghiệp",
  "course-3-description":
    "Chương trình tại công ty hoặc lớp riêng — giao tiếp công sở và lộ trình theo ngành.",
  "course-3-meta": "B2B",
  "courses-note":
    "Muốn xem lớp đang mở và học phí? Xem mục tuyển sinh bên dưới hoặc trang Khóa học.",
  "process-title": "Lộ trình học tại TNJS",
  "process-description": "Bốn bước rõ ràng từ tư vấn đến thi / ứng dụng",
  "process-0-title": "Tư vấn & xếp lớp",
  "process-0-description": "Đánh giá trình độ, chọn khóa và lịch phù hợp",
  "process-1-title": "Học trên lớp",
  "process-1-description": "Lớp nhỏ (tối đa 10 HV), sensei dẫn dắt, thực hành nhiều",
  "process-2-title": "Luyện đề / giao tiếp",
  "process-2-description": "Ôn JLPT hoặc tình huống thực tế theo mục tiêu",
  "process-3-title": "Thi & đồng hành",
  "process-3-description": "Hỗ trợ kỳ thi và bước tiếp theo (du học / việc làm)",
  "method-title": "Phương pháp giảng dạy",
  "method-0-title": "Giảng viên bản ngữ dẫn dắt",
  "method-0-description":
    "Sensei người Nhật chủ trì; trợ giảng Việt hỗ trợ khi cần",
  "method-1-title": "Lớp học nhỏ",
  "method-1-description": "Tối đa 10 học viên/lớp để đảm bảo chất lượng",
  "method-2-title": "Bài học tương tác",
  "method-2-description": "Thực hành nhiều, kết hợp công nghệ hỗ trợ học tập",
  "method-3-title": "Giáo trình chuẩn Nhật Bản",
  "method-3-description": "Tích hợp học văn hóa và phong tục Nhật Bản",
  "schedule-title": "Lịch khai giảng",
  "schedule-description":
    "Các đợt chiêu sinh gần đây — nhận lịch ca cụ thể khi đăng ký tư vấn",
  "schedule-0-title": "Khai giảng sơ cấp (N5–N4)",
  "schedule-0-time": "Đợt mới trong tháng — còn chỗ hạn chế",
  "schedule-1-title": "Luyện thi JLPT N3–N2",
  "schedule-1-time": "Ôn sát kỳ thi tới — tư vấn để xếp ca phù hợp",
  "schedule-2-title": "Lớp thiếu nhi / thiếu niên",
  "schedule-2-time": "Cuối tuần & buổi tối — phụ huynh đăng ký tư vấn",
  "schedule-3-title": "Giao tiếp & doanh nghiệp",
  "schedule-3-time": "Mở theo nhu cầu nhóm — liên hệ xếp lịch riêng",
  "schedule-note":
    "Nội dung mang tính thông báo chiêu sinh. Ca học và ngày khai giảng chính thức xác nhận khi tư vấn / đăng ký.",
  "instructors-title": "Đội ngũ giảng viên",
  "instructor-0-name": "Cô Trần Mỹ Trinh",
  "instructor-0-role": "Ngữ pháp · Đọc hiểu · Nghe hiểu",
  "instructor-0-bio":
    "Giảng dạy tiếng Nhật nhiều năm; đồng hành học viên luyện thi và củng cố nền tảng.",
  "instructor-1-name": "Thầy Lê Anh Tuấn",
  "instructor-1-role": "Ngữ pháp · Luyện thi JLPT",
  "instructor-1-bio":
    "Chuyên luyện thi JLPT; lộ trình rõ, bài giảng thực tế và dễ theo dõi.",
  "instructor-2-name": "Cô Kayoko Takahashi",
  "instructor-2-role": "Giao tiếp N5–N1 · Nghe nói",
  "instructor-2-bio":
    "Sensei bản ngữ; tập trung phản xạ giao tiếp và kỹ năng nghe nói thực tế.",
  "stories-title": "Học viên nói gì",
  "stories-description": "Chia sẻ từ học viên đã học tại TNJS",
};

const COURSE_COUNT = 4;
const METHOD_ICONS = [User, Users, Laptop, Globe];
const PROCESS_ICONS = [MessageSquare, Users, Target, Briefcase];

const LEGACY_KEY_MAP: Record<string, string> = {
  "japanese-teaching-method-title": "method-title",
  "japanese-schedule-title": "schedule-title",
  "japanese-testimonials-title": "stories-title",
  "japanese-instructors-title": "instructors-title",
};

export default function JapaneseTraining() {
  const { getImageByType, invalidateCache } = useUiImages();
  const { hasImageEditPermission, user } = useAuth();
  const hasEditPermission = user?.role === "manager" || user?.role === "admin";
  const queryClient = useQueryClient();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const t = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
    }, 120);
    return () => window.clearTimeout(t);
  }, []);

  const [heroOverride, setHeroOverride] = useState<string | null>(null);
  const [classroomOverride, setClassroomOverride] = useState<string | null>(null);
  const [showHeroImageManager, setShowHeroImageManager] = useState(false);
  const [showClassroomImageManager, setShowClassroomImageManager] = useState(false);
  const [instructorOverrides, setInstructorOverrides] = useState<Record<number, string>>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const migratedLocal = useRef(false);

  const { data: remoteContents = {}, isLoading: contentsLoading } =
    useSiteContents("japanese");
  const upsertContent = useUpsertSiteContent("japanese");
  const bulkUpsertContent = useBulkUpsertSiteContents("japanese");

  const getContent = useCallback(
    (key: string) => remoteContents[key] ?? JP_DEFAULTS[key] ?? "",
    [remoteContents],
  );

  const { data: testimonials = [] } = useQuery<Testimonial[]>({
    queryKey: testimonialKeys.all,
  });

  const updateTestimonialMutation = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      role?: string;
      content?: string;
      avatarUrl?: string | null;
    }) => {
      const res = await apiRequest("PUT", `/api/testimonials/${id}`, data);
      return res.json() as Promise<Testimonial>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: testimonialKeys.all });
    },
  });

  const heroImage = heroOverride ?? getImageByType("japanese-hero");
  const classroomImage = classroomOverride ?? getImageByType("japanese-classroom");

  const getInstructorAvatar = (id: number) =>
    instructorOverrides[id] ?? getImageByType(`instructor-${id}`) ?? "";

  useEffect(() => {
    if (migratedLocal.current) return;
    if (!hasEditPermission || contentsLoading) return;
    migratedLocal.current = true;

    void (async () => {
      const entries: Array<{ key: string; value: string }> = [];
      try {
        const raw = localStorage.getItem("japanese-training-edit-values");
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          for (const [oldKey, value] of Object.entries(parsed)) {
            if (typeof value !== "string" || !value) continue;
            if (oldKey.startsWith("japanese-testimonial-")) continue;
            const mapped = LEGACY_KEY_MAP[oldKey] || oldKey;
            if (
              JP_DEFAULTS[mapped] !== undefined &&
              value !== JP_DEFAULTS[mapped] &&
              remoteContents[mapped] !== value
            ) {
              if (!entries.some((e) => e.key === mapped)) {
                entries.push({ key: mapped, value });
              }
            }
          }
        }
      } catch {
        // ignore
      }
      if (entries.length > 0) await bulkUpsertContent.mutateAsync(entries);
      localStorage.removeItem("japanese-training-edit-values");
    })();
  }, [hasEditPermission, contentsLoading, remoteContents, bulkUpsertContent]);

  useEffect(() => {
    document.title = "TNJS | Đào tạo tiếng Nhật — N&P Group";
    const content =
      "TNJS — khóa học tiếng Nhật N5–N1 và luyện thi JLPT. Sensei bản ngữ, lớp tối đa 10 học viên, đăng ký học miễn phí.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", content);
  }, []);

  const handleEditStart = (fieldName: string, currentValue: string) => {
    setEditingField(fieldName);
    setEditValues((prev) => ({ ...prev, [fieldName]: currentValue }));
  };

  const handleEditSave = (fieldName: string, value: string) => {
    const testimonialMatch = fieldName.match(/^testimonial:([^:]+):(name|role|content)$/);
    if (testimonialMatch) {
      const [, id, field] = testimonialMatch;
      updateTestimonialMutation.mutate({ id, [field]: value });
    } else {
      upsertContent.mutate({ key: fieldName, value });
    }
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
    setEditingField(null);
  };

  const handleEditCancel = () => setEditingField(null);

  const jpTestimonials = (() => {
    const jpFocused = testimonials.filter((t) =>
      /nhật|jlpt|\bn[1-5]\b|tiếng nhật/i.test(`${t.role ?? ""} ${t.content ?? ""}`),
    );
    return (jpFocused.length > 0 ? jpFocused : testimonials).slice(0, 3);
  })();

  return (
    <div className="w-full max-w-full">
      {/* Hero — full-bleed photo + TNJS brand */}
      <section className="relative text-white overflow-hidden min-h-[calc(78svh-var(--header-height))] flex items-center">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt=""
            className="w-full h-full object-cover scale-[1.02] motion-safe:animate-[tnjs-hero-pan_28s_ease-in-out_infinite_alternate]"
            onError={(e) => {
              e.currentTarget.src =
                "https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=2092&q=80";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/70" />
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(152,72%,18%)]/50 via-transparent to-transparent" />
        </div>

        {hasImageEditPermission && (
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHeroImageManager(true)}
              className="bg-white/20 text-white hover:bg-white/30 border-white/50"
            >
              <Edit className="w-4 h-4 mr-2" />
              Cập nhật ảnh nền
            </Button>
            <ImageManager
              isOpen={showHeroImageManager}
              onClose={() => setShowHeroImageManager(false)}
              onImageUpdate={(url) => {
                setHeroOverride(url);
                invalidateCache();
              }}
              imageType="japanese-hero"
              altText="Japanese training hero"
            />
          </div>
        )}

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="max-w-3xl">
            <p className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-4 home-fade-up drop-shadow-sm">
              TNJS
            </p>
            <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold text-white/95 mb-3 leading-snug home-fade-up">
              <EditableText
                fieldName="heroTitle"
                text={getContent("heroTitle")}
                className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold text-white/95"
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </h1>
            <div className="text-sm sm:text-base text-white/85 mb-8 max-w-xl leading-relaxed home-fade-up">
              <EditableText
                fieldName="heroDescription"
                text={getContent("heroDescription")}
                className="text-sm sm:text-base text-white/85"
                multiline
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 home-fade-up">
              <Button
                size="lg"
                className="bg-white text-primary shadow-md font-semibold px-8 hover:bg-secondary hover:text-primary"
                onClick={() =>
                  document.getElementById("jp-tu-van")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Đăng ký học miễn phí
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-white bg-transparent text-white font-semibold px-8 hover:bg-white hover:text-primary hover:border-white"
                onClick={() =>
                  document.getElementById("jp-courses")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Xem khóa học
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Why TNJS — typography, 4 reasons */}
      <section id="jp-why" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2 home-fade-up">
              <EditableText
                fieldName="why-title"
                text={getContent("why-title")}
                className="font-display text-2xl sm:text-3xl font-bold text-foreground"
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </h2>
            <div className="text-sm sm:text-base text-muted-foreground home-fade-up">
              <EditableText
                fieldName="why-description"
                text={getContent("why-description")}
                className="text-sm sm:text-base text-muted-foreground"
                multiline
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-10">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="border-t border-foreground/10 pt-5 home-fade-up"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <p className="text-xs font-semibold tracking-[0.2em] text-primary mb-2">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  <EditableText
                    fieldName={`why-${index}-title`}
                    text={getContent(`why-${index}-title`)}
                    className="font-display text-lg font-semibold text-foreground"
                    showEditButton={hasEditPermission}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                </h3>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  <EditableText
                    fieldName={`why-${index}-description`}
                    text={getContent(`why-${index}-description`)}
                    className="text-sm text-muted-foreground"
                    multiline
                    showEditButton={hasEditPermission}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Courses by audience */}
      <section id="jp-courses" className="py-16 sm:py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
              <EditableText
                fieldName="courses-title"
                text={getContent("courses-title")}
                className="font-display text-2xl sm:text-3xl font-bold text-foreground"
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </h2>
            <div className="text-sm sm:text-base text-muted-foreground">
              <EditableText
                fieldName="courses-description"
                text={getContent("courses-description")}
                className="text-sm sm:text-base text-muted-foreground"
                multiline
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-8 mb-8">
            {Array.from({ length: COURSE_COUNT }, (_, index) => (
              <div
                key={index}
                className="text-left border-t border-foreground/10 pt-5 home-fade-up"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <p className="text-xs font-semibold tracking-[0.18em] text-primary mb-2">
                  <EditableText
                    fieldName={`course-${index}-meta`}
                    text={getContent(`course-${index}-meta`)}
                    className="text-xs font-semibold tracking-[0.18em] text-primary"
                    showEditButton={hasEditPermission}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                </p>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  <EditableText
                    fieldName={`course-${index}-title`}
                    text={getContent(`course-${index}-title`)}
                    className="font-display text-lg font-semibold text-foreground"
                    showEditButton={hasEditPermission}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                </h3>
                <div className="text-sm text-muted-foreground leading-relaxed mb-3">
                  <EditableText
                    fieldName={`course-${index}-description`}
                    text={getContent(`course-${index}-description`)}
                    className="text-sm text-muted-foreground"
                    multiline
                    showEditButton={hasEditPermission}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                </div>
                <button
                  type="button"
                  className="text-sm font-semibold text-primary hover:underline"
                  onClick={() =>
                    document.getElementById("jp-tu-van")?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Tư vấn khóa này →
                </button>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl mb-8">
            <EditableText
              fieldName="courses-note"
              text={getContent("courses-note")}
              className="text-sm text-muted-foreground"
              multiline
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button
              size="lg"
              className="bg-primary hover:bg-[hsl(142,76%,30%)] text-primary-foreground font-semibold px-8"
              onClick={() =>
                document.getElementById("jp-open-classes")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Lớp đang tuyển sinh
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="font-semibold px-8"
              onClick={() =>
                document.getElementById("jp-tu-van")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Đăng ký học miễn phí
            </Button>
          </div>
        </div>
      </section>

      {/* Open class sessions (commerce) */}
      <OpenClassesSection />

      {/* Process */}
      <section id="jp-process" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
              <EditableText
                fieldName="process-title"
                text={getContent("process-title")}
                className="font-display text-2xl sm:text-3xl font-bold text-foreground"
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </h2>
            <div className="text-sm sm:text-base text-muted-foreground">
              <EditableText
                fieldName="process-description"
                text={getContent("process-description")}
                className="text-sm sm:text-base text-muted-foreground"
                multiline
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </div>
          </div>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {PROCESS_ICONS.map((Icon, index) => (
              <li
                key={index}
                className="relative home-fade-up"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                {index < PROCESS_ICONS.length - 1 ? (
                  <div
                    className="hidden lg:block absolute top-7 left-[calc(50%+2.5rem)] right-[calc(-50%+2.5rem)] h-px bg-border"
                    aria-hidden
                  />
                ) : null}
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="h-6 w-6" aria-hidden />
                    <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    <EditableText
                      fieldName={`process-${index}-title`}
                      text={getContent(`process-${index}-title`)}
                      className="text-base font-semibold text-foreground"
                      showEditButton={hasEditPermission}
                      editingField={editingField}
                      editValues={editValues}
                      onEditStart={handleEditStart}
                      onEditSave={handleEditSave}
                      onEditCancel={handleEditCancel}
                    />
                  </h3>
                  <div className="text-sm text-muted-foreground leading-relaxed max-w-[16rem]">
                    <EditableText
                      fieldName={`process-${index}-description`}
                      text={getContent(`process-${index}-description`)}
                      className="text-sm text-muted-foreground"
                      multiline
                      showEditButton={hasEditPermission}
                      editingField={editingField}
                      editValues={editValues}
                      onEditStart={handleEditStart}
                      onEditSave={handleEditSave}
                      onEditCancel={handleEditCancel}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Method + classroom */}
      <section className="py-16 sm:py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-6">
                <EditableText
                  fieldName="method-title"
                  text={getContent("method-title")}
                  className="font-display text-2xl sm:text-3xl font-bold text-foreground"
                  showEditButton={hasEditPermission}
                  editingField={editingField}
                  editValues={editValues}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              </h2>
              <div className="space-y-4">
                {METHOD_ICONS.map((Icon, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-base mb-0.5">
                        <EditableText
                          fieldName={`method-${index}-title`}
                          text={getContent(`method-${index}-title`)}
                          className="font-semibold text-foreground"
                          showEditButton={hasEditPermission}
                          editingField={editingField}
                          editValues={editValues}
                          onEditStart={handleEditStart}
                          onEditSave={handleEditSave}
                          onEditCancel={handleEditCancel}
                        />
                      </h3>
                      <div className="text-sm text-muted-foreground">
                        <EditableText
                          fieldName={`method-${index}-description`}
                          text={getContent(`method-${index}-description`)}
                          className="text-sm text-muted-foreground"
                          multiline
                          showEditButton={hasEditPermission}
                          editingField={editingField}
                          editValues={editValues}
                          onEditStart={handleEditStart}
                          onEditSave={handleEditSave}
                          onEditCancel={handleEditCancel}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              {classroomImage ? (
                <img
                  src={classroomImage}
                  alt="Lớp học tiếng Nhật N&P"
                  loading="lazy"
                  className="rounded-xl w-full h-auto"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget.nextElementSibling;
                    if (fallback instanceof HTMLElement) fallback.classList.remove("hidden");
                  }}
                />
              ) : null}
              <div
                className={
                  classroomImage
                    ? "hidden rounded-xl w-full aspect-[4/3] bg-gradient-to-br from-primary/15 via-accent/20 to-primary/5 flex items-center justify-center text-primary/40 text-sm"
                    : "rounded-xl w-full aspect-[4/3] bg-gradient-to-br from-primary/15 via-accent/20 to-primary/5 flex items-center justify-center text-primary/40 text-sm"
                }
              >
                Ảnh lớp học tiếng Nhật
              </div>
              {hasImageEditPermission && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowClassroomImageManager(true)}
                    className="absolute top-4 right-4 bg-white/90 hover:bg-white text-foreground"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Cập nhật ảnh
                  </Button>
                  <ImageManager
                    isOpen={showClassroomImageManager}
                    onClose={() => setShowClassroomImageManager(false)}
                    onImageUpdate={(url) => {
                      setClassroomOverride(url);
                      invalidateCache();
                    }}
                    imageType="japanese-classroom"
                    altText="Japanese classroom"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Schedule — chiêu sinh / khai giảng style */}
      <section id="jp-schedule" className="py-16 sm:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2 home-fade-up">
              <EditableText
                fieldName="schedule-title"
                text={getContent("schedule-title")}
                className="font-display text-2xl sm:text-3xl font-bold text-foreground"
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </h2>
            <div className="text-sm sm:text-base text-muted-foreground home-fade-up">
              <EditableText
                fieldName="schedule-description"
                text={getContent("schedule-description")}
                className="text-sm sm:text-base text-muted-foreground"
                multiline
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </div>
          </div>
          <ul className="space-y-0 mb-6">
            {[0, 1, 2, 3].map((index) => (
              <li
                key={index}
                className="border-t border-foreground/10 py-5 home-fade-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <h3 className="font-semibold text-foreground mb-1 text-base">
                  <EditableText
                    fieldName={`schedule-${index}-title`}
                    text={getContent(`schedule-${index}-title`)}
                    className="font-semibold text-foreground"
                    showEditButton={hasEditPermission}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                </h3>
                <div className="text-sm text-muted-foreground">
                  <EditableText
                    fieldName={`schedule-${index}-time`}
                    text={getContent(`schedule-${index}-time`)}
                    className="text-sm text-muted-foreground"
                    showEditButton={hasEditPermission}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs sm:text-sm text-muted-foreground mb-8 max-w-xl">
            <EditableText
              fieldName="schedule-note"
              text={getContent("schedule-note")}
              className="text-xs sm:text-sm text-muted-foreground"
              multiline
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              className="font-semibold px-8"
              onClick={() =>
                document.getElementById("jp-tu-van")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Đăng ký nhận lịch khai giảng
            </Button>
            <Link href="/news">
              <Button variant="outline" size="lg" className="font-semibold px-8">
                Tin tức & sự kiện
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Instructors */}
      <section id="jp-instructors" className="py-16 sm:py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground text-center mb-10">
            <EditableText
              fieldName="instructors-title"
              text={getContent("instructors-title")}
              className="font-display text-2xl sm:text-3xl font-bold text-foreground"
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[0, 1, 2].map((index) => (
              <InstructorCard
                key={index}
                name={getContent(`instructor-${index}-name`)}
                title={getContent(`instructor-${index}-role`)}
                description={getContent(`instructor-${index}-bio`)}
                avatar={getInstructorAvatar(index + 1)}
                allowAvatarEdit={hasImageEditPermission}
                onAvatarUpdate={(url) => {
                  setInstructorOverrides((prev) => ({ ...prev, [index + 1]: url }));
                  invalidateCache();
                }}
                imageType={`instructor-${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials from DB */}
      {jpTestimonials.length > 0 ? (
        <section className="py-16 sm:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10 max-w-2xl mx-auto">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
                <EditableText
                  fieldName="stories-title"
                  text={getContent("stories-title")}
                  className="font-display text-2xl sm:text-3xl font-bold text-foreground"
                  showEditButton={hasEditPermission}
                  editingField={editingField}
                  editValues={editValues}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              </h2>
              <div className="text-sm sm:text-base text-muted-foreground">
                <EditableText
                  fieldName="stories-description"
                  text={getContent("stories-description")}
                  className="text-sm sm:text-base text-muted-foreground"
                  multiline
                  showEditButton={hasEditPermission}
                  editingField={editingField}
                  editValues={editValues}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-10 md:gap-12">
              {jpTestimonials.map((t) => (
                <TestimonialCard
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  role={t.role}
                  content={t.content}
                  avatar={t.avatarUrl}
                  rating={t.rating ?? 5}
                  allowAvatarEdit={hasImageEditPermission}
                  onAvatarUpdate={(url) =>
                    updateTestimonialMutation.mutate({ id: t.id, avatarUrl: url })
                  }
                  allowTextEdit={hasEditPermission}
                  editingField={editingField}
                  editValues={editValues}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* CTA form — replaces external tnjs.vn as primary conversion */}
      <section className="py-16 sm:py-20 bg-primary" id="jp-tu-van">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <ContactForm
            variant="hero"
            defaultService="japanese"
            submitMessage="Yêu cầu đăng ký học thử / tư vấn tiếng Nhật từ trang đào tạo"
          />
        </div>
      </section>

      <ArticleSection
        category="japanese-training"
        title="Thông tin về tiếng Nhật"
        description="Mẹo học tiếng Nhật hiệu quả và thông tin về văn hóa Nhật Bản"
      />
    </div>
  );
}
