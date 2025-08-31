import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { HeroSection } from "@/components/ui/hero-section";
import { Button } from "@/components/ui/button";
import { EditableText } from "@/components/ui/editable-text";
import { Card, CardContent } from "@/components/ui/card";
import { ArticleSection } from "@/components/ArticleSection";
import { ImageManager } from "@/components/ui/image-manager";
import { useAuth } from "@/hooks/useAuth";
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
  CheckCircle,
  Edit,
  Check,
  X
} from "lucide-react";

export default function StudyAbroad() {
  const [, setLocation] = useLocation();
  const { hasImageEditPermission } = useAuth();
  const [heroImage, setHeroImage] = useState("https://images.unsplash.com/photo-1523240795612-9a054b0db644?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080");
  const [studentsImage, setStudentsImage] = useState("https://images.unsplash.com/photo-1523240795612-9a054b0db644?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1000");
  const [showHeroImageManager, setShowHeroImageManager] = useState(false);
  const [showStudentsImageManager, setShowStudentsImageManager] = useState(false);
  




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
        backgroundImage={heroImage}
        allowImageEdit={hasImageEditPermission}
        onImageUpdate={setHeroImage}
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
      <section className="py-4 bg-neutral pt-[10px] pb-[10px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8 mt-[60px] mb-[60px]">
            <div className="lg:col-span-2">
              <h3 className="text-2xl font-bold text-foreground mb-6">
                <EditableText 
                  fieldName="study-abroad-services-title"
                  text="Dịch vụ tư vấn du học toàn diện"
                  className="text-2xl font-bold text-foreground"
                  showEditButton={true}
                  editingField={null}
                  editValues={{}}
                  onEditStart={() => {}}
                  onEditSave={() => {}}
                  onEditCancel={() => {}}
                />
              </h3>
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {services.map((service, index) => (
                  <div key={index} className="flex items-start">
                    <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      {service.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">
                        <EditableText 
                          fieldName={`study-service-${index}-title`}
                          text={service.title}
                          className="font-semibold text-foreground"
                          showEditButton={true}
                          editingField={null}
                          editValues={{}}
                          onEditStart={() => {}}
                          onEditSave={() => {}}
                          onEditCancel={() => {}}
                        />
                      </h4>
                      <p className="text-muted-foreground text-sm">
                        <EditableText 
                          fieldName={`study-service-${index}-description`}
                          text={service.description}
                          className="text-muted-foreground text-sm"
                          multiline={true}
                          showEditButton={true}
                          editingField={null}
                          editValues={{}}
                          onEditStart={() => {}}
                          onEditSave={() => {}}
                          onEditCancel={() => {}}
                        />
                      </p>
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

            <div className="relative">
              <img 
                src={studentsImage} 
                alt="International students in university library" 
                className="rounded-xl shadow-lg w-full h-auto mb-6" 
              />
              {hasImageEditPermission && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStudentsImageManager(true)}
                  className="absolute top-4 right-4 bg-white/80 hover:bg-white/90 text-gray-700"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Cập nhật ảnh
                </Button>
              )}
              <ImageManager
                isOpen={showStudentsImageManager}
                onClose={() => setShowStudentsImageManager(false)}
                onImageUpdate={setStudentsImage}
                imageType="study-abroad-students"
                altText="Study abroad students image"
              />
              
              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-foreground mb-4">
                    <EditableText 
                      fieldName="study-why-np-title"
                      text="Tại sao du học với N&P?"
                      className="font-semibold text-foreground"
                    />
                  </h4>
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
      
      {/* Why Choose N&P */}
      <section className="py-20 bg-gradient-to-r from-primary to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold mb-8 text-center">
            <EditableText 
              fieldName="study-why-choose-title"
              text="Tại Sao Nên Du Học Với N&P?"
              className="text-2xl font-bold text-white"
            />
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
      {/* Articles Section */}
      <ArticleSection 
        category="study-abroad"
        title="Thông tin về du học"
        description="Thông tin hữu ích về du học và cuộc sống sinh viên tại các nước"
      />
    </div>
  );
}
