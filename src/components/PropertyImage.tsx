import { useState } from "react";
import { Building2 } from "lucide-react";

interface PropertyImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

export function PropertyImage({ 
  src, 
  alt, 
  className = "", 
  fallbackClassName = "" 
}: PropertyImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // If no src or image failed to load, show fallback
  if (!src || imageError) {
    return (
      <div 
        className={`flex items-center justify-center bg-muted ${fallbackClassName || className}`}
        role="img"
        aria-label={alt}
      >
        <Building2 className="h-12 w-12 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className={`absolute inset-0 flex items-center justify-center bg-muted ${className}`}>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={className}
        onError={() => {
          setImageError(true);
          setIsLoading(false);
        }}
        onLoad={() => setIsLoading(false)}
        loading="lazy"
      />
    </div>
  );
}

// Made with Bob
