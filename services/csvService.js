import Papa from 'papaparse';
import validator from 'validator';

/**
 * CSV Service for bulk operations
 * Handles parsing and validation of CSV files for users, enrollments, and grades
 */

// Maximum allowed rows per CSV upload
const MAX_ROWS = 1000;

/**
 * Parse CSV file buffer to array of objects
 * @param {Buffer} fileBuffer - CSV file buffer
 * @returns {Object} - { success: boolean, data: array, errors: array }
 */
export const parseCsv = (fileBuffer) => {
  try {
    const csvText = fileBuffer.toString('utf-8');
    
    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      transform: (value) => value.trim()
    });

    if (result.errors.length > 0) {
      return {
        success: false,
        data: [],
        errors: result.errors.map(err => ({
          row: err.row,
          message: err.message
        }))
      };
    }

    // Check row limit
    if (result.data.length > MAX_ROWS) {
      return {
        success: false,
        data: [],
        errors: [{
          row: 0,
          message: `CSV exceeds maximum allowed rows (${MAX_ROWS}). Found ${result.data.length} rows.`
        }]
      };
    }

    // Check if CSV is empty
    if (result.data.length === 0) {
      return {
        success: false,
        data: [],
        errors: [{
          row: 0,
          message: 'CSV file is empty or has no valid data rows.'
        }]
      };
    }

    return {
      success: true,
      data: result.data,
      errors: []
    };

  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [{
        row: 0,
        message: `Failed to parse CSV: ${error.message}`
      }]
    };
  }
};

/**
 * Validate User CSV data
 * Required headers: username, email, password, full_name, role
 * Optional headers: batch_code (required for students)
 * @param {Array} rows - Parsed CSV data
 * @returns {Object} - { valid: boolean, errors: array }
 */
