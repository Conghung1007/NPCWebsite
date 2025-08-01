import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { HeroSection } from "@/components/ui/hero-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { 
  DollarSign, 
  Plane, 
  Headphones, 
  Smartphone,
  PlaneTakeoff,
  PlaneLanding,
  CalendarDays,
  Users
} from "lucide-react";

export default function FlightTickets() {
  const [, setLocation] = useLocation();
  const [tripType, setTripType] = useState("round-trip");

  useEffect(() => {
    document.title = "Bán Vé Máy Bay - N&P Company";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Vé máy bay giá tốt nhất, đa dạng hãng hàng không, hỗ trợ 24/7. Đặt vé máy bay online nhanh chóng và tiện lợi.');
    }
  }, []);

  const benefits = [
    {
      icon: <DollarSign className="h-8 w-8 text-green-600" />,
      title: "Giá cả cạnh tranh",
      description: "Cam kết giá tốt nhất thị trường, hoàn tiền nếu tìm được giá rẻ hơn"
    },
    {
      icon: <Plane className="h-8 w-8 text-blue-600" />,
      title: "Hàng không đa dạng", 
      description: "Đối tác với 50+ hãng hàng không trong nước và quốc tế"
    },
    {
      icon: <Headphones className="h-8 w-8 text-red-600" />,
      title: "Hỗ trợ 24/7",
      description: "Đội ngũ tư vấn sẵn sàng hỗ trợ mọi lúc, mọi nơi"
    },
    {
      icon: <Smartphone className="h-8 w-8 text-purple-600" />,
      title: "Đặt vé dễ dàng",
      description: "Quy trình đặt vé nhanh chóng, thanh toán an toàn"
    }
  ];

  const airlines = [
    "Vietnam Airlines", "VietJet Air", "Bamboo Airways", 
    "JAL", "ANA", "+45 hãng"
  ];

  const promotions = [
    {
      title: "🔥 Flash Sale", 
      description: "Giảm đến 30% vé đi Nhật Bản",
      bgColor: "bg-orange-50 border-orange-200",
      textColor: "text-orange-800"
    },
    {
      title: "💎 Khách VIP",
      description: "Tích điểm đổi vé miễn phí", 
      bgColor: "bg-green-50 border-green-200",
      textColor: "text-green-800"
    },
    {
      title: "👥 Nhóm đông",
      description: "Giảm 15% cho nhóm 10+ người",
      bgColor: "bg-blue-50 border-blue-200", 
      textColor: "text-blue-800"
    }
  ];

  const popularRoutes = [
    {
      route: "Hà Nội - Tokyo",
      code: "HAN - NRT",
      price: "Từ 12.5 triệu",
      type: "Khứ hồi, bao gồm thuế"
    },
    {
      route: "TP.HCM - Seoul", 
      code: "SGN - ICN",
      price: "Từ 8.9 triệu",
      type: "Khứ hồi, bao gồm thuế"
    },
    {
      route: "Hà Nội - Bangkok",
      code: "HAN - BKK", 
      price: "Từ 3.2 triệu",
      type: "Khứ hồi, bao gồm thuế"
    }
  ];

  const handleSearchFlights = () => {
    // In a real app, this would perform the flight search
    alert("Tính năng tìm kiếm chuyến bay sẽ được tích hợp với API đặt vé");
  };

  const handleContactClick = () => {
    setLocation("/contact");
  };

  return (
    <div>
      <HeroSection
        title="Bán vé máy bay"
        subtitle=""
        description="Vé máy bay giá tốt nhất, đa dạng hãng hàng không, hỗ trợ tận tâm cho mọi chuyến đi của bạn"
        backgroundImage="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080"
        primaryAction={{
          text: "Tìm chuyến bay của bạn",
          onClick: () => document.getElementById('search')?.scrollIntoView({ behavior: 'smooth' })
        }}
        secondaryAction={{
          text: "Nhận báo giá",
          onClick: handleContactClick
        }}
      />

      {/* Flight Search Interface */}
      <section id="search" className="py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="p-8">
              <h3 className="text-xl font-semibold text-foreground mb-6 text-center">
                Tìm kiếm chuyến bay
              </h3>
              
              {/* Trip Type Selector */}
              <div className="flex justify-center mb-6">
                <div className="flex bg-muted rounded-lg p-1">
                  <button 
                    onClick={() => setTripType("round-trip")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      tripType === "round-trip" 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Khứ hồi
                  </button>
                  <button 
                    onClick={() => setTripType("one-way")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      tripType === "one-way" 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Một chiều
                  </button>
                  <button 
                    onClick={() => setTripType("multi-city")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      tripType === "multi-city" 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Nhiều thành phố
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Từ</label>
                  <div className="relative">
                    <Input 
                      placeholder="Hà Nội (HAN)" 
                      className="pl-10"
                    />
                    <PlaneTakeoff className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Đến</label>
                  <div className="relative">
                    <Input 
                      placeholder="Tokyo (NRT)" 
                      className="pl-10"
                    />
                    <PlaneLanding className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Ngày đi</label>
                  <div className="relative">
                    <Input 
                      type="date" 
                      className="pl-10"
                    />
                    <CalendarDays className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Hành khách</label>
                  <Select>
                    <SelectTrigger>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="1 người lớn" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 người lớn</SelectItem>
                      <SelectItem value="2">2 người lớn</SelectItem>
                      <SelectItem value="3">3 người lớn</SelectItem>
                      <SelectItem value="4+">4+ người lớn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="text-center">
                <Button 
                  onClick={handleSearchFlights}
                  className="btn-primary text-lg px-12 py-3"
                >
                  <Plane className="mr-2 h-5 w-5" />
                  Tìm chuyến bay
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Benefits & Airlines */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            <div className="lg:col-span-2">
              <h3 className="text-2xl font-bold text-foreground mb-6">
                Lợi ích khi đặt vé với N&P
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                      {benefit.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">{benefit.title}</h4>
                      <p className="text-muted-foreground text-sm">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <h4 className="text-lg font-semibold text-foreground mb-4">Đối tác hàng không</h4>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
                  {airlines.map((airline, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border border-border text-center">
                      <span className="font-semibold text-muted-foreground text-sm">{airline}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <img 
                src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600" 
                alt="Airplane taking off from runway" 
                className="rounded-xl shadow-lg w-full h-auto mb-6" 
              />
              
              <Card>
                <CardContent className="p-6">
                  <h4 className="font-semibold text-foreground mb-4 text-center">Ưu đãi đặc biệt</h4>
                  <div className="space-y-4">
                    {promotions.map((promo, index) => (
                      <div key={index} className={`border rounded-lg p-4 ${promo.bgColor}`}>
                        <div className={`font-semibold text-sm ${promo.textColor}`}>{promo.title}</div>
                        <div className={`text-sm ${promo.textColor}`}>{promo.description}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Routes */}
      <section className="py-20 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold text-foreground text-center mb-8">
            Tuyến bay phổ biến
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            {popularRoutes.map((route, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <div className="font-semibold text-foreground">{route.route}</div>
                      <div className="text-sm text-muted-foreground">{route.code}</div>
                    </div>
                    <Plane className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-primary mb-2">{route.price}</div>
                  <div className="text-sm text-muted-foreground">{route.type}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-red-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-bold mb-4">
            Tìm Chuyến Bay Hoàn Hảo Cho Bạn
          </h3>
          <p className="text-red-100 mb-6">
            Hãy để chúng tôi giúp bạn tìm được vé máy bay phù hợp nhất
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => document.getElementById('search')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white text-red-600 hover:bg-white/90 text-lg px-8 py-3"
            >
              Tìm Chuyến Bay Của Tôi
            </Button>
            <Button 
              onClick={handleContactClick}
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-red-600 text-lg px-8 py-3"
            >
              Nhận Báo Giá
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
