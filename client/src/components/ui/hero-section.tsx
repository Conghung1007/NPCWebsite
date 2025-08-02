import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

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
}

export function HeroSection({
  title,
  subtitle,
  description,
  primaryAction,
  secondaryAction,
  backgroundImage,
  children
}: HeroSectionProps) {
  return (
    <section className="relative hero-gradient text-white overflow-hidden">
      {backgroundImage && (
        <div className="absolute inset-0">
          <img 
            src={backgroundImage} 
            alt="Hero background" 
            className="w-full h-full object-cover opacity-20" 
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
