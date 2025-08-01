import { useEffect } from "react";
import { HeroSection } from "@/components/ui/hero-section";
import { ContactForm } from "@/components/ui/contact-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  MapPin, 
  Phone, 
  Mail, 
  Clock,
  Facebook,
  Youtube,
  MessageCircle,
  Send
} from "lucide-react";

export default function Contact() {
  useEffect(() => {
    document.title = "Liên Hệ - N&P Company";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Liên hệ với N&P để được tư vấn miễn phí về visa, du học, tiếng Nhật và vé máy bay. Hỗ trợ 24/7 qua hotline 1900 1234.');
    }
  }, []);

  const contactInfo = [
    {
      icon: <MapPin className="h-6 w-6 text-primary" />,
      title: "Văn phòng chính",
      content: ["123 Nguyễn Huệ, Quận 1, TP.HCM"]
    },
    {
      icon: <Phone className="h-6 w-6 text-secondary" />,
      title: "Hotline",
      content: ["1900 1234 (24/7)", "028 3822 5678"]
    },
    {
      icon: <Mail className="h-6 w-6 text-accent" />,
      title: "Email", 
      content: ["info@npcompany.vn", "support@npcompany.vn"]
    },
    {
      icon: <Clock className="h-6 w-6 text-red-600" />,
      title: "Giờ hoạt động",
      content: ["T2-T6: 8:00 - 18:00", "T7-CN: 8:00 - 17:00"]
    }
  ];

  const socialLinks = [
    {
      name: "Facebook",
      icon: <Facebook className="h-5 w-5" />,
      href: "#",
      color: "bg-blue-600 hover:bg-blue-700"
    },
    {
      name: "YouTube", 
      icon: <Youtube className="h-5 w-5" />,
      href: "#",
      color: "bg-red-600 hover:bg-red-700"
    },
    {
      name: "Zalo",
      icon: <MessageCircle className="h-5 w-5" />,
      href: "#",
      color: "bg-blue-400 hover:bg-blue-500"
    },
    {
      name: "WhatsApp",
      icon: <Send className="h-5 w-5" />,
      href: "#", 
      color: "bg-green-600 hover:bg-green-700"
    }
  ];

  return (
    <div>
      <HeroSection
        title="Liên hệ với chúng tôi"
        subtitle=""
        description="Sẵn sàng hỗ trợ bạn 24/7. Hãy liên hệ ngay để nhận tư vấn miễn phí!"
        backgroundImage="https://images.unsplash.com/photo-1423666639041-f56000c27a9a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080"
      />

      {/* Contact Section */}
      <section className="py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Contact Form */}
            <div className="lg:col-span-2">
              <ContactForm variant="page" />
            </div>

            {/* Contact Information */}
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-foreground mb-4">Thông tin liên hệ</h4>
                  <div className="space-y-4">
                    {contactInfo.map((info, index) => (
                      <div key={index} className="flex items-start">
                        <div className="flex-shrink-0 mr-4 mt-1">
                          {info.icon}
                        </div>
                        <div>
                          <div className="font-medium text-foreground mb-1">{info.title}</div>
                          {info.content.map((item, i) => (
                            <div key={i} className="text-muted-foreground text-sm">{item}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Map Placeholder */}
              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-foreground mb-4">Bản đồ văn phòng</h4>
                  <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <MapPin className="h-12 w-12 mx-auto mb-2" />
                      <div className="text-sm">Bản đồ Google Maps</div>
                      <div className="text-xs">sẽ được tích hợp</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Social Media */}
              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-foreground mb-4">Kết nối với chúng tôi</h4>
                  <div className="flex space-x-4">
                    {socialLinks.map((social, index) => (
                      <a
                        key={index}
                        href={social.href}
                        className={`w-12 h-12 ${social.color} text-white rounded-full flex items-center justify-center transition-colors`}
                        title={social.name}
                      >
                        {social.icon}
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Contact CTA */}
      <section className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-4">Cần tư vấn ngay?</h3>
          <p className="text-blue-100 mb-6">Đội ngũ chuyên gia sẵn sàng hỗ trợ bạn 24/7</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="tel:19001234" 
              className="bg-white text-primary px-8 py-3 rounded-lg font-semibold hover:bg-white/90 transition-colors inline-flex items-center justify-center"
            >
              <Phone className="mr-2 h-5 w-5" />
              Gọi ngay: 1900 1234
            </a>
            <a 
              href="#" 
              className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-primary transition-colors inline-flex items-center justify-center"
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Chat Zalo
            </a>
          </div>
        </div>
      </section>

      {/* Office Hours & Additional Info */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <h4 className="font-semibold text-foreground mb-2">Giờ làm việc</h4>
              <p className="text-muted-foreground text-sm">
                Thứ 2 - Thứ 6: 8:00 - 18:00<br />
                Thứ 7 - Chủ nhật: 8:00 - 17:00
              </p>
            </div>
            
            <div>
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="h-8 w-8 text-secondary" />
              </div>
              <h4 className="font-semibold text-foreground mb-2">Hotline 24/7</h4>
              <p className="text-muted-foreground text-sm">
                Luôn sẵn sàng hỗ trợ bạn<br />
                mọi lúc, mọi nơi
              </p>
            </div>
            
            <div>
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-accent" />
              </div>
              <h4 className="font-semibold text-foreground mb-2">Phản hồi nhanh</h4>
              <p className="text-muted-foreground text-sm">
                Email được trả lời<br />
                trong vòng 2 giờ
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
