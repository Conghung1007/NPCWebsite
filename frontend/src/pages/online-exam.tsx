import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { ContactForm } from "@/components/ui/contact-form";
import { EditableText } from "@/components/ui/editable-text";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  useSiteContents,
  useUpsertSiteContent,
} from "@/hooks/useSiteContents";
import {
  Clock,
  BookOpen,
  Play,
  Lock,
  Search,
  ListChecks,
  ClipboardCheck,
  BarChart3,
  Languages,
} from "lucide-react";
import { type Exam } from "@shared/schema";
import { cn } from "@/lib/utils";

type ExamListItem = Exam & {
  timeLimit?: number;
  questionCount?: number;
};

type ExamFilter = "all" | "demo" | "official";

const LOGIN_ONLINE = `/login?redirect=${encodeURIComponent("/online-exam")}`;
const REGISTER_ONLINE = `/register`;

const EXAM_DEFAULTS: Record<string, string> = {
  heroTitle: "Thi trực tuyến",
  heroDescription:
    "Luyện đề miễn phí ngay, hoặc đăng nhập để làm đề chính thức và lưu kết quả.",
  "process-title": "Cách thi tại N&P",
  "process-description":
    "Ba bước rõ ràng — đề thử không cần tài khoản; đề chính thức lưu kết quả sau khi đăng nhập",
  "process-0-title": "Chọn đề",
  "process-0-description": "Thi thử miễn phí hoặc đề chính thức theo mục tiêu",
  "process-1-title": "Làm bài",
  "process-1-description": "Theo thời gian và phần thi của đề đã chọn",
  "process-2-title": "Xem kết quả",
  "process-2-description":
    "Đề chính thức lưu điểm; đề thử giúp tự đánh giá",
  "list-title": "Danh sách đề thi",
  "list-description": "Lọc miễn phí / chính thức hoặc tìm theo tên đề",
  "login-banner":
    "Đề chính thức cần tài khoản để lưu kết quả. Đăng nhập rồi quay lại trang này hoặc vào thẳng đề bạn chọn.",
  "eco-title": "Luyện thi gắn với khóa tiếng Nhật",
  "eco-description":
    "Đề online giúp đo trình độ; lớp N&P đồng hành từ sơ cấp đến JLPT với sensei bản ngữ và lớp nhỏ.",
};

const PROCESS_ICONS = [ListChecks, ClipboardCheck, BarChart3];

function ExamCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-border/70 bg-white p-5 animate-pulse"
      aria-hidden
    >
      <div className="h-5 bg-muted rounded w-3/4 mb-3" />
      <div className="h-4 bg-muted rounded w-full mb-2" />
      <div className="h-4 bg-muted rounded w-2/3 mb-6" />
      <div className="h-3 bg-muted rounded w-1/3 mb-2" />
      <div className="h-3 bg-muted rounded w-1/4 mb-4" />
      <div className="h-10 bg-muted rounded w-full" />
    </div>
  );
}

function ExamCard({
  exam,
  locked,
}: {
  exam: ExamListItem;
  locked?: boolean;
}) {
  const isDemo = Boolean(exam.isDemo);
  const loginHref = `/login?redirect=${encodeURIComponent(`/exam/${exam.id}`)}`;

  return (
    <article className="flex flex-col rounded-xl border border-border/70 bg-white p-5 text-left">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground leading-snug">
          {exam.title}
        </h3>
        <Badge
          variant="outline"
          className={
            isDemo
              ? "shrink-0 border-primary/40 text-primary bg-primary/5"
              : "shrink-0 border-transparent bg-primary text-primary-foreground"
          }
        >
          {isDemo ? "Miễn phí" : "Chính thức"}
        </Badge>
      </div>
      {exam.description ? (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
          {exam.description}
        </p>
      ) : (
        <div className="mb-4" />
      )}
      <div className="mt-auto space-y-2 text-sm text-muted-foreground mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary shrink-0" aria-hidden />
          <span>{exam.timeLimit ?? "—"} phút</span>
        </div>
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary shrink-0" aria-hidden />
          <span>{exam.questionCount ?? "—"} câu hỏi</span>
        </div>
      </div>
      {locked ? (
        <Link href={loginHref}>
          <Button variant="outline" className="w-full border-primary text-primary">
            <Lock className="w-4 h-4 mr-2" />
            Đăng nhập để thi
          </Button>
        </Link>
      ) : (
        <Link href={`/exam/${exam.id}`}>
          <Button className="w-full bg-primary hover:bg-[hsl(142,76%,30%)] text-primary-foreground">
            <Play className="w-4 h-4 mr-2" />
            Bắt đầu thi
          </Button>
        </Link>
      )}
    </article>
  );
}

