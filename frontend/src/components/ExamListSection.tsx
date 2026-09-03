import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { TnjsPillTitle } from "@/components/TnjsUi";
import { TNJS } from "@/lib/tnjsTheme";
import { useAuth } from "@/hooks/useAuth";
import { portalPath, tnjsTrainingHref } from "@/lib/portal";
import { resolveExamAccess } from "@shared/examAccess";
import { type Exam } from "@shared/schema";
import {
  BookOpen,
  Check,
  Languages,
  Lock,
  Play,
  QrCode,
  Search,
} from "lucide-react";

type ExamListItem = Exam & {
  timeLimit?: number;
  questionCount?: number;
};

type ExamFilter = "all" | "demo" | "official";

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
  const loginHref = `/login?redirect=${encodeURIComponent(portalPath("luyenthi", `/exam/${exam.id}`))}`;

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
          <Link href={portalPath("luyenthi", `/exam/${exam.id}`)}>{ctaInner}</Link>
        )}
      </div>
    </article>
  );
}

export type ExamListSectionProps = {
  title?: ReactNode;
  description?: ReactNode;
  examsPerPage?: number;
  align?: "left" | "center" | "right";
};

/** Danh sách đề thi (lọc / tìm / phân trang) — dùng trong khối bố cục và trang online-exam. */
export function ExamListSection({
  title = "Danh sách đề thi",
  description = "Chọn đề miễn phí hoặc đề chính thức theo trình độ của bạn.",
  examsPerPage = 6,
  align = "center",
}: ExamListSectionProps) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [filter, setFilter] = useState<ExamFilter>("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

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

  const listLoading = isLoading || authLoading;
  const showLoginBanner =
    !isAuthenticated &&
    !listLoading &&
    (filter === "all" || filter === "official") &&
    officialCount > 0;

  return (
    <div>
      <TnjsPillTitle variant="onLight" align={align}>
        {title}
      </TnjsPillTitle>
      {description ? (
        <div
          className={
            align === "left"
              ? "mb-10 max-w-2xl text-left text-sm text-neutral-600 sm:text-base"
              : align === "right"
                ? "mb-10 ml-auto max-w-2xl text-right text-sm text-neutral-600 sm:text-base"
                : "mx-auto mb-10 max-w-2xl text-center text-sm text-neutral-600 sm:text-base"
          }
        >
          {description}
        </div>
      ) : (
        <div className="mb-10" />
      )}

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex gap-1 rounded-full border-2 bg-white p-1 shadow-sm"
          style={{ borderColor: TNJS.green }}
          role="tablist"
          aria-label="Lọc loại đề"
        >
          {(
            [
              { id: "all" as const, label: "Tất cả", count: activeExams.length },
              { id: "demo" as const, label: "Miễn phí", count: demoCount },
              { id: "official" as const, label: "Chính thức", count: officialCount },
            ] as const
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.id)}
                className="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors sm:text-sm"
                style={{
                  backgroundColor: active ? TNJS.green : "transparent",
                  color: active ? "#fff" : TNJS.green,
                }}
              >
                {tab.label}
                <span className="ml-1 opacity-80">({tab.count})</span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm đề thi…"
            className="pl-9"
          />
        </div>
      </div>

      {showLoginBanner ? (
        <div
          className="mb-8 flex flex-col gap-3 rounded-xl px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between"
          style={{ backgroundColor: TNJS.greenDeep }}
        >
          <p className="text-sm leading-relaxed text-white/90">
            Đăng nhập để làm đề chính thức và lưu kết quả.
          </p>
          <div className="flex shrink-0 gap-2">
            <Link href="/register">
              <span className="inline-flex items-center justify-center rounded-md border-2 border-white px-4 py-2 text-sm font-bold uppercase text-white">
                Đăng ký
              </span>
            </Link>
            <Link href={`/login?redirect=${encodeURIComponent("/")}`}>
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
            <a href={tnjsTrainingHref()} rel="noopener noreferrer">
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
            <div key={exam.id} style={{ animationDelay: `${(i % 6) * 50}ms` }}>
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
  );
}
