import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, ArrowLeft } from "lucide-react";

export default function RegisterSuccess() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            Đăng ký thành công!
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Thông tin đăng ký của bạn đã được gửi thành công
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6 text-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              Đang chờ xác nhận từ nhân viên tư vấn
            </h3>
            <p className="text-blue-700 leading-relaxed">
              Nhân viên tư vấn của chúng tôi sẽ xem xét và xác nhận thông tin đăng ký trong vòng{" "}
              <span className="font-semibold">48 giờ</span>. 
              Bạn sẽ nhận được thông báo qua email khi tài khoản được kích hoạt.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Bước tiếp theo:</h4>
            <ul className="text-left space-y-2 text-muted-foreground">
              <li className="flex items-start">
                <span className="inline-block w-6 h-6 bg-primary/10 text-primary rounded-full text-sm font-semibold mr-3 mt-0.5 text-center leading-6">1</span>
                Kiểm tra email để theo dõi trạng thái đăng ký
              </li>
              <li className="flex items-start">
                <span className="inline-block w-6 h-6 bg-primary/10 text-primary rounded-full text-sm font-semibold mr-3 mt-0.5 text-center leading-6">2</span>
                Chờ xác nhận từ nhân viên tư vấn (trong vòng 48h)
              </li>
              <li className="flex items-start">
                <span className="inline-block w-6 h-6 bg-primary/10 text-primary rounded-full text-sm font-semibold mr-3 mt-0.5 text-center leading-6">3</span>
                Đăng nhập và sử dụng dịch vụ khi tài khoản được kích hoạt
              </li>
            </ul>
          </div>

          <div className="border-t pt-6">
            <p className="text-sm text-muted-foreground mb-4">
              Có thắc mắc về quá trình đăng ký?
            </p>
            <div className="flex gap-3 justify-center">
              <Button 
                variant="outline" 
                onClick={() => setLocation("/contact")}
                className="flex-1 max-w-40"
              >
                Liên hệ hỗ trợ
              </Button>
              <Button 
                variant="default" 
                onClick={() => setLocation("/")}
                className="flex-1 max-w-40"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Về trang chủ
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}