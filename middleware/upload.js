/**
 * Upload Middleware using Multer + Cloudinary Storage
 * Handles file uploads for materials and assignment submissions
 */

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

/**
 * Cloudinary Storage Configuration for Materials (PDFs, Documents, Presentations)
 * Used by teachers to upload course materials
 */
const materialStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'lms-uploads/materials',
    allowed_formats: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt'],
    resource_type: 'auto',
    transformation: [{ quality: 'auto' }]
  }
});

/**
 * Cloudinary Storage Configuration for Assignment Submissions
 * Used by students to submit assignment files
 */
const submissionStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'lms-uploads/submissions',
    allowed_formats: ['pdf', 'doc', 'docx', 'txt', 'zip'],
    resource_type: 'auto',
    transformation: [{ quality: 'auto' }]
  }
});

/**
 * File Filter Function
 * Validates file types before upload
 */
const fileFilter = (allowedTypes) => {
  return (req, file, cb) => {
    const allowedMimeTypes = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      zip: 'application/zip'
    };

    const isAllowed = allowedTypes.some(type => file.mimetype === allowedMimeTypes[type]);

    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
    }
  };
};

/**
 * Upload Middleware for Course Materials
 * Max file size: 10MB
 * Allowed formats: PDF, DOC, DOCX, PPT, PPTX
 */
const uploadMaterial = multer({
  storage: materialStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: fileFilter(['pdf', 'doc', 'docx', 'ppt', 'pptx'])
}).single('material'); // Field name: 'material'

/**
 * Upload Middleware for Assignment Submissions
 * Max file size: 10MB
 * Allowed formats: PDF, DOC, DOCX, TXT, ZIP
 */
const uploadSubmission = multer({
  storage: submissionStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: fileFilter(['pdf', 'doc', 'docx', 'txt', 'zip'])
}).single('submission'); // Field name: 'submission'

/**
 * Wrapper function to handle Multer errors
 * Catches specific Multer errors (file size, file type) and unknown errors
 */
const handleUpload = (uploadMiddleware) => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // Multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size exceeds 10MB limit'
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      } else if (err) {
        // Custom file filter errors or other errors
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      // No error, proceed
      next();
    });
  };
};

/**
 * Export upload middleware with error handling
 */
module.exports = {
  uploadMaterial: handleUpload(uploadMaterial),
  uploadSubmission: handleUpload(uploadSubmission)
};
