import { useEffect } from "react";
import { useLocation } from "wouter";
import { HeroSection } from "@/components/ui/hero-section";
import { ServiceCard } from "@/components/ui/service-card";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { ContactForm } from "@/components/ui/contact-form";
import { Button } from "@/components/ui/button";
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
  ArrowRight
} from "lucide-react";

// Service Row with Animated Posts Component
function ServiceRowWithPosts({ service, isReversed, onLearnMore }: {
  service: any;
  isReversed: boolean;
  onLearnMore: () => void;
}) {
  // Sample posts for each service
  const getServicePosts = (title: string) => {
    const postSets = {
      "Dịch vụ xin thị thực": [
        { title: "Visa Nhật Bản - Thủ tục đơn giản", image: "https://images.unsplash.com/photo-1490650034439-fd184c3c86a5?w=300&h=200&fit=crop", type: "Visa" },
        { title: "Visa Mỹ - Tỷ lệ thành công 98%", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop", type: "Visa" },
        { title: "Visa Châu Âu - Xử lý nhanh chóng", image: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=300&h=200&fit=crop", type: "Visa" },
        { title: "Visa Australia - Hỗ trợ 24/7", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop", type: "Visa" },
        { title: "Visa Canada - Tư vấn miễn phí", image: "https://images.unsplash.com/photo-1503614472-8c93d56ad7eb?w=300&h=200&fit=crop", type: "Visa" }
      ],
      "Tư vấn du học": [
        { title: "Du học Nhật - Học bổng 100%", image: "https://images.unsplash.com/photo-1523050854058-8df90110c9d1?w=300&h=200&fit=crop", type: "Du học" },
        { title: "Du học Úc - Định cư dễ dàng", image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=300&h=200&fit=crop", type: "Du học" },
        { title: "Du học Mỹ - Top trường đại học", image: "https://images.unsplash.com/photo-1562774053-701939374585?w=300&h=200&fit=crop", type: "Du học" },
        { title: "Du học Canada - Chi phí thấp", image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop", type: "Du học" },
        { title: "Du học Đức - Miễn học phí", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=200&fit=crop", type: "Du học" }
      ],
      "Đào tạo tiếng Nhật": [
        { title: "Lớp N5 - Khởi đầu hoàn hảo", image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=300&h=200&fit=crop", type: "Nhật ngữ" },
        { title: "Lớp N3 - Giao tiếp thành thạo", image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=300&h=200&fit=crop", type: "Nhật ngữ" },
        { title: "Lớp N1 - Trình độ chuyên gia", image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=300&h=200&fit=crop", type: "Nhật ngữ" },
        { title: "Khóa giao tiếp - Thực tế", image: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=300&h=200&fit=crop", type: "Nhật ngữ" },
        { title: "Luyện thi JLPT - Đạt điểm cao", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=300&h=200&fit=crop", type: "Nhật ngữ" }
      ],
      "Bán vé máy bay": [
        { title: "Vé Hà Nội - Tokyo siêu rẻ", image: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=300&h=200&fit=crop", type: "Vé bay" },
        { title: "Vé TP.HCM - Seoul giảm 50%", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=200&fit=crop", type: "Vé bay" },
        { title: "Vé quốc tế - Ưu đãi đặc biệt", image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=300&h=200&fit=crop", type: "Vé bay" },
        { title: "Vé khứ hồi - Tiết kiệm 30%", image: "https://images.unsplash.com/photo-1517479149777-5f3b1511d5ad?w=300&h=200&fit=crop", type: "Vé bay" },
        { title: "Vé nhóm - Ưu đãi hấp dẫn", image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=200&fit=crop", type: "Vé bay" }
      ]
    };
    return postSets[title as keyof typeof postSets] || postSets["Dịch vụ xin thị thực"];
  };

  const posts = getServicePosts(service.title);
  const duplicatedPosts = [...posts, ...posts]; // Duplicate for seamless loop

  return (
    <div className={`flex flex-col lg:flex-row items-center gap-8 ${isReversed ? 'lg:flex-row-reverse' : ''}`}>
      {/* Service Info */}
      <div className="flex-1 lg:max-w-md">
        <div className="bg-white rounded-xl p-8 shadow-lg">
          <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
            {service.icon}
          </div>
          <h3 className="text-3xl font-bold text-foreground mb-4">{service.title}</h3>
          <p className="text-lg text-muted-foreground mb-6">{service.description}</p>
          <Button onClick={onLearnMore} className="w-full">
            Tìm hiểu thêm
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Animated Posts */}
      <div className="flex-1 overflow-hidden">
        <div className="relative">
          <div className="flex animate-scroll space-x-4" style={{
            animation: 'scroll 30s linear infinite',
            width: `${duplicatedPosts.length * 280}px`
          }}>
            {duplicatedPosts.map((post, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-64 bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-32 object-cover"
                />
                <div className="p-4">
                  <span className="inline-block bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full mb-2">
                    {post.type}
                  </span>
                  <h4 className="font-semibold text-base text-gray-800 line-clamp-2">
                    {post.title}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();

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
  }, []);

  const handleServiceClick = (service: string) => {
    setLocation(service);
  };

  const handleContactClick = () => {
    setLocation("/contact");
  };

  const services = [
    {
      icon: <IdCard className="h-8 w-8 text-primary" />,
      title: "Dịch vụ xin thị thực",
      description: "Hỗ trợ xin thị thực du lịch, công tác, sinh viên cho hơn 50 quốc gia với tỷ lệ thành công 98%",
      route: "/visa-services"
    },
    {
      icon: <GraduationCap className="h-8 w-8 text-secondary" />,
      title: "Tư vấn du học", 
      description: "Tư vấn chọn trường, chương trình học, hỗ trợ hồ sơ và học bổng tại Nhật, Mỹ, Canada, Châu Âu",
      route: "/study-abroad"
    },
    {
      icon: <Languages className="h-8 w-8 text-accent" />,
      title: "Đào tạo tiếng Nhật",
      description: "Khóa học tiếng Nhật từ cơ bản đến nâng cao, luyện thi JLPT với giảng viên bản ngữ",
      route: "/japanese-training"
    },
    {
      icon: <Plane className="h-8 w-8 text-red-600" />,
      title: "Bán vé máy bay",
      description: "Vé máy bay giá tốt, đa dạng hãng hàng không, hỗ trợ 24/7 cho mọi hành trình của bạn",
      route: "/flight-tickets"
    }
  ];

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

  const testimonials = [
    {
      name: "Nguyễn Thu Hà",
      role: "Du học sinh Nhật Bản",
      content: "Nhờ N&P, tôi đã xin được visa du học Nhật Bản chỉ sau 2 tuần. Đội ngũ tư vấn rất chuyên nghiệp và hỗ trợ tận tình!",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face"
    },
    {
      name: "Trần Minh Đức", 
      role: "Kỹ sư IT",
      content: "Khóa học tiếng Nhật tại N&P rất hiệu quả. Sau 6 tháng tôi đã vượt qua kỳ thi N3 JLPT với điểm cao!",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
    },
    {
      name: "Lê Thị Mai",
      role: "Doanh nhân", 
      content: "Dịch vụ vé máy bay của N&P luôn có giá tốt và hỗ trợ tuyệt vời. Tôi đã sử dụng nhiều lần và rất hài lòng!",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face"
    }
  ];

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
        backgroundImage="https://images.unsplash.com/photo-1556075798-4825dfaaf498?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080"
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

      {/* Services Overview */}
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

          <div className="space-y-12">
            {services.map((service, index) => (
              <ServiceRowWithPosts
                key={index}
                service={service}
                isReversed={index % 2 === 1}
                onLearnMore={() => handleServiceClick(service.route)}
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

            <div>
              <img 
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600" 
                alt="Happy diverse group celebrating success" 
                className="rounded-xl shadow-lg w-full h-auto" 
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
            {testimonials.map((testimonial, index) => (
              <TestimonialCard
                key={index}
                name={testimonial.name}
                role={testimonial.role}
                content={testimonial.content}
                avatar={testimonial.avatar}
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
