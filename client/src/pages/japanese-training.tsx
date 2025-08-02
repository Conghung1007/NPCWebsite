import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { HeroSection } from "@/components/ui/hero-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { ArticleSection } from "@/components/ArticleSection";
import { ImageManager } from "@/components/ui/image-manager";
import { 
  Sprout, 
  TreePine, 
  Mountain, 
  Target,
  MessageSquare,
  Briefcase,
  Tag,
  User,
  Users,
  Laptop,
  Globe,
  CheckCircle,
  Star,
  Edit
} from "lucide-react";

export default function JapaneseTraining() {
  const [, setLocation] = useLocation();
  const [heroImage, setHeroImage] = useState("https://images.unsplash.com/photo-1528720208104-3d9bd03cc9d4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080");
  const [classroomImage, setClassroomImage] = useState("https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600");
  const [showHeroImageManager, setShowHeroImageManager] = useState(false);
  const [showClassroomImageManager, setShowClassroomImageManager] = useState(false);
  const [showInstructorImageManager, setShowInstructorImageManager] = useState<number | null>(null);

  useEffect(() => {
    document.title = "Đào Tạo Tiếng Nhật - N&P Company";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Khóa học tiếng Nhật từ cơ bản đến nâng cao, luyện thi JLPT với giảng viên bản ngữ. Phương pháp giảng dạy hiện đại, lớp học nhỏ.');
    }
  }, []);

  const courseLevels = [
    {
      icon: <Sprout className="h-8 w-8 text-accent" />,
      title: "Tiếng Nhật sơ cấp",
      level: "N5 - N4 JLPT",
      description: "Học bảng chữ cái, từ vựng cơ bản, ngữ pháp căn bản cho người mới bắt đầu",
      price: "3.5 triệu/tháng",
      duration: "3 tháng"
    },
    {
      icon: <TreePine className="h-8 w-8 text-accent" />,
      title: "Tiếng Nhật trung cấp",
      level: "N3 - N2 JLPT", 
      description: "Phát triển kỹ năng giao tiếp, đọc hiểu và viết luận trong các tình huống thực tế",
      price: "4.2 triệu/tháng",
      duration: "4 tháng"
    },
    {
      icon: <Mountain className="h-8 w-8 text-accent" />,
      title: "Tiếng Nhật cao cấp",
      level: "N1 JLPT",
      description: "Thành thạo tiếng Nhật ở mức độ gần như người bản ngữ, chuẩn bị cho công việc",
      price: "5.0 triệu/tháng", 
      duration: "6 tháng"
    }
  ];

  const specialCourses = [
    {
      icon: <MessageSquare className="h-8 w-8 text-accent" />,
      title: "Tiếng Nhật Giao Tiếp",
      description: "Tập trung vào kỹ năng nói và nghe trong các tình huống thực tế"
    },
    {
      icon: <Briefcase className="h-8 w-8 text-accent" />,
      title: "Tiếng Nhật Thương Mại",
      description: "Từ vựng và cách giao tiếp trong môi trường doanh nghiệp"
    },
    {
      icon: <Tag className="h-8 w-8 text-accent" />,
      title: "Luyện Thi JLPT",
      description: "Chuẩn bị chuyên sâu cho kỳ thi năng lực tiếng Nhật quốc tế"
    }
  ];

  const teachingMethods = [
    {
      icon: <User className="h-5 w-5 text-primary" />,
      title: "Giảng viên bản ngữ Nhật Bản có kinh nghiệm",
      description: "100% giảng viên người Nhật có kinh nghiệm giảng dạy"
    },
    {
      icon: <Users className="h-5 w-5 text-secondary" />,
      title: "Lớp học nhỏ tối đa 8-10 học viên",
      description: "Tối đa 8-12 học viên/lớp để đảm bảo chất lượng"
    },
    {
      icon: <Laptop className="h-5 w-5 text-accent" />,
      title: "Bài học tương tác, thực hành nhiều",
      description: "Sử dụng công nghệ hiện đại và game hóa học tập"
    },
    {
      icon: <Globe className="h-5 w-5 text-primary" />,
      title: "Giáo trình chuẩn Nhật Bản",
      description: "Tích hợp học văn hóa, phong tục tập quán Nhật Bản"
    }
  ];

  const schedules = [
    { title: "Lớp sáng", time: "8:00 - 10:00", days: "Thứ 2, 4, 6" },
    { title: "Lớp tối", time: "19:00 - 21:00", days: "Thứ 3, 5, 7" },
    { title: "Lớp cuối tuần", time: "9:00 - 12:00", days: "Chủ nhật" },
    { title: "Lớp online", time: "Linh hoạt", days: "Mọi ngày" }
  ];

  const [instructors, setInstructors] = useState([
    {
      id: 1,
      name: "Yamada Sensei",
      title: "Giảng viên chính",
      description: "10+ năm kinh nghiệm giảng dạy tiếng Nhật cho người Việt. Chuyên gia luyện thi N1, N2 JLPT",
      avatar: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&h=150&fit=crop&crop=face"
    },
    {
      id: 2,
      name: "Tanaka Sensei", 
      title: "Giảng viên giao tiếp",
      description: "Chuyên về tiếng Nhật giao tiếp và văn hóa doanh nghiệp Nhật Bản. 8 năm kinh nghiệm",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
    },
    {
      id: 3,
      name: "Cô Minh Châu",
      title: "Trợ giảng",
      description: "Thạc sĩ ngôn ngữ Nhật, từng học tập 4 năm tại Tokyo. Hỗ trợ học viên Việt Nam",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face"
    }
  ]);

  const handleInstructorAvatarUpdate = (instructorId: number, newAvatar: string) => {
    setInstructors(prev => prev.map(instructor => 
      instructor.id === instructorId 
        ? { ...instructor, avatar: newAvatar }
        : instructor
    ));
  };

  const testimonials = [
    {
      name: "Trần Thị Hoa",
      role: "Học viên N2",
      content: "Học được 8 tháng và đã vượt qua N2 JLPT. Sensei rất nhiệt tình và phương pháp dạy rất hay!",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face"
    },
    {
      name: "Nguyễn Văn Nam",
      role: "Học viên giao tiếp",
      content: "Lớp học nhỏ nên được chú ý kỹ. Giờ đây tôi có thể giao tiếp tự tin với đồng nghiệp Nhật Bản",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
    }
  ];

  const handleScheduleView = () => {
    document.getElementById('schedule')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTrialClass = () => {
    setLocation("/contact");
  };

  return (
    <div>
      <HeroSection
        title="Đào tạo tiếng Nhật"
        subtitle=""
        description="Học tiếng Nhật từ cơ bản đến nâng cao với giảng viên bản ngữ và phương pháp giảng dạy hiện đại"
        backgroundImage={heroImage}
        allowImageEdit={true}
        onImageUpdate={setHeroImage}
        primaryAction={{
          text: "Xem lịch học",
          onClick: handleScheduleView
        }}
        secondaryAction={{
          text: "Đăng ký học thử miễn phí", 
          onClick: handleTrialClass
        }}
      />

      {/* Course Levels */}
      <section className="py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Các khóa học tiếng Nhật
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Từ sơ cấp đến nâng cao, chúng tôi có chương trình phù hợp với mọi trình độ
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 mb-16">
            {courseLevels.map((level, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="text-4xl mb-4">
                    {index === 0 ? "🌱" : index === 1 ? "🌿" : index === 2 ? "🌳" : "🎯"}
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{level.title}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{level.description}</p>
                  <div className="text-primary font-semibold">{level.duration}</div>
                </CardContent>
              </Card>
            ))}
            
            {/* JLPT Prep Course */}
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="font-bold text-foreground mb-2">Luyện Thi JLPT</h3>
                <p className="text-muted-foreground text-sm mb-4">Đào tạo chuyên sâu cho kỳ thi năng lực tiếng Nhật</p>
                <div className="text-primary font-semibold">2-4 tháng</div>
              </CardContent>
            </Card>
          </div>

          {/* Special Courses */}
          <Card className="mb-16">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-foreground mb-8 text-center">
                Các khóa học đặc biệt
              </h3>
              <div className="grid md:grid-cols-3 gap-8">
                {specialCourses.map((course, index) => (
                  <div key={index} className="text-center">
                    <div className="bg-accent/10 p-6 rounded-xl mb-4 inline-block">
                      {course.icon}
                    </div>
                    <h4 className="font-semibold text-foreground mb-3">{course.title}</h4>
                    <p className="text-muted-foreground">{course.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Teaching Method & Classroom */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-6">Phương pháp giảng dạy</h3>
              <div className="space-y-4">
                {teachingMethods.map((method, index) => (
                  <div key={index} className="flex items-start">
                    <div className="flex-shrink-0 mr-3 mt-1">
                      {method.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{method.title}</h4>
                      <p className="text-muted-foreground text-sm">{method.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <img 
                src={classroomImage} 
                alt="Japanese teacher with students in classroom" 
                className="rounded-xl shadow-lg w-full h-auto" 
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClassroomImageManager(true)}
                className="absolute top-4 right-4 bg-white/80 hover:bg-white/90 text-gray-700"
              >
                <Edit className="w-4 h-4 mr-2" />
                Cập nhật ảnh
              </Button>
              <ImageManager
                isOpen={showClassroomImageManager}
                onClose={() => setShowClassroomImageManager(false)}
                onImageUpdate={setClassroomImage}
                imageType="japanese-classroom"
                altText="Japanese classroom image"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Schedule & Testimonials */}
      <section id="schedule" className="py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-6">Lịch học linh hoạt</h3>
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {schedules.map((schedule, index) => (
                      <div key={index}>
                        <h4 className="font-semibold text-foreground mb-2">{schedule.title}</h4>
                        <p className="text-muted-foreground text-sm">{schedule.time}</p>
                        <p className="text-muted-foreground text-sm">{schedule.days}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-4">
                    <h4 className="font-semibold text-foreground mb-2">Ưu đãi đặc biệt</h4>
                    <p className="text-accent font-semibold">Giảm 20% học phí khi đăng ký trước 15/12</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-foreground mb-6">Học viên nói gì</h3>
              <div className="space-y-4">
                {testimonials.map((testimonial, index) => (
                  <Card key={index}>
                    <CardContent className="p-6">
                      <div className="flex items-center mb-3">
                        <div className="flex text-accent mr-3">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-current" />
                          ))}
                        </div>
                        <span className="font-medium text-foreground">{testimonial.name}</span>
                      </div>
                      <p className="text-muted-foreground text-sm italic">"{testimonial.content}"</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Instructors */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold text-foreground text-center mb-8">
            Đội ngũ giảng viên
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            {instructors.map((instructor, index) => (
              <Card key={index} className="text-center">
                <CardContent className="p-6">
                  <div className="relative group w-24 h-24 mx-auto mb-4">
                    <img 
                      src={instructor.avatar} 
                      alt={instructor.name}
                      className="w-24 h-24 rounded-full object-cover" 
                    />
                    <button
                      onClick={() => setShowInstructorImageManager(instructor.id)}
                      className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100"
                    >
                      <Edit className="h-5 w-5 text-white" />
                    </button>
                  </div>
                  <h4 className="font-semibold text-foreground mb-2">{instructor.name}</h4>
                  <p className="text-accent text-sm mb-3">{instructor.title}</p>
                  <p className="text-muted-foreground text-sm">{instructor.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Articles Section */}
      <ArticleSection 
        category="japanese-training"
        title="Thông tin về tiếng Nhật"
        description="Mẹo học tiếng Nhật hiệu quả và thông tin về văn hóa Nhật Bản"
      />

      {/* Instructor Image Manager Modal */}
      {showInstructorImageManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4" style={{ height: '95vh' }}>
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                  Cập nhật avatar giảng viên
                </h3>
                <button
                  onClick={() => setShowInstructorImageManager(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto" style={{ height: 'calc(95vh - 120px)' }}>
              <ImageManager
                onImageSelect={(imageUrl) => {
                  if (showInstructorImageManager) {
                    handleInstructorAvatarUpdate(showInstructorImageManager, imageUrl);
                    setShowInstructorImageManager(null);
                  }
                }}
                folder="ui-images"
                imageType={`instructor-${showInstructorImageManager}`}
                currentImageUrl={instructors.find(i => i.id === showInstructorImageManager)?.avatar}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
