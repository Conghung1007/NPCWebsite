import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  useCart,
  formatVnd,
  isClassCartItem,
  isExamPackageCartItem,
} from "@/hooks/useCart";
import {
  getEffectiveExamCount,
  formatExamCountShort,
  getPackageSaleInfo,
} from "@/lib/examPackageDisplay";
import { ExamPackagesSection } from "@/components/ExamPackagesSection";
import { TNJS } from "@/lib/tnjsTheme";
import { Trash2, ShoppingBag, ArrowRight, BookOpen } from "lucide-react";

export default function CartPage() {
  const [, setLocation] = useLocation();
  const { cart, isLoading, removeItem } = useCart();
  const items = cart?.items ?? [];

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-white">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-8 font-serif text-3xl font-bold">Giỏ hàng</h1>

        {items.length === 0 ? (
          <div className="border border-dashed border-emerald-200 bg-white/80 px-4 py-12 text-center sm:py-16">
            <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-2 text-lg font-medium">Giỏ hàng trống</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Chọn gói đề bên dưới để thêm vào giỏ, hoặc xem lớp đang mở.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a href="#cart-package-suggestions">
                <Button>Chọn gói đề</Button>
              </a>
              <Link href="/classes">
                <Button variant="outline">Xem lớp đang mở</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-4 border border-emerald-100 bg-white p-4"
              >
                <div className="min-w-0">
                  {isClassCartItem(item) ? (
                    <>
                      <Link
                        href={`/classes/${item.classSessionId}`}
                        className="font-semibold hover:text-primary"
                      >
                        {item.classSession.title}
                      </Link>
                      {item.classSession.scheduleText && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.classSession.scheduleText}
                        </p>
                      )}
                      <p className="mt-2 font-bold text-primary">
                        {formatVnd(item.classSession.priceVnd)}
                      </p>
                    </>
                  ) : isExamPackageCartItem(item) ? (
                    <>
                      <div className="flex items-center gap-2 font-semibold">
                        <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                        <span>{item.examPackage.name}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatExamCountShort(
                          getEffectiveExamCount(item.examPackage),
                        )}
                        {item.examPackage.level
                          ? ` · JLPT ${item.examPackage.level.toUpperCase()}`
                          : ""}
                      </p>
                      <p className="mt-2 font-bold text-primary">
                        {(() => {
                          const sale = getPackageSaleInfo(item.examPackage);
                          return sale.onSale ? (
                            <>
                              <span className="mr-2 text-sm font-normal text-muted-foreground line-through">
                                {formatVnd(sale.compareAtPriceVnd!)}
                              </span>
                              {formatVnd(sale.salePriceVnd)}
                            </>
                          ) : (
                            formatVnd(item.examPackage.priceVnd)
                          );
                        })()}
                      </p>
                    </>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem.mutate(item.id)}
                  disabled={removeItem.isPending}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}

            {cart?.hasExamPackages ? (
              <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Gói đề trong giỏ — bấm Thanh toán, đăng ký hoặc đăng nhập nhanh
                rồi trả qua PayOS để mở quyền thi.
              </p>
            ) : null}

            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <p className="text-sm text-muted-foreground">Tổng cộng</p>
                <p className="text-2xl font-bold text-primary">
                  {formatVnd(cart?.totalVnd || 0)}
                </p>
              </div>
              <Button size="lg" onClick={() => setLocation("/checkout")}>
                Thanh toán
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <section
        id="cart-package-suggestions"
        className="py-14 sm:py-16"
        style={{ backgroundColor: TNJS.green }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ExamPackagesSection
            title={
              items.length === 0 ? "Gợi ý gói đề cho bạn" : "Thêm gói đề khác"
            }
            description={
              items.length === 0
                ? "Chọn gói theo trình độ JLPT — thêm vào giỏ rồi thanh toán để mở quyền thi."
                : "Bổ sung gói đề khác vào giỏ nếu cần luyện thêm cấp độ."
            }
            stayOnPage
            hideCartLink
          />
        </div>
      </section>
    </div>
  );
}
