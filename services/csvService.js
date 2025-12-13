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
 * @returns {Object} - { validRows: array, invalidRows: array, headerError: string|null }
 */
export const validateUserCsv = (rows) => {
  const requiredHeaders = ['username', 'email', 'password', 'full_name', 'role'];
  const validRoles = ['admin', 'teacher', 'student'];

  // Check if data exists
  if (!rows || rows.length === 0) {
    return {
      validRows: [],
      invalidRows: [],
      headerError: 'No data rows found in CSV'
    };
  }

  // Check headers (fatal error - cannot proceed)
  const headers = Object.keys(rows[0]);
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
  
  if (missingHeaders.length > 0) {
    return {
      validRows: [],
      invalidRows: [],
      headerError: `Missing required headers: ${missingHeaders.join(', ')}`
    };
  }

  // Row-level validation
  const validRows = [];
  const invalidRows = [];

  const usernames = new Set();
  const emails = new Set();

  rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 because index 0 is row 2 (after header)
    const rowErrors = [];

    // Check required fields
    if (!row.username || row.username.length < 3) {
      rowErrors.push({
        field: 'username',
        message: 'Username is required and must be at least 3 characters'
      });
    }

    // Check for duplicate username in CSV
    if (row.username) {
      if (usernames.has(row.username.toLowerCase())) {
        rowErrors.push({
          field: 'username',
          message: `Duplicate username in CSV: ${row.username}`
        });
      }
      usernames.add(row.username.toLowerCase());
    }

    // Validate email
    if (!row.email || !validator.isEmail(row.email)) {
      rowErrors.push({
        field: 'email',
        message: 'Valid email is required'
      });
    }

    // Check for duplicate email in CSV
    if (row.email) {
      if (emails.has(row.email.toLowerCase())) {
        rowErrors.push({
          field: 'email',
          message: `Duplicate email in CSV: ${row.email}`
        });
      }
      emails.add(row.email.toLowerCase());
    }

    // Validate password
    if (!row.password || row.password.length < 6) {
      rowErrors.push({
        field: 'password',
        message: 'Password is required and must be at least 6 characters'
      });
    }

    // Validate full_name
    if (!row.full_name || row.full_name.length < 2) {
      rowErrors.push({
        field: 'full_name',
        message: 'Full name is required and must be at least 2 characters'
      });
    }

    // Validate role
    if (!row.role || !validRoles.includes(row.role.toLowerCase())) {
      rowErrors.push({
        field: 'role',
        message: `Role must be one of: ${validRoles.join(', ')}`
      });
    }

    // Validate batch_code for students
    if (row.role && row.role.toLowerCase() === 'student') {
      if (!row.batch_code || row.batch_code.length === 0) {
        rowErrors.push({
          field: 'batch_code',
          message: 'Batch code is required for students'
        });
      }
    }

    // Add row to appropriate array
    if (rowErrors.length === 0) {
      validRows.push({ rowNum, data: row });
    } else {
      invalidRows.push({ 
        rowNum, 
        data: row, 
        errors: rowErrors 
      });
    }
  });

  return {
    validRows,
    invalidRows,
    headerError: null
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
 * Validate teacher grade upload CSV
 * Expected columns: student_email OR username, grade, remarks (optional)
 * @param {Array} rows - Parsed CSV rows
 * @returns {Object} - { valid: boolean, errors: array }
 */
export const validateTeacherGradeCsv = (rows) => {
  const errors = [];
  const requiredHeaders = ['grade'];
  const identifierHeaders = ['student_email', 'username', 'email'];
  
  // Check if CSV has data
  if (!rows || rows.length === 0) {
    errors.push({
      row: 0,
      message: 'CSV file is empty'
    });
    return { valid: false, errors };
  }

  // Check for required headers
  const headers = Object.keys(rows[0]);
  
  // Check if at least one student identifier exists
  const hasIdentifier = identifierHeaders.some(id => headers.includes(id));
  if (!hasIdentifier) {
    errors.push({
      row: 0,
      message: `CSV must include at least one student identifier column: ${identifierHeaders.join(', ')}`
    });
  }

  // Check for grade column
  if (!headers.includes('grade')) {
    errors.push({
      row: 0,
      message: 'CSV must include "grade" column'
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate each row
  const studentIdentifiers = new Set();
  
  rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 because index starts at 0 and we skip header row

    // Get student identifier
    const studentId = row.student_email || row.username || row.email;
    
    if (!studentId || studentId === '') {
      errors.push({
        row: rowNum,
        field: 'student identifier',
        message: 'Student email/username is required'
      });
      return; // Skip further validation for this row
    }

    // Validate email format if email is used
    if ((row.student_email || row.email) && !validator.isEmail(studentId)) {
      errors.push({
        row: rowNum,
        field: 'student_email/email',
        message: `Invalid email format: ${studentId}`
      });
    }

    // Validate grade is not empty
    if (!row.grade || row.grade === '') {
      errors.push({
        row: rowNum,
        field: 'grade',
        message: 'Grade is required'
      });
      return;
    }

    // Validate grade format (letter A-F with optional +/- or numeric 0-100)
    const gradeTrimmed = row.grade.trim();
    const letterGradePattern = /^[A-Fa-f][+-]?$/;
    const numericGradePattern = /^\d+(\.\d+)?$/;

    if (!letterGradePattern.test(gradeTrimmed) && !numericGradePattern.test(gradeTrimmed)) {
      errors.push({
        row: rowNum,
        field: 'grade',
        message: `Invalid grade format: ${row.grade}. Use letter grade (A-F) or percentage (0-100)`
      });
    } else if (numericGradePattern.test(gradeTrimmed)) {
      // If numeric, validate range
      const numGrade = parseFloat(gradeTrimmed);
      if (numGrade < 0 || numGrade > 100) {
        errors.push({
          row: rowNum,
          field: 'grade',
          message: `Numeric grade must be between 0 and 100. Found: ${row.grade}`
        });
      }
    }

    // Check for duplicate student in CSV
    const identifierKey = studentId.toLowerCase();
    if (studentIdentifiers.has(identifierKey)) {
      errors.push({
        row: rowNum,
        field: 'student identifier',
        message: `Duplicate entry for student: ${studentId}`
      });
    }
    studentIdentifiers.add(identifierKey);

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
 * Validate Batch Update CSV data
 * Required headers: student_email, new_batch_code
 * @param {Array} rows - Parsed CSV data
 * @returns {Object} - { valid: boolean, errors: array }
 */
export const validateBatchUpdateCsv = (rows) => {
  const errors = [];
  const requiredHeaders = ['student_email', 'new_batch_code'];

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
  rows.forEach((row, index) => {
    const rowNum = index + 2;

    // Validate student_email
    if (!row.student_email || !validator.isEmail(row.student_email)) {
      errors.push({
        row: rowNum,
        field: 'student_email',
        message: 'Valid student email is required'
      });
    }

    // Validate new_batch_code
    if (!row.new_batch_code || row.new_batch_code.length === 0) {
      errors.push({
        row: rowNum,
        field: 'new_batch_code',
        message: 'New batch code is required'
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
