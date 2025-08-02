import { storage } from "./storage";
import { multiR2Storage } from "./multiR2Storage";
import { ObjectStorageService } from "./objectStorage";
import fs from "fs";
import path from "path";

// Sample images for articles (you can replace these with actual image URLs or files)
const sampleImages = {
  "visa-services": [
    "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1555399784-17946f01cc1b?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1502780402662-acc01917183e?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1521791136064-6986246ac8d0?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=600&fit=crop"
  ],
  "study-abroad": [
    "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=600&fit=crop"
  ],
  "japanese-training": [
    "https://images.unsplash.com/photo-1528164344705-47542687000d?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1480796927426-f609979314bd?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop"
  ],
  "flight-tickets": [
    "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1583929036134-66d2e43ac0f5?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=600&fit=crop"
  ]
};

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadImageToR2(imageBuffer: Buffer, fileName: string, provider: "replit" | "primary" | "secondary" = "replit"): Promise<string | null> {
  try {
    console.log(`Attempting to upload to provider: ${provider}`);
    
    // Get upload URL
    const result = await multiR2Storage.getUploadUrl({
      provider,
      folder: "article-images",
      allowedTypes: ["image/*"],
      maxSizeBytes: 10 * 1024 * 1024 // 10MB
    });

    console.log("Upload URL result:", result);

    if (!result.success || !result.url) {
      console.error("Failed to get upload URL:", result.error);
      return null;
    }

    // Upload image using presigned URL
    const uploadResponse = await fetch(result.url, {
      method: "PUT",
      body: imageBuffer,
      headers: {
        "Content-Type": "image/jpeg",
      },
    });

    console.log("Upload response status:", uploadResponse.status);

    if (!uploadResponse.ok) {
      console.error("Failed to upload image:", uploadResponse.statusText);
      return null;
    }

    // For Replit storage, finalize the upload
    if (provider === "replit") {
      try {
        const objectStorageService = new ObjectStorageService();
        const finalPath = await objectStorageService.trySetObjectEntityAclPolicy(
          result.url,
          {
            owner: "system",
            visibility: "public",
          }
        );
        console.log("Finalized path:", finalPath);
        return finalPath;
      } catch (error) {
        console.error("Failed to finalize upload:", error);
        return result.path || null;
      }
    }

    // For R2 storage, construct the public URL using the original fileName
    const publicUrl = `/public-objects/article-images/${fileName}`;
    console.log("R2 public URL:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("Error uploading image:", error);
    return null;
  }
}

async function uploadExistingArticleImages(provider: "replit" | "primary" | "secondary" = "replit") {
  try {
    console.log(`Starting upload of article images to ${provider}...`);
    
    // Get all articles
    const articles = await storage.getAllArticles();
    const articlesWithoutImages = articles.filter((article: any) => !article.imageUrl);
    
    console.log(`Found ${articlesWithoutImages.length} articles without images`);
    
    let uploadCount = 0;
    
    for (const article of articlesWithoutImages) {
      const categoryImages = sampleImages[article.category as keyof typeof sampleImages];
      if (!categoryImages || categoryImages.length === 0) {
        console.log(`No sample images for category: ${article.category}`);
        continue;
      }
      
      // Pick a random image from the category
      const randomImageUrl = categoryImages[Math.floor(Math.random() * categoryImages.length)];
      
      try {
        console.log(`Downloading image for article: ${article.title}`);
        const imageBuffer = await downloadImage(randomImageUrl);
        
        const fileName = `${article.id}.jpg`;
        console.log(`Uploading image for article: ${article.title}`);
        const uploadedPath = await uploadImageToR2(imageBuffer, fileName, provider);
        
        if (uploadedPath) {
          // Update article with new image URL
          await storage.updateArticle({
            ...article,
            imageUrl: uploadedPath
          });
          
          console.log(`✓ Uploaded image for: ${article.title}`);
          uploadCount++;
        } else {
          console.log(`✗ Failed to upload image for: ${article.title}`);
        }
        
        // Add small delay to avoid overwhelming the services
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error processing article ${article.title}:`, error);
      }
    }
    
    console.log(`\nCompleted! Uploaded ${uploadCount} images to ${provider}`);
    return uploadCount;
    
  } catch (error) {
    console.error("Error in uploadExistingArticleImages:", error);
    throw error;
  }
}

// Export for use in API endpoints
export { uploadExistingArticleImages };