import bcrypt from 'bcrypt';
import { parseCsv, validateUserCsv, validateEnrollmentCsv, formatErrors } from '../services/csvService.js';
import { User, Batch, Course, BatchEnrollment, sequelize } from '../models/index.js';

/**
 * Bulk User Upload Controller
 * Handles CSV-based bulk operations for users, enrollments, and grades
 */

/**
 * Bulk create users from CSV
 * @route POST /admin/tools/bulk-users
 */
export const bulkCreateUsers = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No CSV file uploaded',
        summary: { total: 0, created: 0, skipped: 0, errors: 0 },
        results: { success: [], errors: [], skipped: [] }
      });
    }

    // Parse CSV
    const parseResult = parseCsv(req.file.buffer);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'CSV parsing failed',
        summary: { total: 0, created: 0, skipped: 0, errors: parseResult.errors.length },
        results: { success: [], errors: parseResult.errors, skipped: [] }
      });
    }

    // Validate CSV data (row-level validation)
    const validationResult = validateUserCsv(parseResult.data);
    
    // Check for header errors (fatal - cannot proceed)
    if (validationResult.headerError) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: validationResult.headerError,
        summary: { total: parseResult.data.length, created: 0, skipped: 0, errors: parseResult.data.length },
        results: { success: [], errors: [{ row: 0, message: validationResult.headerError }], skipped: [] }
      });
    }

    const totalRows = parseResult.data.length;
    const results = {
      success: [],
      errors: [],
      skipped: []
    };

    // Add validation errors to results (include all original data)
    validationResult.invalidRows.forEach(invalidRow => {
      const errorMessages = invalidRow.errors.map(e => `${e.field}: ${e.message}`).join('; ');
      results.errors.push({
        row: invalidRow.rowNum,
        username: invalidRow.data.username || '',
        email: invalidRow.data.email || '',
        password: invalidRow.data.password || '', // Include original password for re-upload
        full_name: invalidRow.data.full_name || '',
        role: invalidRow.data.role || '',
        batch_code: invalidRow.data.batch_code || '',
        status: 'error',
        message: errorMessages
      });
    });

    // Process only valid rows
    for (const validRow of validationResult.validRows) {
      const row = validRow.data;
      const rowNum = validRow.rowNum;
      
      try {
        // Check for duplicate username in database
        const existingUsername = await User.findOne({
          where: { username: row.username.toLowerCase() },
          transaction
        });

        if (existingUsername) {
          results.skipped.push({
            row: rowNum,
            username: row.username || '',
            email: row.email || '',
            password: row.password || '', // Include original password for re-upload
            full_name: row.full_name || '',
            role: row.role || '',
            batch_code: row.batch_code || '',
            status: 'skipped',
            message: 'Username already exists in database'
          });
          continue;
        }

        // Check for duplicate email in database
        const existingEmail = await User.findOne({
          where: { email: row.email.toLowerCase() },
          transaction
        });

        if (existingEmail) {
          results.skipped.push({
            row: rowNum,
            username: row.username || '',
            email: row.email || '',
            password: row.password || '', // Include original password for re-upload
            full_name: row.full_name || '',
            role: row.role || '',
            batch_code: row.batch_code || '',
            status: 'skipped',
            message: 'Email already exists in database'
          });
          continue;
        }

        // For students, verify batch exists
        let batchId = null;
        if (row.role.toLowerCase() === 'student') {
          const batch = await Batch.findOne({
            where: { code: row.batch_code },
            transaction
          });

          if (!batch) {
            results.errors.push({
              row: rowNum,
              username: row.username || '',
              email: row.email || '',
              password: row.password || '', // Include original password for re-upload
              full_name: row.full_name || '',
              role: row.role || '',
              batch_code: row.batch_code || '',
              status: 'error',
              message: `Batch with code '${row.batch_code}' not found`
            });
            continue;
          }

          batchId = batch.id;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(row.password, 10);

        // Create user
        const user = await User.create({
          username: row.username.toLowerCase(),
          email: row.email.toLowerCase(),
          password: hashedPassword,
          full_name: row.full_name,
          role: row.role.toLowerCase(),
          batch_id: batchId
        }, { transaction });

        results.success.push({
          row: rowNum,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          batch_code: row.batch_code || '',
          status: 'success',
          message: 'User created successfully'
        });

      } catch (error) {
        results.errors.push({
          row: rowNum,
          username: row.username || '',
          email: row.email || '',
          password: row.password || '', // Include original password for re-upload
          full_name: row.full_name || '',
          role: row.role || '',
          batch_code: row.batch_code || '',
          status: 'error',
          message: error.message
        });
      }
    }

    // Commit transaction if at least one user was created successfully
    if (results.success.length > 0) {
      await transaction.commit();
      
      const hasErrors = results.errors.length > 0 || results.skipped.length > 0;
      
      return res.status(200).json({
        success: true,
        message: hasErrors 
          ? `Partial success: Created ${results.success.length} user(s). ${results.errors.length + results.skipped.length} row(s) failed.`
          : `Successfully created ${results.success.length} user(s)`,
        summary: {
          total: totalRows,
          created: results.success.length,
          skipped: results.skipped.length,
          errors: results.errors.length
        },
        results: results
      });
    } else {
      await transaction.rollback();
      
      return res.status(400).json({
        success: false,
        message: 'No users were created. All rows had errors.',
        summary: {
          total: totalRows,
          created: 0,
          skipped: results.skipped.length,
          errors: results.errors.length
        },
        results: results
      });
    }

  } catch (error) {
    await transaction.rollback();
    
    console.error('Bulk user upload error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error during bulk upload',
      error: error.message,
      summary: { total: 0, created: 0, skipped: 0, errors: 1 },
      results: { success: [], errors: [{ row: 0, message: error.message }], skipped: [] }
    });
  }
};

