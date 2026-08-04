import { db } from './db';
import { uiImages } from '../shared/schema';

async function updateUploadedImageRecords() {
  console.log('Creating UI image records for uploaded images...');

  const imageRecords = [
    {
      imageType: 'contact-hero',
      imageUrl: '/api/proxy-image/primary/ui-images/contact-hero-bg.jpg',
      description: 'Contact page hero background image'
    },
    {
      imageType: 'instructor-1',
      imageUrl: '/api/proxy-image/primary/ui-images/instructor-yamada-sensei.jpg',
      description: 'Yamada Sensei avatar'
    },
    {
      imageType: 'instructor-2', 
      imageUrl: '/api/proxy-image/primary/ui-images/instructor-tanaka-sensei.jpg',
      description: 'Tanaka Sensei avatar'
    },
    {
      imageType: 'instructor-3',
      imageUrl: '/api/proxy-image/primary/ui-images/instructor-minh-chau.jpg',
      description: 'Minh Châu avatar'
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const record of imageRecords) {
    try {
      // Check if record already exists
      const existing = await db.select().from(uiImages).where(
        eq(uiImages.imageType, record.imageType)
      );

      if (existing.length > 0) {
        // Update existing record
        await db.update(uiImages)
          .set({
            imageUrl: record.imageUrl,
            description: record.description,
            updatedAt: new Date()
          })
          .where(eq(uiImages.imageType, record.imageType));
        
        console.log(`✓ Updated existing record: ${record.imageType}`);
      } else {
        // Create new record
        await db.insert(uiImages).values({
          imageType: record.imageType,
          imageUrl: record.imageUrl,
          description: record.description
        });
        
        console.log(`✓ Created new record: ${record.imageType}`);
      }
      
      successCount++;
    } catch (error) {
      console.error(`✗ Failed to update ${record.imageType}:`, error);
      errorCount++;
    }
  }

  console.log(`\n=== Database Update Summary ===`);
  console.log(`✓ Successful updates: ${successCount}`);
  console.log(`✗ Failed updates: ${errorCount}`);
  console.log(`Total records: ${imageRecords.length}`);
}

// Add missing import
import { eq } from 'drizzle-orm';

// Run the update
updateUploadedImageRecords()
  .then(() => {
    console.log('Database update completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Database update failed:', error);
    process.exit(1);
  });