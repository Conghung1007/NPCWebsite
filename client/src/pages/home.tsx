import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { HeroSection } from "@/components/ui/hero-section";
import { ServiceCard } from "@/components/ui/service-card";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { ContactForm } from "@/components/ui/contact-form";
import { Button } from "@/components/ui/button";
import { ServiceWithArticles } from "@/components/ServiceWithArticles";
import { ServiceWithExams } from "@/components/ServiceWithExams";
import { ImageManager } from "@/components/ui/image-manager";
import { EditableText } from "@/components/ui/editable-text";
import { 
  IdCard, 
  GraduationCap, 
  Languages, 
  BookOpen,
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
  const { user, hasImageEditPermission } = useAuth();
  const [heroBgImage, setHeroBgImage] = useState("https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=2074&q=80");
  const [whyChooseImage, setWhyChooseImage] = useState("https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2084&q=80");
  const [uiImages, setUiImages] = useState<Record<string, string>>({});
  const [showWhyChooseImageManager, setShowWhyChooseImageManager] = useState(false);
  
  // Text editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('home-edit-values');
      console.log('Loading home-edit-values from localStorage:', saved);
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('Failed to load home edit values from localStorage:', error);
      return {};
    }
  });

  // Editable text handler functions
  const handleEditStart = (fieldName: string, currentValue: string) => {
    setEditingField(fieldName);
    setEditValues({ ...editValues, [fieldName]: currentValue });
  };

  const handleEditSave = (fieldName: string, value: string) => {
    // Hero section fields that should update serviceTexts
    const heroFields = ['heroTitle', 'heroSubtitle', 'heroDescription'];
    
    // Service-related fields 
    const serviceFields = ['services-title', 'services-description', 'testimonials-title', 'testimonials-description'];
    
    // Why choose us fields
    const whyChooseFields = ['why-choose-title', 'why-choose-description'];
    
    // Update service texts if it's a service field or hero field
    if (value && (Object.keys(serviceTexts).includes(fieldName) || heroFields.includes(fieldName))) {
      handleServiceTextUpdate(fieldName, value);
    }
    
    // Update testimonial if it's a testimonial field
    if (fieldName.startsWith('testimonial-')) {
      const parts = fieldName.split('-');
      if (parts.length >= 3) {
        const testimonialId = parseInt(parts[1]);
        const field = parts[2];
        handleTestimonialTextUpdate(testimonialId, field, value);
      }
    }
    
    console.log(`Saving field ${fieldName} with value:`, value);
    const updatedEditValues = { ...editValues, [fieldName]: value };
    setEditValues(updatedEditValues);
    // Save to localStorage
    console.log('Saving home-edit-values to localStorage:', updatedEditValues);
    localStorage.setItem('home-edit-values', JSON.stringify(updatedEditValues));
    setEditingField(null);
  };

  const handleEditCancel = () => {
    setEditingField(null);
    setEditValues({});
  };
  
  // Check if user has edit permissions (Manager or Admin)
  const hasEditPermission = user?.role === 'manager' || user?.role === 'admin';



  useEffect(() => {
    document.title = "N&P Company - Đối Tác Tin Cậy Cho Giấc Mơ Toàn Cầu";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'N&P - Chuyên gia hàng đầu về dịch vụ thị thực, tư vấn du học, đào tạo tiếng Nhật và hệ thống thi trực tuyến với hơn 10 năm kinh nghiệm');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'N&P - Chuyên gia hàng đầu về dịch vụ thị thực, tư vấn du học, đào tạo tiếng Nhật và hệ thống thi trực tuyến với hơn 10 năm kinh nghiệm';
      document.head.appendChild(meta);
    }

    // Load UI images from database
    fetch('/api/ui-images')
      .then(res => res.json())
      .then(images => {
        const imageMap: Record<string, string> = {};
        images.forEach((img: any) => {
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

  // State for editable service content with localStorage persistence
  const [serviceTexts, setServiceTexts] = useState(() => {
    const defaultServiceTexts = {
      heroTitle: "Đối tác tin cậy cho",
      heroSubtitle: "giấc mơ toàn cầu", 
      heroDescription: "Chuyên gia hàng đầu về dịch vụ thị thực, tư vấn du học, đào tạo tiếng Nhật và hệ thống thi trực tuyến với hơn 10 năm kinh nghiệm",
      visaTitle: "Dịch vụ xin thị thực",
      visaDescription: "Hỗ trợ xin thị thực du lịch, công tác, sinh viên cho hơn 50 quốc gia với tỷ lệ thành công 98%",
      studyTitle: "Tư vấn du học",
      studyDescription: "Tư vấn chọn trường, chương trình học, hỗ trợ hồ sơ và học bổng tại Nhật, Mỹ, Canada, Châu Âu",
      japaneseTitle: "Đào tạo tiếng Nhật",
      japaneseDescription: "Khóa học tiếng Nhật từ cơ bản đến nâng cao, luyện thi JLPT với giảng viên bản ngữ",
      examTitle: "Thi thử trực tuyến",
      examDescription: "Hệ thống thi trực tuyến với đề thi demo miễn phí và đề thi chính thức đánh giá năng lực tiếng Anh, tiếng Nhật"
    };
    
    try {
      const saved = localStorage.getItem('home-service-texts');
      console.log('Loading home-service-texts from localStorage:', saved);
      const savedServiceTexts = saved ? JSON.parse(saved) : defaultServiceTexts;
      
      // Check if we have editValues from localStorage that should override serviceTexts
      const savedEditValues = localStorage.getItem('home-edit-values');
      if (savedEditValues) {
        try {
          const editValues = JSON.parse(savedEditValues);
          console.log('Merging editValues into serviceTexts:', editValues);
          // Merge editValues that are hero fields into serviceTexts
          const heroFields = ['heroTitle', 'heroSubtitle', 'heroDescription'];
          heroFields.forEach(field => {
            if (editValues[field]) {
              savedServiceTexts[field] = editValues[field];
            }
          });
        } catch (e) {
          console.error('Failed to parse editValues:', e);
        }
      }
      
      return savedServiceTexts;
    } catch (error) {
      console.error('Failed to load home service texts from localStorage:', error);
      return defaultServiceTexts;
    }
  });

  const handleServiceTextUpdate = (fieldName: string, newValue: string) => {
    const updatedTexts = { ...serviceTexts, [fieldName]: newValue };
    setServiceTexts(updatedTexts);
    // Save to localStorage
    console.log('Saving home-service-texts to localStorage:', updatedTexts);
    localStorage.setItem('home-service-texts', JSON.stringify(updatedTexts));
    
    // Also update the services array with the new text
    setServices(prevServices => 
      prevServices.map(service => {
        // Handle service title updates
        if (fieldName === `${service.category}-title`) {
          return { ...service, title: newValue };
        }
        // Handle service description updates  
        if (fieldName === `${service.category}-description`) {
          return { ...service, description: newValue };
        }
        // Handle online exam service (special case)
        if (fieldName === 'online-exam-title' && service.category === 'online-exam') {
          return { ...service, title: newValue };
        }
        if (fieldName === 'online-exam-description' && service.category === 'online-exam') {
          return { ...service, description: newValue };
        }
        return service;
      })
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
      icon: <BookOpen className="h-8 w-8 text-blue-600" />,
      title: "Thi thử trực tuyến",
      description: "Hệ thống thi trực tuyến với đề thi demo miễn phí và đề thi chính thức đánh giá năng lực tiếng Anh, tiếng Nhật",
      route: "/online-exam",
      category: "online-exam",
      backgroundImage: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=300"
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

  const [testimonials, setTestimonials] = useState(() => {
    try {
      const saved = localStorage.getItem('home-testimonials');
      console.log('Loading home-testimonials from localStorage:', saved);
      return saved ? JSON.parse(saved) : [
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
          role: "Giáo viên", 
          content: "Hệ thống thi trực tuyến của N&P rất tiện lợi và chính xác. Tôi đã sử dụng để đánh giá trình độ tiếng Anh của học sinh và rất hài lòng!",
          avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face"
        }
      ];
    } catch (error) {
      console.error('Failed to load home testimonials from localStorage:', error);
      return [
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
          role: "Giáo viên", 
          content: "Hệ thống thi trực tuyến của N&P rất tiện lợi và chính xác. Tôi đã sử dụng để đánh giá trình độ tiếng Anh của học sinh và rất hài lòng!",
          avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face"
        }
      ];
    }
  });

  const handleTestimonialAvatarUpdate = (testimonialId: number, newAvatar: string) => {
    setTestimonials(prev => prev.map(testimonial => 
      testimonial.id === testimonialId 
        ? { ...testimonial, avatar: newAvatar }
        : testimonial
    ));
  };

  const handleTestimonialTextUpdate = (testimonialId: number, field: string, value: string) => {
    const updatedTestimonials = testimonials.map(testimonial => 
      testimonial.id === testimonialId 
        ? { ...testimonial, [field]: value }
        : testimonial
    );
    setTestimonials(updatedTestimonials);
    // Save to localStorage
    console.log('Saving home-testimonials to localStorage:', updatedTestimonials);
    localStorage.setItem('home-testimonials', JSON.stringify(updatedTestimonials));
  };

  const stats = [
    { number: "1000+", label: "Khách hàng tin tưởng" },
    { number: "98%", label: "Tỷ lệ thành công" },
    { number: "50+", label: "Quốc gia hỗ trợ" }
  ];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative hero-gradient text-white overflow-hidden">
        {heroBgImage && (
          <div className="absolute inset-0">
            <img 
              src={heroBgImage} 
              alt="Hero background" 
              className="w-full h-full object-cover opacity-20" 
            />
          </div>
        )}
        
        {hasImageEditPermission && (
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowWhyChooseImageManager(true)}
              className="bg-white/20 text-white hover:bg-white/30 border-white/50"
            >
              <Edit className="w-4 h-4 mr-2" />
              Cập nhật ảnh nền
            </Button>
            <ImageManager
              isOpen={showWhyChooseImageManager}
              onClose={() => setShowWhyChooseImageManager(false)}
              onImageUpdate={setHeroBgImage}
              imageType="hero"
              altText="Hero background image"
            />
          </div>
        )}
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            <h1 className="text-5xl lg:text-7xl font-bold mb-4">
              <EditableText 
                fieldName="heroTitle"
                text={serviceTexts.heroTitle}
                className="text-5xl lg:text-7xl font-bold text-white"
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
              <br />
              <span className="text-accent">
                <EditableText 
                  fieldName="heroSubtitle"
                  text={serviceTexts.heroSubtitle}
                  className="text-accent text-5xl lg:text-7xl font-bold"
                  showEditButton={hasEditPermission}
                  editingField={editingField}
                  editValues={editValues}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              </span>
            </h1>
            <div className="text-xl lg:text-2xl text-blue-100 mb-8 max-w-4xl mx-auto">
              <EditableText 
                fieldName="heroDescription"
                text={serviceTexts.heroDescription}
                className="text-xl lg:text-2xl text-blue-100"
                multiline={true}
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-accent hover:bg-accent/90 text-white font-semibold px-8 py-4 text-lg"
                onClick={handleContactClick}
              >
                Tư vấn miễn phí ngay
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="border-white bg-white backdrop-blur-sm text-primary hover:bg-white/90 hover:text-primary/80 font-semibold px-8 py-4 text-lg shadow-lg"
                onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Xem dịch vụ
              </Button>
            </div>
          </div>

          {/* Floating Stats */}
          <div className="hidden lg:flex justify-center space-x-6 mt-12">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{stat.number}</div>
                <div className="text-sm text-blue-100">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services with Articles */}
      <section id="services" className="py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              <EditableText 
                fieldName="services-title"
                text="Dịch vụ chuyên nghiệp"
                className="text-4xl md:text-5xl font-bold text-foreground"
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </h2>
            <div className="text-2xl text-muted-foreground max-w-3xl mx-auto">
              <EditableText 
                fieldName="services-description"
                text="Chúng tôi cung cấp giải pháp toàn diện cho mọi nhu cầu du lịch, học tập và phát triển sự nghiệp quốc tế của bạn"
                className="text-2xl text-muted-foreground"
                multiline={true}
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </div>
          </div>

          <div className="space-y-20">
            {services.map((service, index) => {
              const serviceKey = service.category === 'visa-services' ? 'visa' : 
                               service.category === 'study-abroad' ? 'study' :
                               service.category === 'japanese-training' ? 'japanese' :
                               'exam';
              
              // Just pass the service as-is, components will handle EditableText internally
              const editableService = service;
              
              // Use ServiceWithExams for online exam service
              if (service.category === 'online-exam') {
                return (
                  <ServiceWithExams
                    key={index}
                    service={editableService}
                    onServiceClick={() => handleServiceClick(service.route)}
                    allowImageEdit={hasImageEditPermission}
                    allowTextEdit={hasEditPermission}
                    onServiceImageUpdate={(newImageUrl) => handleServiceImageUpdate(index, newImageUrl)}
                    onServiceTextUpdate={handleServiceTextUpdate}
                  />
                );
              }
              
              // Use ServiceWithArticles for other services
              return (
                <ServiceWithArticles
                  key={index}
                  service={editableService}
                  category={service.category}
                  onServiceClick={() => handleServiceClick(service.route)}
                  allowImageEdit={hasImageEditPermission}
                  allowTextEdit={hasEditPermission}
                  onServiceImageUpdate={(newImageUrl) => handleServiceImageUpdate(index, newImageUrl)}
                  onServiceTextUpdate={handleServiceTextUpdate}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Choose N&P */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                <EditableText 
                  fieldName="why-choose-title"
                  text="Tại sao chọn N&P?"
                  className="text-4xl md:text-5xl font-bold text-foreground"
                  showEditButton={hasEditPermission}
                  editingField={editingField}
                  editValues={editValues}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              </h2>
              <div className="text-2xl text-muted-foreground mb-8">
                <EditableText 
                  fieldName="why-choose-description"
                  text="Với hơn 10 năm kinh nghiệm, chúng tôi tự hào là đối tác đáng tin cậy giúp hàng nghìn khách hàng thực hiện ước mơ toàn cầu"
                  className="text-2xl text-muted-foreground"
                  multiline={true}
                  showEditButton={hasEditPermission}
                  editingField={editingField}
                  editValues={editValues}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              </div>

              <div className="space-y-6">
                {reasons.map((reason, index) => (
                  <div key={index} className="flex items-start">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      {reason.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        <EditableText 
                          fieldName={`why-reason-title-${index}`}
                          text={reason.title}
                          className="text-xl font-semibold text-foreground"
                          showEditButton={hasEditPermission}
                          editingField={editingField}
                          editValues={editValues}
                          onEditStart={handleEditStart}
                          onEditSave={handleEditSave}
                          onEditCancel={handleEditCancel}
                        />
                      </h3>
                      <div className="text-lg text-muted-foreground">
                        <EditableText 
                          fieldName={`why-reason-description-${index}`}
                          text={reason.description}
                          className="text-lg text-muted-foreground"
                          multiline={true}
                          showEditButton={hasEditPermission}
                          editingField={editingField}
                          editValues={editValues}
                          onEditStart={handleEditStart}
                          onEditSave={handleEditSave}
                          onEditCancel={handleEditCancel}
                        />
                      </div>
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
              {hasImageEditPermission && (
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
              <EditableText 
                fieldName="testimonials-title"
                text="Khách hàng nói gì về chúng tôi"
                className="text-4xl md:text-5xl font-bold text-foreground"
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </h2>
            <div className="text-2xl text-muted-foreground">
              <EditableText 
                fieldName="testimonials-description"
                text="Hàng nghìn câu chuyện thành công từ khách hàng tin tưởng N&P"
                className="text-2xl text-muted-foreground"
                multiline={true}
                showEditButton={hasEditPermission}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <TestimonialCard
                key={testimonial.id}
                id={testimonial.id}
                name={testimonial.name}
                role={testimonial.role}
                content={testimonial.content}
                avatar={testimonial.avatar}
                allowAvatarEdit={hasImageEditPermission}
                onAvatarUpdate={(newAvatar) => handleTestimonialAvatarUpdate(testimonial.id, newAvatar)}
                allowTextEdit={hasEditPermission}
                onTextUpdate={(field, value) => handleTestimonialTextUpdate(testimonial.id, field, value)}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
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