export const validateUserCsv = (rows) => {
  const errors = [];
  const requiredHeaders = ['username', 'email', 'password', 'full_name', 'role'];
  const validRoles = ['admin', 'teacher', 'student'];

  // Check if data exists
  if (!rows || rows.length === 0) {
    return {
      valid: false,
      errors: [{ row: 0, message: 'No data rows found in CSV' }]
    };
  }

  // Check headers
  const headers = Object.keys(rows[0]);
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
  
  if (missingHeaders.length > 0) {
    return {
      valid: false,
      errors: [{
        row: 0,
        message: `Missing required headers: ${missingHeaders.join(', ')}`
      }]
    };
  }

  // Validate each row
  const usernames = new Set();
  const emails = new Set();

  rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 because index 0 is row 2 (after header)

    // Check required fields
    if (!row.username || row.username.length < 3) {
      errors.push({
        row: rowNum,
        field: 'username',
        message: 'Username is required and must be at least 3 characters'
      });
    }

    // Check for duplicate username in CSV
    if (row.username) {
      if (usernames.has(row.username.toLowerCase())) {
        errors.push({
          row: rowNum,
          field: 'username',
          message: `Duplicate username in CSV: ${row.username}`
        });
      }
      usernames.add(row.username.toLowerCase());
    }

    // Validate email
    if (!row.email || !validator.isEmail(row.email)) {
      errors.push({
        row: rowNum,
        field: 'email',
        message: 'Valid email is required'
      });
    }

    // Check for duplicate email in CSV
    if (row.email) {
      if (emails.has(row.email.toLowerCase())) {
        errors.push({
          row: rowNum,
          field: 'email',
          message: `Duplicate email in CSV: ${row.email}`
        });
      }
      emails.add(row.email.toLowerCase());
    }

    // Validate password
    if (!row.password || row.password.length < 6) {
      errors.push({
        row: rowNum,
        field: 'password',
        message: 'Password is required and must be at least 6 characters'
      });
    }

    // Validate full_name
    if (!row.full_name || row.full_name.length < 2) {
      errors.push({
        row: rowNum,
        field: 'full_name',
        message: 'Full name is required and must be at least 2 characters'
      });
    }

    // Validate role
    if (!row.role || !validRoles.includes(row.role.toLowerCase())) {
      errors.push({
        row: rowNum,
        field: 'role',
        message: `Role must be one of: ${validRoles.join(', ')}`
      });
    }

    // Validate batch_code for students
    if (row.role && row.role.toLowerCase() === 'student') {
      if (!row.batch_code || row.batch_code.length === 0) {
        errors.push({
          row: rowNum,
          field: 'batch_code',
          message: 'Batch code is required for students'
        });
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors
  };
};

/**
 * Validate Enrollment CSV data
 * Required headers: batch_code, course_code
 * @param {Array} rows - Parsed CSV data
 * @returns {Object} - { valid: boolean, errors: array }
 */
export const validateEnrollmentCsv = (rows) => {
  const errors = [];
  const requiredHeaders = ['batch_code', 'course_code'];

  // Check if data exists
  if (!rows || rows.length === 0) {
    return {
      valid: false,
      errors: [{ row: 0, message: 'No data rows found in CSV' }]
    };
  }

  // Check headers
  const headers = Object.keys(rows[0]);
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
  
  if (missingHeaders.length > 0) {
    return {
      valid: false,
      errors: [{
        row: 0,
        message: `Missing required headers: ${missingHeaders.join(', ')}`
      }]
    };
  }

  // Validate each row
  const enrollmentPairs = new Set();

  rows.forEach((row, index) => {
    const rowNum = index + 2;

    // Validate batch_code
    if (!row.batch_code || row.batch_code.length === 0) {
      errors.push({
        row: rowNum,
        field: 'batch_code',
        message: 'Batch code is required'
      });
    }

    // Validate course_code
    if (!row.course_code || row.course_code.length === 0) {
      errors.push({
        row: rowNum,
        field: 'course_code',
        message: 'Course code is required'
      });
    }

    // Check for duplicate enrollment in CSV
    if (row.batch_code && row.course_code) {
      const pairKey = `${row.batch_code.toLowerCase()}_${row.course_code.toLowerCase()}`;
      if (enrollmentPairs.has(pairKey)) {
        errors.push({
          row: rowNum,
          field: 'batch_code, course_code',
          message: `Duplicate enrollment in CSV: Batch ${row.batch_code} already enrolled in ${row.course_code}`
        });
      }
      enrollmentPairs.add(pairKey);
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors
  };
};

/**
 * Validate Grade CSV data
 * Required headers: student_username OR student_email, course_code, grade
 * Optional headers: remarks
 * @param {Array} rows - Parsed CSV data
 * @returns {Object} - { valid: boolean, errors: array }
 */
export const validateGradeCsv = (rows) => {
  const errors = [];
  const validGradeFormats = /^[A-F][+-]?$|^(100|[0-9]{1,2})$/; // A-F or 0-100

  // Check if data exists
  if (!rows || rows.length === 0) {
    return {
      valid: false,
      errors: [{ row: 0, message: 'No data rows found in CSV' }]
    };
  }

  // Check headers - need at least one student identifier
  const headers = Object.keys(rows[0]);
  const hasStudentUsername = headers.includes('student_username');
  const hasStudentEmail = headers.includes('student_email');
  const hasCourseCode = headers.includes('course_code');
  const hasGrade = headers.includes('grade');

  if (!hasStudentUsername && !hasStudentEmail) {
    return {
      valid: false,
      errors: [{
        row: 0,
        message: 'Missing required header: student_username OR student_email'
      }]
    };
  }

  if (!hasCourseCode) {
    return {
      valid: false,
      errors: [{
        row: 0,
        message: 'Missing required header: course_code'
      }]
    };
  }

  if (!hasGrade) {
    return {
      valid: false,
      errors: [{
        row: 0,
        message: 'Missing required header: grade'
      }]
    };
  }

  // Validate each row
  const gradePairs = new Set();

  rows.forEach((row, index) => {
    const rowNum = index + 2;

    // Validate student identifier
    const studentId = row.student_username || row.student_email;
    if (!studentId || studentId.length === 0) {
      errors.push({
        row: rowNum,
        field: 'student_username/student_email',
        message: 'Student username or email is required'
      });
    }

    // Validate email format if using student_email
    if (row.student_email && !validator.isEmail(row.student_email)) {
      errors.push({
        row: rowNum,
        field: 'student_email',
        message: 'Invalid email format'
      });
    }

    // Validate course_code
    if (!row.course_code || row.course_code.length === 0) {
      errors.push({
        row: rowNum,
        field: 'course_code',
        message: 'Course code is required'
      });
    }

    // Validate grade format
    if (!row.grade || !validGradeFormats.test(row.grade.toUpperCase())) {
      errors.push({
        row: rowNum,
        field: 'grade',
        message: 'Grade must be A-F (with optional +/-) or 0-100'
      });
    }

    // Check for duplicate grade entry in CSV
    if (studentId && row.course_code) {
      const pairKey = `${studentId.toLowerCase()}_${row.course_code.toLowerCase()}`;
      if (gradePairs.has(pairKey)) {
        errors.push({
          row: rowNum,
          field: 'student, course',
          message: `Duplicate grade entry in CSV for student ${studentId} in course ${row.course_code}`
        });
      }
      gradePairs.add(pairKey);
    }

    // Validate remarks length (optional field)
    if (row.remarks && row.remarks.length > 500) {
      errors.push({
        row: rowNum,
        field: 'remarks',
        message: 'Remarks must not exceed 500 characters'
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors
  };
};

/**
 * Generate CSV error report for display
 * @param {Array} errors - Array of error objects
 * @returns {String} - Formatted error message
 */
export const formatErrors = (errors) => {
  if (!errors || errors.length === 0) {
    return 'No errors found.';
  }

  let message = `Found ${errors.length} error(s):\n\n`;
  
  errors.forEach((error, index) => {
    if (error.row === 0) {
      message += `${index + 1}. ${error.message}\n`;
    } else {
      const fieldInfo = error.field ? ` [${error.field}]` : '';
      message += `${index + 1}. Row ${error.row}${fieldInfo}: ${error.message}\n`;
    }
  });

  return message;
};
