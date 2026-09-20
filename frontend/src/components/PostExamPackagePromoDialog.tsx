import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { authLinkWithReturn } from "@/components/AuthShell";
import { BookOpen, Check, Lock, ShoppingCart, Sparkles } from "lucide-react";
import { TNJS } from "@/lib/tnjsTheme";
import {
  formatExamCountShort,
  formatVnd,
  getEffectiveExamCount,
  getPackageSaleInfo,
  packageLevelBanner,
} from "@/lib/examPackageDisplay";
import { cn } from "@/lib/utils";

type StorePackage = {
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

const LEVEL_ORDER = ["N5", "N4", "N3", "N2", "N1"];

function sortPackages(list: StorePackage[]) {
  return [...list].sort((a, b) => {
    const ia = a.level ? LEVEL_ORDER.indexOf(a.level.toUpperCase()) : 99;
    const ib = b.level ? LEVEL_ORDER.indexOf(b.level.toUpperCase()) : 99;
    if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.name.localeCompare(b.name, "vi");
  });
}

export type PostExamPackagePromoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Guest: register + packages (cannot unlock detail). Member: packages then dismiss to results. */
  mode: "guest" | "member";
  /** Demo miễn phí vs thi thử 10 câu đề số 1 trong gói. */
  promoKind?: "demo" | "trial";
  examTitle?: string;
  /** Pin related package (trial/demo) to the top of the promo list. */
  preferredPackageId?: string | null;
  preferredLevel?: string | null;
  /** After login/register, return here (e.g. /exam-result/:id). */
  returnPath?: string | null;
};

/**
 * Post demo/trial exam promo — guest: đăng ký + gói đề; member: giới thiệu gói rồi xem kết quả.
 */
