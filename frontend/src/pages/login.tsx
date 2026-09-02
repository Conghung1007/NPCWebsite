import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthShell, authLinkWithRedirect, authRedirectParam } from "@/components/AuthShell";
import { AuthDivider, GoogleSignInButton } from "@/components/GoogleSignInButton";
import { TNJS } from "@/lib/tnjsTheme";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [formData, setFormData] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        credentials: "include",
      });
      const data = await response.json();

      if (response.ok && data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        toast({
          title: "Đăng nhập thành công",
          description: `Chào mừng ${data.user.username}!`,
        });
        const redirect = authRedirectParam();
        setLocation(redirect || "/");
      } else {
        setError(data.message || "Đăng nhập thất bại");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để mua gói đề, lưu kết quả thi và quản lý tài khoản của bạn."
      footer={
        <p className="text-sm text-neutral-600">
          Chưa có tài khoản?{" "}
          <Link
            href={authLinkWithRedirect("/register")}
            className="font-semibold hover:underline"
            style={{ color: TNJS.green }}
          >
            Đăng ký bằng email hoặc Google
          </Link>
        </p>
      }
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold text-neutral-900">Đăng nhập</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Dùng tên đăng nhập và mật khẩu đã đăng ký
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <GoogleSignInButton
          mode="signin"
          disabled={isLoading}
          onError={(msg) => setError(msg)}
        />

        <AuthDivider />

        <div className="space-y-2">
          <Label htmlFor="username">Tên đăng nhập</Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
            <Input
              id="username"
              name="username"
              autoComplete="username"
              placeholder="vd: nguyenvan_a"
              value={formData.username}
              onChange={(e) => {
                setFormData((p) => ({ ...p, username: e.target.value }));
                setError("");
              }}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Mật khẩu</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => {
                setFormData((p) => ({ ...p, password: e.target.value }));
                setError("");
              }}
              className="pl-10 pr-10"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-700"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-11 font-bold text-white hover:opacity-95"
          style={{ backgroundColor: TNJS.orange }}
          disabled={isLoading}
        >
          {isLoading ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
      </form>
    </AuthShell>
  );
}
