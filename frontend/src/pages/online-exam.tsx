import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { ContactForm } from "@/components/ui/contact-form";
import { EditableText } from "@/components/ui/editable-text";
import { EditableHeroCarousel } from "@/components/ui/editable-hero-carousel";
import {
  ExamPackagesSection,
  ExamAccessGuide,
} from "@/components/ExamPackagesSection";
import { TnjsPillTitle } from "@/components/TnjsUi";
import { TNJS } from "@/lib/tnjsTheme";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  useSiteContents,
  useUpsertSiteContent,
} from "@/hooks/useSiteContents";
import {
  BookOpen,
  Play,
  Lock,
  Search,
  ListChecks,
  ClipboardCheck,
  BarChart3,
  Languages,
  QrCode,
  Check,
} from "lucide-react";
import { type Exam } from "@shared/schema";
import { cn } from "@/lib/utils";
import { resolveExamAccess } from "@shared/examAccess";
import { portalHref, tnjsTrainingHref } from "@/lib/portal";

type ExamListItem = Exam & {
  timeLimit?: number;
  questionCount?: number;
};

type ExamFilter = "all" | "demo" | "official";

const LOGIN_ONLINE = `/login?redirect=${encodeURIComponent("/")}`;
const REGISTER_ONLINE = `/register`;

import { ONLINE_EXAM_CONTENT_DEFAULTS } from "@shared/siteContentDefaults";

const EXAM_DEFAULTS = ONLINE_EXAM_CONTENT_DEFAULTS;

const PROCESS_ICONS = [ListChecks, ClipboardCheck, BarChart3];

function ExamCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-lg animate-pulse" aria-hidden>
      <div className="h-24" style={{ backgroundColor: TNJS.green }} />
      <div className="h-10" style={{ backgroundColor: TNJS.yellow }} />
      <div className="space-y-3 p-4" style={{ backgroundColor: TNJS.cream }}>
        <div className="h-4 w-4/5 rounded bg-black/10" />
        <div className="h-4 w-3/5 rounded bg-black/10" />
      </div>
      <div className="h-16 bg-white p-4">
        <div className="h-10 rounded bg-black/10" />
      </div>
    </div>
  );
}

function ExamCard({
  exam,
  userId,
  role,
  activeLevels,
  activePackageIds,
}: {
  exam: ExamListItem;
  userId?: string | null;
  role?: string | null;
  activeLevels?: string[];
  activePackageIds?: string[];
}) {
  const isDemo = Boolean(exam.isDemo);
  const access = resolveExamAccess({
    exam,
    userId,
    role,
    activeLevels,
    activePackageIds,
  });
  const loginHref = `/login?redirect=${encodeURIComponent(`/exam/${exam.id}`)}`;

  let badge = isDemo ? "Miễn phí" : exam.level || "Chính thức";
  if (access.mode === "trial") badge = `Thi thử ${exam.level || ""}`.trim();
  if (access.mode === "full" && exam.level && !isDemo) badge = `Đã mở ${exam.level}`;

  const bullets = [
    `${exam.timeLimit ?? "—"} phút làm bài`,
    access.mode === "trial"
      ? "10 câu thi thử"
      : `${exam.questionCount ?? "—"} câu hỏi`,
    isDemo ? "Không cần đăng nhập" : badge,
  ];

  const ctaLabel =
    access.mode === "denied" && access.requiresLogin
      ? "Đăng nhập để thi"
      : access.mode === "denied" && access.requiresPurchase
        ? `Mua gói ${exam.level || ""}`
        : access.mode === "trial"
          ? "Thi thử 10 câu"
          : "Bắt đầu thi";

  const ctaInner = (
    <span
      className="inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-opacity group-hover:opacity-95"
      style={{
        backgroundColor:
          access.mode === "denied" ? TNJS.greenDeep : TNJS.orange,
      }}
    >
      {access.mode === "denied" && access.requiresLogin ? (
        <Lock className="h-4 w-4" />
      ) : access.mode === "denied" && access.requiresPurchase ? (
        <QrCode className="h-4 w-4" />
      ) : (
        <Play className="h-4 w-4" />
      )}
      {ctaLabel}
    </span>
  );

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl bg-white text-left shadow-lg transition-transform duration-300 hover:-translate-y-1.5 home-fade-up">
      <div
        className="relative flex h-28 flex-col items-center justify-center px-4 text-white"
        style={{
          background: `linear-gradient(160deg, ${TNJS.greenDeep} 0%, ${TNJS.greenBright} 100%)`,
        }}
      >
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-white/80">
          {isDemo ? "Đề thử" : "JLPT"}
        </span>
        <span className="mt-1 line-clamp-2 text-center text-lg font-black leading-tight">
          {exam.level?.toUpperCase() || (isDemo ? "FREE" : "ĐỀ")}
        </span>
        <span
          className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{
            backgroundColor: isDemo || access.mode === "full" ? "#fff" : TNJS.yellow,
            color: isDemo || access.mode === "full" ? TNJS.green : "#111",
          }}
        >
          {badge}
        </span>
      </div>

      <div
        className="relative z-[1] -mt-1 px-3 py-2.5 text-center shadow-sm"
        style={{ backgroundColor: TNJS.yellow }}
      >
        <h3 className="text-[13px] font-extrabold uppercase leading-snug text-neutral-900 line-clamp-2">
          {exam.title}
        </h3>
      </div>

      <div className="flex-1 space-y-2 px-4 py-4" style={{ backgroundColor: TNJS.cream }}>
        {bullets.map((line) => (
          <p
            key={line}
            className="flex items-start gap-2 text-[13px] leading-snug text-neutral-800"
          >
            <Check
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: TNJS.green }}
              strokeWidth={3}
            />
            <span>{line}</span>
          </p>
        ))}
        {exam.description ? (
          <p className="line-clamp-2 pl-6 pt-1 text-xs leading-relaxed text-neutral-600">
            {exam.description}
          </p>
        ) : null}
      </div>

      <div className="border-t border-black/5 bg-white px-4 py-4">
        {access.mode === "denied" && access.requiresLogin ? (
          <Link href={loginHref}>{ctaInner}</Link>
        ) : access.mode === "denied" && access.requiresPurchase ? (
          <a href="#exam-packages">{ctaInner}</a>
        ) : (
          <Link href={`/exam/${exam.id}`}>{ctaInner}</Link>
        )}
      </div>
    </article>
  );
}

