import { multiR2Storage, type MediaUploadConfig } from "./multiR2Storage";

export async function uploadSingleUIImage(name: string, url: string, provider: string = "primary"): Promise<{ success: boolean; finalUrl?: string; error?: string }> {
  try {
    console.log(`Downloading ${name} from ${url}...`);
    
    // Download image
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    
    // Get upload URL from multiR2Storage  
    const uploadConfig: MediaUploadConfig = {
      provider: provider as "primary" | "secondary",
      folder: "ui-images",
      allowedTypes: ["image/*"],
      maxSizeBytes: 10 * 1024 * 1024
    };
    
    const uploadResult = await multiR2Storage.getUploadUrl(uploadConfig);
    
    if (!uploadResult.success || !uploadResult.url) {
      return { success: false, error: uploadResult.error || "Failed to get upload URL" };
    }
    
    console.log(`Uploading ${name} to R2...`);
    
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
    
    console.log(`✓ Successfully uploaded ${name} to ${finalUrl}`);
    return { success: true, finalUrl };
    
  } catch (error) {
    console.error(`Error uploading ${name}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}