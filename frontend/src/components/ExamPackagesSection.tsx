import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Check, Clock, ShoppingCart } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { TNJS } from "@/lib/tnjsTheme";
import { TnjsPillTitle } from "@/components/TnjsUi";
import {
  buildPackageCardBullets,
  formatExamCountShort,
  formatVnd as formatPackageVnd,
  getEffectiveExamCount,
  getPackageSaleInfo,
  packageLevelBanner,
} from "@/lib/examPackageDisplay";

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

type Entitlement = {
  id: string;
  level: string;
  packageId: string | null;
  status: string;
  amountVnd: number;
};

type MeResponse = {
  entitlements: Entitlement[];
  activeLevels: string[];
  activePackageIds: string[];
};

const LEVEL_ORDER = ["N5", "N4", "N3", "N2", "N1"];

function formatVnd(n: number) {
  return formatPackageVnd(n);
}

function PackageCardPrice({
  pkg,
  active,
}: {
  pkg: StorePackage;
  active: boolean;
}) {
  const sale = getPackageSaleInfo(pkg);

  if (active) {
    return (
      <p className="mb-3 text-center text-sm font-bold" style={{ color: TNJS.green }}>
        Đã có quyền thi đầy đủ
      </p>
    );
  }

  if (sale.onSale) {
    return (
      <div
        className="mb-3 overflow-hidden rounded-lg border-2 text-center"
        style={{ borderColor: TNJS.orange, backgroundColor: `${TNJS.orange}10` }}
      >
        <div
          className="px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-white"
          style={{ backgroundColor: TNJS.orange }}
        >
          Sale off −{sale.discountPercent}%
        </div>
        <div className="px-3 py-2.5">
          <p className="text-sm font-semibold text-neutral-500 line-through tabular-nums">
            {formatVnd(sale.compareAtPriceVnd!)}
          </p>
          <p
            className="mt-0.5 text-[1.75rem] font-black tabular-nums leading-none"
            style={{ color: TNJS.orange }}
          >
            {formatVnd(sale.salePriceVnd)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <p className="mb-3 text-center text-xl font-extrabold tabular-nums text-neutral-900">
      {formatVnd(pkg.priceVnd)}
    </p>
  );
}

function sortPackages(list: StorePackage[]) {
  return [...list].sort((a, b) => {
    const ia = a.level ? LEVEL_ORDER.indexOf(a.level.toUpperCase()) : 99;
    const ib = b.level ? LEVEL_ORDER.indexOf(b.level.toUpperCase()) : 99;
    if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.name.localeCompare(b.name, "vi");
  });
}

function PackageCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-md animate-pulse">
      <div className="h-28 bg-white/30" style={{ backgroundColor: TNJS.green }} />
      <div className="h-10 bg-amber-200/80" />
      <div className="space-y-3 p-4" style={{ backgroundColor: TNJS.cream }}>
        <div className="h-4 bg-black/10 rounded w-4/5" />
        <div className="h-4 bg-black/10 rounded w-3/5" />
        <div className="h-4 bg-black/10 rounded w-2/3" />
      </div>
      <div className="h-20 bg-white p-4">
        <div className="h-8 bg-black/10 rounded" />
      </div>
    </div>
  );
}

