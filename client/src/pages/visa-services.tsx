import { useEffect } from "react";
import { useLocation } from "wouter";
import { HeroSection } from "@/components/ui/hero-section";
import { ServiceCard } from "@/components/ui/service-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArticleSection } from "@/components/ArticleSection";
import { 
  Plane, 
  Briefcase, 
  GraduationCap, 
  Home,
  CheckCircle,
  MessageCircle,
  FileText,
  Search,
  Send,
  Award
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function VisaServices() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Dịch Vụ Xin Thị Thực - N&P Company";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Dịch vụ xin thị thực chuyên nghiệp với tỷ lệ thành công 98% cho hơn 50 quốc gia. Hỗ trợ visa du lịch, công tác, sinh viên, định cư.');
    }
  }, []);

  const visaTypes = [
    {
      icon: <Plane className="h-6 w-6 text-primary" />,
      title: "Visa Du Lịch",
      description: "Thăm quan, nghỉ dưỡng"
    },
    {
      icon: <Briefcase className="h-6 w-6 text-secondary" />,
      title: "Visa Công Tác", 
      description: "Họp hội nghị, hợp tác"
    },
    {
      icon: <GraduationCap className="h-6 w-6 text-accent" />,
      title: "Visa Du Học",
      description: "Học tập, nghiên cứu"
    },
    {
      icon: <Home className="h-6 w-6 text-primary" />,
      title: "Visa Định Cư",
      description: "Sinh sống lâu dài"
    }
  ];

  const processSteps = [
    {
      number: "1",
      title: "Tư Vấn",
      description: "Tư vấn miễn phí về loại visa phù hợp",
      icon: <MessageCircle className="h-6 w-6" />
    },
    {
      number: "2", 
      title: "Chuẩn Bị",
      description: "Hướng dẫn chuẩn bị hồ sơ đầy đủ",
      icon: <FileText className="h-6 w-6" />
    },
    {
      number: "3",
      title: "Kiểm Tra",
      description: "Rà soát kỹ lưỡng hồ sơ trước khi nộp",
      icon: <Search className="h-6 w-6" />
    },
    {
      number: "4",
      title: "Nộp Đơn", 
      description: "Nộp hồ sơ và theo dõi tiến độ",
      icon: <Send className="h-6 w-6" />
    },
    {
      number: "5",
      title: "Nhận Kết Quả",
      description: "Nhận visa và hướng dẫn sử dụng",
      icon: <Award className="h-6 w-6" />
    }
  ];

  const requiredDocuments = [
    "Hộ chiếu còn hạn tối thiểu 6 tháng",
    "Đơn xin visa đã điền đầy đủ", 
    "Ảnh 4x6 cm nền trắng (theo tiêu chuẩn)",
    "Chứng minh tài chính",
    "Bảo hiểm du lịch (tùy quốc gia)",
    "Giấy tờ khác theo yêu cầu riêng"
  ];

  const faqs = [
    {
      question: "Thời gian xử lý visa là bao lâu?",
      answer: "Thông thường từ 5-15 ngày làm việc tùy thuộc vào quốc gia và loại visa. Chúng tôi sẽ thông báo chính xác thời gian cho từng trường hợp cụ thể."
    },
    {
      question: "Chi phí dịch vụ bao gồm những gì?",
      answer: "Chi phí bao gồm tư vấn, kiểm tra hồ sơ, nộp đơn và theo dõi kết quả. Lệ phí lãnh sự được tính riêng theo quy định của từng quốc gia."
    },
    {
      question: "Nếu bị từ chối có được hoàn phí?",
      answer: "Lệ phí lãnh sự không hoàn lại theo quy định quốc tế. Chi phí dịch vụ có chính sách hoàn tiền theo cam kết trong hợp đồng."
    },
    {
      question: "Tỷ lệ thành công của N&P như thế nào?",
      answer: "N&P có tỷ lệ thành công 98% nhờ quy trình chuyên nghiệp và kinh nghiệm nhiều năm. Chúng tôi cam kết hỗ trợ tối đa để hồ sơ của bạn được chấp thuận."
    }
  ];

  const handleConsultation = () => {
    setLocation("/contact");
  };

  return (
    <div>
      <HeroSection
        title="Dịch vụ xin thị thực"
        subtitle=""
        description="Chuyên gia hàng đầu về dịch vụ xin visa với tỷ lệ thành công 98% cho hơn 50 quốc gia trên thế giới"
        backgroundImage="https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080"
        primaryAction={{
          text: "Nhận tư vấn miễn phí",
          onClick: handleConsultation
        }}
        secondaryAction={{
          text: "Nộp đơn ngay",
          onClick: handleConsultation
        }}
      />
      {/* Visa Types & Countries */}
      <section className="py-20 bg-white pt-[60px] pb-[60px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 mb-16">
            <div>
              <img 
                src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600" 
                alt="Professional visa processing office" 
                className="rounded-xl shadow-lg w-full h-auto" 
              />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-6">
                Các loại thị thực chúng tôi hỗ trợ
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {visaTypes.map((type, index) => (
                  <div key={index} className="flex items-center p-4 bg-neutral rounded-lg">
                    {type.icon}
                    <div className="ml-3">
                      <span className="font-medium text-foreground">{type.title}</span>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <h4 className="text-lg font-semibold text-foreground mb-4">Quốc gia chuyên môn</h4>
              <div className="flex flex-wrap gap-2 mb-6">
                {["Nhật Bản", "Hàn Quốc", "Mỹ", "Canada", "Úc", "Anh", "Đức", "+40 quốc gia"].map((country, index) => (
                  <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {country}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Process Steps */}
      <section className="py-20 bg-neutral pt-[30px] pb-[30px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold text-foreground text-center mb-12">
            Quy trình xin thị thực
          </h3>
          <div className="grid md:grid-cols-5 gap-8">
            {processSteps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-xl">{step.number}</span>
                </div>
                <h4 className="font-semibold text-foreground mb-2">{step.title}</h4>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Required Documents & FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <Card>
              <CardContent className="p-8">
                <h3 className="text-xl font-bold text-foreground mb-6">Hồ Sơ Bắt Buộc</h3>
                <ul className="space-y-3">
                  {requiredDocuments.map((doc, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-secondary mt-1 mr-3 flex-shrink-0" />
                      <span className="text-muted-foreground">{doc}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-8">
                <h3 className="text-xl font-bold text-foreground mb-6">Câu Hỏi Thường Gặp</h3>
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((faq, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent>
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>

        </div>
      </section>
      {/* Articles Section */}
      <ArticleSection 
        category="visa-services"
        title="Thông tin về dịch vụ visa"
        description="Thông tin hữu ích và cập nhật về thủ tục xin visa các quốc gia"
      />
    </div>
  );
}
