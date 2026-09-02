import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { usePortal } from "@/contexts/PortalContext";
import type { PortalId } from "@/lib/portal";
import { useEffect } from "react";

const baseFields = {
  name: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự"),
  phone: z.string().min(10, "Số điện thoại không hợp lệ"),
  service: z.string().optional(),
  privacy: z.boolean().refine((val) => val === true, "Bạn phải đồng ý với điều khoản"),
};

const heroFormSchema = z.object(baseFields);

const pageFormSchema = z.object({
  ...baseFields,
  email: z.string().email("Email không hợp lệ"),
  message: z.string().min(10, "Nội dung phải có ít nhất 10 ký tự"),
});

type HeroFormValues = z.infer<typeof heroFormSchema>;
type PageFormValues = z.infer<typeof pageFormSchema>;

interface ContactFormProps {
  variant?: "hero" | "page";
  className?: string;
  /** Prefill dịch vụ quan tâm (vd. "visa") */
  defaultService?: string;
  /** Ghi chú gửi kèm khi dùng form hero rút gọn */
  submitMessage?: string;
}

const SERVICES_BY_PORTAL: Record<PortalId, { value: string; label: string }[]> = {
  group: [
    { value: "japanese", label: "Đào tạo tiếng Nhật (TNJS)" },
    { value: "study-abroad", label: "Hướng nghiệp — Du học" },
    { value: "career", label: "Hướng nghiệp — Đi làm" },
    { value: "vocational", label: "Hướng nghiệp — Đào tạo nghề" },
    { value: "interpreting", label: "Biên phiên dịch" },
    { value: "soft-skills", label: "Kỹ năng mềm" },
    { value: "enterprise", label: "Tư vấn doanh nghiệp" },
    { value: "online-exam", label: "Luyện thi" },
    { value: "other", label: "Khác" },
  ],
  huongnghiep: [
    { value: "study-abroad", label: "Du học" },
    { value: "career", label: "Đi làm" },
    { value: "vocational", label: "Đào tạo nghề" },
    { value: "visa", label: "Visa" },
    { value: "other", label: "Khác" },
  ],
  dichvu: [
    { value: "interpreting", label: "Biên phiên dịch" },
    { value: "soft-skills", label: "Kỹ năng mềm" },
    { value: "enterprise", label: "Tư vấn doanh nghiệp" },
    { value: "other", label: "Khác" },
  ],
  luyenthi: [
    { value: "online-exam", label: "Luyện thi / thi thử" },
    { value: "japanese", label: "Đào tạo tiếng Nhật (TNJS)" },
    { value: "other", label: "Khác" },
  ],
};

const DEFAULT_SERVICE: Record<PortalId, string> = {
  group: "",
  huongnghiep: "study-abroad",
  dichvu: "interpreting",
  luyenthi: "online-exam",
};

export function ContactForm({
  variant = "page",
  className = "",
  defaultService = "",
  submitMessage = "Yêu cầu tư vấn miễn phí từ trang chủ",
}: ContactFormProps) {
  const { toast } = useToast();
  const { portal } = usePortal();
  const isHero = variant === "hero";
  const services = SERVICES_BY_PORTAL[portal] || SERVICES_BY_PORTAL.group;
  const resolvedDefault =
    defaultService || DEFAULT_SERVICE[portal] || "";

  const heroForm = useForm<HeroFormValues>({
    resolver: zodResolver(heroFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      service: resolvedDefault,
      privacy: false,
    },
  });

  const pageForm = useForm<PageFormValues>({
    resolver: zodResolver(pageFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      service: resolvedDefault,
      message: "",
      privacy: false,
    },
  });

  useEffect(() => {
    heroForm.setValue("service", resolvedDefault);
    pageForm.setValue("service", resolvedDefault);
  }, [resolvedDefault, portal]);

  const contactMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      phone: string;
      email: string;
      service?: string;
      message: string;
      portal?: string;
    }) => {
      const response = await apiRequest("POST", "/api/contact", {
        ...data,
        portal,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Thành công!",
        description: data.message || "Yêu cầu của bạn đã được gửi thành công!",
      });
      if (isHero) heroForm.reset();
      else pageForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Có lỗi xảy ra",
        description: error.message || "Vui lòng thử lại sau",
        variant: "destructive",
      });
    },
  });

  const onHeroSubmit = (data: HeroFormValues) => {
    const { privacy: _privacy, ...rest } = data;
    contactMutation.mutate({
      name: rest.name,
      phone: rest.phone,
      service: rest.service || resolvedDefault || undefined,
      email: `sdt.${rest.phone.replace(/\D/g, "")}@lienhe.np`,
      message: `[${portal}] ${submitMessage}`,
    });
  };

  const onPageSubmit = (data: PageFormValues) => {
    const { privacy: _privacy, ...contactData } = data;
    contactMutation.mutate({
      ...contactData,
      message: `[${portal}] ${contactData.message}`,
    });
  };

  const labelClass = isHero ? "text-white" : "";
  const inputClass = isHero ? "bg-white text-foreground" : "";

  if (isHero) {
    return (
      <div
        className={`bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-2xl p-4 sm:p-6 lg:p-8 ${className}`}
      >
        <h3 className="text-xl sm:text-2xl font-bold mb-2 text-white">Tư vấn miễn phí</h3>
        <p className="text-base opacity-90 mb-6">
          Để lại họ tên và số điện thoại — chúng tôi liên hệ trong 24 giờ
        </p>

        <Form {...heroForm}>
          <form onSubmit={heroForm.handleSubmit(onHeroSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={heroForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Họ và tên *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nguyễn Văn A" {...field} className={inputClass} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={heroForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClass}>Số điện thoại *</FormLabel>
                    <FormControl>
                      <Input placeholder="0901234567" {...field} className={inputClass} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={heroForm.control}
              name="service"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelClass}>Dịch vụ quan tâm</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Chọn dịch vụ" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.value} value={service.value}>
                          {service.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={heroForm.control}
              name="privacy"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="bg-white border-gray-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm text-white">
                      Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật của N&P
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full bg-white text-primary hover:bg-secondary hover:text-primary text-sm sm:text-base py-3 font-semibold shadow-md"
              disabled={contactMutation.isPending}
            >
              {contactMutation.isPending ? "Đang gửi..." : "Tư vấn miễn phí"}
            </Button>
          </form>
        </Form>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 shadow-lg rounded-2xl p-4 sm:p-6 lg:p-8 ${className}`}>
      <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-foreground">
        Gửi yêu cầu tư vấn
      </h3>

      <Form {...pageForm}>
        <form onSubmit={pageForm.handleSubmit(onPageSubmit)} className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={pageForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Họ và tên *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nguyễn Văn A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={pageForm.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số điện thoại *</FormLabel>
                  <FormControl>
                    <Input placeholder="0901234567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={pageForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input placeholder="email@example.com" type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={pageForm.control}
            name="service"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dịch vụ quan tâm</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn dịch vụ" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {services.map((service) => (
                        <SelectItem key={service.value} value={service.value}>
                          {service.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={pageForm.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nội dung *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Mô tả chi tiết yêu cầu của bạn..."
                    rows={4}
                    {...field}
                    className="resize-none"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={pageForm.control}
            name="privacy"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm text-muted-foreground">
                    Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật của N&P
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full btn-primary text-sm sm:text-base lg:text-lg py-2 sm:py-3"
            disabled={contactMutation.isPending}
          >
            {contactMutation.isPending ? "Đang gửi..." : "Tư vấn miễn phí"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
