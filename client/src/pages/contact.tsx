import { useEffect, useState } from "react";
import { HeroSection } from "@/components/ui/hero-section";
import { ContactForm } from "@/components/ui/contact-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUiImages } from "@/hooks/useUiImages";
import { useAuth } from "@/hooks/useAuth";
import { useContactInfo } from "@/hooks/useContactInfo";
import { MapDisplay } from "@/components/MapDisplay";
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
  const { getImageByType, invalidateCache } = useUiImages();
  const { hasImageEditPermission } = useAuth();
  const { data: contactInfos = [] } = useContactInfo();
  const [heroImage, setHeroImage] = useState("https://images.unsplash.com/photo-1423666639041-f56000c27a9a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080");

  // Update hero image from database when available
  useEffect(() => {
    const dbHeroImage = getImageByType('contact-hero');
    if (dbHeroImage) {
      setHeroImage(dbHeroImage);
    }
  }, [getImageByType]);

  useEffect(() => {
    document.title = "Liên Hệ - N&P Company";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Liên hệ với N&P để được tư vấn miễn phí về visa, du học, tiếng Nhật và vé máy bay. Hỗ trợ 24/7 qua hotline 1900 1234.');
    }
  }, []);

  // Helper function to get contact icon based on type
  const getContactIcon = (type: string) => {
    const iconClass = "h-6 w-6";
    switch (type) {
      case "main_office":
        return <MapPin className={`${iconClass} text-primary`} />;
      case "hotline":
        return <Phone className={`${iconClass} text-secondary`} />;
      case "email":
        return <Mail className={`${iconClass} text-accent`} />;
      case "business_hours":
        return <Clock className={`${iconClass} text-red-600`} />;
      default:
        return <MapPin className={`${iconClass} text-primary`} />;
    }
  };

  // Fallback contact info if database is empty
  const fallbackContactInfo = [
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

  // Use dynamic contact info if available, otherwise use fallback
  const displayContactInfo = contactInfos.length > 0 
    ? contactInfos.map(info => ({
        icon: getContactIcon(info.type),
        title: info.title,
        content: info.content
      }))
    : fallbackContactInfo;

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
        backgroundImage={heroImage}
        allowImageEdit={hasImageEditPermission}
        onImageUpdate={(newUrl) => {
          setHeroImage(newUrl);
          invalidateCache();
        }}
      />

      {/* Contact Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Contact Form */}
            <div className="order-2 lg:order-1 lg:col-span-2">
              <ContactForm variant="page" />
            </div>

            {/* Contact Information */}
            <div className="order-1 lg:order-2 space-y-4 lg:space-y-6">
              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-foreground mb-4">Thông tin liên hệ</h4>
                  <div className="space-y-4">
                    {displayContactInfo.map((info, index) => (
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

              {/* Map Display */}
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <h4 className="font-semibold text-foreground mb-4">Bản đồ văn phòng</h4>
                  <MapDisplay />
                </CardContent>
              </Card>

              {/* Social Media */}
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <h4 className="font-semibold text-foreground mb-4">Kết nối với chúng tôi</h4>
                  <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                    {socialLinks.map((social, index) => (
                      <a
                        key={index}
                        href={social.href}
                        className={`w-10 h-10 sm:w-12 sm:h-12 ${social.color} text-white rounded-full flex items-center justify-center transition-colors`}
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

      

      
    </div>
  );
}
