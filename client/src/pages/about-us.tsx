import { useEffect } from "react";
import { useLocation } from "wouter";
import { HeroSection } from "@/components/ui/hero-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Eye, 
  Heart, 
  Award, 
  Users, 
  Star, 
  Lightbulb,
  Handshake,
  Target,
  Facebook,
  Linkedin
} from "lucide-react";

export default function AboutUs() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Giới Thiệu Về N&P - N&P Company";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Tìm hiểu về N&P - Công ty TNHH hàng đầu về dịch vụ visa, du học, đào tạo tiếng Nhật và vé máy bay với hơn 10 năm kinh nghiệm.');
    }
  }, []);

  const coreValues = [
    {
      icon: <Handshake className="h-8 w-8 text-primary" />,
      title: "Uy Tín",
      description: "Luôn đặt uy tín và lời hứa lên hàng đầu trong mọi hoạt động"
    },
    {
      icon: <Star className="h-8 w-8 text-secondary" />,
      title: "Chất Lượng", 
      description: "Không ngừng nâng cao chất lượng dịch vụ và sản phẩm"
    },
    {
      icon: <Heart className="h-8 w-8 text-accent" />,
      title: "Tận Tâm",
      description: "Phục vụ khách hàng với tinh thần trách nhiệm cao nhất"
    },
    {
      icon: <Lightbulb className="h-8 w-8 text-primary" />,
      title: "Sáng Tạo",
      description: "Liên tục đổi mới và cải tiến để phục vụ tốt hơn"
    }
  ];

  const teamMembers = [
    {
      name: "Nguyễn Văn Phúc",
      position: "Giám đốc điều hành",
      description: "15 năm kinh nghiệm trong ngành du lịch và giáo dục quốc tế",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
      color: "text-primary"
    },
    {
      name: "Trần Thị Nga",
      position: "Trưởng phòng Tư vấn", 
      description: "Chuyên gia tư vấn du học với 12 năm kinh nghiệm",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face",
      color: "text-secondary"
    },
    {
      name: "Lê Minh Tuấn", 
      position: "Chuyên viên Visa",
      description: "Chuyên gia xin visa với tỷ lệ thành công 99%",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
      color: "text-accent"
    },
    {
      name: "Phạm Thị Lan",
      position: "Trưởng phòng CSKH",
      description: "Chuyên gia chăm sóc khách hàng và hỗ trợ 24/7",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face",
      color: "text-red-600"
    }
  ];

  const achievements = [
    { number: "10+", label: "Năm kinh nghiệm" },
    { number: "5000+", label: "Khách hàng tin tưởng" },
    { number: "50+", label: "Quốc gia hỗ trợ" },
    { number: "98%", label: "Tỷ lệ thành công" }
  ];

  const whyChooseUs = [
    {
      icon: <Award className="h-8 w-8 text-primary" />,
      title: "Kinh Nghiệm Lâu Năm",
      description: "Hơn 10 năm kinh nghiệm trong lĩnh vực dịch vụ quốc tế với hàng ngàn case thành công"
    },
    {
      icon: <Users className="h-8 w-8 text-secondary" />,
      title: "Đội Ngũ Chuyên Nghiệp", 
      description: "Tư vấn viên được đào tạo bài bản, am hiểu sâu về thị trường và quy định từng quốc gia"
    },
    {
      icon: <Handshake className="h-8 w-8 text-accent" />,
      title: "Dịch Vụ Toàn Diện",
      description: "Một điểm đến cho mọi nhu cầu toàn cầu"
    },
    {
      icon: <Target className="h-8 w-8 text-red-600" />,
      title: "Tỷ Lệ Thành Công Cao",
      description: "98% hồ sơ được chấp thuận thành công"
    }
  ];

  const handleContactClick = () => {
    setLocation("/contact");
  };

  return (
    <div>
      <HeroSection
        title="Giới thiệu về N&P"
        subtitle=""
        description="Câu chuyện của chúng tôi bắt đầu từ ước mơ kết nối Việt Nam với thế giới"
        backgroundImage="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080"
        primaryAction={{
          text: "Liên hệ với chúng tôi",
          onClick: handleContactClick
        }}
      />

      {/* Company Story */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 mb-16">
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-6">Câu chuyện của chúng tôi</h3>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Được thành lập vào năm 2013, Công ty TNHH N&P bắt đầu hành trình với sứ mệnh giúp người Việt Nam 
                  thực hiện ước mơ toàn cầu. Từ một văn phòng nhỏ với 3 nhân viên, chúng tôi đã phát triển thành 
                  một trong những công ty dịch vụ du lịch và giáo dục uy tín nhất Việt Nam.
                </p>
                <p>
                  Với hơn 10 năm kinh nghiệm, N&P đã đồng hành cùng hàng nghìn khách hàng thực hiện giấc mơ du học, 
                  du lịch và phát triển sự nghiệp quốc tế. Chúng tôi tự hào về tỷ lệ thành công 98% trong việc 
                  xin visa và hơn 95% sinh viên nhận được học bổng du học.
                </p>
                <p>
                  Ngày hôm nay, N&P không chỉ là đối tác tin cậy mà còn là người bạn đồng hành trong mọi hành trình 
                  khám phá thế giới của bạn.
                </p>
              </div>

              <div className="mt-8 p-6 bg-neutral rounded-xl">
                <h4 className="font-semibold text-foreground mb-4">Tầm nhìn và sứ mệnh</h4>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <Eye className="h-6 w-6 text-primary mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <strong className="text-foreground">Tầm nhìn:</strong>
                      <span className="text-muted-foreground ml-2">Trở thành công ty dịch vụ du lịch và giáo dục hàng đầu Đông Nam Á</span>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Heart className="h-6 w-6 text-secondary mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <strong className="text-foreground">Sứ mệnh:</strong>
                      <span className="text-muted-foreground ml-2">Kết nối ước mơ toàn cầu, mang lại cơ hội phát triển cho mọi người</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <img 
                src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600" 
                alt="Professional team in modern office" 
                className="rounded-xl shadow-lg w-full h-auto mb-6" 
              />
              
              <div className="grid grid-cols-2 gap-4">
                {achievements.map((achievement, index) => (
                  <div key={index} className="bg-primary/10 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-primary mb-1">{achievement.number}</div>
                    <div className="text-sm text-muted-foreground">{achievement.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-2xl font-bold text-foreground mb-4">Giá trị cốt lõi</h3>
            <p className="text-xl text-muted-foreground">Những giá trị định hướng mọi hoạt động của chúng tôi</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6">
            {coreValues.map((value, index) => (
              <div key={index} className="text-center">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  {value.icon}
                </div>
                <h4 className="font-semibold text-foreground mb-2">{value.title}</h4>
                <p className="text-muted-foreground text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-2xl font-bold text-foreground mb-4">Đội ngũ chuyên gia</h3>
            <p className="text-xl text-muted-foreground">Những con người tài năng đằng sau thành công của N&P</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6">
            {teamMembers.map((member, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <img 
                    src={member.avatar} 
                    alt={member.name}
                    className="w-32 h-32 rounded-full mx-auto mb-4 object-cover" 
                  />
                  <h4 className="font-semibold text-foreground mb-1">{member.name}</h4>
                  <p className={`${member.color} text-sm mb-2 font-medium`}>{member.position}</p>
                  <p className="text-muted-foreground text-xs">{member.description}</p>
                  <div className="flex justify-center space-x-3 mt-4">
                    <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                      <Linkedin className="h-4 w-4" />
                    </a>
                    <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                      <Facebook className="h-4 w-4" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Achievements */}
      <section className="py-20 bg-gradient-to-r from-primary to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold mb-8 text-center">Thành tựu của chúng tôi</h3>
          <div className="grid md:grid-cols-4 gap-8 text-center">
            {achievements.map((achievement, index) => (
              <div key={index}>
                <div className="text-4xl font-bold mb-2">{achievement.number}</div>
                <p className="opacity-90">{achievement.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose N&P */}
      <section className="py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-2xl font-bold text-foreground mb-6">Tại sao chọn N&P?</h3>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6">
            {whyChooseUs.map((item, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center">
                  <div className="flex justify-center mb-4">
                    {item.icon}
                  </div>
                  <h4 className="font-semibold text-foreground mb-3">{item.title}</h4>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            Sẵn sàng bắt đầu hành trình với N&P?
          </h3>
          <p className="text-muted-foreground mb-6">
            Liên hệ với chúng tôi ngay hôm nay để được tư vấn miễn phí
          </p>
          <Button 
            onClick={handleContactClick}
            className="btn-primary text-lg px-8 py-3"
          >
            Liên Hệ Ngay
          </Button>
        </div>
      </section>
    </div>
  );
}
