import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EditableText } from "@/components/ui/editable-text";
import { ContactForm } from "@/components/ui/contact-form";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { ArticleSection } from "@/components/ArticleSection";
import { ImageManager } from "@/components/ui/image-manager";
import { useAuth } from "@/hooks/useAuth";
import { useUiImages } from "@/hooks/useUiImages";
import {
  useSiteContents,
  useUpsertSiteContent,
  useBulkUpsertSiteContents,
} from "@/hooks/useSiteContents";
import { apiRequest } from "@/lib/queryClient";
import { testimonialKeys } from "@/lib/queryKeys";
import type { Testimonial } from "@shared/schema";
import {
  Search,
  FileText,
  Award,
  Handshake,
  Eye,
  Heart,
  TrendingUp,
  Users,
  MessageCircle,
  Send,
  CheckCircle2,
  Edit,
} from "lucide-react";

import { STUDY_ABROAD_CONTENT_DEFAULTS } from "@shared/siteContentDefaults";

const STUDY_DEFAULTS = STUDY_ABROAD_CONTENT_DEFAULTS;

/** 4 nhóm dịch vụ (gộp từ 6 mục cũ) */
const SERVICE_ICONS = [Search, FileText, Award, Handshake];
const WHY_ICONS = [Eye, Heart, TrendingUp, Users];
const PROCESS_ICONS = [MessageCircle, FileText, Send, CheckCircle2];

