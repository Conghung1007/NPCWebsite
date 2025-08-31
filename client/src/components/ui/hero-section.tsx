import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageManager } from "@/components/ui/image-manager";
import { Edit } from "lucide-react";

interface HeroSectionProps {
  title: string;
  subtitle: string;
  description: string;
  primaryAction?: {
    text: string;
    onClick: () => void;
  };
  secondaryAction?: {
    text: string;
    onClick: () => void;
  };
  backgroundImage?: string;
  children?: ReactNode;
  allowImageEdit?: boolean;
  onImageUpdate?: (newImageUrl: string) => void;
}

export function HeroSection({
  title,
  subtitle,
  description,
  primaryAction,
  secondaryAction,
  backgroundImage,
  children,
  allowImageEdit = false,
  onImageUpdate
}: HeroSectionProps) {
  const [currentBgImage, setCurrentBgImage] = useState(backgroundImage);
  const [showImageManager, setShowImageManager] = useState(false);

  const handleImageUpdate = (newImageUrl: string) => {
    setCurrentBgImage(newImageUrl);
    onImageUpdate?.(newImageUrl);
  };
  return (
    <section className="relative hero-gradient text-white overflow-hidden">
      {currentBgImage && (
        <div className="absolute inset-0">
          <img 
            src={currentBgImage} 
            alt="Hero background" 
            className="w-full h-full object-cover opacity-20" 
          />
        </div>
      )}
      
      {allowImageEdit && (
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImageManager(true)}
            className="bg-white/20 text-white hover:bg-white/30 border-white/50 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
          >
            <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Cập nhật ảnh nền</span>
            <span className="sm:hidden">Ảnh</span>
          </Button>
          <ImageManager
            isOpen={showImageManager}
            onClose={() => setShowImageManager(false)}
            onImageUpdate={handleImageUpdate}
            imageType="hero"
            altText="Hero background image"
          />
        </div>
      )}
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24 xl:py-32">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
            {title}
            {subtitle && (
              <>
                <br />
                <span className="text-accent">{subtitle}</span>
              </>
            )}
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-6 sm:mb-8 text-blue-100 max-w-3xl mx-auto px-4">
            {description}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-4">
            {primaryAction && (
              <Button 
                onClick={primaryAction.onClick}
                className="btn-accent text-sm sm:text-base lg:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto"
              >
                {primaryAction.text}
              </Button>
            )}
            {secondaryAction && (
              <Button 
                onClick={secondaryAction.onClick}
                variant="outline"
                className="text-sm sm:text-base lg:text-lg px-6 sm:px-8 py-3 sm:py-4 border-white text-primary bg-white hover:bg-white/90 hover:text-primary font-semibold w-full sm:w-auto"
              >
                {secondaryAction.text}
              </Button>
            )}
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
