import { db } from './db';
import { uiImages } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Mapping of uploaded R2 images to their purposes
const uploadedImages = [
  {
    purpose: 'hero-banner',
    originalUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=2074&q=80',
    r2Url: 'https://c440756f6e07264a7a4993e109430de2.r2.cloudflarestorage.com/ui-images/hero-banner.jpg',
    filename: 'hero-banner.jpg'
  },
  {
    purpose: 'why-choose-us',
    originalUrl: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2084&q=80',
    r2Url: 'https://c440756f6e07264a7a4993e109430de2.r2.cloudflarestorage.com/ui-images/why-choose-us.jpg',
    filename: 'why-choose-us.jpg'
  },
  {
    purpose: 'visa-services-bg',
    originalUrl: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=400&h=300',
    r2Url: 'https://c440756f6e07264a7a4993e109430de2.r2.cloudflarestorage.com/ui-images/visa-services-bg.jpg',
    filename: 'visa-services-bg.jpg'
  },
  {
    purpose: 'japanese-training-bg',
    originalUrl: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&h=300',
    r2Url: 'https://c440756f6e07264a7a4993e109430de2.r2.cloudflarestorage.com/ui-images/japanese-training-bg.jpg',
    filename: 'japanese-training-bg.jpg'
  },
  {
    purpose: 'flight-tickets-bg',
    originalUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&h=300',
    r2Url: 'https://c440756f6e07264a7a4993e109430de2.r2.cloudflarestorage.com/ui-images/flight-tickets-bg.jpg',
    filename: 'flight-tickets-bg.jpg'
  },
  {
    purpose: 'testimonial-tran-minh-duc',
    originalUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    r2Url: 'https://c440756f6e07264a7a4993e109430de2.r2.cloudflarestorage.com/ui-images/testimonial-tran-minh-duc.jpg',
    filename: 'testimonial-tran-minh-duc.jpg'
  },
  {
    purpose: 'testimonial-le-thi-mai',
    originalUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    r2Url: 'https://c440756f6e07264a7a4993e109430de2.r2.cloudflarestorage.com/ui-images/testimonial-le-thi-mai.jpg',
    filename: 'testimonial-le-thi-mai.jpg'
  },
  {
    purpose: 'study-abroad-students',
    originalUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1000',
    r2Url: 'https://c440756f6e07264a7a4993e109430de2.r2.cloudflarestorage.com/ui-images/study-abroad-students.jpg',
    filename: 'study-abroad-students.jpg'
  },
  {
    purpose: 'visa-consultation',
    originalUrl: 'https://images.unsplash.com/photo-1551836022-8b2858c9c69b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
    r2Url: 'https://c440756f6e07264a7a4993e109430de2.r2.cloudflarestorage.com/ui-images/visa-consultation.jpg',
    filename: 'visa-consultation.jpg'
  },
  {
    purpose: 'japanese-classroom',
    originalUrl: 'https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
    r2Url: 'https://c440756f6e07264a7a4993e109430de2.r2.cloudflarestorage.com/ui-images/japanese-classroom.jpg',
    filename: 'japanese-classroom.jpg'
  },
  {
    purpose: 'flight-booking',
    originalUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600',
    r2Url: 'https://c440756f6e07264a7a4993e109430de2.r2.cloudflarestorage.com/ui-images/flight-booking.jpg',
    filename: 'flight-booking.jpg'
  }
];

export async function insertUploadedUIImages() {
  console.log('Inserting uploaded UI images into database...');
  
  const results = [];
  
  for (const image of uploadedImages) {
    try {
      const existingImages = await db
        .select()
        .from(uiImages)
        .where(eq(uiImages.purpose, image.purpose));
      
      const existingImage = existingImages[0];
      
      if (existingImage) {
        // Update existing image
        const updatedImages = await db
          .update(uiImages)
          .set({
            imageUrl: `/api/proxy-image/primary/ui-images/${image.filename}`,
            filename: image.filename,
            updatedAt: new Date()
          })
          .where(eq(uiImages.purpose, image.purpose))
          .returning();
        
        const updatedImage = updatedImages[0];
        
        console.log(`✓ Updated: ${image.purpose} -> ${updatedImage.imageUrl}`);
        results.push({ ...updatedImage, action: 'updated' });
      } else {
        // Insert new image
        const newImages = await db
          .insert(uiImages)
          .values({
            purpose: image.purpose,
            imageUrl: `/api/proxy-image/primary/ui-images/${image.filename}`,
            filename: image.filename,
            description: `UI image for ${image.purpose.replace('-', ' ')}`
          })
          .returning();
        
        const newImage = newImages[0];
        
        console.log(`✓ Inserted: ${image.purpose} -> ${newImage.imageUrl}`);
        results.push({ ...newImage, action: 'inserted' });
      }
    } catch (error) {
      console.error(`✗ Failed to process ${image.purpose}:`, error);
      results.push({ 
        purpose: image.purpose, 
        error: error.message, 
        action: 'failed' 
      });
    }
  }
  
  console.log('\n=== Insert Summary ===');
  console.log(`Total images processed: ${uploadedImages.length}`);
  console.log(`Successful inserts: ${results.filter(r => r.action === 'inserted').length}`);
  console.log(`Successful updates: ${results.filter(r => r.action === 'updated').length}`);
  console.log(`Failed: ${results.filter(r => r.action === 'failed').length}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  insertUploadedUIImages()
    .then((results) => {
      console.log('\n=== Final Results ===');
      results.forEach(result => {
        if (result.action === 'failed') {
          console.log(`✗ ${result.purpose}: ${result.error}`);
        } else {
          console.log(`✓ ${result.purpose}: ${result.action} - ${result.imageUrl}`);
        }
      });
    })
    .catch((error) => {
      console.error('Insert process failed:', error);
      process.exit(1);
    });
}