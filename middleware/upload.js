/**
 * Upload Middleware using Multer + Cloudinary Storage
 * Handles file uploads for materials and assignment submissions
 */

import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

/**
 * Cloudinary Storage Configuration for Materials (PDFs, Documents, Presentations)
 * Used by teachers to upload course materials
 */
const materialStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Generate unique filename
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    
    return {
      folder: 'lms-uploads/materials',
      resource_type: 'auto',
      public_id: uniqueName,
      use_filename: false,
      access_mode: 'public'
    };
  }
});

/**
 * Cloudinary Storage Configuration for Assignment Materials
 * Used by teachers to upload assignment reference materials
 */
const assignmentMaterialStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Generate unique filename
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    
    return {
      folder: 'lms-uploads/assignments',
      resource_type: 'auto',
      public_id: uniqueName,
      use_filename: false,
      access_mode: 'public'
    };
  }
});

/**
 * Cloudinary Storage Configuration for Assignment Submissions
 * Used by students to submit assignment files
 */
const submissionStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Generate unique filename
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    
    return {
      folder: 'lms-uploads/submissions',
      resource_type: 'auto',
      public_id: uniqueName,
      use_filename: false,
      access_mode: 'public'
    };
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
 * Upload Middleware for Assignment Materials (multiple files)
 * Max file size: 10MB per file
 * Allowed formats: PDF, DOC, DOCX, PPT, PPTX, TXT, ZIP
 */
const uploadAssignmentMaterials = multer({
  storage: assignmentMaterialStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB per file
  },
  fileFilter: fileFilter(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'zip'])
}).array('materials', 10); // Field name: 'materials', max 10 files

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
 * Multer configuration for CSV file uploads (in-memory storage)
 * Used for bulk operations (users, enrollments, grades)
 */
const csvStorage = multer.memoryStorage();

const uploadCsv = multer({
  storage: csvStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
}).single('csvFile');

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
export { uploadMaterial, uploadAssignmentMaterials, uploadSubmission, uploadCsv };

export default {
  uploadMaterial: handleUpload(uploadMaterial),
  uploadAssignmentMaterials: handleUpload(uploadAssignmentMaterials),
  uploadSubmission: handleUpload(uploadSubmission),
  uploadCsv: handleUpload(uploadCsv)
};
