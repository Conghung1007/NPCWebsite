import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Eye,
  EyeOff,
  Lock,
  User,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  UserCircle,
  RefreshCw,
  MailCheck,
  ArrowLeft,
} from "lucide-react";
import { registrationFormSchema, type RegistrationFormData } from "@shared/schema";
import { getPasswordRuleChecks, getPasswordStrength } from "@shared/passwordRules";
import { OtpInput } from "@/components/OtpInput";
import { AuthShell, authLinkWithRedirect, authRedirectParam } from "@/components/AuthShell";
import { AuthDivider, GoogleSignInButton } from "@/components/GoogleSignInButton";
import { TNJS } from "@/lib/tnjsTheme";
import { cn } from "@/lib/utils";

type RegistrationStep = "form" | "verify_email";

const inputClass =
  "h-10 rounded-lg border border-neutral-200 bg-white pl-10 pr-10 text-sm transition-all focus-visible:border-[#00A651] focus-visible:ring-2 focus-visible:ring-[#00A651]/15";

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<RegistrationStep>("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [pendingFormData, setPendingFormData] = useState<RegistrationFormData | null>(null);
  const [formError, setFormError] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const autoVerifyRef = useRef(false);

  const [availabilityChecks, setAvailabilityChecks] = useState({
    username: { checking: false, available: null as boolean | null, message: "" },
    email: { checking: false, available: null as boolean | null, message: "" },
    phone: { checking: false, available: null as boolean | null, message: "" },
  });

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: {
      username: "",
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      agreeToTerms: false,
    },
  });

  const watchedPassword = form.watch("password");
  const watchedConfirmPassword = form.watch("confirmPassword");
  const passwordStrength = getPasswordStrength(watchedPassword || "");
  const passwordRuleChecks = getPasswordRuleChecks(
    watchedPassword || "",
    watchedConfirmPassword || "",
  );

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

  const checkAvailability = async (
    field: "username" | "email" | "phone",
    value: string,
  ): Promise<boolean | null> => {
    if (!value) return null;
    if (field === "username" && (value.length < 8 || value.length > 30)) return null;
    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;

    setAvailabilityChecks((prev) => ({
      ...prev,
      [field]: { ...prev[field], checking: true },
    }));

    try {
      const response = await fetch(`/api/auth/check-${field}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await response.json();
      setAvailabilityChecks((prev) => ({
        ...prev,
        [field]: {
          checking: false,
          available: data.available,
          message: data.message,
        },
      }));
      return data.available ?? null;
    } catch {
      setAvailabilityChecks((prev) => ({
        ...prev,
        [field]: { checking: false, available: null, message: "Lỗi kiểm tra" },
      }));
      return null;
    }
  };

  const handleFieldBlur = (field: "username" | "email" | "phone") => {
    const value = form.getValues(field);
    if (!value?.trim()) return;
    setTimeout(() => checkAvailability(field, value.trim()), 500);
  };

  const sendVerificationEmail = async (email: string): Promise<boolean> => {
    const response = await fetch("/api/auth/send-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, type: "registration" }),
    });
    const result = await response.json();
    if (response.ok && result.success && result.emailDispatched) {
      setExpiresAt(new Date(Date.now() + (result.expiresIn || 300) * 1000));
      setCountdown(60);
      setFormError("");
      return true;
    }
    setFormError(result.message || "Không thể gửi mã xác minh. Kiểm tra email và thử lại.");
    return false;
  };

  const handleResendCode = async () => {
    if (countdown > 0 || isResending || !pendingEmail) return;
    setIsResending(true);
    setVerifyError("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, type: "registration" }),
      });
      const result = await response.json();
      if (response.ok && result.success && result.emailDispatched) {
        setExpiresAt(new Date(Date.now() + (result.expiresIn || 300) * 1000));
        setCountdown(60);
        setOtpCode("");
        autoVerifyRef.current = false;
        toast({ title: "Đã gửi lại mã xác minh" });
      } else {
        setVerifyError(result.message || "Không thể gửi lại mã");
      }
    } catch {
      setVerifyError("Lỗi kết nối. Không thể gửi lại mã.");
    } finally {
      setIsResending(false);
    }
  };

  const completeRegistration = async () => {
    if (!pendingFormData || otpCode.length !== 6) return;
    setIsVerifying(true);
    setVerifyError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...pendingFormData, code: otpCode }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        toast({
          title: "Đăng ký thành công",
          description: "Tài khoản đã kích hoạt — chào mừng bạn!",
        });
        const redirect = authRedirectParam();
        setLocation(redirect || "/");
        return;
      }
      if (response.status === 409) {
        setFormError(result.message || "Thông tin đã tồn tại");
        setStep("form");
      } else {
        setVerifyError(result.message || "Mã xác minh không hợp lệ");
        setOtpCode("");
        autoVerifyRef.current = false;
      }
    } catch {
      setVerifyError("Đăng ký thất bại. Thử lại hoặc gửi lại mã.");
      setOtpCode("");
      autoVerifyRef.current = false;
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (otpCode.length < 6) {
      autoVerifyRef.current = false;
      return;
    }
    if (step === "verify_email" && otpCode.length === 6 && !isVerifying && !autoVerifyRef.current) {
      autoVerifyRef.current = true;
      void completeRegistration();
    }
  }, [otpCode, step, isVerifying]);

  const onSubmit = async (data: RegistrationFormData) => {
    setIsLoading(true);
    setFormError("");
    try {
      const [usernameAvailable, emailAvailable] = await Promise.all([
        checkAvailability("username", data.username),
        checkAvailability("email", data.email),
      ]);
      if (usernameAvailable === false) {
        setFormError("Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.");
        return;
      }
      if (emailAvailable === false) {
        setFormError("Email đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.");
        return;
      }
      setPendingFormData(data);
      setPendingEmail(data.email);
      const sent = await sendVerificationEmail(data.email);
      if (sent) {
        setStep("verify_email");
        setOtpCode("");
        autoVerifyRef.current = false;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailabilityIcon = (field: "username" | "email" | "phone") => {
    const check = availabilityChecks[field];
    if (check.checking) {
      return (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#00A651] border-t-transparent" />
      );
    }
    if (check.available === true) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (check.available === false) return <XCircle className="h-4 w-4 text-red-500" />;
    return null;
  };

  const renderFieldHint = (field: "username" | "email" | "phone") => {
    const check = availabilityChecks[field];
    if (!check.message) return null;
    return (
      <p className={cn("text-xs", check.available ? "text-green-600" : "text-red-500")}>
        {check.message}
      </p>
    );
  };

  const steps = [
    { label: "Thông tin", active: step === "form", done: step === "verify_email" },
    { label: "Xác minh email", active: step === "verify_email", done: false },
  ];

  const authFooter = (
    <p className="text-sm text-neutral-600">
      Đã có tài khoản?{" "}
      <Link
        href={authLinkWithRedirect("/login")}
        className="font-semibold hover:underline"
        style={{ color: TNJS.green }}
      >
        Đăng nhập
      </Link>
    </p>
  );

  if (step === "verify_email") {
    return (
      <AuthShell title="Xác minh email" showHints={false} steps={steps} narrow footer={authFooter}>
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm"
            style={{ backgroundColor: `${TNJS.green}14` }}
          >
            <MailCheck className="h-8 w-8" style={{ color: TNJS.green }} />
          </div>
          <h2 className="text-xl font-bold text-neutral-900">Kiểm tra hộp thư</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Mã 6 số đã gửi tới{" "}
            <strong className="text-neutral-900">{pendingEmail}</strong>
          </p>
        </div>

        {verifyError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{verifyError}</AlertDescription>
          </Alert>
        ) : null}

        <OtpInput value={otpCode} onChange={setOtpCode} disabled={isVerifying} />

        <p className="mt-4 text-center text-sm text-neutral-500">
          {remainingSeconds > 0
            ? `Mã hết hạn sau ${formatTime(remainingSeconds)}`
            : "Mã đã hết hạn — bấm gửi lại"}
        </p>

        <Button
          className="mt-6 h-11 w-full rounded-xl font-bold text-white hover:opacity-95"
          style={{ backgroundColor: TNJS.orange }}
          disabled={otpCode.length !== 6 || isVerifying}
          onClick={() => completeRegistration()}
        >
          {isVerifying ? "Đang kích hoạt…" : "Kích hoạt tài khoản"}
        </Button>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-xl"
            onClick={() => {
              setStep("form");
              setOtpCode("");
              setVerifyError("");
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Sửa thông tin
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-xl"
            disabled={countdown > 0 || isResending}
            onClick={handleResendCode}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isResending ? "animate-spin" : ""}`} />
            {countdown > 0 ? `Gửi lại (${countdown}s)` : "Gửi lại mã"}
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Tạo tài khoản mới"
      subtitle="Tham gia cộng đồng luyện thi Trí Nhân Academy — hoàn toàn miễn phí."
      showHints
      steps={steps}
      footer={authFooter}
    >
      {formError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <GoogleSignInButton
          mode="signup"
          disabled={isLoading}
          onError={(msg) => setFormError(msg)}
        />

        <AuthDivider />

        <div className="space-y-1">
          <Label htmlFor="username" className="text-sm font-medium text-neutral-800">
            Tên đăng nhập *
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              id="username"
              className={inputClass}
              disabled={isLoading}
              placeholder="8-30 ký tự"
              autoComplete="username"
              {...form.register("username", {
                onChange: () => {
                  setAvailabilityChecks((prev) => ({
                    ...prev,
                    username: { checking: false, available: null, message: "" },
                  }));
                },
              })}
              onBlur={() => handleFieldBlur("username")}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {getAvailabilityIcon("username")}
            </div>
          </div>
          {form.formState.errors.username ? (
            <p className="text-xs text-red-500">{form.formState.errors.username.message}</p>
          ) : null}
          {renderFieldHint("username")}
        </div>

        <div className="space-y-1">
          <Label htmlFor="email" className="text-sm font-medium text-neutral-800">
            Email *
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              id="email"
              type="email"
              className={inputClass}
              disabled={isLoading}
              placeholder="email@example.com"
              autoComplete="email"
              {...form.register("email", {
                onChange: () => {
                  setAvailabilityChecks((prev) => ({
                    ...prev,
                    email: { checking: false, available: null, message: "" },
                  }));
                },
              })}
              onBlur={() => handleFieldBlur("email")}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {getAvailabilityIcon("email")}
            </div>
          </div>
          {form.formState.errors.email ? (
            <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
          ) : null}
          {renderFieldHint("email")}
        </div>

        <div className="space-y-1">
          <Label htmlFor="fullName" className="text-sm font-medium text-neutral-800">
            Họ và tên
          </Label>
          <div className="relative">
            <UserCircle className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              id="fullName"
              className={cn(inputClass, "pr-4")}
              disabled={isLoading}
              placeholder="Nguyễn Văn A"
              autoComplete="name"
              {...form.register("fullName")}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="phone" className="text-sm font-medium text-neutral-800">
            Số điện thoại <span className="font-normal text-neutral-400">(tuỳ chọn)</span>
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              id="phone"
              type="tel"
              className={inputClass}
              disabled={isLoading}
              placeholder="10–11 chữ số"
              autoComplete="tel"
              {...form.register("phone")}
              onBlur={() => handleFieldBlur("phone")}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {getAvailabilityIcon("phone")}
            </div>
          </div>
          {form.formState.errors.phone ? (
            <p className="text-xs text-red-500">{form.formState.errors.phone.message}</p>
          ) : null}
          {renderFieldHint("phone")}
        </div>

        <div className="space-y-1">
          <Label htmlFor="password" className="text-sm font-medium text-neutral-800">
            Mật khẩu *
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              className={inputClass}
              disabled={isLoading}
              placeholder="8+ ký tự, chữ hoa, số, ký tự đặc biệt"
              autoComplete="new-password"
              {...form.register("password")}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {watchedPassword ? (
            <div className="space-y-1 pt-0.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className={cn(
                      "h-1 flex-1 rounded-full",
                      n <= passwordStrength.score ? passwordStrength.barClass : "bg-neutral-200",
                    )}
                  />
                ))}
              </div>
              <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                {passwordRuleChecks.map((rule) => (
                  <li
                    key={rule.label}
                    className={cn("flex items-center gap-1", rule.ok ? "text-green-600" : "text-neutral-400")}
                  >
                    <CheckCircle className="h-3 w-3 shrink-0" />
                    {rule.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {form.formState.errors.password ? (
            <p className="text-xs text-red-500">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Label htmlFor="confirmPassword" className="text-sm font-medium text-neutral-800">
            Xác nhận mật khẩu *
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              className={inputClass}
              disabled={isLoading}
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
              {...form.register("confirmPassword")}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {form.formState.errors.confirmPassword ? (
            <p className="text-xs text-red-500">{form.formState.errors.confirmPassword.message}</p>
          ) : null}
        </div>

        <div className="flex items-start gap-2 pt-1">
          <Checkbox
            id="agreeToTerms"
            checked={form.watch("agreeToTerms")}
            onCheckedChange={(checked) => form.setValue("agreeToTerms", !!checked)}
            disabled={isLoading}
            className="mt-0.5"
          />
          <Label
            htmlFor="agreeToTerms"
            className="cursor-pointer text-xs leading-snug font-normal text-neutral-600"
          >
            Tôi đồng ý với điều khoản dịch vụ và chính sách bảo mật của Trí Nhân Academy *
          </Label>
        </div>
        {form.formState.errors.agreeToTerms ? (
          <p className="text-xs text-red-500">{form.formState.errors.agreeToTerms.message}</p>
        ) : null}

        <Button
          type="submit"
          className="mt-1 h-10 w-full rounded-lg font-bold text-white hover:opacity-95"
          style={{ backgroundColor: TNJS.orange }}
          disabled={isLoading}
        >
          {isLoading ? "Đang xử lý…" : "Tiếp tục"}
        </Button>
      </form>
    </AuthShell>
  );
}
