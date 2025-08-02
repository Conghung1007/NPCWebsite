import { multiR2Storage } from './multiR2Storage';

async function uploadContactAndInstructorImages() {
  console.log('Starting upload of contact and instructor images...');

  const imagesToUpload = [
    // Contact page hero image
    {
      url: "https://images.unsplash.com/photo-1423666639041-f56000c27a9a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080",
      folder: "ui-images",
      filename: "contact-hero-bg.jpg"
    },
    
    // Instructor avatars
    {
      url: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&h=150&fit=crop&crop=face",
      folder: "ui-images",
      filename: "instructor-yamada-sensei.jpg"
    },
    {
      url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
      folder: "ui-images", 
      filename: "instructor-tanaka-sensei.jpg"
    },
    {
      url: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
      folder: "ui-images",
      filename: "instructor-minh-chau.jpg"
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const image of imagesToUpload) {
    try {
      console.log(`Uploading ${image.filename}...`);
      
      // Fetch image from URL
      const response = await fetch(image.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${image.url}: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      // Upload to R2
      const uploadResult = await multiR2Storage.uploadFile(
        buffer,
        image.filename,
        contentType,
        {
          provider: "primary",
          folder: image.folder,
          allowedTypes: ["image/*"],
          maxSizeBytes: 10 * 1024 * 1024 // 10MB
        }
      );

      console.log(`✓ Uploaded ${image.filename} successfully`);
      console.log(`  URL: ${uploadResult.url}`);
      console.log(`  Size: ${buffer.length} bytes`);
      successCount++;

    } catch (error) {
      console.error(`✗ Failed to upload ${image.filename}:`, error);
      errorCount++;
    }
  }

  console.log(`\n=== Upload Summary ===`);
  console.log(`✓ Successful uploads: ${successCount}`);
  console.log(`✗ Failed uploads: ${errorCount}`);
  console.log(`Total images: ${imagesToUpload.length}`);
}

// Run the upload
uploadContactAndInstructorImages()
  .then(() => {
    console.log('Upload process completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Upload process failed:', error);
    process.exit(1);
  });