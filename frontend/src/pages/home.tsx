import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useUiImages } from "@/hooks/useUiImages";
import {
  useSiteContents,
  useUpsertSiteContent,
  useBulkUpsertSiteContents,
} from "@/hooks/useSiteContents";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { ContactForm } from "@/components/ui/contact-form";
import { Button } from "@/components/ui/button";
import { ImageManager } from "@/components/ui/image-manager";
import { EditableText } from "@/components/ui/editable-text";
import { apiRequest } from "@/lib/queryClient";
import { testimonialKeys } from "@/lib/queryKeys";
import type { Testimonial } from "@shared/schema";
import {
  IdCard,
  GraduationCap,
  Languages,
  BookOpen,
  Users,
  Heart,
  DollarSign,
  TrendingUp,
  ArrowRight,
  Edit,
  MessageCircle,
  FileText,
  Send,
  CheckCircle2,
  Award,
  ShieldCheck,
} from "lucide-react";

import { HOME_CONTENT_DEFAULTS } from "@shared/siteContentDefaults";
import { tnjsTrainingHref } from "@/lib/portal";

const HOME_DEFAULTS = HOME_CONTENT_DEFAULTS;

function navigateService(
  route: string,
  external: boolean | undefined,
  setLocation: (path: string) => void,
) {
  if (external || /^https?:\/\//i.test(route)) {
    window.location.href = route;
    return;
  }
  setLocation(route);
}

const SERVICE_DEFS = [
  {
    key: "visa" as const,
    titleKey: "visaTitle",
    descriptionKey: "visaDescription",
    route: "/visa-services",
    imageType: "visa-service",
    icon: IdCard,
  },
  {
    key: "study" as const,
    titleKey: "studyTitle",
    descriptionKey: "studyDescription",
    route: "/study-abroad",
    imageType: "study-abroad",
    icon: GraduationCap,
  },
  {
    key: "japanese" as const,
    titleKey: "japaneseTitle",
    descriptionKey: "japaneseDescription",
    route: tnjsTrainingHref(),
    external: true,
    imageType: "japanese-training",
    icon: Languages,
  },
  {
    key: "exam" as const,
    titleKey: "examTitle",
    descriptionKey: "examDescription",
    route: "/online-exam",
    imageType: "online-exam",
    icon: BookOpen,
  },
];

