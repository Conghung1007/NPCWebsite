import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { EditableText } from "@/components/ui/editable-text";
import { ContactForm } from "@/components/ui/contact-form";
import { ArticleSection } from "@/components/ArticleSection";
import { ImageManager } from "@/components/ui/image-manager";
import { useAuth } from "@/hooks/useAuth";
import { useUiImages } from "@/hooks/useUiImages";
import {
  useSiteContents,
  useUpsertSiteContent,
  useBulkUpsertSiteContents,
} from "@/hooks/useSiteContents";
import {
  Plane,
  Briefcase,
  GraduationCap,
  Home,
  CheckCircle,
  MessageCircle,
  FileText,
  Send,
  CheckCircle2,
  Edit,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { usePortal } from "@/contexts/PortalContext";
import { portalHref } from "@/lib/portal";

import { VISA_CONTENT_DEFAULTS } from "@shared/siteContentDefaults";

type DocTypeKey = "tourism" | "business" | "study" | "residence";

const VISA_DEFAULTS = VISA_CONTENT_DEFAULTS;

function parseDocsByType(raw?: string): Record<DocTypeKey, string[]> {
  const fallback = JSON.parse(VISA_CONTENT_DEFAULTS["documents-by-type"]) as Record<
    DocTypeKey,
    string[]
  >;
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Record<DocTypeKey, string[]>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function parseFaqs(raw?: string): Array<{ question: string; answer: string }> {
  const fallback = JSON.parse(VISA_CONTENT_DEFAULTS.faqs) as Array<{
    question: string;
    answer: string;
  }>;
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

const DEFAULT_DOCS_BY_TYPE = parseDocsByType();
const DEFAULT_FAQS = parseFaqs();

const DOC_TYPE_META: Array<{ key: DocTypeKey; label: string; typeIndex: number }> = [
  { key: "tourism", label: "Du lịch", typeIndex: 0 },
  { key: "business", label: "Công tác", typeIndex: 1 },
  { key: "study", label: "Du học", typeIndex: 2 },
  { key: "residence", label: "Định cư", typeIndex: 3 },
];

const TYPE_ICONS = [Plane, Briefcase, GraduationCap, Home];

/** Đồng bộ 4 bước với trang chủ */
const PROCESS_STEPS = [
  {
    title: "Tư vấn miễn phí",
    description: "Trao đổi mục tiêu và loại visa phù hợp với bạn",
    icon: MessageCircle,
  },
  {
    title: "Chuẩn bị hồ sơ",
    description: "Hướng dẫn giấy tờ, rà soát và hoàn thiện trước khi nộp",
    icon: FileText,
  },
  {
    title: "Nộp & theo dõi",
    description: "Nộp đơn, cập nhật tiến độ và hỗ trợ khi cần",
    icon: Send,
  },
  {
    title: "Nhận kết quả",
    description: "Thông báo kết quả và hướng dẫn bước tiếp theo",
    icon: CheckCircle2,
  },
];

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function VisaServices() {
  const [, setLocation] = useLocation();
  const { portal } = usePortal();
  const { user, hasImageEditPermission } = useAuth();
  const hasEditPermission = user?.role === "manager" || user?.role === "admin";
  const { getImageByType, invalidateCache } = useUiImages();

  // Visa lives under Hướng nghiệp — send other-portal visitors there
  useEffect(() => {
    if (portal !== "huongnghiep") {
      window.location.replace(portalHref("huongnghiep", "/visa-services"));
    }
  }, [portal]);

  const [heroOverride, setHeroOverride] = useState<string | null>(null);
  const [consultationOverride, setConsultationOverride] = useState<string | null>(null);
  const [showHeroImageManager, setShowHeroImageManager] = useState(false);
  const [showConsultationImageManager, setShowConsultationImageManager] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [activeDocType, setActiveDocType] = useState<DocTypeKey>("tourism");
  const migratedLocal = useRef(false);

  const { data: remoteContents = {}, isLoading: contentsLoading } = useSiteContents("visa");
  const upsertContent = useUpsertSiteContent("visa");
  const bulkUpsertContent = useBulkUpsertSiteContents("visa");

  const getContent = useCallback(
    (key: string) => remoteContents[key] ?? VISA_DEFAULTS[key] ?? "",
    [remoteContents],
  );

  const docsByType = useMemo(() => {
    const parsed = parseJson<Partial<Record<DocTypeKey, string[]>>>(
      remoteContents["documents-by-type"],
      {},
    );
    const merged = { ...DEFAULT_DOCS_BY_TYPE };
    for (const key of Object.keys(DEFAULT_DOCS_BY_TYPE) as DocTypeKey[]) {
      if (Array.isArray(parsed[key]) && parsed[key]!.length > 0) {
        merged[key] = parsed[key]!;
      }
    }
    // Legacy single list → fill tourism if typed docs missing in DB
    if (!remoteContents["documents-by-type"] && remoteContents["required-documents"]) {
      const legacy = parseJson<string[]>(remoteContents["required-documents"], []);
      if (legacy.length > 0) merged.tourism = legacy;
    }
    return merged;
  }, [remoteContents]);

  const activeDocuments = docsByType[activeDocType];

  const faqs = useMemo(
    () =>
      parseJson<Array<{ question: string; answer: string }>>(
        remoteContents.faqs,
        DEFAULT_FAQS,
      ),
    [remoteContents],
  );

  const heroImage = heroOverride ?? getImageByType("visa-hero");
  const consultationImage = consultationOverride ?? getImageByType("visa-consultation");

  useEffect(() => {
    if (migratedLocal.current) return;
    if (!hasEditPermission || contentsLoading) return;
    migratedLocal.current = true;

    void (async () => {
      const entries: Array<{ key: string; value: string }> = [];

      try {
        const docsRaw = localStorage.getItem("visa-required-documents");
        if (docsRaw && !remoteContents["documents-by-type"] && !remoteContents["required-documents"]) {
          const legacy = JSON.parse(docsRaw) as string[];
          if (Array.isArray(legacy)) {
            entries.push({
              key: "documents-by-type",
              value: JSON.stringify({ ...DEFAULT_DOCS_BY_TYPE, tourism: legacy }),
            });
          }
        }
        const faqsRaw = localStorage.getItem("visa-faqs");
        if (faqsRaw && !remoteContents.faqs) {
          entries.push({ key: "faqs", value: faqsRaw });
        }
      } catch {
        // ignore
      }

      if (entries.length > 0) await bulkUpsertContent.mutateAsync(entries);
      localStorage.removeItem("visa-required-documents");
      localStorage.removeItem("visa-faqs");
    })();
  }, [hasEditPermission, contentsLoading, remoteContents, bulkUpsertContent]);

  useEffect(() => {
    document.title = "Dịch Vụ Xin Thị Thực - N&P Company";
    const content =
      "Dịch vụ xin thị thực chuyên nghiệp với tỷ lệ thành công 98% cho hơn 50 quốc gia. Hỗ trợ visa du lịch, công tác, sinh viên, định cư.";
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

  const persistDocsByType = (next: Record<DocTypeKey, string[]>) => {
    upsertContent.mutate({ key: "documents-by-type", value: JSON.stringify(next) });
  };

  const handleEditSave = (fieldName: string, value: string) => {
    if (fieldName.startsWith("visa-document-")) {
      const index = parseInt(fieldName.replace("visa-document-", ""), 10);
      if (!Number.isNaN(index)) {
        const next = { ...docsByType, [activeDocType]: [...docsByType[activeDocType]] };
        next[activeDocType][index] = value;
        persistDocsByType(next);
      }
    } else if (fieldName.startsWith("faq-question-") || fieldName.startsWith("faq-answer-")) {
      const isQuestion = fieldName.startsWith("faq-question-");
      const index = parseInt(
        fieldName.replace(isQuestion ? "faq-question-" : "faq-answer-", ""),
        10,
      );
      if (!Number.isNaN(index)) {
        const next = faqs.map((f, i) => {
          if (i !== index) return f;
          return isQuestion ? { ...f, question: value } : { ...f, answer: value };
        });
        upsertContent.mutate({ key: "faqs", value: JSON.stringify(next) });
      }
    } else {
      upsertContent.mutate({ key: fieldName, value });
    }
    setEditValues((prev) => {
      const n = { ...prev };
      delete n[fieldName];
      return n;
    });
    setEditingField(null);
  };

  const handleEditCancel = () => setEditingField(null);

  const selectDocType = (key: DocTypeKey) => {
    setActiveDocType(key);
    document.getElementById("visa-documents")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (portal !== "huongnghiep") {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground text-sm">
        Đang chuyển tới cổng Hướng nghiệp…
      </div>
    );
  }

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
              imageType="visa-hero"
              altText="Visa hero background"
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
                  document.getElementById("visa-tu-van")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Tư vấn miễn phí
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-white bg-transparent text-white font-semibold px-8 hover:bg-white hover:text-primary hover:border-white"
                onClick={() =>
                  document.getElementById("visa-process")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Xem quy trình
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Visa types — no stock photo; types are the visual */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
              <EditableText
                fieldName="types-title"
                text={getContent("types-title")}
                className="font-display text-2xl sm:text-3xl font-bold text-foreground"
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Chọn loại visa để xem hồ sơ tham khảo bên dưới
            </p>
          </div>

          {consultationImage ? (
            <div className="relative mb-10 max-w-3xl mx-auto">
              <img
                src={consultationImage}
                alt="Tư vấn và hồ sơ thị thực tại N&P"
                loading="lazy"
                className="rounded-xl w-full h-auto object-cover aspect-[16/9]"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              {hasImageEditPermission && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConsultationImageManager(true)}
                    className="absolute top-4 right-4 bg-white/90 hover:bg-white text-foreground"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Cập nhật ảnh
                  </Button>
                  <ImageManager
                    isOpen={showConsultationImageManager}
                    onClose={() => setShowConsultationImageManager(false)}
                    onImageUpdate={(url) => {
                      setConsultationOverride(url);
                      invalidateCache();
                    }}
                    imageType="visa-consultation"
                    altText="Visa consultation"
                  />
                </>
              )}
            </div>
          ) : hasImageEditPermission ? (
            <div className="mb-8 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConsultationImageManager(true)}
                className="text-muted-foreground"
              >
                <Edit className="w-4 h-4 mr-2" />
                Thêm ảnh minh họa (hộ chiếu / hồ sơ visa)
              </Button>
              <ImageManager
                isOpen={showConsultationImageManager}
                onClose={() => setShowConsultationImageManager(false)}
                onImageUpdate={(url) => {
                  setConsultationOverride(url);
                  invalidateCache();
                }}
                imageType="visa-consultation"
                altText="Visa consultation"
              />
            </div>
          ) : null}

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto mb-10">
            {TYPE_ICONS.map((Icon, index) => {
              const meta = DOC_TYPE_META[index];
              const isActive = activeDocType === meta.key;
              return (
                <button
                  key={meta.key}
                  type="button"
                  onClick={() => selectDocType(meta.key)}
                  className={cn(
                    "flex flex-col items-start gap-3 p-5 text-left rounded-xl border transition-colors",
                    isActive
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/70 bg-neutral hover:border-primary/30",
                  )}
                >
                  <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground text-base mb-1">
                      <EditableText
                        fieldName={`type-${index}-title`}
                        text={getContent(`type-${index}-title`)}
                        className="font-semibold text-foreground"
                        showEditButton={hasEditPermission}
                        editingField={editingField}
                        editValues={editValues}
                        onEditStart={handleEditStart}
                        onEditSave={handleEditSave}
                        onEditCancel={handleEditCancel}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <EditableText
                        fieldName={`type-${index}-description`}
                        text={getContent(`type-${index}-description`)}
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
                </button>
              );
            })}
          </div>

          <div className="text-center max-w-2xl mx-auto">
            <h3 className="text-base font-semibold text-foreground mb-2">
              <EditableText
                fieldName="countries-title"
                text={getContent("countries-title")}
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
                fieldName="countries-line"
                text={getContent("countries-line")}
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
      </section>

      {/* Process — 4 steps, aligned with home */}
      <section id="visa-process" className="py-16 sm:py-20 bg-neutral">
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
            {PROCESS_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="relative">
                  {index < PROCESS_STEPS.length - 1 ? (
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

      {/* Documents by type + FAQ */}
      <section id="visa-documents" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-2">
                <EditableText
                  fieldName="documents-title"
                  text={getContent("documents-title")}
                  className="font-display text-xl sm:text-2xl font-bold text-foreground"
                  showEditButton={hasEditPermission}
                  editingField={editingField}
                  editValues={editValues}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              </h2>
              <div className="text-sm text-muted-foreground mb-5">
                <EditableText
                  fieldName="documents-note"
                  text={getContent("documents-note")}
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

              <div
                className="flex flex-wrap gap-1 border-b border-border mb-6"
                role="tablist"
                aria-label="Loại visa"
              >
                {DOC_TYPE_META.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={activeDocType === tab.key}
                    onClick={() => setActiveDocType(tab.key)}
                    className={cn(
                      "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                      activeDocType === tab.key
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <ul className="space-y-3" role="tabpanel">
                {activeDocuments.map((doc, index) => (
                  <li key={`${activeDocType}-${index}`} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="text-sm text-muted-foreground flex-1">
                      <EditableText
                        fieldName={`visa-document-${index}`}
                        text={doc}
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
            </div>

            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-6">
                <EditableText
                  fieldName="faq-title"
                  text={getContent("faq-title")}
                  className="font-display text-xl sm:text-2xl font-bold text-foreground"
                  showEditButton={hasEditPermission}
                  editingField={editingField}
                  editValues={editValues}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              </h2>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left text-sm sm:text-base">
                      <EditableText
                        fieldName={`faq-question-${index}`}
                        text={faq.question}
                        className="text-left font-medium"
                        showEditButton={hasEditPermission}
                        editingField={editingField}
                        editValues={editValues}
                        onEditStart={handleEditStart}
                        onEditSave={handleEditSave}
                        onEditCancel={handleEditCancel}
                      />
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="text-sm text-muted-foreground">
                        <EditableText
                          fieldName={`faq-answer-${index}`}
                          text={faq.answer}
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
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </div>
      </section>

      {/* CTA form */}
      <section className="py-16 sm:py-20 bg-primary" id="visa-tu-van">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <ContactForm
            variant="hero"
            defaultService="visa"
            submitMessage="Yêu cầu tư vấn miễn phí từ trang dịch vụ visa"
          />
        </div>
      </section>

      <ArticleSection
        category="visa-services"
        title="Thông tin về dịch vụ visa"
        description="Thông tin hữu ích và cập nhật về thủ tục xin visa các quốc gia"
      />
    </div>
  );
}
