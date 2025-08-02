import { uploadSingleUIImage } from "./uploadSingleUI";

export async function uploadServiceImages(): Promise<{
  success: boolean;
  results: Array<{ name: string; success: boolean; finalUrl?: string; error?: string }>;
  successCount: number;
}> {
  console.log("Starting service images upload...");
  
  const serviceImages = [
    {
      name: "visa-service.jpg",
      url: "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=400&h=300"
    },
    {
      name: "study-abroad.jpg", 
      url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&h=300"
    },
    {
      name: "japanese-training.jpg",
      url: "https://images.unsplash.com/photo-1528164344705-47542687000d?w=400&h=300"
    },
    {
      name: "flight-tickets.jpg",
      url: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&h=300"
    }
  ];
  
  const results = [];
  let successCount = 0;
  
  for (const image of serviceImages) {
    try {
      console.log(`Uploading ${image.name}...`);
      const result = await uploadSingleUIImage(image.name, image.url);
      
      results.push({
        name: image.name,
        success: result.success,
        finalUrl: result.finalUrl,
        error: result.error
      });
      
      if (result.success) {
        successCount++;
      }
      
      // Small delay between uploads
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error uploading ${image.name}:`, error);
      results.push({
        name: image.name,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
  
  console.log(`Service images upload completed: ${successCount}/${serviceImages.length} successful`);
  
  return {
    success: successCount > 0,
    results,
    successCount
  };
}