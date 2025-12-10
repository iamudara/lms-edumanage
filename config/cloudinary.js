import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Generate a signed URL for authenticated Cloudinary resources
 * This prevents unauthorized access to files even if someone has the public URL
 * 
 * @param {string} url - The original Cloudinary URL stored in database
 * @param {object} options - Options for URL generation
 * @param {number} options.expiresIn - Expiration time in seconds (default: 86400 = 24 hours)
 * @param {string} options.type - File type: 'material', 'assignment', 'submission'
 * @returns {string} - Signed URL with expiration
 */
export function generateSignedUrl(url, options = {}) {
  if (!url) return null;
  
  // If it's an external URL (not Cloudinary), return as-is
  if (!url.includes('cloudinary.com')) {
    return url;
  }
  
  // If URL is already authenticated (signed by multer-storage-cloudinary), return as-is
  // These URLs already have expiration built-in from Cloudinary
  if (url.includes('/authenticated/')) {
    return url;
  }
  
  // Only sign URLs that are public (older uploads before security implementation)
  if (!url.includes('/upload/')) {
    return url; // Not a standard upload URL, return as-is
  }
  
  // Default expiration times based on resource type
  const expirationTimes = {
    material: 21600,      // 6 hours for course materials
    assignment: 10800,    // 3 hours for assignment materials  
    submission: 1800      // 30 minutes for student submissions (most sensitive)
  };
  
  const expiresIn = options.expiresIn || expirationTimes[options.type] || 86400;
  
  // Calculate expiration timestamp
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  
  try {
    // Extract the public_id from the URL
    // URL format: https://res.cloudinary.com/{cloud_name}/raw/upload/v{version}/{folder}/{filename}
    
    const urlParts = url.split('/');
    const uploadIndex = urlParts.findIndex(part => part === 'upload');
    
    if (uploadIndex === -1) {
      return url; // Return original if not a standard Cloudinary URL
    }
    
    // Get everything after 'upload/' as public_id
    // Skip the version number (v1234567890)
    const afterUpload = urlParts.slice(uploadIndex + 1);
    
    // Remove version number if present (starts with 'v' followed by digits)
    const filteredParts = afterUpload.filter((part, index) => {
      if (index === 0 && /^v\d+$/.test(part)) {
        return false; // Skip version number
      }
      return true;
    });
    
    const publicId = filteredParts.join('/');
    
    // Determine resource type based on file extension or URL content
    let resourceType = 'image'; // Default

    // List of extensions that are always 'raw' resource type in Cloudinary
    const rawExtensions = [
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 
      'zip', 'rar', 'txt', 'csv'
    ];

    // Check for extension in the URL
    // URL typically ends with the filename.ext
    const extensionMatch = url.match(/\.([a-z0-9]+)$/i);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : '';

    if (extension && rawExtensions.includes(extension)) {
      resourceType = 'raw';
    } else if (url.includes('/raw/')) {
      resourceType = 'raw';
    } else if (url.includes('/video/')) {
      resourceType = 'video';
    }
    
    // Generate signed URL with expiration
    const signedUrl = cloudinary.url(publicId, {
      type: 'authenticated',
      resource_type: resourceType,
      sign_url: true,
      expires_at: expiresAt
    });
    
    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return url; // Return original URL if signing fails
  }
}

/**
 * Helper function to batch sign multiple URLs
 * @param {Array<{url: string, type: string}>} items - Array of items with URLs to sign
 * @param {string} urlField - The field name containing the URL (e.g., 'file_url', 'url')
 * @param {string} type - Resource type for expiration
 * @returns {Array} - Items with signed URLs
 */
export function signUrlsInArray(items, urlField = 'file_url', type = 'material') {
  if (!items || !Array.isArray(items)) return items;
  
  return items.map(item => {
    if (item && item[urlField]) {
      return {
        ...item.dataValues ? item.dataValues : item,
        [urlField]: generateSignedUrl(item[urlField] || item.dataValues?.[urlField], { type })
      };
    }
    return item.dataValues ? item.dataValues : item;
  });
}

/**
 * Sign URLs in a Sequelize model instance (handles dataValues)
 * @param {object} instance - Sequelize model instance or plain object
 * @param {string} urlField - The field name containing the URL
 * @param {string} type - Resource type for expiration
 * @returns {object} - Instance with signed URL
 */
export function signModelUrl(instance, urlField = 'file_url', type = 'material') {
  if (!instance) return instance;
  
  // Handle plain objects
  if (instance[urlField]) {
    instance[urlField] = generateSignedUrl(instance[urlField], { type });
  }
  
  // Handle Sequelize instances with dataValues
  if (instance.dataValues && instance.dataValues[urlField]) {
    instance.dataValues[urlField] = generateSignedUrl(instance.dataValues[urlField], { type });
  }
  
  return instance;
}

/**
 * Delete a file from Cloudinary
 * Handles both authenticated and public URLs
 * 
 * @param {string} url - The Cloudinary URL of the file to delete
 * @returns {Promise<object>} - Cloudinary deletion result
 */
export async function deleteCloudinaryFile(url) {
  if (!url || !url.includes('cloudinary.com')) {
    return { result: 'not_cloudinary' };
  }
  
  try {
    const urlParts = url.split('/');
    
    // Check if it's an authenticated URL or public upload URL
    const isAuthenticated = url.includes('/authenticated/');
    const deliveryType = isAuthenticated ? 'authenticated' : 'upload';
    
    // Find the index of 'authenticated' or 'upload' in the URL
    const typeIndex = urlParts.findIndex(part => part === 'authenticated' || part === 'upload');
    
    if (typeIndex === -1) {
      console.error('Could not find delivery type in URL:', url);
      return { result: 'invalid_url' };
    }
    
    // Determine resource type from URL (raw, image, video)
    let resourceType = 'raw';
    if (url.includes('/image/')) {
      resourceType = 'image';
    } else if (url.includes('/video/')) {
      resourceType = 'video';
    }
    
    // Get everything after the delivery type
    let pathAfterType = urlParts.slice(typeIndex + 1);
    
    // For authenticated URLs, there might be a signature segment (s--xxx--)
    // Skip signature segments that start with 's--'
    pathAfterType = pathAfterType.filter(part => !part.startsWith('s--'));
    
    // Skip version number if present (starts with 'v' followed by digits)
    if (pathAfterType.length > 0 && /^v\d+$/.test(pathAfterType[0])) {
      pathAfterType = pathAfterType.slice(1);
    }
    
    // Join to get the public_id (with folder path and filename)
    const fullPath = pathAfterType.join('/');
    
    // For raw files, use full path WITH extension
    // For images, use path WITHOUT extension
    let publicId = fullPath;
    if (resourceType === 'image') {
      publicId = fullPath.replace(/\.[^.]+$/, '');
    }
    
    console.log(`Deleting from Cloudinary: publicId=${publicId}, resourceType=${resourceType}, type=${deliveryType}`);
    
    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: deliveryType,
      invalidate: true
    });
    
    console.log('Cloudinary delete result:', result);
    return result;
    
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
}

export default cloudinary;