export function ExamPackagesSection() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { addPackage } = useCart();

  const { data: packages = [], isLoading } = useQuery<StorePackage[]>({
    queryKey: ["/api/exam-packages"],
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: me } = useQuery<MeResponse>({
    queryKey: ["/api/exam-packages/me"],
    enabled: isAuthenticated,
    retry: false,
  });

  const byPackageId = useMemo(() => {
    const map = new Map<string, Entitlement>();
    for (const row of me?.entitlements || []) {
      if (row.packageId) map.set(row.packageId, row);
    }
    return map;
  }, [me]);

  const sorted = useMemo(() => sortPackages(packages), [packages]);

  const handleAddToCart = (pkg: StorePackage) => {
    addPackage.mutate(pkg.id, {
      onSuccess: () => {
        toast({ title: "Đã thêm vào giỏ", description: pkg.name });
        window.location.href = "/cart";
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

  const handlePackageClick = (pkg: StorePackage, active: boolean, pending: boolean) => {
    if (active) {
      document.getElementById("exam-list")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (pending) {
      toast({
        title: "Đang chờ duyệt",
        description: "Gói đề sẽ mở sau khi được xác nhận.",
      });
      return;
    }
    handleAddToCart(pkg);
  };

  return (
    <section aria-labelledby="exam-packages-heading">
      <TnjsPillTitle id="exam-packages-heading" variant="onGreen" className="mb-10">
        Gói đề luyện thi
      </TnjsPillTitle>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <PackageCardSkeleton key={i} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-white/40 bg-white/10 px-6 py-14 text-center text-white">
          <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-70" />
          <p className="text-sm opacity-90">
            Chưa có gói đề đang bán. Admin tạo gói trong Cpanel → Quản lý gói đề.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {sorted.map((pkg) => {
            const ent = byPackageId.get(pkg.id);
            const active =
              ent?.status === "active" ||
              (pkg.level && me?.activeLevels?.includes(pkg.level));
            const pending = ent?.status === "pending";
            const examCount = getEffectiveExamCount(pkg);
            const banner = packageLevelBanner(pkg);
            const bullets = buildPackageCardBullets(pkg, {
              active: !!active,
              pending: !!pending,
            });
            const comingSoon = examCount === 0 && !active;

            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => handlePackageClick(pkg, !!active, !!pending)}
                disabled={(!active && !pending && addPackage.isPending) || comingSoon}
                className={cn(
                  "group flex flex-col overflow-hidden rounded-xl bg-white text-left shadow-lg",
                  "transition-transform duration-300 hover:-translate-y-1.5 focus:outline-none",
                  "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--tnjs-green)]",
                )}
                style={{ ["--tnjs-green" as string]: TNJS.green }}
              >
                {/* Ảnh / banner cấp độ — tương tự khối ảnh khóa học tnjs.vn */}
                <div
                  className="relative flex h-32 flex-col items-center justify-center text-white"
                  style={{
                    background: `linear-gradient(160deg, ${TNJS.greenDeep} 0%, ${TNJS.greenBright} 100%)`,
                  }}
                >
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-white/80">
                    {banner.subtitle}
                  </span>
                  <span className="mt-1 text-5xl font-black leading-none tracking-tight drop-shadow-sm">
                    {banner.title}
                  </span>
                  <span className="mt-2 rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold text-white">
                    {formatExamCountShort(examCount)}
                  </span>
                  {active ? (
                    <span className="absolute right-2 top-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[color:var(--tnjs-green)]">
                      Đã mở
                    </span>
                  ) : pending ? (
                    <span
                      className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                      style={{ backgroundColor: TNJS.orange }}
                    >
                      Chờ duyệt
                    </span>
                  ) : comingSoon ? (
                    <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                      Sắp ra mắt
                    </span>
                  ) : null}
                </div>

                {/* Ruy băng vàng tiêu đề — như thẻ khóa học tnjs.vn */}
                <div
                  className="relative z-[1] -mt-1 px-3 py-2.5 text-center shadow-sm"
                  style={{ backgroundColor: TNJS.yellow }}
                >
                  <p className="text-[13px] font-extrabold uppercase leading-snug text-neutral-900 line-clamp-2">
                    {pkg.name}
                  </p>
                </div>

                {/* Bullet cream */}
                <div
                  className="flex-1 space-y-2 px-4 py-4"
                  style={{ backgroundColor: TNJS.cream }}
                >
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
                  {pkg.description ? (
                    <p className="pt-1 text-xs leading-relaxed text-neutral-600 line-clamp-2 pl-6">
                      {pkg.description}
                    </p>
                  ) : null}
                </div>

                {/* Giá + CTA cam */}
                <div className="border-t border-black/5 bg-white px-4 py-4">
                  <PackageCardPrice pkg={pkg} active={!!active} />
                  <span
                    className={cn(
                      "inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors",
                      active && "opacity-90",
                    )}
                    style={{
                      backgroundColor: active
                        ? TNJS.green
                        : pending
                          ? "#D97706"
                          : comingSoon
                            ? "#9CA3AF"
                            : TNJS.orange,
                    }}
                  >
                    {active ? (
                      "Xem chi tiết"
                    ) : pending ? (
                      <>
                        <Clock className="h-4 w-4" />
                        Đang chờ duyệt
                      </>
                    ) : comingSoon ? (
                      "Đang cập nhật"
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4" />
                        Thêm vào giỏ
                      </>
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {sorted.length > 0 ? (
        <p className="mt-8 text-center text-sm text-white/80">
          <Link
            href="/cart"
            className="font-semibold underline underline-offset-2 hover:text-white"
          >
            Xem giỏ hàng
          </Link>
        </p>
      ) : null}
    </section>
  );
}

export function ExamAccessGuide() {
  return (
    <section
      className="mt-0 py-12 sm:py-16"
      style={{ backgroundColor: TNJS.charcoal }}
      aria-labelledby="exam-access-guide"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <TnjsPillTitle id="exam-access-guide" variant="onDark" className="mb-10">
          Quy trình quyền thi
        </TnjsPillTitle>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Khách",
              body: (
                <>
                  Chỉ thi các đề{" "}
                  <strong className="text-white">miễn phí</strong>.
                </>
              ),
            },
            {
              step: "02",
              title: "Tài khoản",
              body: (
                <>
                  Thi đề miễn phí +{" "}
                  <strong className="text-white">thi thử đề số 1</strong> mỗi cấp
                  (tối đa <strong className="text-white">10 câu</strong>).
                </>
              ),
            },
            {
              step: "03",
              title: "Mua gói",
              body: (
                <>
                  Mở toàn bộ đề trong gói đã chọn — thi không giới hạn lượt.
                </>
              ),
            },
          ].map((item) => (
            <div key={item.step} className="text-center md:text-left">
              <p
                className="mb-2 text-xs font-bold tracking-[0.2em]"
                style={{ color: TNJS.green }}
              >
                {item.step}
              </p>
              <h3 className="mb-2 text-lg font-bold text-white">{item.title}</h3>
              <p className="text-sm leading-relaxed text-white/70">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
