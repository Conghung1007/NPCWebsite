import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditableText } from "@/components/ui/editable-text";
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
  
  // Text editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // Editable text handler functions
  const handleEditStart = (fieldName: string, currentValue: string) => {
    setEditingField(fieldName);
    setEditValues({ ...editValues, [fieldName]: currentValue });
  };

  const handleEditSave = (fieldName: string, value: string) => {
    console.log(`Saving field ${fieldName} with value:`, value);
    setEditValues({ ...editValues, [fieldName]: value });
    setEditingField(null);
  };

  const handleEditCancel = () => {
    setEditingField(null);
    setEditValues({});
  };



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
    }, 3000);
    
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
    <div className="flex flex-col lg:flex-row items-start gap-8">
      {/* Service Info */}
      <div className="flex-1 lg:max-w-md">
        <div className="relative bg-white rounded-xl p-8 shadow-lg h-[400px] flex flex-col justify-between overflow-hidden">
          {/* Background Image */}
          {service.backgroundImage && (
            <div className="absolute inset-0 opacity-5">
              <img 
                src={service.backgroundImage} 
                alt={`${service.title} background`}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Image Manager Button */}
          {allowImageEdit && (
            <div className="absolute top-4 right-4 z-10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImageManager(true)}
                className="bg-white/80 hover:bg-white/90 text-gray-700"
              >
                <Edit className="w-4 h-4 mr-2" />
                Cập nhật ảnh
              </Button>
              <ImageManager
                isOpen={showImageManager}
                onClose={() => setShowImageManager(false)}
                onImageUpdate={(newImageUrl) => onServiceImageUpdate?.(newImageUrl)}
                imageType="online-exam"
                altText={`${service.title} background image`}
              />
            </div>
          )}

          <div className="relative z-10">
            <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
              {service.icon}
            </div>
            <h3 className="text-3xl font-bold text-foreground mb-4">
              <EditableText 
                fieldName="online-exam-title"
                text={service.title}
                className="text-3xl font-bold text-foreground"
                showEditButton={true}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </h3>
            <div className="text-lg text-muted-foreground mb-6">
              <EditableText 
                fieldName="online-exam-description"
                text={service.description}
                className="text-lg text-muted-foreground"
                multiline={true}
                showEditButton={true}
                editingField={editingField}
                editValues={editValues}
                onEditStart={handleEditStart}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
              />
            </div>
          </div>
          <Button onClick={onServiceClick} className="relative z-10 w-full mt-auto">
            Xem tất cả đề thi
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Related Exams */}
      <div className="flex-1">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-full">
                <div className="w-full h-[400px] bg-white border border-gray-200 rounded-lg shadow-sm animate-pulse">
                  <div className="h-32 bg-gray-200 rounded-t-lg"></div>
                  <div className="p-5">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : featuredExams.length > 0 ? (
          <div
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Navigation buttons - only show if more than 3 exams */}
            {featuredExams.length > 3 && (
              <>
                <button
                  onClick={prevSlide}
                  disabled={currentIndex === 0}
                  className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <button
                  onClick={nextSlide}
                  disabled={currentIndex >= featuredExams.length - 3}
                  className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </>
            )}

            {/* Grid layout with sliding window */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredExams.slice(currentIndex, currentIndex + 3).map((exam) => (
                <div key={exam.id} className="w-full h-full flex">
                  <Link href={`/exam/${exam.id}`} className="w-full h-full">
                    <div className="w-full h-[400px] bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer flex flex-col">
                      {/* Exam header */}
                      <div className="h-32 bg-gradient-to-br from-blue-100 to-blue-200 rounded-t-lg flex items-center justify-center flex-shrink-0 relative">
                        <div className="text-center">
                          <BookOpen className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                          <Badge className={`${exam.isDemo ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                            {exam.isDemo ? 'Đề demo' : 'Chính thức'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="p-5 flex flex-col flex-grow min-h-0">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3 line-clamp-2">
                          {exam.title}
                        </h3>
                        
                        <p className="text-gray-600 text-sm mb-4 line-clamp-4 flex-grow">
                          {exam.description}
                        </p>

                        <div className="mb-3 space-y-1">
                          <div className="flex items-center text-gray-500 text-xs">
                            <Timer className="w-3 h-3 mr-1" />
                            <span>{formatTime(exam.timeLimit)}</span>
                          </div>
                          <div className="flex items-center text-gray-500 text-xs">
                            <Users className="w-3 h-3 mr-1" />
                            <span>{exam.questionCount} câu</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center text-gray-500 text-xs">
                            <Clock className="w-4 h-4 mr-1" />
                            {new Date(exam.createdAt.toString()).toLocaleDateString("vi-VN")}
                          </div>
                          
                          <span className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                            {exam.isDemo ? 'Thi thử →' : 'Bắt đầu →'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>

            {/* Dots indicator - only show if more than 3 exams */}
            {featuredExams.length > 3 && (
              <div className="flex justify-center space-x-2 mt-6">
                {Array.from({ length: Math.max(1, featuredExams.length - 2) }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                      index === currentIndex ? 'bg-primary' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            )}
            
            {/* View more exams link */}
            <div className="pt-6 text-center">
              <Link href={service.route}>
                <button className="inline-flex items-center text-primary font-medium hover:text-primary/80 transition-colors">
                  <span>Xem thêm đề thi trực tuyến</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Chưa có đề thi nào</p>
          </div>
        )}
      </div>
    </div>
  );
}