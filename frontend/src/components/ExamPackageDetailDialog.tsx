import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  BookOpen,
  Check,
  Clock,
  Lock,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TNJS } from "@/lib/tnjsTheme";
import { examPublicPath } from "@/lib/contentPaths";
import {
  formatExamCountShort,
  formatVnd,
  getEffectiveExamCount,
  getPackageSaleInfo,
} from "@/lib/examPackageDisplay";

export type PackageDetailSource = {
  id: string;
  name: string;
  description: string | null;
  level: string | null;
  examCount: number;
  priceVnd: number;
  compareAtPriceVnd?: number | null;
  linkedExamCount?: number;
  displayExamCount?: number;
};

type PackageExamRow = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  level: string | null;
  isDemo: boolean | null;
  isLevelTrial: boolean | null;
};

type PackageDetailResponse = PackageDetailSource & {
  exams: PackageExamRow[];
};

function examAccessLabel(
  exam: PackageExamRow,
  opts: { ownsPackage: boolean; isAuthenticated: boolean },
): { kind: "open" | "trial" | "locked"; label: string } {
  if (opts.ownsPackage || exam.isDemo) {
    return { kind: "open", label: exam.isDemo ? "Miễn phí" : "Làm bài" };
  }
  if (exam.isLevelTrial) {
    return {
      kind: "trial",
      label: opts.isAuthenticated ? "Thi thử" : "Thi thử (cần đăng nhập)",
    };
  }
  return { kind: "locked", label: "Trong gói" };
}

export function ExamPackageDetailDialog({
  pkg,
  open,
  onOpenChange,
  ownsPackage,
  pending,
  inCart = false,
  isAuthenticated,
  onAddToCart,
  addPending,
}: {
  pkg: PackageDetailSource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownsPackage: boolean;
  pending: boolean;
  inCart?: boolean;
  isAuthenticated: boolean;
  onAddToCart: () => void;
  addPending?: boolean;
}) {
  const packageId = pkg?.id || "";
  const { data, isLoading, isError } = useQuery<PackageDetailResponse>({
    queryKey: [`/api/exam-packages/${packageId}`],
    enabled: open && !!packageId,
    retry: false,
    staleTime: 30_000,
  });

  const detail = data || pkg;
  const exams = data?.exams || [];
  const examCount = detail ? getEffectiveExamCount(detail) : 0;
  const sale = detail ? getPackageSaleInfo(detail) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,720px)] w-[95vw] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="space-y-2 border-b border-neutral-100 px-5 py-4 text-left">
          <DialogTitle className="text-lg font-bold text-neutral-900 pr-6">
            {detail?.name || "Chi tiết gói đề"}
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-600">
            {detail?.level ? `Cấp ${detail.level} · ` : null}
            {formatExamCountShort(examCount)}
            {detail?.description ? ` — ${detail.description}` : null}
          </DialogDescription>
          {sale && !ownsPackage && !pending ? (
            <div className="flex flex-wrap items-baseline gap-2 pt-1">
              {sale.onSale ? (
                <>
                  <span className="text-sm text-neutral-400 line-through tabular-nums">
                    {formatVnd(sale.compareAtPriceVnd!)}
                  </span>
                  <span
                    className="text-xl font-black tabular-nums"
                    style={{ color: TNJS.orange }}
                  >
                    {formatVnd(sale.salePriceVnd)}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                    style={{ backgroundColor: TNJS.orange }}
                  >
                    −{sale.discountPercent}%
                  </span>
                </>
              ) : (
                <span className="text-xl font-black tabular-nums text-neutral-900">
                  {formatVnd(detail!.priceVnd)}
                </span>
              )}
            </div>
          ) : null}
          {ownsPackage ? (
            <p className="text-sm font-semibold" style={{ color: TNJS.green }}>
              Bạn đã có quyền làm toàn bộ đề trong gói
            </p>
          ) : pending ? (
            <p className="text-sm font-semibold text-amber-700">
              Đang chờ duyệt thanh toán
            </p>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Đề trong gói
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl bg-neutral-100"
                />
              ))}
            </div>
          ) : isError ? (
            <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
              Không tải được danh sách đề. Thử đóng và mở lại.
            </p>
          ) : exams.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-10 text-center">
              <BookOpen className="mx-auto mb-2 h-8 w-8 text-neutral-300" />
              <p className="text-sm text-neutral-500">
                Gói chưa gắn đề công khai. Admin cập nhật trong Cpanel.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {exams.map((exam, index) => {
                const access = examAccessLabel(exam, {
                  ownsPackage,
                  isAuthenticated,
                });
                const href = examPublicPath(exam);
                const canOpen =
                  access.kind === "open" ||
                  (access.kind === "trial" && isAuthenticated);

                const rowInner = (
                  <>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-sm font-bold text-neutral-600">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-neutral-900 leading-snug">
                        {exam.title}
                      </p>
                      {exam.description ? (
                        <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">
                          {exam.description}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {exam.isDemo ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Miễn phí
                          </span>
                        ) : null}
                        {exam.isLevelTrial && !exam.isDemo ? (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                            Có thi thử
                          </span>
                        ) : null}
                        {!exam.isDemo && !exam.isLevelTrial ? (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                            Trong gói
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {canOpen ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold text-white"
                          style={{ backgroundColor: TNJS.green }}
                        >
                          {access.kind === "trial" ? (
                            <Sparkles className="h-3.5 w-3.5" />
                          ) : (
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          )}
                          {access.label}
                        </span>
                      ) : access.kind === "trial" ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800">
                          <Sparkles className="h-3.5 w-3.5" />
                          Thi thử
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-500">
                          <Lock className="h-3.5 w-3.5" />
                          Trong gói
                        </span>
                      )}
                    </div>
                  </>
                );

                return (
                  <li key={exam.id}>
                    {canOpen ? (
                      <Link
                        href={href}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3",
                          "transition-colors hover:border-emerald-300 hover:bg-emerald-50/40",
                        )}
                      >
                        {rowInner}
                      </Link>
                    ) : access.kind === "trial" && !isAuthenticated ? (
                      <Link
                        href={`/login?redirect=${encodeURIComponent(href)}`}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3",
                          "transition-colors hover:border-sky-300 hover:bg-sky-50/40",
                        )}
                      >
                        {rowInner}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50/80 p-3">
                        {rowInner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-neutral-100 bg-neutral-50/80 px-5 py-4 sm:flex-col sm:space-x-0">
          {ownsPackage ? (
            <Button
              type="button"
              className="w-full"
              style={{ backgroundColor: TNJS.green }}
              onClick={() => {
                onOpenChange(false);
                const list = document.getElementById("exam-list");
                if (list) {
                  list.scrollIntoView({ behavior: "smooth" });
                  return;
                }
                window.location.href = "/luyen-thi/online-exam#exam-list";
              }}
            >
              Xem danh sách đề
            </Button>
          ) : pending ? (
            <Button type="button" variant="secondary" className="w-full" disabled>
              <Clock className="mr-2 h-4 w-4" />
              Đang chờ duyệt
            </Button>
          ) : inCart ? (
            <Button type="button" className="w-full font-bold" asChild>
              <Link href="/cart" onClick={() => onOpenChange(false)}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Đã có trong giỏ — thanh toán
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full font-bold"
              style={{ backgroundColor: TNJS.orange }}
              disabled={addPending || examCount === 0}
              onClick={onAddToCart}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {addPending ? "Đang thêm…" : "Thêm gói vào giỏ"}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
