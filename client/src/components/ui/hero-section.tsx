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
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImageManager(true)}
            className="bg-white/20 text-white hover:bg-white/30 border-white/50"
          >
            <Edit className="w-4 h-4 mr-2" />
            Cập nhật ảnh nền
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
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            {title}
            {subtitle && (
              <>
                <br />
                <span className="text-accent">{subtitle}</span>
              </>
            )}
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-blue-100 max-w-3xl mx-auto">
            {description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {primaryAction && (
              <Button 
                onClick={primaryAction.onClick}
                className="btn-accent text-lg px-8 py-4"
              >
                {primaryAction.text}
              </Button>
            )}
            {secondaryAction && (
              <Button 
                onClick={secondaryAction.onClick}
                variant="outline"
                className="text-lg px-8 py-4 border-white text-primary bg-white hover:bg-white/90 hover:text-primary font-semibold"
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
