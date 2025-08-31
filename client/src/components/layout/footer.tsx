import { Link } from "wouter";
import { MapPin, Phone, Mail, Facebook, Youtube, Linkedin } from "lucide-react";
import { useContactInfo } from "@/hooks/useContactInfo";

export function Footer() {
  const { data: contactInfos = [] } = useContactInfo();
  
  const services = [
    { name: "Dịch vụ xin thị thực", href: "/visa-services" },
    { name: "Tư vấn du học", href: "/study-abroad" },
    { name: "Đào tạo tiếng Nhật", href: "/japanese-training" },
    { name: "Thi thử trực tuyến", href: "/online-exam" }
  ];

  // Helper function to get contact info by type
  const getContactByType = (type: string) => {
    return contactInfos.find(info => info.type === type);
  };

  // Helper function to render contact icon based on type
  const getContactIcon = (type: string) => {
    switch (type) {
      case "main_office":
        return <MapPin className="h-5 w-5 mr-3 flex-shrink-0" />;
      case "hotline":
        return <Phone className="h-5 w-5 mr-3 flex-shrink-0" />;
      case "email":
        return <Mail className="h-5 w-5 mr-3 flex-shrink-0" />;
      default:
        return null;
    }
  };



  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div>
            <div className="flex items-center mb-6">
              <span className="text-3xl font-bold text-primary mr-2">N&P</span>
              <span className="text-sm text-gray-400">Company</span>
            </div>
            <p className="text-gray-400 mb-6">
              Đối tác tin cậy cho giấc mơ toàn cầu.<br />
              Chuyên nghiệp - Uy tín - Hiệu quả.
            </p>
            <div className="flex space-x-4">
              <a href="#facebook" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-primary transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#youtube" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-primary transition-colors">
                <Youtube className="h-5 w-5" />
              </a>
              <a href="#linkedin" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-primary transition-colors">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-6">Dịch vụ</h3>
            <ul className="space-y-3 text-gray-400">
              {services.map((service) => (
                <li key={service.href}>
                  <Link href={service.href}>
                    <span className="hover:text-white transition-colors cursor-pointer">
                      {service.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>



          <div>
            <h3 className="text-lg font-semibold mb-6">Liên hệ</h3>
            <div className="space-y-3 text-gray-400">
              {contactInfos.length > 0 ? (
                contactInfos
                  .filter(info => ["main_office", "hotline", "email"].includes(info.type))
                  .map(info => (
                    <div key={info.id} className="flex items-start">
                      {getContactIcon(info.type)}
                      <div className="flex flex-col">
                        {info.content.map((item, index) => (
                          <span key={index} className="text-sm">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
              ) : (
                // Fallback content if no contact info is available
                <>
                  <div className="flex items-center">
                    <MapPin className="h-5 w-5 mr-3 flex-shrink-0" />
                    <span className="text-sm">123 Nguyễn Huệ, Q1, TP.HCM</span>
                  </div>
                  <div className="flex items-center">
                    <Phone className="h-5 w-5 mr-3 flex-shrink-0" />
                    <span className="text-sm">1900 1234</span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="h-5 w-5 mr-3 flex-shrink-0" />
                    <span className="text-sm">info@npcompany.vn</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0">
              © 2024 Công ty TNHH N&P. Tất cả quyền được bảo lưu.
            </div>
            <div className="flex space-x-6 text-sm text-gray-400">
              <a href="#privacy" className="hover:text-white transition-colors">Chính sách bảo mật</a>
              <a href="#terms" className="hover:text-white transition-colors">Điều khoản dịch vụ</a>
              <a href="#regulations" className="hover:text-white transition-colors">Quy chế hoạt động</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