export function PostExamPackagePromoDialog({
  open,
  onOpenChange,
  mode,
  promoKind = "demo",
  examTitle,
  preferredPackageId,
  preferredLevel,
  returnPath,
}: PostExamPackagePromoDialogProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { addPackage } = useCart();

  const resolvedReturn =
    returnPath ||
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "");

  const registerHref = authLinkWithReturn("/register", resolvedReturn);
  const loginHref = authLinkWithReturn("/login", resolvedReturn);

  const { data: packages = [], isLoading } = useQuery<StorePackage[]>({
    queryKey: ["/api/exam-packages"],
    enabled: open,
    retry: false,
    staleTime: 30_000,
  });

  const sorted = useMemo(() => {
    const list = sortPackages(packages);
    if (!preferredPackageId && !preferredLevel) return list.slice(0, 5);

    const preferred: StorePackage[] = [];
    const rest: StorePackage[] = [];
    for (const pkg of list) {
      const byId = preferredPackageId && pkg.id === preferredPackageId;
      const byLevel =
        !byId &&
        preferredLevel &&
        pkg.level?.toUpperCase() === preferredLevel.toUpperCase();
      if (byId || byLevel) preferred.push(pkg);
      else rest.push(pkg);
    }
    preferred.sort((a, b) => {
      const aExact = preferredPackageId && a.id === preferredPackageId ? 0 : 1;
      const bExact = preferredPackageId && b.id === preferredPackageId ? 0 : 1;
      return aExact - bExact;
    });
    return [...preferred, ...rest].slice(0, 5);
  }, [packages, preferredPackageId, preferredLevel]);

  const highlightPackageId = useMemo(() => {
    if (preferredPackageId && sorted.some((p) => p.id === preferredPackageId)) {
      return preferredPackageId;
    }
    if (preferredLevel) {
      const match = sorted.find(
        (p) => p.level?.toUpperCase() === preferredLevel.toUpperCase(),
      );
      return match?.id ?? null;
    }
    return null;
  }, [sorted, preferredPackageId, preferredLevel]);

  const handleAdd = (pkg: StorePackage) => {
    if (!isAuthenticated && mode === "guest") {
      toast({
        title: "Đăng ký để mua gói đề",
        description: "Tạo tài khoản để thêm gói vào giỏ và lưu tiến độ luyện thi.",
      });
      window.location.href = registerHref;
      return;
    }
    addPackage.mutate(pkg.id, {
      onSuccess: () => {
        toast({ title: "Đã thêm vào giỏ", description: pkg.name });
      },
      onError: (err: Error) => {
        toast({
          title: "Không thêm được vào giỏ",
          description: err.message || "Thử lại sau.",
          variant: "destructive",
        });
      },
    });
  };

  const isGuest = mode === "guest";
  const isTrial = promoKind === "trial";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0"
        onPointerDownOutside={(e) => {
          if (isGuest) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isGuest) e.preventDefault();
        }}
      >
        <div
          className="px-5 py-5 sm:px-6 sm:py-6 text-white"
          style={{
            background: `linear-gradient(135deg, ${TNJS.greenDeep} 0%, ${TNJS.green} 55%, ${TNJS.greenBright} 100%)`,
          }}
        >
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2 text-white/90 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="h-4 w-4" />
              {isGuest
                ? "Mở khóa kết quả chi tiết"
                : isTrial
                  ? "Mở đầy đủ đề trong gói"
                  : "Nâng cấp lộ trình luyện thi"}
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-white leading-snug">
              {isGuest
                ? "Đăng ký để xem đáp án chi tiết & lưu kết quả"
                : isTrial
                  ? "Mua gói để làm đầy đủ đề"
                  : "Khám phá gói đề chính thức"}
            </DialogTitle>
            <DialogDescription className="text-white/85 text-sm sm:text-base leading-relaxed">
              {isGuest ? (
                <>
                  Bạn đã hoàn thành đề miễn phí
                  {examTitle ? (
                    <>
                      {" "}
                      <span className="font-semibold text-white">“{examTitle}”</span>
                    </>
                  ) : null}
                  . Tổng điểm vẫn xem được; đáp án từng câu và giải thích chỉ mở sau khi
                  đăng ký / đăng nhập. Đăng ký cũng để mua gói đề JLPT đầy đủ.
                </>
              ) : isTrial ? (
                <>
                  Bạn vừa hoàn thành phần thi thử
                  {examTitle ? (
                    <>
                      {" "}
                      <span className="font-semibold text-white">“{examTitle}”</span>
                    </>
                  ) : null}
                  . Mua gói đề bên dưới để làm toàn bộ câu hỏi và các đề còn lại trong
                  gói — đóng hộp thoại để xem kết quả phần thi thử.
                </>
              ) : (
                <>
                  Cảm ơn bạn đã làm đề miễn phí
                  {examTitle ? (
                    <>
                      {" "}
                      <span className="font-semibold text-white">“{examTitle}”</span>
                    </>
                  ) : null}
                  . Xem các gói đề chính thức bên dưới — đóng hộp thoại để xem chi tiết
                  kết quả bài vừa làm.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {isGuest ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                asChild
                className="font-bold text-white hover:opacity-95"
                style={{ backgroundColor: TNJS.orange }}
              >
                <Link href={registerHref}>Đăng ký miễn phí</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Link href={loginHref}>Đăng nhập</Link>
              </Button>
            </div>
          ) : null}
        </div>

        <div className="px-5 py-5 sm:px-6 sm:py-6 space-y-4" style={{ backgroundColor: TNJS.cream }}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-800 flex items-center gap-2">
              <BookOpen className="h-4 w-4" style={{ color: TNJS.green }} />
              Gói đề luyện thi
            </h3>
            <Link
              href="/luyen-thi/online-exam#exam-packages"
              className="text-xs font-semibold underline underline-offset-2"
              style={{ color: TNJS.green }}
            >
              Xem tất cả
            </Link>
          </div>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-black/10" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-neutral-600 text-center py-6">
              Chưa có gói đề đang bán. Quay lại trang luyện thi để xem cập nhật.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sorted.map((pkg) => {
                const banner = packageLevelBanner(pkg);
                const examCount = getEffectiveExamCount(pkg);
                const sale = getPackageSaleInfo(pkg);
                const isPreferred = highlightPackageId === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm",
                      isPreferred
                        ? "border-emerald-400 ring-1 ring-emerald-200"
                        : "border-black/5",
                    )}
                  >
                    {isPreferred ? (
                      <div
                        className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                        style={{ backgroundColor: TNJS.orange }}
                      >
                        {isTrial ? "Gói đề vừa thi thử" : "Gói đề gợi ý"}
                      </div>
                    ) : null}
                    <div
                      className="flex items-center justify-between gap-2 px-3 py-2 text-white"
                      style={{
                        background: `linear-gradient(135deg, ${TNJS.greenDeep}, ${TNJS.greenBright})`,
                      }}
                    >
                      <span className="text-lg font-black tracking-tight">
                        {banner.title}
                      </span>
                      <span className="text-[10px] font-semibold uppercase opacity-90">
                        {formatExamCountShort(examCount)}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <p className="text-sm font-bold text-neutral-900 line-clamp-2">
                        {pkg.name}
                      </p>
                      <p className="text-xs text-neutral-600 flex items-start gap-1.5">
                        <Check
                          className="h-3.5 w-3.5 mt-0.5 shrink-0"
                          style={{ color: TNJS.green }}
                          strokeWidth={3}
                        />
                        Đề chính thức · lưu kết quả · luyện theo cấp
                      </p>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                        <div className="min-w-0">
                          {sale.onSale ? (
                            <>
                              <p className="text-xs text-neutral-500 line-through tabular-nums">
                                {formatVnd(sale.compareAtPriceVnd!)}
                              </p>
                              <p
                                className="text-base font-black tabular-nums"
                                style={{ color: TNJS.orange }}
                              >
                                {formatVnd(sale.salePriceVnd)}
                              </p>
                            </>
                          ) : (
                            <p className="text-base font-extrabold tabular-nums text-neutral-900">
                              {formatVnd(pkg.priceVnd)}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="shrink-0 font-bold text-white"
                          style={{ backgroundColor: TNJS.orange }}
                          disabled={addPackage.isPending}
                          onClick={() => handleAdd(pkg)}
                        >
                          <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                          {isGuest ? "Đăng ký mua" : "Thêm giỏ"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div
            className={cn(
              "flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between pt-2 border-t border-black/10",
            )}
          >
            {isGuest ? (
              <p className="text-xs text-neutral-600 flex items-start gap-1.5">
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Đóng hộp thoại vẫn chỉ xem được tổng điểm — chưa mở đáp án chi tiết.
              </p>
            ) : (
              <p className="text-xs text-neutral-600">
                Bạn có thể xem kết quả chi tiết ngay sau khi đóng.
              </p>
            )}
            <Button
              variant={isGuest ? "outline" : "default"}
              className={cn(
                "sm:ml-auto font-semibold",
                !isGuest && "text-white",
              )}
              style={!isGuest ? { backgroundColor: TNJS.green } : undefined}
              onClick={() => onOpenChange(false)}
            >
              {isGuest ? "Xem tổng điểm" : "Đóng và xem kết quả"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** sessionStorage key — also reads legacy demo key for one session continuity. */
export function packagePromoStorageKey(attemptId: string) {
  return `exam-package-promo-seen:${attemptId}`;
}

/** @deprecated use packagePromoStorageKey */
export function demoPromoStorageKey(attemptId: string) {
  return packagePromoStorageKey(attemptId);
}

export function hasSeenPackagePromo(attemptId: string): boolean {
  try {
    if (sessionStorage.getItem(packagePromoStorageKey(attemptId))) return true;
    // Legacy key from PostDemoExamDialog
    if (sessionStorage.getItem(`demo-exam-promo-seen:${attemptId}`)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function markPackagePromoSeen(attemptId: string) {
  try {
    sessionStorage.setItem(packagePromoStorageKey(attemptId), "1");
  } catch {
    /* ignore */
  }
}

/** @deprecated use PostExamPackagePromoDialog */
export const PostDemoExamDialog = PostExamPackagePromoDialog;
