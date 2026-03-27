/**
 * Gallery Builder Script
 * 
 * Scans the public/gallery folder and generates:
 * 1. Optimized thumbnails (400px wide) for fast grid loading
 * 2. A JSON manifest of all images
 * 
 * Run with: npm run build:gallery
 * Or: node build-gallery.js
 */

const fs = require('fs');
const path = require('path');

const GALLERY_DIR = path.join(__dirname, 'public', 'gallery');
const THUMBS_DIR = path.join(__dirname, 'public', 'gallery', 'thumbs');
const OUTPUT_FILE = path.join(__dirname, 'public', 'gallery-images.json');

// Thumbnail settings
const THUMB_WIDTH = 400;
const THUMB_QUALITY = 80;

// Browser-compatible image formats
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Function to generate a title from filename
function generateTitle(filename) {
  // Remove extension
  let title = path.basename(filename, path.extname(filename));
  
  // Handle specific naming patterns
  if (title.startsWith('IAC')) {
    return 'IAC PERFORMANCE';
  }
  if (title.includes('Sun Dogs')) {
    return 'SUN DOGS AT BAM';
  }
  if (title.includes('WHAT BELONGS TO YOU')) {
    if (title.includes('DRESS')) {
      return 'WHAT BELONGS TO YOU — DRESS';
    }
    if (title.includes('REHEARSAL')) {
      return 'WHAT BELONGS TO YOU — REHEARSAL';
    }
    return 'WHAT BELONGS TO YOU';
  }
  
  // Default: clean up the filename
  return title
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

// Function to generate alt text from filename
function generateAltText(filename) {
  let alt = path.basename(filename, path.extname(filename));
  
  if (alt.startsWith('IAC')) {
    return 'IAC Performance';
  }
  if (alt.includes('Sun Dogs')) {
    return 'Sun Dogs at BAM';
  }
  if (alt.includes('WHAT BELONGS TO YOU')) {
    if (alt.includes('DRESS')) {
      return 'What Belongs To You - Dress Rehearsal';
    }
    if (alt.includes('REHEARSAL')) {
      return 'What Belongs To You - Rehearsal';
    }
    return 'What Belongs To You';
  }
  
  return alt.replace(/_/g, ' ').replace(/-/g, ' ');
}

// Generate thumbnail for an image
async function generateThumbnail(sharp, inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .resize(THUMB_WIDTH, null, {
        withoutEnlargement: true,
        fit: 'inside'
      })
      .webp({ quality: THUMB_QUALITY })
      .toFile(outputPath);
    return true;
  } catch (error) {
    console.error(`   ⚠️  Failed to generate thumbnail for ${path.basename(inputPath)}: ${error.message}`);
    return false;
  }
}

// Get image dimensions
async function getImageDimensions(sharp, inputPath) {
  try {
    const metadata = await sharp(inputPath).metadata();
    return { width: metadata.width, height: metadata.height };
  } catch (error) {
    console.error(`   ⚠️  Failed to get dimensions for ${path.basename(inputPath)}: ${error.message}`);
    return null;
  }
}

// Main function
async function buildGallery() {
  console.log('🖼️  Gallery Builder - Optimized for Performance\n');
  
  // Try to load sharp
  let sharp;
  try {
    sharp = require('sharp');
    console.log('✅ Sharp image processor loaded');
  } catch (error) {
    console.log('⚠️  Sharp not installed. Run: npm install');
    console.log('   Generating manifest without thumbnails...\n');
  }
  
  // Check if gallery directory exists
  if (!fs.existsSync(GALLERY_DIR)) {
    console.error('❌ Gallery directory not found:', GALLERY_DIR);
    process.exit(1);
  }
  
  // Create thumbs directory if it doesn't exist
  if (sharp && !fs.existsSync(THUMBS_DIR)) {
    fs.mkdirSync(THUMBS_DIR, { recursive: true });
    console.log('📁 Created thumbnails directory');
  }
  
  // Read all files in the gallery directory (excluding thumbs folder)
  const files = fs.readdirSync(GALLERY_DIR).filter(file => {
    const fullPath = path.join(GALLERY_DIR, file);
    return !fs.statSync(fullPath).isDirectory();
  });
  
  // Filter for supported image formats
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
  });
  
  console.log(`📷 Found ${imageFiles.length} compatible images\n`);
  
  // Group files by base name to prefer webp over jpg
  const imageMap = new Map();
  
  imageFiles.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, ext);
    
    // If we don't have this image yet, or if this is a webp (preferred), use it
    if (!imageMap.has(baseName) || ext === '.webp') {
      imageMap.set(baseName, file);
    }
  });
  
  const uniqueImages = Array.from(imageMap.values());
  console.log(`🔄 Processing ${uniqueImages.length} unique images...\n`);
  
  // Generate thumbnails and build image list
  const images = [];
  let thumbsGenerated = 0;
  let thumbsSkipped = 0;
  
  for (const filename of uniqueImages) {
    const inputPath = path.join(GALLERY_DIR, filename);
    const thumbFilename = path.basename(filename, path.extname(filename)) + '.webp';
    const thumbPath = path.join(THUMBS_DIR, thumbFilename);
    
    // Generate thumbnail if sharp is available
    if (sharp) {
      // Check if thumbnail already exists and is newer than source
      let needsRegen = true;
      if (fs.existsSync(thumbPath)) {
        const srcStat = fs.statSync(inputPath);
        const thumbStat = fs.statSync(thumbPath);
        if (thumbStat.mtime > srcStat.mtime) {
          needsRegen = false;
          thumbsSkipped++;
        }
      }
      
      if (needsRegen) {
        const success = await generateThumbnail(sharp, inputPath, thumbPath);
        if (success) {
          thumbsGenerated++;
          process.stdout.write(`   ✓ ${filename}\n`);
        }
      }
    }
    
    // Get image dimensions to prevent layout shift
    let dimensions = null;
    if (sharp) {
      dimensions = await getImageDimensions(sharp, inputPath);
    }
    
    const imageEntry = {
      src: `public/gallery/${filename}`,
      thumb: sharp ? `public/gallery/thumbs/${thumbFilename}` : `public/gallery/${filename}`,
      title: generateTitle(filename),
      alt: generateAltText(filename)
    };
    
    // Add dimensions if available
    if (dimensions) {
      imageEntry.width = dimensions.width;
      imageEntry.height = dimensions.height;
    }
    
    images.push(imageEntry);
  }
  
  // Sort alphabetically by filename for consistency
  images.sort((a, b) => a.src.localeCompare(b.src));
  
  // Write JSON file
  const output = {
    generated: new Date().toISOString(),
    count: images.length,
    hasThumbnails: !!sharp,
    images: images
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ Gallery build complete!`);
  console.log(`   📄 Manifest: ${OUTPUT_FILE}`);
  console.log(`   🖼️  Images: ${images.length}`);
  if (sharp) {
    console.log(`   🔧 Thumbnails generated: ${thumbsGenerated}`);
    console.log(`   ⏭️  Thumbnails skipped (up to date): ${thumbsSkipped}`);
  }
}

// Run
buildGallery().catch(console.error);
