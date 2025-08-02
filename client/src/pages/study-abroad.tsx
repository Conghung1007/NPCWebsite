import { useEffect } from "react";
import { useLocation } from "wouter";
import { HeroSection } from "@/components/ui/hero-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArticleSection } from "@/components/ArticleSection";
import { 
  Search, 
  FileText, 
  Award, 
  PlaneTakeoff, 
  Home, 
  Users,
  Eye,
  Heart,
  TrendingUp,
  CheckCircle
} from "lucide-react";

export default function StudyAbroad() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Tư Vấn Du Học - N&P Company";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Tư vấn du học chuyên nghiệp tại Nhật Bản, Hàn Quốc, Mỹ, Canada và Châu Âu. Hỗ trợ chọn trường, hồ sơ, học bổng với tỷ lệ thành công 95%.');
    }
  }, []);

  const services = [
    {
      icon: <Search className="h-8 w-8 text-secondary" />,
      title: "Lựa chọn chương trình",
      description: "Tư vấn chọn ngành học, trường đại học phù hợp với năng lực và mục tiêu"
    },
    {
      icon: <FileText className="h-8 w-8 text-secondary" />,
      title: "Hỗ trợ nộp đơn", 
      description: "Hướng dẫn hoàn thiện hồ sơ, thư động cơ, thư giới thiệu"
    },
    {
      icon: <Award className="h-8 w-8 text-secondary" />,
      title: "Hướng dẫn học bổng",
      description: "Tìm kiếm và hỗ trợ xin học bổng du học"
    },
    {
      icon: <PlaneTakeoff className="h-8 w-8 text-secondary" />,
      title: "Chuẩn bị trước khi đi",
      description: "Hướng dẫn thủ tục visa, bảo hiểm và chuẩn bị hành lý"
    },
    {
      icon: <Home className="h-8 w-8 text-secondary" />,
      title: "Hỗ trợ chỗ ở",
      description: "Tư vấn và đặt chỗ ở, ký túc xá cho sinh viên"
    },
    {
      icon: <Users className="h-8 w-8 text-secondary" />,
      title: "Hỗ trợ liên tục",
      description: "Đồng hành và hỗ trợ trong suốt quá trình du học"
    }
  ];

  const destinations = [
    { country: "Nhật Bản", flag: "🇯🇵" },
    { country: "Hàn Quốc", flag: "🇰🇷" },
    { country: "Mỹ", flag: "🇺🇸" },
    { country: "Canada", flag: "🇨🇦" },
    { country: "Anh", flag: "🇬🇧" },
    { country: "Úc", flag: "🇦🇺" }
  ];

  const successStories = [
    {
      name: "Phạm Việt Anh",
      school: "Đại học Tokyo - Kỹ thuật",
      content: "Nhờ N&P, tôi nhận được học bổng 100% tại một trong những trường kỹ thuật hàng đầu Nhật Bản",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
    },
    {
      name: "Nguyễn Thị Linh",
      school: "University of Toronto - Kinh tế", 
      content: "Đội ngũ N&P đã hỗ trợ tôi từ khâu chọn trường đến khi định cư tại Canada",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face"
    },
    {
      name: "Lê Minh Quân",
      school: "MIT - Khoa học máy tính",
      content: "Chương trình chuẩn bị của N&P giúp tôi tự tin chinh phục trường mơ ước tại Mỹ",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
    }
  ];

  const whyChooseUs = [
    {
      icon: <Eye className="h-8 w-8 text-secondary" />,
      title: "Hướng dẫn cá nhân hóa từ A-Z",
      description: "Tư vấn riêng biệt cho từng học sinh"
    },
    {
      icon: <Heart className="h-8 w-8 text-secondary" />,
      title: "Mạng lưới trường đại học rộng khắp",
      description: "Hợp tác với hơn 500 trường đại học"
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-secondary" />,
      title: "95% sinh viên nhận học bổng",
      description: "Tỷ lệ nhận học bổng cao nhất thị trường"
    },
    {
      icon: <Users className="h-8 w-8 text-secondary" />,
      title: "Hỗ trợ sau khi đến trường",
      description: "Đồng hành trong suốt hành trình du học"
    }
  ];

  const handleConsultation = () => {
    setLocation("/contact");
  };

  return (
    <div>
      <HeroSection
        title="Tư vấn du học"
        subtitle=""
        description="Mở rộng chân trời tri thức với các chương trình du học hàng đầu tại Nhật Bản, Hàn Quốc, Mỹ, Canada và Châu Âu"
        backgroundImage="https://images.unsplash.com/photo-1523240795612-9a054b0db644?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080"
        primaryAction={{
          text: "Khám phá lựa chọn học tập",
          onClick: handleConsultation
        }}
        secondaryAction={{
          text: "Đặt lịch tư vấn miễn phí",
          onClick: handleConsultation
        }}
      />

      {/* Services & Destinations */}
      <section className="py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            <div className="lg:col-span-2">
              <h3 className="text-2xl font-bold text-foreground mb-6">
                Dịch vụ tư vấn du học toàn diện
              </h3>
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {services.map((service, index) => (
                  <div key={index} className="flex items-start">
                    <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      {service.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">{service.title}</h4>
                      <p className="text-muted-foreground text-sm">{service.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Card>
                <CardContent className="p-6">
                  <h4 className="text-lg font-semibold text-foreground mb-4">
                    Quốc gia du học phổ biến
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {destinations.map((dest, index) => (
                      <div key={index} className="flex items-center p-3 border border-border rounded-lg">
                        <span className="text-2xl mr-3">{dest.flag}</span>
                        <span className="font-medium">{dest.country}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <img 
                src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1000" 
                alt="International students in university library" 
                className="rounded-xl shadow-lg w-full h-auto mb-6" 
              />
              
              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-foreground mb-4">Tại sao du học với N&P?</h4>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    {whyChooseUs.map((item, index) => (
                      <li key={index} className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-secondary mr-3 flex-shrink-0" />
                        {item.title}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold text-foreground text-center mb-8">
            Câu chuyện thành công
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            {successStories.map((story, index) => (
              <div key={index} className="text-center">
                <img 
                  src={story.avatar} 
                  alt={story.name}
                  className="w-24 h-24 rounded-full mx-auto mb-4 object-cover" 
                />
                <h4 className="font-semibold text-foreground mb-2">{story.name}</h4>
                <p className="text-secondary text-sm mb-2">{story.school}</p>
                <p className="text-muted-foreground text-sm italic">"{story.content}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose N&P */}
      <section className="py-20 bg-gradient-to-r from-primary to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold mb-8 text-center">
            Tại Sao Nên Du Học Với N&P?
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            {whyChooseUs.slice(0, 3).map((item, index) => (
              <div key={index} className="text-center">
                <div className="flex justify-center mb-4 opacity-90">
                  {item.icon}
                </div>
                <h4 className="font-semibold mb-3">{item.title}</h4>
                <p className="opacity-90">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-neutral">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            Khám phá các lựa chọn học tập của bạn
          </h3>
          <p className="text-muted-foreground mb-6">
            Bắt đầu hành trình du học của bạn ngay hôm nay
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleConsultation}
              className="btn-primary text-lg px-8 py-3"
            >
              Khám Phá Lựa Chọn
            </Button>
            <Button 
              onClick={handleConsultation}
              className="btn-secondary text-lg px-8 py-3"
            >
              Đặt Lịch Tư Vấn Miễn Phí
            </Button>
          </div>
        </div>
      </section>

      {/* Articles Section */}
      <ArticleSection 
        category="study-abroad"
        title="Bài viết về du học"
        description="Thông tin hữu ích về du học và cuộc sống sinh viên tại các nước"
      />
    </div>
  );
}
