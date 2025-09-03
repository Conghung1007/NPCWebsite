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
    <footer className="bg-gray-900 text-white py-12 sm:py-16 w-full max-w-full overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-8 lg:mb-12">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center mb-4 lg:mb-6">
              <span className="text-2xl sm:text-3xl font-bold text-primary mr-2">N&P</span>
              <span className="text-sm text-gray-400">Company</span>
            </div>
            <p className="text-gray-400 mb-4 lg:mb-6 text-sm sm:text-base">
              Đối tác tin cậy cho giấc mơ toàn cầu.<br />
              Chuyên nghiệp - Uy tín - Hiệu quả.
            </p>
            <div className="flex space-x-3 justify-center sm:justify-start">
              <a href="#facebook" className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-primary transition-colors">
                <Facebook className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
              <a href="#youtube" className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-primary transition-colors">
                <Youtube className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
              <a href="#linkedin" className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-primary transition-colors">
                <Linkedin className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-4 lg:mb-6 text-center sm:text-left">Dịch vụ</h3>
            <ul className="space-y-2 lg:space-y-3 text-gray-400 text-center sm:text-left">
              {services.map((service) => (
                <li key={service.href}>
                  <Link href={service.href}>
                    <span className="hover:text-white transition-colors cursor-pointer text-sm sm:text-base">
                      {service.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>



          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-4 lg:mb-6 text-center sm:text-left">Liên hệ</h3>
            <div className="space-y-2 lg:space-y-3 text-gray-400 text-center sm:text-left">
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
