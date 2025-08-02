import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

interface UiImage {
  id: string;
  imageType: string;
  imageUrl: string;
  altText?: string;
  description?: string;
}

export function useUiImages() {
  const queryClient = useQueryClient();
  
  const { data: uiImages, isLoading } = useQuery<UiImage[]>({
    queryKey: ['/api/ui-images'],
    retry: false,
  });

  const getImageByType = useCallback((imageType: string, fallbackUrl?: string): string => {
    const image = uiImages?.find(img => img.imageType === imageType);
    return image?.imageUrl || fallbackUrl || '';
  }, [uiImages]);

  const invalidateCache = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/ui-images'] });
  }, [queryClient]);

  return {
    uiImages,
    isLoading,
    getImageByType,
    invalidateCache
  };
}