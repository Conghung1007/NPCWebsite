import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRight, ChevronLeft, ChevronRight, Edit, BookOpen, Users, Timer } from "lucide-react";
import { Link } from "wouter";
import { useState, useRef, useEffect } from "react";
import type { Exam } from "@shared/schema";
import { ImageManager } from "@/components/ui/image-manager";

interface ServiceWithExamsProps {
  service: {
    icon: React.ReactNode;
    title: string;
    description: string;
    route: string;
    backgroundImage?: string;
  };
  onServiceClick: () => void;
  allowImageEdit?: boolean;
  onServiceImageUpdate?: (newImageUrl: string) => void;
}

// Simple Badge component
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function ServiceWithExams({ 
  service, 
  onServiceClick,
  allowImageEdit = false,
  onServiceImageUpdate
}: ServiceWithExamsProps) {
  const { data: allExams = [], isLoading } = useQuery<Exam[]>({
    queryKey: ['/api/exams'],
  });

  // State for carousel
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showImageManager, setShowImageManager] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filter and limit to 6 most recent exams
  const featuredExams = allExams
    .filter(exam => exam.isActive)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);
  
  // Number of exams to show at once (responsive)
  const getExamsPerView = () => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 1024) return 3; // lg: 3 columns
      if (window.innerWidth >= 768) return 2;  // md: 2 columns  
      return 1; // sm: 1 column
    }
    return 3; // default
  };
  
  const [examsPerView, setExamsPerView] = useState(getExamsPerView);
  const maxIndex = Math.max(0, featuredExams.length - examsPerView);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => setExamsPerView(getExamsPerView());
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    if (isHovered || featuredExams.length <= examsPerView) return;
    
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
    }, 4000);
    
    return () => clearInterval(interval);
  }, [isHovered, maxIndex, examsPerView, featuredExams.length]);

  const nextSlide = () => {
    setCurrentIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex(prev => (prev <= 0 ? maxIndex : prev - 1));
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} phút`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}p` : `${hours} giờ`;
  };

  return (
    <div className="group">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Service Description */}
        <div className="order-2 lg:order-1">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mr-4">
              {service.icon}
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-foreground">
              {service.title}
            </h3>
          </div>
          
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            {service.description}
          </p>

          <Button 
            onClick={onServiceClick}
            size="lg"
            className="text-lg px-8 py-4 h-auto group/btn"
            data-testid="button-service-exam"
          >
            Xem tất cả đề thi
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover/btn:translate-x-1" />
          </Button>
        </div>

        {/* Service Image */}
        <div 
          className="order-1 lg:order-2 relative rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900"
          style={{
            backgroundImage: service.backgroundImage ? `url(${service.backgroundImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            height: '400px'
          }}
        >
          <div className="absolute inset-0 bg-black/20"></div>
          {allowImageEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImageManager(true)}
              className="absolute top-4 right-4 bg-white/80 hover:bg-white/90 text-gray-700 z-10"
            >
              <Edit className="w-4 h-4 mr-2" />
              Cập nhật ảnh
            </Button>
          )}
          
          <ImageManager
            isOpen={showImageManager}
            onClose={() => setShowImageManager(false)}
            onImageUpdate={onServiceImageUpdate || (() => {})}
            imageType="online-exam"
            altText="Online exam service image"
          />
        </div>
      </div>

      {/* Exams Section */}
      {!isLoading && featuredExams.length > 0 && (
        <div className="mt-16">
          <div className="flex justify-between items-center mb-8">
            <h4 className="text-2xl font-semibold text-foreground">
              Đề thi nổi bật
            </h4>
            
            {featuredExams.length > examsPerView && (
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={prevSlide}
                  className="h-10 w-10"
                  data-testid="button-prev-exam"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={nextSlide}
                  className="h-10 w-10"
                  data-testid="button-next-exam"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div 
            className="relative overflow-hidden"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div 
              ref={scrollContainerRef}
              className="flex transition-transform duration-500 ease-in-out gap-6"
              style={{ 
                transform: `translateX(-${currentIndex * (100 / examsPerView)}%)`,
                width: `${(featuredExams.length / examsPerView) * 100}%`
              }}
            >
              {featuredExams.map((exam) => (
                <div 
                  key={exam.id} 
                  className="flex-shrink-0"
                  style={{ width: `${100 / featuredExams.length}%` }}
                >
                  <Card className="h-full hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <BookOpen className="h-5 w-5 text-primary mr-2" />
                          <Badge className={`${exam.isDemo ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}>
                            {exam.isDemo ? 'Demo' : 'Chính thức'}
                          </Badge>
                        </div>
                      </div>
                      
                      <h5 className="text-lg font-semibold text-foreground mb-3 line-clamp-2">
                        {exam.title}
                      </h5>
                      
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                        {exam.description}
                      </p>

                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                        <div className="flex items-center">
                          <Timer className="h-4 w-4 mr-1" />
                          <span>{formatTime(exam.timeLimit)}</span>
                        </div>
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          <span>{exam.questionCount} câu</span>
                        </div>
                      </div>
                      
                      <Link href={`/exam/${exam.id}`} className="block">
                        <Button 
                          variant="outline" 
                          className="w-full group/exam-btn"
                          data-testid={`button-exam-${exam.id}`}
                        >
                          {exam.isDemo ? 'Thi thử ngay' : 'Bắt đầu thi'}
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/exam-btn:translate-x-1" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination dots */}
          {featuredExams.length > examsPerView && (
            <div className="flex justify-center mt-6 space-x-2">
              {Array.from({ length: maxIndex + 1 }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                  data-testid={`dot-${index}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="mt-16">
          <h4 className="text-2xl font-semibold text-foreground mb-8">
            Đề thi nổi bật
          </h4>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded mb-4"></div>
                  <div className="h-6 bg-muted rounded mb-3"></div>
                  <div className="h-16 bg-muted rounded mb-4"></div>
                  <div className="h-8 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}