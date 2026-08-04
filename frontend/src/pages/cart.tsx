import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useCart, formatVnd } from "@/hooks/useCart";
import { Trash2, ShoppingBag, ArrowRight } from "lucide-react";

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
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-serif text-3xl font-bold mb-8">Giỏ hàng</h1>

        {items.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-emerald-200 bg-white/80">
            <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Giỏ hàng trống</p>
            <Link href="/classes">
              <Button className="mt-4">Xem lớp đang mở</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex gap-4 items-start justify-between border border-emerald-100 bg-white p-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/classes/${item.classSessionId}`}
                    className="font-semibold hover:text-primary"
                  >
                    {item.classSession.title}
                  </Link>
                  {item.classSession.scheduleText && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.classSession.scheduleText}
                    </p>
                  )}
                  <p className="text-primary font-bold mt-2">
                    {formatVnd(item.classSession.priceVnd)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem.mutate(item.id)}
                  disabled={removeItem.isPending}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            ))}

            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Tổng cộng</p>
                <p className="text-2xl font-bold text-primary">
                  {formatVnd(cart?.totalVnd || 0)}
                </p>
              </div>
              <Button size="lg" onClick={() => setLocation("/checkout")}>
                Thanh toán
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
