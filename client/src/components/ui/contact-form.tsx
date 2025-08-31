import { useState } from "react";
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

const contactFormSchema = z.object({
  name: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự"),
  phone: z.string().min(10, "Số điện thoại không hợp lệ"),
  email: z.string().email("Email không hợp lệ"),
  service: z.string().optional(),
  message: z.string().min(10, "Nội dung phải có ít nhất 10 ký tự"),
  privacy: z.boolean().refine(val => val === true, "Bạn phải đồng ý với điều khoản"),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

interface ContactFormProps {
  variant?: "hero" | "page";
  className?: string;
}

export function ContactForm({ variant = "page", className = "" }: ContactFormProps) {
  const { toast } = useToast();
  
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      service: "",
      message: "",
      privacy: false,
    },
  });

  const contactMutation = useMutation({
    mutationFn: async (data: Omit<ContactFormValues, "privacy">) => {
      const response = await apiRequest("POST", "/api/contact", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Thành công!",
        description: data.message || "Yêu cầu của bạn đã được gửi thành công!",
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Có lỗi xảy ra",
        description: error.message || "Vui lòng thử lại sau",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormValues) => {
    const { privacy, ...contactData } = data;
    contactMutation.mutate(contactData);
  };

  const services = [
    { value: "visa", label: "Dịch vụ xin thị thực" },
    { value: "study-abroad", label: "Tư vấn du học" },
    { value: "japanese", label: "Đào tạo tiếng Nhật" },
    { value: "other", label: "Khác" },
  ];

  return (
    <div className={`${variant === "hero" ? "bg-white/10 backdrop-blur-sm border border-white/20 text-white" : "bg-white border border-gray-200 shadow-lg"} rounded-2xl p-4 sm:p-6 lg:p-8 ${className}`}>
      <h3 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${variant === "hero" ? "text-white" : "text-foreground"}`}>
        {variant === "hero" ? "Nhận tư vấn miễn phí" : "Gửi yêu cầu tư vấn"}
      </h3>
      {variant === "hero" && (
        <p className="text-base sm:text-lg lg:text-xl opacity-90 mb-6 sm:mb-8">Để lại thông tin, chúng tôi sẽ liên hệ tư vấn trong 24h</p>
      )}
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={variant === "hero" ? "text-white" : ""}>
                    Họ và tên *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nguyễn Văn A" 
                      {...field}
                      className={variant === "hero" ? "bg-white text-foreground" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={variant === "hero" ? "text-white" : ""}>
                    Số điện thoại *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="0901234567" 
                      {...field}
                      className={variant === "hero" ? "bg-white text-foreground" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={variant === "hero" ? "text-white" : ""}>
                  Email *
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="email@example.com" 
                    type="email"
                    {...field}
                    className={variant === "hero" ? "bg-white text-foreground" : ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="service"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={variant === "hero" ? "text-white" : ""}>
                  Dịch vụ quan tâm
                </FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className={variant === "hero" ? "bg-white text-foreground" : ""}>
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
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={variant === "hero" ? "text-white" : ""}>
                  Nội dung *
                </FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Mô tả chi tiết yêu cầu của bạn..."
                    rows={4}
                    {...field}
                    className={`resize-none ${variant === "hero" ? "bg-white text-foreground" : ""}`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="privacy"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className={variant === "hero" ? "bg-white border-gray-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary" : ""}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className={`text-sm ${variant === "hero" ? "text-white" : "text-muted-foreground"}`}>
                    Tôi đồng ý với{" "}
                    <a href="#" className={`${variant === "hero" ? "text-yellow-200 font-medium" : "text-primary"} hover:underline`}>
                      điều khoản sử dụng
                    </a>{" "}
                    và{" "}
                    <a href="#" className={`${variant === "hero" ? "text-yellow-200 font-medium" : "text-primary"} hover:underline`}>
                      chính sách bảo mật
                    </a>{" "}
                    của N&P
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
          
          <Button 
            type="submit" 
            className={`w-full text-sm sm:text-base lg:text-lg py-2 sm:py-3 ${
              variant === "hero" 
                ? "btn-accent" 
                : "btn-primary"
            }`}
            disabled={contactMutation.isPending}
          >
            {contactMutation.isPending ? "Đang gửi..." : "Gửi yêu cầu"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
