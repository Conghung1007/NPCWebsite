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
import {
  Sprout,
  TreePine,
  Mountain,
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
      const res = await fetch("/api/class-sessions", { credentials: "include" });
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
  "courses-title": "Các khóa học tiếng Nhật",
  "courses-description":
    "Bốn lộ trình chính theo JLPT — lớp giao tiếp và thương mại gắn trong từng cấp",
  "course-0-title": "Sơ cấp N5–N4",
  "course-0-description":
    "Hiragana, Katakana, từ vựng và ngữ pháp nền; làm quen giao tiếp hàng ngày",
  "course-0-meta": "3 tháng",
  "course-1-title": "Trung cấp N3–N2",
  "course-1-description":
    "Giao tiếp thực tế, đọc hiểu và viết; có thể kết hợp hướng thương mại",
  "course-1-meta": "4 tháng",
  "course-2-title": "Cao cấp N1",
  "course-2-description":
    "Gần mức bản ngữ — chuẩn bị công việc, học tập và môi trường chuyên môn",
  "course-2-meta": "6 tháng",
  "course-3-title": "Luyện thi JLPT",
  "course-3-description":
    "Ôn chuyên sâu theo kỹ năng thi: từ vựng, ngữ pháp, đọc, nghe",
  "course-3-meta": "2–4 tháng",
  "courses-note":
    "Ngoài lộ trình JLPT, N&P mở lớp giao tiếp và tiếng Nhật thương mại theo nhu cầu.",
  "process-title": "Lộ trình học tại N&P",
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
  "schedule-title": "Lịch học linh hoạt",
  "schedule-description": "Các ca học thường mở — xác nhận lịch khai giảng khi tư vấn",
  "schedule-0-title": "Lớp sáng",
  "schedule-0-time": "8:00 – 10:00 · Thứ 2, 4, 6",
  "schedule-1-title": "Lớp tối",
  "schedule-1-time": "19:00 – 21:00 · Thứ 3, 5, 7",
  "schedule-2-title": "Lớp cuối tuần",
  "schedule-2-time": "9:00 – 12:00 · Chủ nhật",
  "schedule-3-title": "Lớp online",
  "schedule-3-time": "Lịch linh hoạt · Mọi ngày",
  "schedule-note":
    "Lịch mang tính tham khảo. Ca học và ngày khai giảng cụ thể sẽ được xác nhận khi đăng ký / tư vấn.",
  "instructors-title": "Đội ngũ giảng viên",
  "instructor-0-name": "Yamada Sensei",
  "instructor-0-role": "Giảng viên chính",
  "instructor-0-bio":
    "10+ năm kinh nghiệm giảng dạy tiếng Nhật cho người Việt. Chuyên luyện thi N1, N2 JLPT",
  "instructor-1-name": "Tanaka Sensei",
  "instructor-1-role": "Giảng viên giao tiếp",
  "instructor-1-bio":
    "Chuyên tiếng Nhật giao tiếp và văn hóa doanh nghiệp. 8 năm kinh nghiệm",
  "instructor-2-name": "Cô Minh Châu",
  "instructor-2-role": "Trợ giảng",
  "instructor-2-bio":
    "Thạc sĩ ngôn ngữ Nhật, từng học tập tại Tokyo. Hỗ trợ học viên Việt Nam",
  "stories-title": "Học viên nói gì",
  "stories-description": "Chia sẻ từ học viên đã học tại N&P",
};

const COURSE_ICONS = [Sprout, TreePine, Mountain, Target];
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
    document.title = "Đào Tạo Tiếng Nhật - N&P Company";
    const content =
      "Khóa học tiếng Nhật N5–N1 và luyện thi JLPT tại N&P. Sensei bản ngữ dẫn dắt, trợ giảng Việt hỗ trợ, lớp tối đa 10 học viên.";
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
      {/* Hero */}
      <section className="relative hero-gradient text-white overflow-hidden min-h-[calc(70svh-var(--header-height))] flex items-center">
        {heroImage ? (
          <div className="absolute inset-0">
            <img
              src={heroImage}
              alt=""
              className="w-full h-full object-cover opacity-25"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />
          </div>
        ) : null}

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
          <div className="max-w-3xl mx-auto text-center">
            <p className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-3">
              N&P
            </p>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold text-white/95 mb-3 leading-snug">
              <EditableText
                fieldName="heroTitle"
                text={getContent("heroTitle")}
                className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold text-white/95"
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </h1>
            <div className="text-sm sm:text-base text-white/80 mb-8 max-w-xl mx-auto leading-relaxed">
              <EditableText
                fieldName="heroDescription"
                text={getContent("heroDescription")}
                className="text-sm sm:text-base text-white/80"
                multiline
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="bg-white text-primary shadow-md font-semibold px-8 hover:bg-secondary hover:text-primary"
                onClick={() =>
                  document.getElementById("jp-tu-van")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Đăng ký học thử
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

      {/* Courses */}
      <section id="jp-courses" className="py-16 sm:py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 max-w-2xl mx-auto">
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

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {COURSE_ICONS.map((Icon, index) => (
              <div
                key={index}
                className="text-left p-5 rounded-xl bg-white border border-border/70 home-fade-up"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="w-11 h-11 mb-3 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1.5 text-base">
                  <EditableText
                    fieldName={`course-${index}-title`}
                    text={getContent(`course-${index}-title`)}
                    className="font-semibold text-foreground"
                    showEditButton={hasEditPermission}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                </h3>
                <div className="text-sm text-muted-foreground mb-3 leading-relaxed">
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
                <div className="text-sm font-semibold text-primary">
                  <EditableText
                    fieldName={`course-${index}-meta`}
                    text={getContent(`course-${index}-meta`)}
                    className="text-sm font-semibold text-primary"
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
          <p className="text-sm text-muted-foreground text-center max-w-2xl mx-auto mb-8">
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
          <div className="flex justify-center gap-3 flex-wrap">
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
              Đăng ký học thử
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

      {/* Schedule — CMS editable; note clarifies illustrative slots */}
      <section id="jp-schedule" className="py-16 sm:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 max-w-2xl mx-auto">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
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
            <div className="text-sm sm:text-base text-muted-foreground">
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
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="p-4 rounded-xl bg-neutral border border-border/70"
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
              </div>
            ))}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground text-center mb-8 max-w-xl mx-auto">
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
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="lg"
              className="border-primary text-primary hover:bg-primary/5 font-semibold px-8"
              onClick={() =>
                document.getElementById("jp-tu-van")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Chọn lịch phù hợp — đăng ký tư vấn
            </Button>
          </div>
        </div>
      </section>

      {/* Instructors */}
      <section className="py-16 sm:py-20 bg-neutral">
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