export function OnlineExamPage() {
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
    document.title = "Thi Trực Tuyến - N&P Company";
    const content =
      "Thi thử tiếng Nhật online tại N&P: đề miễn phí không cần đăng nhập, đề chính thức lưu kết quả. Luyện JLPT và kiểm tra trình độ.";
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
    <div className="w-full max-w-full">
      {/* Hero */}
      <section className="relative hero-gradient text-white overflow-hidden min-h-[calc(55svh-var(--header-height))] flex items-center">
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
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
                onClick={() => scrollToExams("demo")}
              >
                Thi thử miễn phí
              </Button>
              {isAuthenticated ? (
                <Button
                  variant="outline"
                  size="lg"
                  className="border-2 border-white bg-transparent text-white font-semibold px-8 hover:bg-white hover:text-primary hover:border-white"
                  onClick={() => scrollToExams("official")}
                >
                  Đề chính thức
                </Button>
              ) : (
                <Link href={LOGIN_ONLINE}>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-2 border-white bg-transparent text-white font-semibold px-8 w-full sm:w-auto hover:bg-white hover:text-primary hover:border-white"
                  >
                    Đăng nhập để thi chính thức
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 sm:py-14 bg-white border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto text-center">
            {(
              [
                { value: activeExams.length, label: "Đề đang mở" },
                { value: demoCount, label: "Miễn phí" },
                { value: officialCount, label: "Chính thức" },
              ] as const
            ).map((stat) => (
              <div key={stat.label}>
                <div className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                  {listLoading ? (
                    <span className="inline-block h-8 w-10 bg-muted rounded animate-pulse" />
                  ) : (
                    stat.value
                  )}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        className="py-14 sm:py-16 bg-neutral"
        aria-labelledby="exam-process-heading"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <h2
              id="exam-process-heading"
              className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2"
            >
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
          <ol className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {PROCESS_ICONS.map((Icon, index) => (
              <li key={index} className="text-center">
                <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
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
                <div className="text-sm text-muted-foreground leading-relaxed max-w-[16rem] mx-auto">
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
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Exam list */}
      <section id="exam-list" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
              <EditableText
                fieldName="list-title"
                text={getContent("list-title")}
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
                fieldName="list-description"
                text={getContent("list-description")}
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

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-6">
            <div
              className="inline-flex rounded-lg border border-border/70 bg-neutral p-1 gap-1"
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
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    filter === tab.key
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs tabular-nums opacity-70">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:max-w-xs">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm đề thi..."
                className="pl-9 bg-neutral border-border/70"
                aria-label="Tìm đề thi"
              />
            </div>
          </div>

          {showLoginBanner ? (
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-primary/25 bg-primary/5 px-5 py-4">
              <div className="flex items-start gap-3">
                <Lock
                  className="h-5 w-5 text-primary shrink-0 mt-0.5"
                  aria-hidden
                />
                <div className="text-sm text-foreground">
                  <EditableText
                    fieldName="login-banner"
                    text={getContent("login-banner")}
                    className="text-sm text-foreground"
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
              <div className="flex gap-2 shrink-0">
                <Link href={REGISTER_ONLINE}>
                  <Button variant="outline" className="border-primary text-primary">
                    Đăng ký
                  </Button>
                </Link>
                <Link href={LOGIN_ONLINE}>
                  <Button className="bg-primary hover:bg-[hsl(142,76%,30%)] text-primary-foreground">
                    Đăng nhập
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}

          {listLoading ? (
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
              aria-busy="true"
              aria-label="Đang tải danh sách đề thi"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <ExamCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-neutral px-6 py-12 text-center">
              <BookOpen
                className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground mb-4">
                {activeExams.length === 0
                  ? "Chưa có đề thi nào đang mở."
                  : search.trim()
                    ? "Không tìm thấy đề phù hợp. Thử từ khóa khác hoặc đổi bộ lọc."
                    : filter === "demo"
                      ? "Chưa có đề miễn phí."
                      : "Chưa có đề chính thức."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {search.trim() || filter !== "all" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                    }}
                  >
                    Xem tất cả đề
                  </Button>
                ) : null}
                <Link href="/japanese-training">
                  <Button className="bg-primary hover:bg-[hsl(142,76%,30%)] text-primary-foreground">
                    <Languages className="w-4 h-4 mr-2" />
                    Ôn với khóa tiếng Nhật
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pageExams.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  locked={!exam.isDemo && !isAuthenticated}
                />
              ))}
            </div>
          )}

          {!listLoading && filteredExams.length > examsPerPage ? (
            <div className="mt-8">
              <p className="mb-4 text-center text-sm text-muted-foreground">
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

      {/* Ecosystem + CTA */}
      <section className="py-14 sm:py-16 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-3">
                <EditableText
                  fieldName="eco-title"
                  text={getContent("eco-title")}
                  className="font-display text-2xl sm:text-3xl font-bold text-foreground"
                  showEditButton={hasEditPermission}
                  editingField={editingField}
                  editValues={editValues}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              </h2>
              <div className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed max-w-md">
                <EditableText
                  fieldName="eco-description"
                  text={getContent("eco-description")}
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
              <Link href="/japanese-training">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/5 font-semibold"
                >
                  Xem khóa tiếng Nhật
                </Button>
              </Link>
            </div>
            <div id="exam-tu-van" className="rounded-xl bg-primary p-6 sm:p-8">
              <ContactForm
                variant="hero"
                defaultService="online-exam"
                submitMessage="Yêu cầu tư vấn thi online / luyện JLPT từ trang thi trực tuyến"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default OnlineExamPage;