export default function StudyAbroad() {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const t = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
    }, 120);
    return () => window.clearTimeout(t);
  }, []);
  const { hasImageEditPermission, user } = useAuth();
  const hasEditPermission = user?.role === "manager" || user?.role === "admin";
  const { getImageByType, invalidateCache } = useUiImages();
  const queryClient = useQueryClient();

  const [heroOverride, setHeroOverride] = useState<string | null>(null);
  const [studentsOverride, setStudentsOverride] = useState<string | null>(null);
  const [showHeroImageManager, setShowHeroImageManager] = useState(false);
  const [showStudentsImageManager, setShowStudentsImageManager] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const migratedLocal = useRef(false);

  const { data: remoteContents = {}, isLoading: contentsLoading } =
    useSiteContents("study-abroad");
  const upsertContent = useUpsertSiteContent("study-abroad");
  const bulkUpsertContent = useBulkUpsertSiteContents("study-abroad");

  const getContent = useCallback(
    (key: string) => remoteContents[key] ?? STUDY_DEFAULTS[key] ?? "",
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

  const heroImage = heroOverride ?? getImageByType("study-abroad-hero");
  const studentsImage = studentsOverride ?? getImageByType("study-abroad-students");

  useEffect(() => {
    if (migratedLocal.current) return;
    if (!hasEditPermission || contentsLoading) return;
    migratedLocal.current = true;

    void (async () => {
      const entries: Array<{ key: string; value: string }> = [];
      try {
        const raw = localStorage.getItem("study-abroad-edit-values");
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const keyMap: Record<string, string> = {
            "study-abroad-services-title": "services-title",
            "study-why-np-title": "why-title",
            "study-why-choose-title": "why-title",
          };
          for (const [oldKey, value] of Object.entries(parsed)) {
            if (typeof value !== "string" || !value) continue;
            if (oldKey.startsWith("study-service-")) {
              const m = oldKey.match(/^study-service-(\d+)-(title|description)$/);
              if (m && Number(m[1]) <= 3) {
                const mapped = `service-${m[1]}-${m[2]}`;
                if (value !== STUDY_DEFAULTS[mapped] && remoteContents[mapped] !== value) {
                  entries.push({ key: mapped, value });
                }
              }
              continue;
            }
            const mapped = keyMap[oldKey] || oldKey;
            if (
              STUDY_DEFAULTS[mapped] !== undefined &&
              value !== STUDY_DEFAULTS[mapped] &&
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
      localStorage.removeItem("study-abroad-edit-values");
    })();
  }, [hasEditPermission, contentsLoading, remoteContents, bulkUpsertContent]);

  useEffect(() => {
    document.title = "Tư Vấn Du Học - N&P Company";
    const content =
      "Tư vấn du học tại Nhật Bản, Hàn Quốc, Mỹ, Canada và Châu Âu. Hỗ trợ chọn trường, hồ sơ, học bổng và đồng hành nhập học.";
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
              imageType="study-abroad-hero"
              altText="Study abroad hero"
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
                  document.getElementById("study-tu-van")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Tư vấn miễn phí
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-white bg-transparent text-white font-semibold px-8 hover:bg-white hover:text-primary hover:border-white"
                onClick={() =>
                  document.getElementById("study-process")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Xem lộ trình
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Markets */}
      <section
        id="study-countries"
        className="bg-white border-b border-border/60"
        aria-label="Thị trường du học"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 text-center">
          <h2 className="text-sm font-semibold text-foreground mb-2">
            <EditableText
              fieldName="countries-title"
              text={getContent("countries-title")}
              className="text-sm font-semibold text-foreground"
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </h2>
          <div className="text-sm text-foreground/80 font-medium tracking-wide">
            <EditableText
              fieldName="countries-line"
              text={getContent("countries-line")}
              className="text-sm text-foreground/80 font-medium"
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
      </section>

      {/* Services — 4 groups */}
      <section id="study-services" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-10 lg:gap-12 items-start">
            <div className="lg:col-span-2">
              <div className="mb-8 max-w-2xl">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
                  <EditableText
                    fieldName="services-title"
                    text={getContent("services-title")}
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
                    fieldName="services-description"
                    text={getContent("services-description")}
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
              <div className="grid sm:grid-cols-2 gap-6">
                {SERVICE_ICONS.map((Icon, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-11 h-11 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground mb-1">
                        <EditableText
                          fieldName={`service-${index}-title`}
                          text={getContent(`service-${index}-title`)}
                          className="text-base font-semibold text-foreground"
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
                          fieldName={`service-${index}-description`}
                          text={getContent(`service-${index}-description`)}
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
              {studentsImage ? (
                <img
                  src={studentsImage}
                  alt="Sinh viên du học với N&P"
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
                  studentsImage
                    ? "hidden rounded-xl w-full aspect-[4/5] bg-gradient-to-br from-primary/15 via-accent/20 to-primary/5 flex items-center justify-center text-primary/40 text-sm"
                    : "rounded-xl w-full aspect-[4/5] bg-gradient-to-br from-primary/15 via-accent/20 to-primary/5 flex items-center justify-center text-primary/40 text-sm"
                }
              >
                Ảnh sinh viên du học
              </div>
              {hasImageEditPermission && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowStudentsImageManager(true)}
                    className="absolute top-4 right-4 bg-white/90 hover:bg-white text-foreground"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Cập nhật ảnh
                  </Button>
                  <ImageManager
                    isOpen={showStudentsImageManager}
                    onClose={() => setShowStudentsImageManager(false)}
                    onImageUpdate={(url) => {
                      setStudentsOverride(url);
                      invalidateCache();
                    }}
                    imageType="study-abroad-students"
                    altText="Study abroad students"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="study-process" className="py-16 sm:py-20 bg-neutral">
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
              <li key={index} className="relative home-fade-up" style={{ animationDelay: `${index * 80}ms` }}>
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

      {/* Why N&P */}
      <section id="study-why" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
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
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {WHY_ICONS.map((Icon, index) => (
              <li key={index}>
                <div className="w-11 h-11 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">
                  <EditableText
                    fieldName={`why-${index}-title`}
                    text={getContent(`why-${index}-title`)}
                    className="text-base font-semibold text-foreground"
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
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Stories from shared testimonials DB */}
      {testimonials.length > 0 ? (
        <section className="py-16 sm:py-20 bg-neutral">
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
              {testimonials.slice(0, 3).map((t) => (
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

      {/* CTA form */}
      <section className="py-16 sm:py-20 bg-primary" id="study-tu-van">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <ContactForm
            variant="hero"
            defaultService="study-abroad"
            submitMessage="Yêu cầu tư vấn miễn phí từ trang tư vấn du học"
          />
        </div>
      </section>

      <ArticleSection
        category="study-abroad"
        title={getContent("articles-title")}
        description={getContent("articles-description")}
      />
    </div>
  );
}
