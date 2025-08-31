import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { HeroSection } from "@/components/ui/hero-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArticleSection } from "@/components/ArticleSection";
import { ImageManager } from "@/components/ui/image-manager";
import { useAuth } from "@/hooks/useAuth";
import { 
  DollarSign, 
  Plane, 
  Headphones, 
  Smartphone,
  Edit
} from "lucide-react";

export default function FlightTickets() {
  const [, setLocation] = useLocation();
  const { hasImageEditPermission } = useAuth();
  const [heroImage, setHeroImage] = useState("https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080");
  const [flightImage, setFlightImage] = useState("https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600");
  const [showHeroImageManager, setShowHeroImageManager] = useState(false);
  const [showFlightImageManager, setShowFlightImageManager] = useState(false);

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

  const handleContactClick = () => {
    setLocation("/contact");
  };

  return (
    <div>
      <HeroSection
        title="Bán vé máy bay"
        subtitle=""
        description="Vé máy bay giá tốt nhất, đa dạng hãng hàng không, hỗ trợ tận tâm cho mọi chuyến đi của bạn"
        backgroundImage={heroImage}
        allowImageEdit={hasImageEditPermission}
        onImageUpdate={setHeroImage}
        primaryAction={{
          text: "Liên hệ đặt vé",
          onClick: handleContactClick
        }}
        secondaryAction={{
          text: "Nhận báo giá",
          onClick: handleContactClick
        }}
      />

      {/* Benefits & Airlines */}
      <section className="py-4 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8 mb-8">
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

            <div className="relative">
              <img 
                src={flightImage} 
                alt="Airplane taking off from runway" 
                className="rounded-xl shadow-lg w-full h-auto mb-6" 
              />
              {hasImageEditPermission && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFlightImageManager(true)}
                  className="absolute top-4 right-4 bg-white/80 hover:bg-white/90 text-gray-700"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Cập nhật ảnh
                </Button>
              )}
              <ImageManager
                isOpen={showFlightImageManager}
                onClose={() => setShowFlightImageManager(false)}
                onImageUpdate={setFlightImage}
                imageType="flight-booking"
                altText="Flight booking image"
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
      <section className="py-4 bg-neutral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold text-foreground text-center mb-10">
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



      {/* Articles Section */}
      <ArticleSection 
        category="flight-tickets"
        title="Thông tin về vé máy bay"
        description="Mẹo đặt vé máy bay giá rẻ và thông tin hữu ích cho du lịch"
      />
    </div>
  );
}
