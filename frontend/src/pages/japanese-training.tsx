import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EditableText } from "@/components/ui/editable-text";
import { ContactForm } from "@/components/ui/contact-form";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { ArticleSection } from "@/components/ArticleSection";
import { EditableHeroCarousel } from "@/components/ui/editable-hero-carousel";
import { EditableContentImage } from "@/components/ui/editable-content-image";
import { InstructorCard } from "@/components/ui/instructor-card";
import { TnjsPillTitle } from "@/components/TnjsUi";
import { TNJS } from "@/lib/tnjsTheme";
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
import { apiFetch } from "@/lib/queryClient";
import {
  Target,
  MessageSquare,
  Briefcase,
  User,
  Users,
  Laptop,
  Globe,
  Calendar,
  ShoppingCart,
  Check,
  ArrowRight,
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
    <section
      id="jp-open-classes"
      className="py-16 sm:py-20"
      style={{ backgroundColor: TNJS.cream }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <TnjsPillTitle variant="onLight">Lớp đang tuyển sinh</TnjsPillTitle>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <p className="text-sm sm:text-base text-neutral-600 text-center sm:text-left">
            Đăng ký và thanh toán online — số lượng chỗ có hạn
          </p>
          <Link href="/classes">
            <Button
              variant="outline"
              className="font-bold uppercase tracking-wide border-2"
              style={{ borderColor: TNJS.green, color: TNJS.charcoal }}
            >
              Xem tất cả lớp
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2"
              style={{ borderColor: TNJS.green }}
            />
          </div>
        ) : preview.length === 0 ? (
          <p className="text-center text-neutral-600 py-8">
            Hiện chưa có lớp mở đăng ký. Liên hệ tư vấn để nhận lịch khai giảng sớm nhất.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {preview.map((s) => (
              <div
                key={s.id}
                className="p-5 rounded-xl bg-white shadow-md flex flex-col"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  {s.courseLevel && (
                    <span
                      className="text-xs font-bold uppercase tracking-wide text-white px-2 py-0.5 rounded"
                      style={{ backgroundColor: TNJS.green }}
                    >
                      {s.courseLevel}
                    </span>
                  )}
                  <span className="font-bold" style={{ color: TNJS.orange }}>
                    {formatVnd(s.priceVnd)}
                  </span>
                </div>
                <h3 className="font-semibold text-neutral-900 mb-2">
                  <Link
                    href={`/classes/${s.id}`}
                    className="hover:opacity-80"
                    style={{ color: TNJS.charcoal }}
                  >
                    {s.title}
                  </Link>
                </h3>
                {s.scheduleText && (
                  <p className="text-sm text-neutral-600 flex gap-2 mb-4">
                    <Calendar className="w-4 h-4 shrink-0 mt-0.5" />
                    {s.scheduleText}
                  </p>
                )}
                <button
                  type="button"
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-opacity hover:opacity-95 disabled:opacity-60"
                  style={{ backgroundColor: TNJS.orange }}
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
                  <ShoppingCart className="w-4 h-4" />
                  Thêm vào giỏ
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

import { JAPANESE_CONTENT_DEFAULTS } from "@shared/siteContentDefaults";

const JP_DEFAULTS = JAPANESE_CONTENT_DEFAULTS;

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
      {/* Hero carousel — admin đổi / thêm ảnh trượt */}
      <EditableHeroCarousel imageTypePrefix="japanese" altPrefix="TNJS hero">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="max-w-3xl">
            <p className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-4 home-fade-up drop-shadow-sm">
              <EditableText
                fieldName="brandName"
                text={getContent("brandName") || "TNJS"}
                className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white"
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
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
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition-opacity hover:opacity-95"
                style={{ backgroundColor: TNJS.orange }}
                onClick={() =>
                  document.getElementById("jp-tu-van")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Đăng ký học miễn phí
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border-2 border-white bg-transparent px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white hover:text-neutral-900"
                onClick={() =>
                  document.getElementById("jp-courses")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Xem khóa học
              </button>
            </div>
          </div>
        </div>
      </EditableHeroCarousel>

      {/* Why TNJS — charcoal + pill title */}
      <section
        id="jp-why"
        className="py-16 sm:py-20"
        style={{ backgroundColor: TNJS.charcoal }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <TnjsPillTitle variant="onDark">
            <EditableText
              fieldName="why-title"
              text={getContent("why-title")}
              className="font-bold uppercase tracking-[0.12em] text-white"
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </TnjsPillTitle>
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start mb-12 mt-6">
            <div className="max-w-2xl">
              <div className="text-sm sm:text-base text-white/70 home-fade-up text-center lg:text-left">
                <EditableText
                  fieldName="why-description"
                  text={getContent("why-description")}
                  className="text-sm sm:text-base text-white/70"
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
            <div className="overflow-hidden rounded-xl shadow-lg">
              <EditableContentImage
                imageType="japanese-why"
                alt="Vì sao chọn TNJS"
                aspectClassName="aspect-[16/10]"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-10">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="border-t border-white/15 pt-5 home-fade-up"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <p
                  className="text-xs font-bold tracking-[0.2em] mb-2"
                  style={{ color: TNJS.green }}
                >
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="font-display text-lg font-bold text-white mb-2">
                  <EditableText
                    fieldName={`why-${index}-title`}
                    text={getContent(`why-${index}-title`)}
                    className="font-display text-lg font-bold text-white"
                    showEditButton={hasEditPermission}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                </h3>
                <div className="text-sm text-white/70 leading-relaxed">
                  <EditableText
                    fieldName={`why-${index}-description`}
                    text={getContent(`why-${index}-description`)}
                    className="text-sm text-white/70"
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

      {/* Courses by audience — green + yellow ribbon cards */}
      <section
        id="jp-courses"
        className="py-16 sm:py-20"
        style={{ backgroundColor: TNJS.green }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <TnjsPillTitle variant="onGreen">
            <EditableText
              fieldName="courses-title"
              text={getContent("courses-title")}
              className="font-bold uppercase tracking-[0.12em] text-white"
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </TnjsPillTitle>
          <div className="mx-auto mb-10 max-w-2xl text-center text-sm sm:text-base text-white/90">
            <EditableText
              fieldName="courses-description"
              text={getContent("courses-description")}
              className="text-sm sm:text-base text-white/90"
              multiline
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: COURSE_COUNT }, (_, index) => {
              const description = getContent(`course-${index}-description`);
              const bullets = description
                .split(/[.;]\s+/)
                .filter(Boolean)
                .slice(0, 3);
              return (
                <article
                  key={index}
                  className="group flex h-full flex-col overflow-hidden rounded-xl bg-white text-left shadow-lg transition-transform duration-300 hover:-translate-y-1.5 home-fade-up"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <EditableContentImage
                    imageType={`japanese-course-${index}`}
                    alt={getContent(`course-${index}-title`) || `Khóa ${index + 1}`}
                    aspectClassName="aspect-[16/10] rounded-none"
                    className="rounded-none"
                  />
                  <div
                    className="relative z-[1] -mt-1 px-3 py-2.5 text-center shadow-sm"
                    style={{ backgroundColor: TNJS.yellow }}
                  >
                    <h3 className="text-[13px] font-extrabold uppercase leading-snug text-neutral-900 line-clamp-2">
                      <EditableText
                        fieldName={`course-${index}-title`}
                        text={getContent(`course-${index}-title`)}
                        className="text-[13px] font-extrabold uppercase leading-snug text-neutral-900"
                        showEditButton={hasEditPermission}
                        editingField={editingField}
                        editValues={editValues}
                        onEditStart={handleEditStart}
                        onEditSave={handleEditSave}
                        onEditCancel={handleEditCancel}
                      />
                    </h3>
                  </div>
                  <div
                    className="flex flex-1 flex-col space-y-2 px-4 py-4"
                    style={{ backgroundColor: TNJS.cream }}
                  >
                    <p
                      className="text-[11px] font-bold uppercase tracking-[0.18em] mb-1"
                      style={{ color: TNJS.green }}
                    >
                      <EditableText
                        fieldName={`course-${index}-meta`}
                        text={getContent(`course-${index}-meta`)}
                        className="text-[11px] font-bold uppercase tracking-[0.18em]"
                        showEditButton={hasEditPermission}
                        editingField={editingField}
                        editValues={editValues}
                        onEditStart={handleEditStart}
                        onEditSave={handleEditSave}
                        onEditCancel={handleEditCancel}
                      />
                    </p>
                    {hasEditPermission ? (
                      <div className="flex items-start gap-2 text-[13px] leading-snug text-neutral-800">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0"
                          style={{ color: TNJS.green }}
                          strokeWidth={3}
                        />
                        <EditableText
                          fieldName={`course-${index}-description`}
                          text={description}
                          className="text-[13px] text-neutral-800"
                          multiline
                          showEditButton={hasEditPermission}
                          editingField={editingField}
                          editValues={editValues}
                          onEditStart={handleEditStart}
                          onEditSave={handleEditSave}
                          onEditCancel={handleEditCancel}
                        />
                      </div>
                    ) : bullets.length > 0 ? (
                      bullets.map((line) => (
                        <p
                          key={line}
                          className="flex items-start gap-2 text-[13px] leading-snug text-neutral-800"
                        >
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ color: TNJS.green }}
                            strokeWidth={3}
                          />
                          <span>{line.trim()}</span>
                        </p>
                      ))
                    ) : (
                      <p className="text-[13px] text-neutral-800">{description}</p>
                    )}
                  </div>
                  <div className="border-t border-black/5 bg-white px-4 py-4">
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-95"
                      style={{ backgroundColor: TNJS.orange }}
                      onClick={() =>
                        document
                          .getElementById("jp-tu-van")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                    >
                      Tư vấn khóa này
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="text-sm text-white/85 max-w-2xl mb-8 mx-auto text-center">
            <EditableText
              fieldName="courses-note"
              text={getContent("courses-note")}
              className="text-sm text-white/85"
              multiline
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition-opacity hover:opacity-95"
              style={{ backgroundColor: TNJS.orange }}
              onClick={() =>
                document.getElementById("jp-open-classes")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Lớp đang tuyển sinh
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border-2 border-white bg-transparent px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white hover:text-neutral-900"
              onClick={() =>
                document.getElementById("jp-tu-van")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Đăng ký học miễn phí
            </button>
          </div>
        </div>
      </section>

      {/* Open class sessions (commerce) */}
      <OpenClassesSection />

      {/* Process */}
      <section
        id="jp-process"
        className="py-16 sm:py-20"
        style={{ backgroundColor: TNJS.cream }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <TnjsPillTitle variant="onLight">
            <EditableText
              fieldName="process-title"
              text={getContent("process-title")}
              className="font-bold uppercase tracking-[0.12em] text-neutral-900"
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </TnjsPillTitle>
          <div className="mx-auto mb-10 max-w-2xl text-center text-sm sm:text-base text-neutral-600">
            <EditableText
              fieldName="process-description"
              text={getContent("process-description")}
              className="text-sm sm:text-base text-neutral-600"
              multiline
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
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
                    className="hidden lg:block absolute top-7 left-[calc(50%+2.5rem)] right-[calc(-50%+2.5rem)] h-px bg-black/10"
                    aria-hidden
                  />
                ) : null}
                <div className="flex flex-col items-center text-center">
                  <div
                    className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: TNJS.green }}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                    <span
                      className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-neutral-900"
                      style={{ backgroundColor: TNJS.yellow }}
                    >
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-neutral-900 mb-1">
                    <EditableText
                      fieldName={`process-${index}-title`}
                      text={getContent(`process-${index}-title`)}
                      className="text-base font-semibold text-neutral-900"
                      showEditButton={hasEditPermission}
                      editingField={editingField}
                      editValues={editValues}
                      onEditStart={handleEditStart}
                      onEditSave={handleEditSave}
                      onEditCancel={handleEditCancel}
                    />
                  </h3>
                  <div className="text-sm text-neutral-600 leading-relaxed max-w-[16rem]">
                    <EditableText
                      fieldName={`process-${index}-description`}
                      text={getContent(`process-${index}-description`)}
                      className="text-sm text-neutral-600"
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
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <TnjsPillTitle variant="onLight" className="!justify-start mb-6">
                <EditableText
                  fieldName="method-title"
                  text={getContent("method-title")}
                  className="font-bold uppercase tracking-[0.12em] text-neutral-900"
                  showEditButton={hasEditPermission}
                  editingField={editingField}
                  editValues={editValues}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              </TnjsPillTitle>
              <div className="space-y-4">
                {METHOD_ICONS.map((Icon, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white"
                      style={{ backgroundColor: TNJS.green }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900 text-base mb-0.5">
                        <EditableText
                          fieldName={`method-${index}-title`}
                          text={getContent(`method-${index}-title`)}
                          className="font-semibold text-neutral-900"
                          showEditButton={hasEditPermission}
                          editingField={editingField}
                          editValues={editValues}
                          onEditStart={handleEditStart}
                          onEditSave={handleEditSave}
                          onEditCancel={handleEditCancel}
                        />
                      </h3>
                      <div className="text-sm text-neutral-600">
                        <EditableText
                          fieldName={`method-${index}-description`}
                          text={getContent(`method-${index}-description`)}
                          className="text-sm text-neutral-600"
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

            <div className="relative overflow-hidden rounded-xl shadow-lg">
              <EditableContentImage
                imageType="japanese-classroom"
                alt="Lớp học tiếng Nhật TNJS"
                aspectClassName="aspect-[4/3]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Schedule — cream */}
      <section
        id="jp-schedule"
        className="py-16 sm:py-20"
        style={{ backgroundColor: TNJS.cream }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <TnjsPillTitle variant="onLight">
            <EditableText
              fieldName="schedule-title"
              text={getContent("schedule-title")}
              className="font-bold uppercase tracking-[0.12em] text-neutral-900"
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </TnjsPillTitle>
          <div className="mb-10 text-center text-sm sm:text-base text-neutral-600 home-fade-up">
            <EditableText
              fieldName="schedule-description"
              text={getContent("schedule-description")}
              className="text-sm sm:text-base text-neutral-600"
              multiline
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </div>
          <ul className="space-y-0 mb-6 bg-white rounded-xl shadow-md px-5 sm:px-6">
            {[0, 1, 2, 3].map((index) => (
              <li
                key={index}
                className="border-t border-black/10 first:border-t-0 py-5 home-fade-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <h3 className="font-semibold text-neutral-900 mb-1 text-base">
                  <EditableText
                    fieldName={`schedule-${index}-title`}
                    text={getContent(`schedule-${index}-title`)}
                    className="font-semibold text-neutral-900"
                    showEditButton={hasEditPermission}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                </h3>
                <div className="text-sm text-neutral-600">
                  <EditableText
                    fieldName={`schedule-${index}-time`}
                    text={getContent(`schedule-${index}-time`)}
                    className="text-sm text-neutral-600"
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
          <p className="text-xs sm:text-sm text-neutral-600 mb-8 max-w-xl mx-auto text-center">
            <EditableText
              fieldName="schedule-note"
              text={getContent("schedule-note")}
              className="text-xs sm:text-sm text-neutral-600"
              multiline
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition-opacity hover:opacity-95"
              style={{ backgroundColor: TNJS.orange }}
              onClick={() =>
                document.getElementById("jp-tu-van")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Đăng ký nhận lịch khai giảng
            </button>
            <Link href="/news">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border-2 px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-neutral-900 transition-opacity hover:opacity-90"
                style={{ borderColor: TNJS.green }}
              >
                Tin tức & sự kiện
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Instructors — white */}
      <section id="jp-instructors" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <TnjsPillTitle variant="onLight">
            <EditableText
              fieldName="instructors-title"
              text={getContent("instructors-title")}
              className="font-bold uppercase tracking-[0.12em] text-neutral-900"
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </TnjsPillTitle>
          <div className="grid md:grid-cols-3 gap-8 mt-10">
            {[0, 1, 2].map((index) => (
              <InstructorCard
                key={index}
                nameLabel={getContent(`instructor-${index}-name`)}
                name={
                  <EditableText
                    fieldName={`instructor-${index}-name`}
                    text={getContent(`instructor-${index}-name`)}
                    className="font-semibold text-foreground"
                    showEditButton={hasEditPermission}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                }
                title={
                  <EditableText
                    fieldName={`instructor-${index}-role`}
                    text={getContent(`instructor-${index}-role`)}
                    className="text-sm"
                    showEditButton={hasEditPermission}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                }
                description={
                  <EditableText
                    fieldName={`instructor-${index}-bio`}
                    text={getContent(`instructor-${index}-bio`)}
                    className="text-sm text-muted-foreground"
                    multiline
                    showEditButton={hasEditPermission}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                }
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

      {/* Testimonials — charcoal */}
      {jpTestimonials.length > 0 ? (
        <section
          className="py-16 sm:py-20"
          style={{ backgroundColor: TNJS.charcoal }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <TnjsPillTitle variant="onDark">
              <EditableText
                fieldName="stories-title"
                text={getContent("stories-title")}
                className="font-bold uppercase tracking-[0.12em] text-white"
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </TnjsPillTitle>
            <div className="mx-auto mb-10 max-w-2xl text-center text-sm sm:text-base text-white/70">
              <EditableText
                fieldName="stories-description"
                text={getContent("stories-description")}
                className="text-sm sm:text-base text-white/70"
                multiline
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
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

      {/* CTA form — green + white card */}
      <section
        className="py-16 sm:py-20"
        id="jp-tu-van"
        style={{ backgroundColor: TNJS.green }}
      >
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <TnjsPillTitle variant="onGreen">Đăng ký tư vấn</TnjsPillTitle>
          <p className="mx-auto mb-8 max-w-xl text-center text-sm text-white/90">
            Để lại thông tin — chúng tôi liên hệ tư vấn lộ trình tiếng Nhật phù hợp
          </p>
          <div className="overflow-hidden rounded-xl bg-white p-1 shadow-xl">
            <ContactForm
              defaultService="japanese"
              submitMessage="Yêu cầu đăng ký học thử / tư vấn tiếng Nhật từ trang đào tạo"
              className="!rounded-xl !shadow-none"
            />
          </div>
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
