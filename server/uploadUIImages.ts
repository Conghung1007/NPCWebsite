import { multiR2Storage, type MediaUploadConfig } from "./multiR2Storage";

// UI Images to download and upload to R2
const UI_IMAGES = [
  {
    name: "hero-background.jpg",
    url: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080",
    type: "hero"
  },
  {
    name: "why-choose-us.jpg", 
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
    type: "feature"
  },
  {
    name: "visa-service.jpg",
    url: "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=400&h=300",
    type: "service"
  },
  {
    name: "study-abroad.jpg", 
    url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&h=300",
    type: "service"
  },
  {
    name: "japanese-training.jpg",
    url: "https://images.unsplash.com/photo-1528164344705-47542687000d?w=400&h=300", 
    type: "service"
  },
  {
    name: "flight-tickets.jpg",
    url: "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=400&h=300",
    type: "service"
  }
];

async function downloadImageBuffer(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadUIImageToR2(
  imageData: { name: string; url: string; type: string },
  provider: string = "primary"
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    console.log(`Downloading ${imageData.name} from ${imageData.url}...`);
    const imageBuffer = await downloadImageBuffer(imageData.url);
    
    // Get upload URL from multiR2Storage
    const uploadConfig: MediaUploadConfig = {
      provider: provider as "replit" | "primary" | "secondary",
      folder: "ui-images",
      allowedTypes: ["image/*"],
      maxSizeBytes: 10 * 1024 * 1024
    };
    
    const uploadResult = await multiR2Storage.getUploadUrl(uploadConfig);
    
    if (!uploadResult.success || !uploadResult.url) {
      return { success: false, error: uploadResult.error || "Failed to get upload URL" };
    }
    
    console.log(`Uploading ${imageData.name} to R2...`);
    
    // Upload the image buffer to R2
    const uploadResponse = await fetch(uploadResult.url, {
      method: 'PUT',
      body: imageBuffer,
      headers: {
        'Content-Type': 'image/jpeg'
      }
    });
    
    if (!uploadResponse.ok) {
      return { success: false, error: `Upload failed: ${uploadResponse.statusText}` };
    }
    
    // Get the final URL (remove query parameters)
    const finalUrl = uploadResult.url.split('?')[0];
    
    console.log(`✓ Successfully uploaded ${imageData.name} to ${finalUrl}`);
    return { success: true, url: finalUrl };
    
  } catch (error) {
    console.error(`Error uploading ${imageData.name}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

export async function uploadAllUIImages(provider: string = "primary"): Promise<{
  success: boolean;
  results: Array<{ name: string; success: boolean; url?: string; error?: string }>;
  successCount: number;
}> {
  console.log(`\n🚀 Starting UI images upload to ${provider} R2 storage...\n`);
  
  const results = [];
  let successCount = 0;
  
  for (const imageData of UI_IMAGES) {
    const result = await uploadUIImageToR2(imageData, provider);
    
    results.push({
      name: imageData.name,
      success: result.success,
      url: result.url,
      error: result.error
    });
    
    if (result.success) {
      successCount++;
    }
    
    // Small delay between uploads
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n📊 Upload Summary:`);
  console.log(`✓ Successful: ${successCount}`);
  console.log(`✗ Failed: ${UI_IMAGES.length - successCount}`);
  console.log(`📁 Uploaded to: ui-images/ folder on ${provider} R2\n`);
  
  return {
    success: successCount > 0,
    results,
    successCount
  };
}

// Export for use in API routes
export { uploadAllUIImages };