const REASON_ICONS = [
  <Users className="h-6 w-6 text-primary" key="u" />,
  <Heart className="h-6 w-6 text-primary" key="h" />,
  <DollarSign className="h-6 w-6 text-primary" key="d" />,
  <TrendingUp className="h-6 w-6 text-primary" key="t" />,
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, hasImageEditPermission } = useAuth();
  const { getImageByType, invalidateCache } = useUiImages();
  const queryClient = useQueryClient();
  const migratedLocal = useRef(false);

  const [showHeroImageManager, setShowHeroImageManager] = useState(false);
  const [showWhyChooseImageManager, setShowWhyChooseImageManager] = useState(false);
  const [heroOverride, setHeroOverride] = useState<string | null>(null);
  const [whyChooseOverride, setWhyChooseOverride] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const hasEditPermission = user?.role === "manager" || user?.role === "admin";

  const { data: remoteContents = {}, isLoading: contentsLoading } = useSiteContents("home");
  const upsertContent = useUpsertSiteContent("home");
  const bulkUpsertContent = useBulkUpsertSiteContents("home");

  const getContent = useCallback(
    (key: string) => remoteContents[key] ?? HOME_DEFAULTS[key] ?? "",
    [remoteContents],
  );

  const { data: testimonials = [], isLoading: testimonialsLoading } = useQuery<Testimonial[]>({
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

  // Migrate localStorage homepage copy (+ leftover testimonials) → DB once
  useEffect(() => {
    if (migratedLocal.current) return;
    if (!hasEditPermission || contentsLoading || testimonialsLoading) return;
    migratedLocal.current = true;

    void (async () => {
      const entries: Array<{ key: string; value: string }> = [];

      try {
        const serviceRaw = localStorage.getItem("home-service-texts");
        if (serviceRaw) {
          const parsed = JSON.parse(serviceRaw) as Record<string, unknown>;
          for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === "string" && value && value !== HOME_DEFAULTS[key]) {
              entries.push({ key, value });
            }
          }
        }
        const editRaw = localStorage.getItem("home-edit-values");
        if (editRaw) {
          const parsed = JSON.parse(editRaw) as Record<string, unknown>;
          for (const [key, value] of Object.entries(parsed)) {
            if (key.startsWith("testimonial:") || key.startsWith("testimonial-")) continue;
            if (typeof value === "string" && value && value !== HOME_DEFAULTS[key]) {
              if (!entries.some((e) => e.key === key)) entries.push({ key, value });
            }
          }
        }
      } catch {
        // ignore
      }

      if (entries.length > 0) {
        const toSave = entries.filter((e) => remoteContents[e.key] !== e.value);
        if (toSave.length > 0) await bulkUpsertContent.mutateAsync(toSave);
      }

      const rawTestimonials = localStorage.getItem("home-testimonials");
      if (rawTestimonials && testimonials.length > 0) {
        try {
          const localItems = JSON.parse(rawTestimonials) as Array<{
            name?: string;
            role?: string;
            content?: string;
            avatar?: string;
          }>;
          if (Array.isArray(localItems)) {
            const count = Math.min(localItems.length, testimonials.length);
            for (let i = 0; i < count; i++) {
              const local = localItems[i];
              const remote = testimonials[i];
              const payload: {
                name?: string;
                role?: string;
                content?: string;
                avatarUrl?: string | null;
              } = {};
              if (local.name && local.name !== remote.name) payload.name = local.name;
              if (local.role && local.role !== remote.role) payload.role = local.role;
              if (local.content && local.content !== remote.content) {
                payload.content = local.content;
              }
              if (local.avatar && local.avatar !== (remote.avatarUrl || "")) {
                payload.avatarUrl = local.avatar;
              }
              if (Object.keys(payload).length > 0) {
                await updateTestimonialMutation.mutateAsync({ id: remote.id, ...payload });
              }
            }
          }
        } catch {
          // ignore
        }
      }

      localStorage.removeItem("home-service-texts");
      localStorage.removeItem("home-edit-values");
      localStorage.removeItem("home-testimonials");
    })();
  }, [
    hasEditPermission,
    contentsLoading,
    testimonialsLoading,
    remoteContents,
    testimonials,
    bulkUpsertContent,
    updateTestimonialMutation,
  ]);

  const heroBgImage = heroOverride ?? getImageByType("hero-banner");
  const whyChooseImage = whyChooseOverride ?? getImageByType("why-choose-us");

  useEffect(() => {
    document.title = "N&P Company - Đối Tác Tin Cậy Cho Giấc Mơ Toàn Cầu";
    const content =
      "N&P - Chuyên gia hàng đầu về dịch vụ thị thực, tư vấn du học, đào tạo tiếng Nhật và hệ thống thi trực tuyến với hơn 10 năm kinh nghiệm";
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

  const handleEditCancel = () => {
    setEditingField(null);
  };

  const handleTestimonialAvatarUpdate = (testimonialId: string, newAvatar: string) => {
    updateTestimonialMutation.mutate({ id: testimonialId, avatarUrl: newAvatar });
  };

  const trustItems = [
    { icon: Users, label: "Tư vấn 1-1 tận tâm" },
    { icon: ShieldCheck, label: "Cam kết hoàn phí" },
    { icon: Languages, label: "Giảng viên bản ngữ" },
    { icon: Award, label: "Hồ sơ minh bạch" },
  ];

  const processSteps = [
    {
      icon: MessageCircle,
      title: "Tư vấn miễn phí",
      description: "Trao đổi mục tiêu và lộ trình phù hợp với bạn",
    },
    {
      icon: FileText,
      title: "Chuẩn bị hồ sơ",
      description: "Hướng dẫn giấy tờ, kiểm tra và hoàn thiện hồ sơ",
    },
    {
      icon: Send,
      title: "Nộp & theo dõi",
      description: "Nộp đơn, cập nhật tiến độ và hỗ trợ khi cần",
    },
    {
      icon: CheckCircle2,
      title: "Nhận kết quả",
      description: "Thông báo kết quả và đồng hành bước tiếp theo",
    },
  ];

  const stats = [
    { number: "1000+", label: "Khách hàng tin tưởng" },
    { number: "98%", label: "Tỷ lệ thành công" },
    { number: "50+", label: "Quốc gia hỗ trợ" },
  ];

  return (
    <div className="w-full max-w-full">
      {/* Hero */}
      <section className="relative hero-gradient text-white overflow-hidden min-h-[calc(100svh-var(--header-height))] flex items-center">
        {heroBgImage ? (
          <div className="absolute inset-0">
            <img
              src={heroBgImage}
              alt=""
              className="w-full h-full object-cover opacity-25"
              onError={(e) => {
                const fallback =
                  "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=2074&q=80";
                if (e.currentTarget.src !== fallback) {
                  e.currentTarget.src = fallback;
                  return;
                }
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
              imageType="hero-banner"
              altText="Hero background"
            />
          </div>
        )}

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <p className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
              N&P
            </p>

            <h1 className="font-display text-2xl sm:text-3xl lg:text-[2.5rem] font-semibold text-white/95 mb-3 leading-snug">
              <EditableText
                fieldName="heroTitle"
                text={getContent("heroTitle")}
                className="font-display text-2xl sm:text-3xl lg:text-[2.5rem] font-semibold text-white/95"
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

            <div
              className="flex flex-col sm:flex-row gap-3 justify-center home-fade-up"
              style={{ animationDelay: "120ms" }}
            >
              <Button
                size="lg"
                className="bg-white text-primary shadow-md font-semibold px-8 hover:bg-secondary hover:text-primary"
                onClick={() => setLocation("/contact")}
              >
                Tư vấn miễn phí
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-white bg-transparent text-white font-semibold px-8 hover:bg-white hover:text-primary hover:border-white"
                onClick={() =>
                  document.getElementById("services")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Xem dịch vụ
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-white border-b border-border/60" aria-label="Điểm tin cậy">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <ul className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.label}
                  className="flex items-center justify-center gap-2.5 text-sm text-foreground/80"
                >
                  <Icon className="h-5 w-5 text-primary shrink-0" aria-hidden />
                  <span className="font-medium">{item.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-neutral border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {stats.map((stat) => (
              <div key={stat.label} className="home-fade-up">
                <div className="font-display text-3xl sm:text-4xl font-bold text-primary tabular-nums">
                  {stat.number}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-2">
              <EditableText
                fieldName="services-title"
                text={getContent("services-title")}
                className="font-display text-3xl sm:text-4xl font-bold text-foreground"
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

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {SERVICE_DEFS.map((service) => {
              const Icon = service.icon;
              const imageUrl = getImageByType(service.imageType);
              return (
                <div
                  key={service.key}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigateService(service.route, service.external, setLocation)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigateService(service.route, service.external, setLocation);
                    }
                  }}
                  className="group text-left rounded-xl overflow-hidden bg-neutral border border-border/70 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary home-fade-up"
                >
                  <div className="relative aspect-[16/10] bg-primary/5 overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const fallback = e.currentTarget.nextElementSibling;
                          if (fallback instanceof HTMLElement) {
                            fallback.classList.remove("hidden");
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className={
                        imageUrl
                          ? "hidden absolute inset-0 flex items-center justify-center"
                          : "absolute inset-0 flex items-center justify-center"
                      }
                    >
                      <Icon className="h-12 w-12 text-primary/50" />
                    </div>
                  </div>
                  <div className="p-5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 mb-2 text-primary">
                      <Icon className="h-5 w-5 shrink-0" />
                      <h3 className="text-base font-semibold text-foreground">
                        <EditableText
                          fieldName={service.titleKey}
                          text={getContent(service.titleKey)}
                          className="text-base font-semibold text-foreground"
                          showEditButton={hasEditPermission}
                          editingField={editingField}
                          editValues={editValues}
                          onEditStart={handleEditStart}
                          onEditSave={handleEditSave}
                          onEditCancel={handleEditCancel}
                        />
                      </h3>
                    </div>
                    <div className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3">
                      <EditableText
                        fieldName={service.descriptionKey}
                        text={getContent(service.descriptionKey)}
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
                      className="inline-flex items-center text-sm font-semibold text-primary group-hover:gap-2 transition-all"
                      onClick={() =>
                        navigateService(service.route, service.external, setLocation)
                      }
                    >
                      Tìm hiểu thêm
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-16 sm:py-20 bg-neutral" aria-labelledby="process-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <h2
              id="process-heading"
              className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-2"
            >
              Quy trình làm việc
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Bốn bước rõ ràng từ tư vấn đến kết quả — bạn luôn biết mình đang ở đâu
            </p>
          </div>

          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {processSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="relative home-fade-up"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  {index < processSteps.length - 1 ? (
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
                    <h3 className="text-base font-semibold text-foreground mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[16rem]">
                      {step.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Why Choose N&P */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-3">
                <EditableText
                  fieldName="why-choose-title"
                  text={getContent("why-choose-title")}
                  className="font-display text-3xl sm:text-4xl font-bold text-foreground"
                  showEditButton={hasEditPermission}
                  editingField={editingField}
                  editValues={editValues}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              </h2>
              <div className="text-sm sm:text-base text-muted-foreground mb-8">
                <EditableText
                  fieldName="why-choose-description"
                  text={getContent("why-choose-description")}
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

              <div className="space-y-4">
                {REASON_ICONS.map((icon, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                      {icon}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground mb-0.5">
                        <EditableText
                          fieldName={`why-reason-title-${index}`}
                          text={getContent(`why-reason-title-${index}`)}
                          className="text-base font-semibold text-foreground"
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
                          fieldName={`why-reason-description-${index}`}
                          text={getContent(`why-reason-description-${index}`)}
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
              {whyChooseImage ? (
                <img
                  src={whyChooseImage}
                  alt="Đội ngũ N&P"
                  loading="lazy"
                  className="rounded-xl shadow-lg w-full h-auto"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget.nextElementSibling;
                    if (fallback instanceof HTMLElement) {
                      fallback.classList.remove("hidden");
                    }
                  }}
                />
              ) : null}
              <div
                className={
                  whyChooseImage
                    ? "hidden rounded-xl w-full aspect-[4/3] bg-gradient-to-br from-primary/15 via-accent/20 to-primary/5 flex items-center justify-center text-primary/40 text-sm"
                    : "rounded-xl w-full aspect-[4/3] bg-gradient-to-br from-primary/15 via-accent/20 to-primary/5 flex items-center justify-center text-primary/40 text-sm"
                }
              >
                Ảnh giới thiệu N&P
              </div>
              {hasImageEditPermission && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowWhyChooseImageManager(true)}
                    className="absolute top-4 right-4 bg-white/90 hover:bg-white text-foreground"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Cập nhật ảnh
                  </Button>
                  <ImageManager
                    isOpen={showWhyChooseImageManager}
                    onClose={() => setShowWhyChooseImageManager(false)}
                    onImageUpdate={(url) => {
                      setWhyChooseOverride(url);
                      invalidateCache();
                    }}
                    imageType="why-choose-us"
                    altText="Why choose N&P"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 sm:py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-2">
              <EditableText
                fieldName="testimonials-title"
                text={getContent("testimonials-title")}
                className="font-display text-3xl sm:text-4xl font-bold text-foreground"
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
                fieldName="testimonials-description"
                text={getContent("testimonials-description")}
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
            {testimonials.map((testimonial) => (
              <TestimonialCard
                key={testimonial.id}
                id={testimonial.id}
                name={testimonial.name}
                role={testimonial.role}
                content={testimonial.content}
                avatar={testimonial.avatarUrl}
                rating={testimonial.rating ?? 5}
                allowAvatarEdit={hasImageEditPermission}
                onAvatarUpdate={(newAvatar) =>
                  handleTestimonialAvatarUpdate(testimonial.id, newAvatar)
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

      {/* Contact */}
      <section className="py-16 sm:py-20 bg-primary" id="tu-van">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <ContactForm variant="hero" />
        </div>
      </section>
    </div>
  );
}