/**
 * Bulk create enrollments from CSV
 * @route POST /admin/tools/bulk-enrollments
 */
export const bulkCreateEnrollments = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No CSV file uploaded',
        results: []
      });
    }

    // Parse CSV
    const parseResult = parseCsv(req.file.buffer);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'CSV parsing failed',
        errors: formatErrors(parseResult.errors),
        results: []
      });
    }

    // Validate CSV data
    const validationResult = validateEnrollmentCsv(parseResult.data);
    
    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        message: 'CSV validation failed',
        errors: formatErrors(validationResult.errors),
        results: []
      });
    }

    const rows = parseResult.data;
    const results = {
      success: [],
      errors: [],
      skipped: []
    };

    // Process each enrollment
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      
      try {
        // Find batch
        const batch = await Batch.findOne({
          where: { code: row.batch_code },
          transaction
        });

        if (!batch) {
          results.errors.push({
            row: rowNum,
            batch_code: row.batch_code,
            course_code: row.course_code,
            reason: `Batch with code '${row.batch_code}' not found`
          });
          continue;
        }

        // Find course
        const course = await Course.findOne({
          where: { code: row.course_code },
          transaction
        });

        if (!course) {
          results.errors.push({
            row: rowNum,
            batch_code: row.batch_code,
            course_code: row.course_code,
            reason: `Course with code '${row.course_code}' not found`
          });
          continue;
        }

        // Check for duplicate enrollment
        const existingEnrollment = await BatchEnrollment.findOne({
          where: {
            batch_id: batch.id,
            course_id: course.id
          },
          transaction
        });

        if (existingEnrollment) {
          results.skipped.push({
            row: rowNum,
            batch_code: row.batch_code,
            course_code: row.course_code,
            reason: 'Enrollment already exists'
          });
          continue;
        }

        // Create enrollment
        await BatchEnrollment.create({
          batch_id: batch.id,
          course_id: course.id
        }, { transaction });

        results.success.push({
          row: rowNum,
          batch_code: row.batch_code,
          course_code: row.course_code,
          batch_name: batch.name,
          course_title: course.title
        });

      } catch (error) {
        results.errors.push({
          row: rowNum,
          batch_code: row.batch_code || 'N/A',
          course_code: row.course_code || 'N/A',
          reason: error.message
        });
      }
    }

    // Commit transaction if at least one enrollment was created
    if (results.success.length > 0) {
      await transaction.commit();
      
      return res.status(200).json({
        success: true,
        message: `Successfully created ${results.success.length} enrollment(s)`,
        summary: {
          total: rows.length,
          created: results.success.length,
          skipped: results.skipped.length,
          errors: results.errors.length
        },
        results: results
      });
    } else {
      await transaction.rollback();
      
      return res.status(400).json({
        success: false,
        message: 'No enrollments were created',
        summary: {
          total: rows.length,
          created: 0,
          skipped: results.skipped.length,
          errors: results.errors.length
        },
        results: results
      });
    }

  } catch (error) {
    await transaction.rollback();
    
    console.error('Bulk enrollment upload error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error during bulk enrollment',
      error: error.message,
      results: []
    });
  }
};

/**
 * Bulk upload grades from CSV
 * @route POST /admin/tools/bulk-grades
 */
/**
 * Bulk upload grades - DEPRECATED (Model Removed)
 */
export const bulkUploadGrades = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Grade feature has been removed.'
  });
};

/**
 * Bulk delete users
 * @route POST /admin/tools/bulk-delete
 */
export const bulkDeleteUsers = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { userIds } = req.body;

    // Validate input
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No user IDs provided or invalid format',
        results: []
      });
    }

    const results = {
      success: [],
      errors: []
    };

    // Process each user ID
    for (const userId of userIds) {
      try {
        const user = await User.findByPk(userId, { transaction });

        if (!user) {
          results.errors.push({
            userId: userId,
            reason: 'User not found'
          });
          continue;
        }

        // Check for dependencies (submissions, grades, etc.)
        // Note: With onDelete: RESTRICT, this will throw error if dependencies exist
        
        await user.destroy({ transaction });

        results.success.push({
          userId: userId,
          username: user.username,
          email: user.email
        });

      } catch (error) {
        // Check if it's a foreign key constraint error
        if (error.name === 'SequelizeForeignKeyConstraintError') {
          results.errors.push({
            userId: userId,
            reason: 'Cannot delete user: has associated records (submissions, grades, etc.)'
          });
        } else {
          results.errors.push({
            userId: userId,
            reason: error.message
          });
        }
      }
    }

    // Commit transaction if at least one user was deleted
    if (results.success.length > 0) {
      await transaction.commit();
      
      return res.status(200).json({
        success: true,
        message: `Successfully deleted ${results.success.length} user(s)`,
        summary: {
          total: userIds.length,
          deleted: results.success.length,
          errors: results.errors.length
        },
        results: results
      });
    } else {
      await transaction.rollback();
      
      return res.status(400).json({
        success: false,
        message: 'No users were deleted',
        summary: {
          total: userIds.length,
          deleted: 0,
          errors: results.errors.length
        },
        results: results
      });
    }

  } catch (error) {
    await transaction.rollback();
    
    console.error('Bulk delete error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error during bulk delete',
      error: error.message,
      results: []
    });
  }
};
