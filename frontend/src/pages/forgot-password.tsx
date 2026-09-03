import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MailCheck,
  RefreshCw,
} from "lucide-react";
import { getPasswordRuleChecks, getPasswordStrength } from "@shared/passwordRules";
import { OtpInput } from "@/components/OtpInput";
import { AuthShell, authLinkWithRedirect, authRedirectParam } from "@/components/AuthShell";
import { TNJS } from "@/lib/tnjsTheme";
import { cn } from "@/lib/utils";

type ResetStep = "email" | "verify" | "password";

const inputClass =
  "h-10 rounded-lg border border-neutral-200 bg-white pl-10 pr-10 text-sm transition-all focus-visible:border-[#00A651] focus-visible:ring-2 focus-visible:ring-[#00A651]/15";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Quên mật khẩu";
  }, []);

  const [step, setStep] = useState<ResetStep>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const passwordStrength = getPasswordStrength(password);
  const passwordRuleChecks = getPasswordRuleChecks(password, confirmPassword);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (!expiresAt) {
      setRemainingSeconds(0);
      return;
    }
    const tick = () =>
      setRemainingSeconds(Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const requestCode = async (targetEmail: string): Promise<boolean> => {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: targetEmail }),
    });
    const result = await response.json();
    if (response.ok && result.success) {
      setExpiresAt(new Date(Date.now() + (result.expiresIn || 300) * 1000));
      setCountdown(60);
      setError("");
      return true;
    }
    setError(result.message || "Không gửi được mã. Thử lại sau.");
    return false;
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Định dạng email không hợp lệ");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const sent = await requestCode(trimmed);
      if (sent) {
        setEmail(trimmed);
        setStep("verify");
        setOtpCode("");
      }
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending || !email) return;
    setIsResending(true);
    setError("");
    try {
      const sent = await requestCode(email);
      if (sent) {
        setOtpCode("");
        toast({ title: "Đã gửi lại mã xác minh" });
      }
    } catch {
      setError("Lỗi kết nối. Không thể gửi lại mã.");
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setError("Nhập đủ mã 6 số trong email");
      return;
    }
    setError("");
    setStep("password");
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordRuleChecks.every((rule) => rule.ok)) {
      setError("Mật khẩu chưa đủ điều kiện");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          code: otpCode,
          password,
          confirmPassword,
        }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        toast({
          title: "Đã đặt lại mật khẩu",
          description: "Bạn đã được đăng nhập.",
        });
        const redirect = authRedirectParam();
        setLocation(redirect || "/");
        return;
      }
      setError(result.message || "Không đặt lại được mật khẩu");
      if (response.status === 400 && /mã/i.test(result.message || "")) {
        setStep("verify");
        setOtpCode("");
      }
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { label: "Email", active: step === "email", done: step !== "email" },
    { label: "Mã xác minh", active: step === "verify", done: step === "password" },
    { label: "Mật khẩu mới", active: step === "password", done: false },
  ];

  const footer = (
    <p className="text-sm text-neutral-600">
      Nhớ mật khẩu?{" "}
      <Link
        href={authLinkWithRedirect("/login")}
        className="font-semibold hover:underline"
        style={{ color: TNJS.green }}
      >
        Đăng nhập
      </Link>
    </p>
  );

  if (step === "verify") {
    return (
      <AuthShell title="Nhập mã xác minh" showHints={false} steps={steps} narrow footer={footer}>
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm"
            style={{ backgroundColor: `${TNJS.green}14` }}
          >
            <MailCheck className="h-8 w-8" style={{ color: TNJS.green }} />
          </div>
          <h2 className="text-xl font-bold text-neutral-900">Kiểm tra email</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Mã 6 số đã được gửi tới{" "}
            <span className="font-semibold text-neutral-800">{email}</span>
          </p>
          {remainingSeconds > 0 ? (
            <p className="mt-1 text-xs text-neutral-400">Hết hạn sau {formatTime(remainingSeconds)}</p>
          ) : (
            <p className="mt-1 text-xs text-red-500">Mã đã hết hạn — hãy gửi lại</p>
          )}
        </div>

        <form onSubmit={handleVerifyStep} className="space-y-5">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <OtpInput value={otpCode} onChange={setOtpCode} disabled={isLoading} />
          <Button
            type="submit"
            className="h-11 w-full font-bold text-white"
            style={{ backgroundColor: TNJS.orange }}
            disabled={otpCode.length !== 6}
          >
            Tiếp tục
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-neutral-500 hover:text-neutral-800"
              onClick={() => {
                setStep("email");
                setError("");
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Đổi email
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium disabled:opacity-50"
              style={{ color: TNJS.green }}
              onClick={() => void handleResend()}
              disabled={countdown > 0 || isResending}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isResending && "animate-spin")} />
              {countdown > 0 ? `Gửi lại (${countdown}s)` : "Gửi lại mã"}
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  if (step === "password") {
    return (
      <AuthShell title="Mật khẩu mới" showHints={false} steps={steps} narrow footer={footer}>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-neutral-900">Tạo mật khẩu mới</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Mật khẩu mới sẽ thay cho mật khẩu cũ của tài khoản {email}
          </p>
        </div>
        <form onSubmit={handleReset} className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="new-password">Mật khẩu mới</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                className={inputClass}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={cn("h-full transition-all", passwordStrength.barClass)}
                      style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-neutral-500">{passwordStrength.label}</span>
                </div>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {passwordRuleChecks.map((rule) => (
                    <li
                      key={rule.label}
                      className={cn(
                        "text-[11px]",
                        rule.ok ? "text-emerald-600" : "text-neutral-400",
                      )}
                    >
                      {rule.ok ? "✓" : "○"} {rule.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Xác nhận mật khẩu</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                className={inputClass}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                onClick={() => setShowConfirmPassword((v) => !v)}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="h-11 w-full font-bold text-white"
            style={{ backgroundColor: TNJS.orange }}
            disabled={isLoading}
          >
            {isLoading ? "Đang lưu…" : "Đặt lại mật khẩu"}
          </Button>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
            onClick={() => {
              setStep("verify");
              setError("");
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại nhập mã
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Quên mật khẩu"
      subtitle="Nhập email đã đăng ký — chúng tôi sẽ gửi mã 6 số để đặt mật khẩu mới."
      steps={steps}
      footer={footer}
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold text-neutral-900">Đặt lại mật khẩu</h2>
        <p className="mt-1 text-sm text-neutral-500">Dùng email của tài khoản để nhận mã xác minh</p>
      </div>
      <form onSubmit={handleSendEmail} className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="reset-email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              className="pl-10"
              placeholder="ban@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              disabled={isLoading}
            />
          </div>
        </div>
        <Button
          type="submit"
          className="h-11 w-full font-bold text-white"
          style={{ backgroundColor: TNJS.orange }}
          disabled={isLoading}
        >
          {isLoading ? "Đang gửi…" : "Gửi mã xác minh"}
        </Button>
      </form>
    </AuthShell>
  );
}