export function OnlineExamPage({ embed = false }: { embed?: boolean }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const hasEditPermission = user?.role === "manager" || user?.role === "admin";
  const [filter, setFilter] = useState<ExamFilter>("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const examsPerPage = 6;

  const { data: remoteContents = {} } = useSiteContents("online-exam");
  const upsertContent = useUpsertSiteContent("online-exam");

  const getContent = useCallback(
    (key: string) => remoteContents[key] ?? EXAM_DEFAULTS[key] ?? "",
    [remoteContents],
  );

  const handleEditStart = (fieldName: string, currentValue: string) => {
    setEditingField(fieldName);
    setEditValues((prev) => ({ ...prev, [fieldName]: currentValue }));
  };

  const handleEditSave = (fieldName: string, value: string) => {
    upsertContent.mutate({ key: fieldName, value });
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
    setEditingField(null);
  };

  const handleEditCancel = () => setEditingField(null);

  const { data: exams = [], isLoading } = useQuery<ExamListItem[]>({
    queryKey: ["/api/exams"],
    retry: false,
  });

  const { data: packageMe } = useQuery<{
    activeLevels: string[];
    activePackageIds: string[];
  }>({
    queryKey: ["/api/exam-packages/me"],
    enabled: isAuthenticated,
    retry: false,
  });
  const activeLevels = packageMe?.activeLevels || [];
  const activePackageIds = packageMe?.activePackageIds || [];

  const activeExams = useMemo(
    () =>
      exams
        .filter((exam) => exam.isActive)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [exams],
  );

  const demoCount = activeExams.filter((e) => e.isDemo).length;
  const officialCount = activeExams.filter((e) => !e.isDemo).length;

  const filteredExams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeExams.filter((exam) => {
      if (filter === "demo" && !exam.isDemo) return false;
      if (filter === "official" && exam.isDemo) return false;
      if (!q) return true;
      const hay = `${exam.title ?? ""} ${exam.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [activeExams, filter, search]);

  const totalPages = Math.ceil(filteredExams.length / examsPerPage) || 1;
  const startIndex = (currentPage - 1) * examsPerPage;
  const pageExams = filteredExams.slice(startIndex, startIndex + examsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    document.title = "Luyện thi — N&P Group";
    const content =
      "Luyện thi tiếng Nhật online tại N&P: đề miễn phí không cần đăng nhập, đề chính thức lưu kết quả. Luyện JLPT và kiểm tra trình độ.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", content);
  }, []);

  const scrollToExams = (nextFilter?: ExamFilter) => {
    if (nextFilter) setFilter(nextFilter);
    requestAnimationFrame(() => {
      document.getElementById("exam-list")?.scrollIntoView({ behavior: "smooth" });
    });
  };

  const showLoginBanner =
    !isAuthenticated &&
    !isLoading &&
    !authLoading &&
    (filter === "all" || filter === "official") &&
    officialCount > 0;

  const listLoading = isLoading || authLoading;

  return (
    <div className="w-full max-w-full bg-white">
      {!embed ? (
      <>
      {/* Hero — CTA cam như tnjs.vn */}
      <EditableHeroCarousel
        imageTypePrefix="exam"
        altPrefix="Luyện thi hero"
        minHeightClassName="min-h-[calc(72svh-var(--header-height))]"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="mb-4 font-display text-5xl font-bold tracking-tight text-white drop-shadow-sm home-fade-up sm:text-6xl lg:text-7xl">
              <EditableText
                fieldName="brandName"
                text={getContent("brandName")}
                className="font-display text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </p>
            <h1 className="mb-4 font-display text-xl font-semibold leading-snug text-white/95 home-fade-up sm:text-2xl lg:text-3xl">
              <EditableText
                fieldName="heroTitle"
                text={getContent("heroTitle")}
                className="font-display text-xl font-semibold text-white/95 sm:text-2xl lg:text-3xl"
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </h1>
            <div className="mb-8 max-w-xl text-sm leading-relaxed text-white/85 home-fade-up sm:text-base">
              <EditableText
                fieldName="heroDescription"
                text={getContent("heroDescription")}
                className="text-sm text-white/85 sm:text-base"
                multiline
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </div>
            <div className="flex flex-col gap-3 home-fade-up sm:flex-row">
              <button
                type="button"
                onClick={() => scrollToExams("demo")}
                className="rounded-md px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition-opacity hover:opacity-95"
                style={{ backgroundColor: TNJS.orange }}
              >
                Thi thử miễn phí
              </button>
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => scrollToExams("official")}
                  className="rounded-md border-2 border-white bg-transparent px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white hover:text-neutral-900"
                >
                  Đề chính thức
                </button>
              ) : (
                <Link href={LOGIN_ONLINE}>
                  <span className="inline-flex w-full items-center justify-center rounded-md border-2 border-white bg-transparent px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-white hover:text-neutral-900 sm:w-auto">
                    Đăng nhập để thi chính thức
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </EditableHeroCarousel>

      {/* Stats — khối than như “Vì sao chọn chúng tôi” */}
      <section className="py-14 sm:py-16" style={{ backgroundColor: TNJS.charcoal }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TnjsPillTitle variant="onDark">Vì sao luyện thi tại N&P</TnjsPillTitle>
          <p className="mx-auto mb-10 max-w-xl text-center text-sm text-white/70">
            Số liệu đề đang mở trên hệ thống — cập nhật theo danh sách thi hiện tại.
          </p>
          <div className="mx-auto grid max-w-4xl grid-cols-3 gap-6 sm:gap-10">
            {(
              [
                { value: activeExams.length, label: "Đề đang mở" },
                { value: demoCount, label: "Miễn phí" },
                { value: officialCount, label: "Chính thức" },
              ] as const
            ).map((stat, i) => (
              <div
                key={stat.label}
                className="text-center home-fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <p
                  className="mb-2 text-xs font-bold tracking-[0.2em]"
                  style={{ color: TNJS.green }}
                >
                  {String(i + 1).padStart(2, "0")}
                </p>
                <div className="text-3xl font-black tabular-nums text-white sm:text-5xl">
                  {listLoading ? (
                    <span className="inline-block h-10 w-14 animate-pulse rounded bg-white/20" />
                  ) : (
                    stat.value
                  )}
                </div>
                <p className="mt-2 text-xs text-white/65 sm:text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quy trình — nền trắng, tiêu đề pill */}
      <section
        className="py-16 sm:py-20"
        style={{ backgroundColor: TNJS.cream }}
        aria-labelledby="exam-process-heading"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TnjsPillTitle id="exam-process-heading" variant="onLight">
            <EditableText
              fieldName="process-title"
              text={getContent("process-title")}
              className="font-bold uppercase tracking-[0.12em]"
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </TnjsPillTitle>
          <div className="mx-auto mb-12 max-w-2xl text-center text-sm text-neutral-600 sm:text-base">
            <EditableText
              fieldName="process-description"
              text={getContent("process-description")}
              className="text-sm text-neutral-600 sm:text-base"
              multiline
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </div>
          <ol className="grid gap-8 sm:grid-cols-3">
            {PROCESS_ICONS.map((Icon, index) => (
              <li
                key={index}
                className="rounded-xl bg-white p-6 text-center shadow-md home-fade-up"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span
                  className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: TNJS.green }}
                >
                  <Icon className="h-7 w-7" aria-hidden />
                </span>
                <p
                  className="mb-2 text-xs font-bold tracking-[0.2em]"
                  style={{ color: TNJS.green }}
                >
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mb-2 text-lg font-bold text-neutral-900">
                  <EditableText
                    fieldName={`process-${index}-title`}
                    text={getContent(`process-${index}-title`)}
                    className="text-lg font-bold text-neutral-900"
                    showEditButton={hasEditPermission}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                </h3>
                <div className="text-sm leading-relaxed text-neutral-600">
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
              </li>
            ))}
          </ol>
        </div>
      </section>

      </>
      ) : null}

      {/* Gói đề — xanh tnjs */}
      <section
        id="exam-packages"
        className="py-16 sm:py-20"
        style={{ backgroundColor: TNJS.green }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ExamPackagesSection />
        </div>
      </section>

      {/* Danh sách đề */}
      <section id="exam-list" className="py-16 sm:py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TnjsPillTitle variant="onLight">
            <EditableText
              fieldName="list-title"
              text={getContent("list-title")}
              className="font-bold uppercase tracking-[0.12em]"
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </TnjsPillTitle>
          <div className="mx-auto mb-10 max-w-2xl text-center text-sm text-neutral-600 sm:text-base">
            <EditableText
              fieldName="list-description"
              text={getContent("list-description")}
              className="text-sm text-neutral-600 sm:text-base"
              multiline
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </div>

          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="inline-flex gap-1 rounded-full border-2 bg-white p-1 shadow-sm"
              style={{ borderColor: TNJS.green }}
              role="tablist"
              aria-label="Lọc loại đề"
            >
              {(
                [
                  {
                    key: "all" as const,
                    label: "Tất cả",
                    count: listLoading ? "—" : activeExams.length,
                  },
                  {
                    key: "demo" as const,
                    label: "Miễn phí",
                    count: listLoading ? "—" : demoCount,
                  },
                  {
                    key: "official" as const,
                    label: "Chính thức",
                    count: listLoading ? "—" : officialCount,
                  },
                ]
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors",
                    filter === tab.key
                      ? "text-white"
                      : "text-neutral-600 hover:text-neutral-900",
                  )}
                  style={
                    filter === tab.key
                      ? { backgroundColor: TNJS.green }
                      : undefined
                  }
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs tabular-nums opacity-80">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:max-w-xs">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm đề thi..."
                className="border-2 bg-white pl-9 shadow-sm"
                style={{ borderColor: `${TNJS.green}55` }}
                aria-label="Tìm đề thi"
              />
            </div>
          </div>

          {showLoginBanner ? (
            <div
              className="mb-8 flex flex-col gap-4 rounded-xl px-5 py-5 text-white shadow-md sm:flex-row sm:items-center sm:justify-between"
              style={{ backgroundColor: TNJS.charcoal }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: TNJS.green }}
                >
                  <Lock className="h-5 w-5" aria-hidden />
                </span>
                <div className="text-sm leading-relaxed text-white/90">
                  <EditableText
                    fieldName="login-banner"
                    text={getContent("login-banner")}
                    className="text-sm text-white/90"
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
              <div className="flex shrink-0 gap-2">
                <Link href={REGISTER_ONLINE}>
                  <span className="inline-flex items-center justify-center rounded-md border-2 border-white px-4 py-2 text-sm font-bold uppercase text-white">
                    Đăng ký
                  </span>
                </Link>
                <Link href={LOGIN_ONLINE}>
                  <span
                    className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-bold uppercase text-white"
                    style={{ backgroundColor: TNJS.orange }}
                  >
                    Đăng nhập
                  </span>
                </Link>
              </div>
            </div>
          ) : null}

          {listLoading ? (
            <div
              className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
              aria-busy="true"
              aria-label="Đang tải danh sách đề thi"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <ExamCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredExams.length === 0 ? (
            <div
              className="rounded-xl border-2 border-dashed px-6 py-14 text-center"
              style={{ borderColor: TNJS.green, backgroundColor: TNJS.cream }}
            >
              <BookOpen
                className="mx-auto mb-3 h-10 w-10 opacity-50"
                style={{ color: TNJS.green }}
                aria-hidden
              />
              <p className="mx-auto mb-6 max-w-md text-sm text-neutral-600">
                {activeExams.length === 0
                  ? "Chưa có đề thi nào đang mở."
                  : search.trim()
                    ? "Không tìm thấy đề phù hợp. Thử từ khóa khác hoặc đổi bộ lọc."
                    : filter === "demo"
                      ? "Chưa có đề miễn phí."
                      : "Chưa có đề chính thức."}
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                {search.trim() || filter !== "all" ? (
                  <Button
                    variant="outline"
                    className="border-2 font-bold"
                    style={{ borderColor: TNJS.green, color: TNJS.green }}
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                    }}
                  >
                    Xem tất cả đề
                  </Button>
                ) : null}
                <a
                  href={tnjsTrainingHref()}
                  rel="noopener noreferrer"
                >
                  <span
                    className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-bold uppercase text-white"
                    style={{ backgroundColor: TNJS.orange }}
                  >
                    <Languages className="h-4 w-4" />
                    Ôn với khóa tiếng Nhật
                  </span>
                </a>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pageExams.map((exam, i) => (
                <div
                  key={exam.id}
                  style={{ animationDelay: `${(i % 6) * 50}ms` }}
                >
                  <ExamCard
                    exam={exam}
                    userId={user?.id}
                    role={user?.role}
                    activeLevels={activeLevels}
                    activePackageIds={activePackageIds}
                  />
                </div>
              ))}
            </div>
          )}

          {!listLoading && filteredExams.length > examsPerPage ? (
            <div className="mt-10">
              <p className="mb-4 text-center text-sm text-neutral-500">
                Hiển thị {startIndex + 1}–
                {Math.min(startIndex + examsPerPage, filteredExams.length)} /{" "}
                {filteredExams.length} đề
              </p>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                className="justify-center"
              />
            </div>
          ) : null}
        </div>
      </section>

      {!embed ? (
      <>
      {/* Đăng ký / tư vấn — khối xanh như form tnjs */}
      <section
        className="py-16 sm:py-20"
        style={{ backgroundColor: TNJS.green }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TnjsPillTitle variant="onGreen">Đăng ký tư vấn</TnjsPillTitle>
          <div className="mx-auto grid max-w-5xl items-start gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="home-fade-up text-white">
              <h2 className="mb-3 text-2xl font-black sm:text-3xl">
                <EditableText
                  fieldName="eco-title"
                  text={getContent("eco-title")}
                  className="text-2xl font-black text-white sm:text-3xl"
                  showEditButton={hasEditPermission}
                  editingField={editingField}
                  editValues={editValues}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              </h2>
              <div className="mb-8 max-w-md text-sm leading-relaxed text-white/90 sm:text-base">
                <EditableText
                  fieldName="eco-description"
                  text={getContent("eco-description")}
                  className="text-sm text-white/90 sm:text-base"
                  multiline
                  showEditButton={hasEditPermission}
                  editingField={editingField}
                  editValues={editValues}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              </div>
              <a
                href={tnjsTrainingHref()}
                rel="noopener noreferrer"
              >
                <span
                  className="inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-opacity hover:opacity-95"
                  style={{ backgroundColor: TNJS.orange }}
                >
                  <Languages className="h-4 w-4" />
                  Xem khóa tiếng Nhật
                </span>
              </a>
            </div>
            <div
              id="exam-tu-van"
              className="overflow-hidden rounded-xl bg-white p-1 shadow-xl home-fade-up"
            >
              <ContactForm
                variant="hero"
                className="!rounded-xl !shadow-none"
                defaultService="online-exam"
                submitMessage="Yêu cầu tư vấn thi online / luyện JLPT từ trang thi trực tuyến"
              />
            </div>
          </div>
        </div>
      </section>

      <ExamAccessGuide />
      </>
      ) : null}
    </div>
  );
}

export default OnlineExamPage;
