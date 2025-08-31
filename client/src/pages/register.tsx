import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, User, Mail, Phone, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { registrationFormSchema, type RegistrationFormData } from "@shared/schema";

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Cuộn lên đầu trang khi component mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [availabilityChecks, setAvailabilityChecks] = useState({
    username: { checking: false, available: null as boolean | null, message: "" },
    email: { checking: false, available: null as boolean | null, message: "" },
    phone: { checking: false, available: null as boolean | null, message: "" }
  });

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: {
      username: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      agreeToTerms: false,
    },
  });

  // Debounced availability checking
  const checkAvailability = async (field: 'username' | 'email' | 'phone', value: string) => {
    if (!value) return;
    
    setAvailabilityChecks(prev => ({
      ...prev,
      [field]: { ...prev[field], checking: true }
    }));

    try {
      const response = await fetch(`/api/auth/check-${field}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value })
      });
      
      const data = await response.json();
      
      setAvailabilityChecks(prev => ({
        ...prev,
        [field]: { 
          checking: false, 
          available: data.available, 
          message: data.message 
        }
      }));
    } catch (error) {
      setAvailabilityChecks(prev => ({
        ...prev,
        [field]: { 
          checking: false, 
          available: null, 
          message: "Lỗi kiểm tra" 
        }
      }));
    }
  };

  const handleFieldBlur = (field: 'username' | 'email' | 'phone') => {
    const value = form.getValues(field);
    if (value && value.length > 0) {
      // Add small delay to avoid too frequent checks
      setTimeout(() => checkAvailability(field, value), 500);
    }
  };

  const onSubmit = async (data: RegistrationFormData) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "Đăng ký thành công",
          description: result.message,
        });
        
        // Redirect to success page
        setLocation("/register-success");
      } else {
        toast({
          title: "Đăng ký thất bại",
          description: result.message || "Có lỗi xảy ra, vui lòng thử lại",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      toast({
        title: "Đăng ký thất bại",
        description: "Có lỗi xảy ra, vui lòng thử lại sau",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailabilityIcon = (field: 'username' | 'email' | 'phone') => {
    const check = availabilityChecks[field];
    if (check.checking) return <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />;
    if (check.available === true) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (check.available === false) return <XCircle className="w-4 h-4 text-red-500" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold text-foreground">
            Đăng ký tài khoản
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Tạo tài khoản để sử dụng dịch vụ N&P LLC
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">Tên đăng nhập *</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="8-15 ký tự, chỉ chữ cái và số"
                  className="pl-10 pr-10"
                  disabled={isLoading}
                  {...form.register("username")}
                  onBlur={() => handleFieldBlur('username')}
                />
                <div className="absolute right-3 top-3">
                  {getAvailabilityIcon('username')}
                </div>
              </div>
              {form.formState.errors.username && (
                <p className="text-sm text-red-500">{form.formState.errors.username.message}</p>
              )}
              {availabilityChecks.username.message && (
                <p className={`text-sm ${availabilityChecks.username.available ? 'text-green-600' : 'text-red-500'}`}>
                  {availabilityChecks.username.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  className="pl-10 pr-10"
                  disabled={isLoading}
                  {...form.register("email")}
                  onBlur={() => handleFieldBlur('email')}
                />
                <div className="absolute right-3 top-3">
                  {getAvailabilityIcon('email')}
                </div>
              </div>
              {form.formState.errors.email && (
                <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
              )}
              {availabilityChecks.email.message && (
                <p className={`text-sm ${availabilityChecks.email.available ? 'text-green-600' : 'text-red-500'}`}>
                  {availabilityChecks.email.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Số điện thoại *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="10-11 chữ số"
                  className="pl-10 pr-10"
                  disabled={isLoading}
                  {...form.register("phone")}
                  onBlur={() => handleFieldBlur('phone')}
                />
                <div className="absolute right-3 top-3">
                  {getAvailabilityIcon('phone')}
                </div>
              </div>
              {form.formState.errors.phone && (
                <p className="text-sm text-red-500">{form.formState.errors.phone.message}</p>
              )}
              {availabilityChecks.phone.message && (
                <p className={`text-sm ${availabilityChecks.phone.available ? 'text-green-600' : 'text-red-500'}`}>
                  {availabilityChecks.phone.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ít nhất 8 ký tự, 1 chữ hoa, 1 số, 1 ký tự đặc biệt"
                  className="pl-10 pr-10"
                  disabled={isLoading}
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm text-red-500">{form.formState.errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Xác nhận mật khẩu *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu"
                  className="pl-10 pr-10"
                  disabled={isLoading}
                  {...form.register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-red-500">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Terms agreement */}
            <div className="flex items-start space-x-2">
              <Checkbox
                id="agreeToTerms"
                checked={form.watch("agreeToTerms")}
                onCheckedChange={(checked) => form.setValue("agreeToTerms", !!checked)}
                disabled={isLoading}
              />
              <Label htmlFor="agreeToTerms" className="text-sm leading-5">
                Tôi đồng ý với{" "}
                <button
                  type="button"
                  className="text-primary hover:text-primary/80 underline"
                  onClick={() => window.open("/terms", "_blank")}
                >
                  điều khoản dịch vụ
                </button>
                {" "}và{" "}
                <button
                  type="button"
                  className="text-primary hover:text-primary/80 underline"
                  onClick={() => window.open("/privacy", "_blank")}
                >
                  chính sách bảo mật
                </button>
                *
              </Label>
            </div>
            {form.formState.errors.agreeToTerms && (
              <p className="text-sm text-red-500">{form.formState.errors.agreeToTerms.message}</p>
            )}
            
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Đang đăng ký..." : "Đăng ký"}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Đã có tài khoản?{" "}
              <button
                onClick={() => setLocation("/login")}
                className="text-primary hover:text-primary/80 font-medium"
              >
                Đăng nhập ngay
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}