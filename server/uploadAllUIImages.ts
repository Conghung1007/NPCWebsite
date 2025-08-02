import { MultiR2StorageService } from './multiR2Storage';

// All UI images that need to be uploaded to R2
const uiImages = [
  // Hero Section background
  {
    url: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=2074&q=80",
    filename: "hero-banner.jpg",
    type: "hero-banner"
  },
  
  // Why Choose N&P section
  {
    url: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2084&q=80",
    filename: "why-choose-us.jpg", 
    type: "why-choose-us"
  },
  
  // Service background images
  {
    url: "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=400&h=300",
    filename: "visa-services-bg.jpg",
    type: "visa-services-bg"
  },
  {
    url: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=300", 
    filename: "study-abroad-bg.jpg",
    type: "study-abroad-bg"
  },
  {
    url: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&h=300",
    filename: "japanese-training-bg.jpg",
    type: "japanese-training-bg"
  },
  {
    url: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&h=300",
    filename: "flight-tickets-bg.jpg", 
    type: "flight-tickets-bg"
  },
  
  // Testimonial avatars
  {
    url: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face",
    filename: "testimonial-nguyen-thu-ha.jpg",
    type: "testimonial-avatar"
  },
  {
    url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    filename: "testimonial-tran-minh-duc.jpg", 
    type: "testimonial-avatar"
  },
  {
    url: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
    filename: "testimonial-le-thi-mai.jpg",
    type: "testimonial-avatar"
  },
  
  // Other page images
  {
    url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1000",
    filename: "study-abroad-students.jpg",
    type: "page-image"
  },
  {
    url: "https://images.unsplash.com/photo-1551836022-8b2858c9c69b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
    filename: "visa-consultation.jpg", 
    type: "page-image"
  },
  {
    url: "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
    filename: "japanese-classroom.jpg",
    type: "page-image"
  },
  {
    url: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
    filename: "flight-booking.jpg",
    type: "page-image"
  }
];

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function uploadAllUIImages() {
  const storage = new MultiR2StorageService();
  const results = [];

  console.log(`Starting upload of ${uiImages.length} UI images...`);

  for (const image of uiImages) {
    try {
      console.log(`Downloading and uploading: ${image.filename}`);
      
      // Download image from Unsplash
      const imageBuffer = await downloadImage(image.url);
      
      // Upload to R2
      const uploadResult = await storage.uploadFile(
        imageBuffer,
        image.filename,
        'image/jpeg',
        {
          provider: 'primary',
          folder: 'ui-images',
          allowedTypes: ['image/*'],
          maxSizeBytes: 50 * 1024 * 1024
        }
      );
      
      results.push({
        original: image.url,
        filename: image.filename,
        type: image.type,
        uploaded: uploadResult.url,
        success: true
      });
      
      console.log(`✓ Uploaded: ${image.filename} -> ${uploadResult.url}`);
      
    } catch (error) {
      console.error(`✗ Failed to upload ${image.filename}:`, error);
      results.push({
        original: image.url,
        filename: image.filename, 
        type: image.type,
        uploaded: null,
        success: false,
        error: error.message
      });
    }
  }

  console.log('\n=== Upload Summary ===');
  console.log(`Total images: ${uiImages.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  uploadAllUIImages()
    .then((results) => {
      console.log('\n=== Final Results ===');
      results.forEach(result => {
        if (result.success) {
          console.log(`✓ ${result.filename}: ${result.uploaded}`);
        } else {
          console.log(`✗ ${result.filename}: ${result.error}`);
        }
      });
    })
    .catch((error) => {
      console.error('Upload process failed:', error);
      process.exit(1);
    });
}