import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight } from "lucide-react";
import { AuthShell, authLinkWithRedirect } from "@/components/AuthShell";
import { TNJS } from "@/lib/tnjsTheme";

export default function RegisterSuccess() {
  const [, setLocation] = useLocation();

  return (
    <AuthShell
      title="Tài khoản đã sẵn sàng"
      subtitle="Xác minh email thành công — bạn có thể luyện thi và mua gói đề ngay."
      narrow
    >
      <div className="text-center py-2">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: `${TNJS.green}18` }}
        >
          <CheckCircle className="h-9 w-9" style={{ color: TNJS.green }} />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Đăng ký thành công!</h2>
        <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
          Tài khoản đã được kích hoạt tự động sau khi xác minh email. Không cần chờ admin duyệt.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            className="font-bold text-white hover:opacity-95"
            style={{ backgroundColor: TNJS.orange }}
            onClick={() => setLocation("/#exam-list")}
          >
            Vào thi ngay
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setLocation(authLinkWithRedirect("/login"))}>
            Đăng nhập
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
