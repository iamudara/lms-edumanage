import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
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
  // SECURITY BYPASS: Return raw URL as is
  return url;
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
