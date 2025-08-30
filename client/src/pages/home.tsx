import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { HeroSection } from "@/components/ui/hero-section";
import { ServiceCard } from "@/components/ui/service-card";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { ContactForm } from "@/components/ui/contact-form";
import { Button } from "@/components/ui/button";
import { ServiceWithArticles } from "@/components/ServiceWithArticles";
import { ImageManager } from "@/components/ui/image-manager";
import { 
  IdCard, 
  GraduationCap, 
  Languages, 
  Plane,
  Users,
  Heart,
  DollarSign,
  TrendingUp,
  Award,
  HandHeart,
  Handshake,
  BarChart3,
  ArrowRight,
  Edit
} from "lucide-react";



export default function Home() {
  const [, setLocation] = useLocation();
  const { hasImageEditPermission } = useAuth();
  const [heroBgImage, setHeroBgImage] = useState("https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=2074&q=80");
  const [whyChooseImage, setWhyChooseImage] = useState("https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2084&q=80");
  const [uiImages, setUiImages] = useState({});
  const [showWhyChooseImageManager, setShowWhyChooseImageManager] = useState(false);

  useEffect(() => {
    document.title = "N&P Company - Đối Tác Tin Cậy Cho Giấc Mơ Toàn Cầu";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'N&P - Chuyên gia hàng đầu về dịch vụ thị thực, tư vấn du học, đào tạo tiếng Nhật và vé máy bay với hơn 10 năm kinh nghiệm');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'N&P - Chuyên gia hàng đầu về dịch vụ thị thực, tư vấn du học, đào tạo tiếng Nhật và vé máy bay với hơn 10 năm kinh nghiệm';
      document.head.appendChild(meta);
    }

    // Load UI images from database
    fetch('/api/ui-images')
      .then(res => res.json())
      .then(images => {
        const imageMap = {};
        images.forEach(img => {
          imageMap[img.imageType] = img.imageUrl;
        });
        setUiImages(imageMap);
        
        // Update hero banner if available
        if (imageMap['hero-banner']) {
          setHeroBgImage(imageMap['hero-banner']);
        }
        
        // Update why choose us image if available
        if (imageMap['why-choose-us']) {
          setWhyChooseImage(imageMap['why-choose-us']);
        }
        
        // Update service images with correct mapping
        setServices(prevServices => 
          prevServices.map(service => {
            let imageType = service.category;
            // Map categories to database image types
            if (imageType === 'visa-services') imageType = 'visa-service';
            
            if (imageMap[imageType]) {
              return { ...service, backgroundImage: imageMap[imageType] };
            }
            return service;
          })
        );
      })
      .catch(err => console.error('Failed to load UI images:', err));
  }, []);

  const handleServiceClick = (service: string) => {
    setLocation(service);
  };

  const handleContactClick = () => {
    setLocation("/contact");
  };

  const handleServiceImageUpdate = (serviceIndex: number, newImageUrl: string) => {
    setServices(prevServices => 
      prevServices.map((service, index) => 
        index === serviceIndex 
          ? { ...service, backgroundImage: newImageUrl }
          : service
      )
    );
  };

  const [services, setServices] = useState([
    {
      icon: <IdCard className="h-8 w-8 text-primary" />,
      title: "Dịch vụ xin thị thực",
      description: "Hỗ trợ xin thị thực du lịch, công tác, sinh viên cho hơn 50 quốc gia với tỷ lệ thành công 98%",
      route: "/visa-services",
      category: "visa-services",
      backgroundImage: "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=400&h=300"
    },
    {
      icon: <GraduationCap className="h-8 w-8 text-secondary" />,
      title: "Tư vấn du học", 
      description: "Tư vấn chọn trường, chương trình học, hỗ trợ hồ sơ và học bổng tại Nhật, Mỹ, Canada, Châu Âu",
      route: "/study-abroad",
      category: "study-abroad",
      backgroundImage: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=300"
    },
    {
      icon: <Languages className="h-8 w-8 text-accent" />,
      title: "Đào tạo tiếng Nhật",
      description: "Khóa học tiếng Nhật từ cơ bản đến nâng cao, luyện thi JLPT với giảng viên bản ngữ",
      route: "/japanese-training",
      category: "japanese-training",
      backgroundImage: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&h=300"
    },
    {
      icon: <Plane className="h-8 w-8 text-red-600" />,
      title: "Bán vé máy bay",
      description: "Vé máy bay giá tốt, đa dạng hãng hàng không, hỗ trợ 24/7 cho mọi hành trình của bạn",
      route: "/flight-tickets",
      category: "flight-tickets",
      backgroundImage: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&h=300"
    }
  ]);

  const reasons = [
    {
      icon: <Users className="h-8 w-8 text-primary" />,
      title: "Chuyên gia giàu kinh nghiệm",
      description: "Đội ngũ tư vấn viên được đào tạo chuyên sâu, am hiểu thủ tục và quy định quốc tế"
    },
    {
      icon: <Heart className="h-8 w-8 text-secondary" />,
      title: "Hỗ trợ cá nhân hóa",
      description: "Tư vấn 1-1, theo dõi tiến độ và hỗ trợ 24/7 trong suốt quá trình"
    },
    {
      icon: <DollarSign className="h-8 w-8 text-accent" />,
      title: "Giá cả cạnh tranh",
      description: "Cam kết giá tốt nhất thị trường với nhiều gói dịch vụ linh hoạt"
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-green-600" />,
      title: "Tỷ lệ thành công cao",
      description: "98% hồ sơ được chấp thuận, cam kết hoàn phí nếu không thành công"
    }
  ];

  const [testimonials, setTestimonials] = useState([
    {
      id: 1,
      name: "Nguyễn Thu Hà",
      role: "Du học sinh Nhật Bản",
      content: "Nhờ N&P, tôi đã xin được visa du học Nhật Bản chỉ sau 2 tuần. Đội ngũ tư vấn rất chuyên nghiệp và hỗ trợ tận tình!",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face"
    },
    {
      id: 2,
      name: "Trần Minh Đức", 
      role: "Kỹ sư IT",
      content: "Khóa học tiếng Nhật tại N&P rất hiệu quả. Sau 6 tháng tôi đã vượt qua kỳ thi N3 JLPT với điểm cao!",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
    },
    {
      id: 3,
      name: "Lê Thị Mai",
      role: "Doanh nhân", 
      content: "Dịch vụ vé máy bay của N&P luôn có giá tốt và hỗ trợ tuyệt vời. Tôi đã sử dụng nhiều lần và rất hài lòng!",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face"
    }
  ]);

  const handleTestimonialAvatarUpdate = (testimonialId: number, newAvatar: string) => {
    setTestimonials(prev => prev.map(testimonial => 
      testimonial.id === testimonialId 
        ? { ...testimonial, avatar: newAvatar }
        : testimonial
    ));
  };

  const stats = [
    { number: "1000+", label: "Khách hàng tin tưởng" },
    { number: "98%", label: "Tỷ lệ thành công" },
    { number: "50+", label: "Quốc gia hỗ trợ" }
  ];

  return (
    <div>
      {/* Hero Section */}
      <HeroSection
        title="Đối tác tin cậy cho"
        subtitle="giấc mơ toàn cầu"
        description="Chuyên gia hàng đầu về dịch vụ thị thực, tư vấn du học, đào tạo tiếng Nhật và vé máy bay với hơn 10 năm kinh nghiệm"
        backgroundImage={heroBgImage}
        allowImageEdit={hasImageEditPermission()}
        onImageUpdate={setHeroBgImage}
        primaryAction={{
          text: "Tư vấn miễn phí ngay",
          onClick: handleContactClick
        }}
        secondaryAction={{
          text: "Xem dịch vụ", 
          onClick: () => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })
        }}
      >
        {/* Floating Stats */}
        <div className="hidden lg:flex justify-center space-x-6 mt-12">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{stat.number}</div>
              <div className="text-sm text-blue-100">{stat.label}</div>
            </div>
          ))}
        </div>
      </HeroSection>

      {/* Services with Articles */}
      <section id="services" className="py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Dịch vụ chuyên nghiệp
            </h2>
            <p className="text-2xl text-muted-foreground max-w-3xl mx-auto">
              Chúng tôi cung cấp giải pháp toàn diện cho mọi nhu cầu du lịch, học tập và phát triển sự nghiệp quốc tế của bạn
            </p>
          </div>

          <div className="space-y-20">
            {services.map((service, index) => (
              <ServiceWithArticles
                key={index}
                service={service}
                category={service.category}
                onServiceClick={() => handleServiceClick(service.route)}
                allowImageEdit={hasImageEditPermission()}
                onServiceImageUpdate={(newImageUrl) => handleServiceImageUpdate(index, newImageUrl)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose N&P */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                Tại sao chọn N&P?
              </h2>
              <p className="text-2xl text-muted-foreground mb-8">
                Với hơn 10 năm kinh nghiệm, chúng tôi tự hào là đối tác đáng tin cậy giúp hàng nghìn khách hàng thực hiện ước mơ toàn cầu
              </p>

              <div className="space-y-6">
                {reasons.map((reason, index) => (
                  <div key={index} className="flex items-start">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      {reason.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        {reason.title}
                      </h3>
                      <p className="text-lg text-muted-foreground">{reason.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <img 
                src={whyChooseImage} 
                alt="Professional business team providing visa and international services" 
                className="rounded-xl shadow-lg w-full h-auto" 
              />
              {hasImageEditPermission() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWhyChooseImageManager(true)}
                  className="absolute top-4 right-4 bg-white/80 hover:bg-white/90 text-gray-700"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Cập nhật ảnh
                </Button>
              )}
              <ImageManager
                isOpen={showWhyChooseImageManager}
                onClose={() => setShowWhyChooseImageManager(false)}
                onImageUpdate={setWhyChooseImage}
                imageType="why-choose-us"
                altText="Why choose N&P image"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Khách hàng nói gì về chúng tôi
            </h2>
            <p className="text-2xl text-muted-foreground">
              Hàng nghìn câu chuyện thành công từ khách hàng tin tưởng N&P
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <TestimonialCard
                key={testimonial.id}
                name={testimonial.name}
                role={testimonial.role}
                content={testimonial.content}
                avatar={testimonial.avatar}
                allowAvatarEdit={hasImageEditPermission()}
                onAvatarUpdate={(newAvatar) => handleTestimonialAvatarUpdate(testimonial.id, newAvatar)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ContactForm variant="hero" />
        </div>
      </section>
    </div>
  );
}
