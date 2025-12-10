/**
 * Teacher Controller
 * Handles teacher-specific operations (dashboard, courses, materials, assignments, grading)
 * Phase 4: Teacher Features Implementation
 */

import { 
  User, 
  Course, 
  CourseTeacher,
  BatchEnrollment, 
  Assignment,
  AssignmentMaterial,
  Submission, 
  Batch, 
  Grade,
  Material,
  Folder,
  FolderCourse,
  sequelize
} from '../models/index.js';
import { Op, QueryTypes } from 'sequelize';
import cloudinary, { generateSignedUrl, signUrlsInArray, deleteCloudinaryFile } from '../config/cloudinary.js';
import { teacherService } from '../services/teacherService.js';



/**
 * Show Teacher Dashboard
 * GET /teacher/dashboard
 * 
 * Displays:
 * - Teacher's courses count (including assigned courses)
 * - Total enrolled students across all courses
 * - Pending submissions count (ungraded)
 * - Recent activity (latest submissions)
 */
export const showDashboard = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const dashboardData = await teacherService.getDashboardData(teacherId);

    res.render('teacher/dashboard', {
      user: req.user,
      ...dashboardData,
      pageTitle: 'Teacher Dashboard'
    });
  } catch (error) {
    console.error('Teacher Dashboard Error:', error);
    res.status(500).send('Error loading dashboard: ' + error.message);
  }
};

/**
 * Get All Courses
 * GET /teacher/courses
 * 
 * Displays list of all courses the teacher has access to (owned + assigned)
 */
export const getCourses = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Get all course IDs teacher has access to
    const courseIds = await teacherService.getCourseIds(teacherId);

    const courses = await Course.findAll({
      where: { id: { [Op.in]: courseIds } },
      include: [{
        model: BatchEnrollment,
        include: [{
          model: Batch,
          as: 'batch',
          include: [{
            model: User,
            as: 'students'
          }]
        }]
      }, {
        model: Assignment
      }, {
        model: CourseTeacher,
        as: 'courseTeachers',
        include: [{
          model: User,
          as: 'teacher',
          attributes: ['id', 'full_name']
        }]
      }],
      order: [['created_at', 'DESC']]
    });

    // Add a flag to indicate if current teacher is the primary teacher
    const coursesWithOwnership = courses.map(course => {
      const courseJson = course.toJSON();
      // Check if this teacher has is_primary flag in courseTeachers
      const isPrimary = courseJson.courseTeachers?.some(
        ct => ct.teacher_id === teacherId && ct.is_primary
      ) || false;
      return {
        ...courseJson,
        isOwner: isPrimary
      };
    });

    // Get unique batches from courses for filtering
    const batchMap = new Map();
    coursesWithOwnership.forEach(course => {
      if (course.BatchEnrollments) {
        course.BatchEnrollments.forEach(enrollment => {
          if (enrollment.batch && !batchMap.has(enrollment.batch.id)) {
            batchMap.set(enrollment.batch.id, enrollment.batch.name);
          }
        });
      }
    });
    
    // Convert to array and sort
    const batches = Array.from(batchMap, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.render('teacher/courses', {
      user: req.user,
      courses: coursesWithOwnership,
      batches,
      pageTitle: 'My Courses'
    });

  } catch (error) {
    console.error('Get Courses Error:', error);
    res.status(500).send('Error loading courses: ' + error.message);
  }
};

/**
 * Get All Assignments
 * GET /teacher/assignments
 * 
 * Displays list of all assignments the teacher has created across all courses
 * with filtering by course, status (active/overdue), and sorting options
 */
export const getAssignments = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Get all course IDs teacher has access to
    const courseIds = await teacherService.getCourseIds(teacherId);

    if (courseIds.length === 0) {
      return res.render('teacher/assignments', {
        user: req.user,
        assignments: [],
        courses: [],
        stats: {
          total: 0,
          active: 0,
          overdue: 0,
          pendingGrading: 0
        },
        pageTitle: 'All Assignments'
      });
    }

    // Fetch all assignments for teacher's courses
    const assignments = await Assignment.findAll({
      where: { course_id: { [Op.in]: courseIds } },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'code']
        },
        {
          model: Submission,
          attributes: ['id', 'marks', 'submitted_at']
        },
        {
          model: AssignmentMaterial,
          as: 'materials',
          attributes: ['id', 'title', 'type']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'full_name']
        }
      ],
      order: [['deadline', 'DESC']]
    });

    // Get courses for filter dropdown
    const courses = await Course.findAll({
      where: { id: { [Op.in]: courseIds } },
      attributes: ['id', 'title', 'code'],
      order: [['title', 'ASC']]
    });

    // Calculate statistics
    const now = new Date();
    let activeCount = 0;
    let overdueCount = 0;
    let pendingGradingCount = 0;

    assignments.forEach(assignment => {
      const isOverdue = new Date(assignment.deadline) < now;
      if (isOverdue) {
        overdueCount++;
      } else {
        activeCount++;
      }
      // Count submissions without grades
      const pendingSubmissions = assignment.Submissions.filter(s => s.marks === null).length;
      pendingGradingCount += pendingSubmissions;
    });

    res.render('teacher/assignments', {
      user: req.user,
      assignments,
      courses,
      stats: {
        total: assignments.length,
        active: activeCount,
        overdue: overdueCount,
        pendingGrading: pendingGradingCount
      },
      pageTitle: 'All Assignments'
    });

  } catch (error) {
    console.error('Get Assignments Error:', error);
    res.status(500).send('Error loading assignments: ' + error.message);
  }
};

/**
 * Show Course Creation Form
 * GET /teacher/courses/create
 */
export const showCreateCourse = async (req, res) => {
  try {
    res.render('teacher/course-create', {
      user: req.user,
      pageTitle: 'Create New Course',
      errors: null
    });
  } catch (error) {
    console.error('Show Create Course Error:', error);
    res.status(500).send('Error loading form: ' + error.message);
  }
};

/**
 * Create New Course
 * POST /teacher/courses/create
 * 
 * Validates:
 * - All fields required
 * - Course code must be unique
 */
export const createCourse = async (req, res) => {
  try {
    const { title, code, description, semester } = req.body;
    const teacherId = req.user.id;

    // Validation
    const errors = [];

    if (!title || title.trim() === '') {
      errors.push('Course title is required');
    }

    if (!code || code.trim() === '') {
      errors.push('Course code is required');
    }

    if (!description || description.trim() === '') {
      errors.push('Course description is required');
    }

    // Validate semester (must be Semester 1-8)
    const validSemesters = ['Semester 1', 'Semester 2', 'Semester 3', 'Semester 4', 'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8'];
    if (!semester || !validSemesters.includes(semester)) {
      errors.push('Please select a valid semester (Semester 1-8)');
    }

    // Check if course code already exists
    if (code) {
      const existingCourse = await Course.findOne({
        where: { code: code.trim().toUpperCase() }
      });

      if (existingCourse) {
        errors.push('Course code already exists. Please use a different code.');
      }
    }

    // If validation errors, re-render form
    if (errors.length > 0) {
      return res.render('teacher/course-create', {
        user: req.user,
        pageTitle: 'Create New Course',
        errors,
        formData: { title, code, description, semester }
      });
    }

    // Create course
    const newCourse = await Course.create({
      title: title.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim(),
      semester: semester ? semester.trim() : null
    });

    // Add teacher to CourseTeacher with primary access
    await CourseTeacher.create({
      course_id: newCourse.id,
      teacher_id: teacherId,
      is_primary: true,
      can_edit: true,
      can_grade: true
    });

    // Redirect to course detail page
    res.redirect(`/teacher/courses/${newCourse.id}`);

  } catch (error) {
    console.error('Create Course Error:', error);
    res.status(500).send('Error creating course: ' + error.message);
  }
};

/**
 * Get Course Detail
 * GET /teacher/courses/:id
 * 
 * Shows course details, enrolled batches, materials, assignments
 * Verifies teacher has access to the course (owner or assigned)
 */
export const getCourseDetail = async (req, res) => {
  try {
    const courseId = req.params.id;
    const teacherId = req.user.id;

    // Check if teacher has access to this course
    const hasAccess = await teacherService.checkCourseAccess(courseId, teacherId);
    if (!hasAccess) {
      return res.status(404).send('Course not found or you do not have permission to view it');
    }

    const course = await Course.findByPk(courseId, {
      include: [{
        model: BatchEnrollment,
        include: [{
          model: Batch,
          as: 'batch',
          include: [{
            model: User,
            as: 'students'
          }]
        }]
      }, {
        model: Assignment,
        include: [{
          model: Submission
        }, {
          model: AssignmentMaterial,
          as: 'materials'
        }]
      }, {
        model: CourseTeacher,
        as: 'courseTeachers',
        include: [{
          model: User,
          as: 'teacher',
          attributes: ['id', 'full_name', 'email']
        }]
      }]
    });

    if (!course) {
      return res.status(404).send('Course not found');
    }

    // Calculate enrolled students
    let totalStudents = 0;
    const enrolledBatches = [];
    
    course.BatchEnrollments.forEach(enrollment => {
      const studentsCount = enrollment.batch.students.length;
      totalStudents += studentsCount;
      enrolledBatches.push({
        id: enrollment.batch.id,
        name: enrollment.batch.name,
        code: enrollment.batch.code,
        studentsCount
      });
    });

    // Check if current teacher is the primary teacher
    const isOwner = await teacherService.isPrimary(courseId, teacherId);

    // Get teacher's permissions
    let permissions = { can_edit: true, can_grade: true };
    if (!isOwner) {
      const courseTeacher = await CourseTeacher.findOne({
        where: { course_id: courseId, teacher_id: teacherId }
      });
      if (courseTeacher) {
        permissions = {
          can_edit: courseTeacher.can_edit,
          can_grade: courseTeacher.can_grade
        };
      }
    }

    // Sign assignment material URLs for authenticated access (12-hour expiry)
    if (course.Assignments) {
      course.Assignments.forEach(assignment => {
        if (assignment.materials && assignment.materials.length > 0) {
          assignment.materials = signUrlsInArray(assignment.materials, 'url', 'assignment');
        }
      });
    }

    res.render('teacher/course-detail', {
      user: req.user,
      course,
      totalStudents,
      enrolledBatches,
      isOwner,
      permissions,
      pageTitle: course.title
    });

  } catch (error) {
    console.error('Get Course Detail Error:', error);
    res.status(500).send('Error loading course details: ' + error.message);
  }
};

/**
 * Get Course Materials
 * GET /teacher/courses/:id/materials
 * 
 * Shows all materials for a course with upload form
 */
export const getMaterials = async (req, res) => {
  try {
    const courseId = req.params.id;
    const teacherId = req.user.id;

    // Verify teacher has access to the course (with edit permission for uploads)
    const course = await teacherService.checkCourseAccess(courseId, teacherId);

    if (!course) {
      return res.status(404).send('Course not found or you do not have permission to access it');
    }

    // Check edit permission
    const isOwner = await teacherService.isPrimary(courseId, teacherId);
    let canEdit = isOwner;
    if (!isOwner) {
      const courseTeacher = await CourseTeacher.findOne({
        where: { course_id: courseId, teacher_id: teacherId }
      });
      canEdit = courseTeacher ? courseTeacher.can_edit : false;
    }

    // Get all materials for this course
    const materials = await Material.findAll({
      where: { course_id: courseId },
      order: [['created_at', 'DESC']]
    });

    // Sign URLs for authenticated access (24-hour expiry for materials)
    const signedMaterials = signUrlsInArray(materials, 'file_url', 'material');

    res.render('teacher/materials', {
      user: req.user,
      course,
      materials: signedMaterials,
      canEdit,
      pageTitle: `Materials - ${course.title}`,
      success: req.query.success,
      error: req.query.error
    });

  } catch (error) {
    console.error('Get Materials Error:', error);
    res.status(500).send('Error loading materials: ' + error.message);
  }
};

/**
 * Upload Material
 * POST /teacher/courses/:id/materials/upload
 * 
 * Handles both file upload and URL input
 * Supports: PDF, DOC, DOCX, PPT, PPTX (max 10MB)
 * Can upload to a specific folder or course root
 */
export const uploadMaterial = async (req, res) => {
  try {
    const courseId = req.params.id;
    const teacherId = req.user.id;
    const { title, description, material_url, folder_id } = req.body;

    // Verify teacher has access and edit permission
    const course = await teacherService.checkCourseAccess(courseId, teacherId, { requireEdit: true });

    if (!course) {
      return res.redirect(`/teacher/courses/${courseId}/materials?error=Course not found or you do not have edit permission`);
    }

    // Validation
    if (!title || title.trim() === '') {
      return res.redirect(`/teacher/courses/${courseId}/materials?error=Title is required`);
    }

    // If folder_id is provided, verify folder is shared with this course
    if (folder_id && folder_id !== '') {
      const folder = await Folder.findByPk(folder_id);
      
      if (!folder) {
        return res.redirect(`/teacher/courses/${courseId}/materials?error=Folder not found`);
      }
      
      // Check if folder is shared with this course
      const folderSharedWithCourse = await FolderCourse.findOne({
        where: { folder_id: folder_id, course_id: courseId }
      });
      
      if (!folderSharedWithCourse) {
        return res.redirect(`/teacher/courses/${courseId}/materials?error=Folder is not shared with this course`);
      }
    }

    let fileUrl = material_url || '';
    let fileType = 'url'; // Default to URL

    // Check if file was uploaded
    if (req.file) {
      fileUrl = req.file.path; // Cloudinary URL
      
      // Extract file extension from original filename
      const originalName = req.file.originalname;
      const extMatch = originalName.match(/\.([a-z0-9]+)$/i);
      fileType = extMatch ? extMatch[1].toLowerCase() : 'file';
    } else if (!material_url || material_url.trim() === '') {
      return res.redirect(`/teacher/courses/${courseId}/materials?error=Please upload a file or provide a URL`);
    }

    // Validate URL format if provided
    if (material_url && !req.file) {
      // More flexible URL pattern that supports YouTube, Google Drive, etc.
      const urlPattern = /^https?:\/\/.+/i;
      if (!urlPattern.test(material_url)) {
        return res.redirect(`/teacher/courses/${courseId}/materials?error=Invalid URL format. URL must start with http:// or https://`);
      }
    }

    // Create material
    // If folder_id is provided: material belongs to folder (no course_id) - shared via FolderCourse
    // If no folder_id: material belongs directly to course (course_id set)
    const hasFolderId = folder_id && folder_id !== '';
    const parsedFolderId = hasFolderId ? parseInt(folder_id) : null;
    
    await Material.create({
      course_id: hasFolderId ? null : courseId, // Only set course_id for direct uploads (no folder)
      folder_id: parsedFolderId,
      title: title.trim(),
      description: description ? description.trim() : null,
      file_url: fileUrl,
      file_type: fileType
    });

    // If uploading to a folder, automatically share folder AND its parent hierarchy with this course
    if (parsedFolderId) {
      // Get all parent folder IDs (including the current folder)
      const folderIdsToShare = [parsedFolderId];
      let currentFolder = await Folder.findByPk(parsedFolderId);
      
      while (currentFolder && currentFolder.parent_folder_id) {
        folderIdsToShare.push(currentFolder.parent_folder_id);
        currentFolder = await Folder.findByPk(currentFolder.parent_folder_id);
      }
      
      // Share each folder in hierarchy if not already shared
      for (const fId of folderIdsToShare) {
        const existingShare = await FolderCourse.findOne({
          where: { folder_id: fId, course_id: courseId }
        });
        
        if (!existingShare) {
          await FolderCourse.create({
            folder_id: fId,
            course_id: courseId,
            added_by: req.user.id
          });
        }
      }
    }

    const successMsg = hasFolderId 
      ? 'Material uploaded to folder successfully' 
      : 'Material uploaded successfully';
    res.redirect(`/teacher/courses/${courseId}/materials?success=${successMsg}`);

  } catch (error) {
    console.error('Upload Material Error:', error);
    res.redirect(`/teacher/courses/${req.params.id}/materials?error=Error uploading material: ${error.message}`);
  }
};

/**
 * Delete Material
 * DELETE /teacher/materials/:id
 * 
 * Deletes material and associated Cloudinary file if exists
 */
export const deleteMaterial = async (req, res) => {
  try {
    const materialId = req.params.id;
    const teacherId = req.user.id;
    // Course context can come from route param or query string
    const fromCourseId = req.params.course_id || req.query.course_id;

    // Find material
    const material = await Material.findByPk(materialId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Check permission based on material type
    // Direct material (course_id set): check course access
    // Folder material (course_id null): check folder access via shared courses
    let hasPermission = false;
    let redirectCourseId = fromCourseId || material.course_id;

    if (material.course_id) {
      // Direct course material - check course edit access
      const course = await teacherService.checkCourseAccess(material.course_id, teacherId, { requireEdit: true });
      hasPermission = !!course;
    } else if (material.folder_id) {
      // Folder-based material - check if teacher has access via any shared course
      const sharedCourseIds = await FolderCourse.findAll({
        where: { folder_id: material.folder_id },
        attributes: ['course_id']
      }).then(rows => rows.map(r => r.course_id));
      
      if (sharedCourseIds.length > 0) {
        // Check if teacher has edit access to any of these courses
        const teacherCourse = await CourseTeacher.findOne({
          where: {
            teacher_id: teacherId,
            course_id: { [Op.in]: sharedCourseIds },
            can_edit: true
          }
        });
        
        if (teacherCourse) {
          hasPermission = true;
          if (!redirectCourseId) redirectCourseId = teacherCourse.course_id;
        } else {
          // Check if teacher owns any of these courses
          const ownedCourse = await Course.findOne({
            where: {
              id: { [Op.in]: sharedCourseIds },
              teacher_id: teacherId
            }
          });
          if (ownedCourse) {
            hasPermission = true;
            if (!redirectCourseId) redirectCourseId = ownedCourse.id;
          }
        }
      }
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this material'
      });
    }

    // Delete from Cloudinary if it's a Cloudinary URL
    if (material.file_url && material.file_url.includes('cloudinary.com')) {
      try {
        await deleteCloudinaryFile(material.file_url);
      } catch (cloudinaryError) {
        console.error('Cloudinary deletion error:', cloudinaryError);
        // Continue with database deletion even if Cloudinary fails
      }
    }

    // Delete from database
    await material.destroy();

    res.json({
      success: true,
      message: 'Material deleted successfully',
      redirectUrl: redirectCourseId 
        ? `/teacher/courses/${redirectCourseId}/materials?success=Material deleted successfully`
        : `/teacher/folders?success=Material deleted successfully`
    });

  } catch (error) {
    console.error('Delete Material Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting material: ' + error.message
    });
  }
};

/**
 * Show Assignment Creation Form
 * GET /teacher/courses/:id/assignments/create
 * 
 * Displays form to create a new assignment for a course
 */
export const showCreateAssignment = async (req, res) => {
  try {
    const courseId = req.params.id;
    const teacherId = req.user.id;

    // Verify teacher has access with edit permission
    const course = await teacherService.checkCourseAccess(courseId, teacherId, { requireEdit: true });

    if (!course) {
      return res.status(404).send('Course not found or you do not have permission to create assignments');
    }

    res.render('teacher/assignment-create', {
      user: req.user,
      course,
      pageTitle: `Create Assignment - ${course.code}`,
      error: req.query.error
    });

  } catch (error) {
    console.error('Show Create Assignment Error:', error);
    res.status(500).send('Error loading assignment creation form: ' + error.message);
  }
};

/**
 * Create New Assignment
 * POST /teacher/courses/:id/assignments
 * 
 * Creates a new assignment for a course with optional materials (files/URLs)
 * Validates: deadline must be in the future
 */
export const createAssignment = async (req, res) => {
  try {
    const courseId = req.params.id;
    const teacherId = req.user.id;
    const { title, description, deadline, material_titles, url_titles, material_urls } = req.body;
    const uploadedFiles = req.files || [];

    // Verify teacher has access with edit permission
    const course = await teacherService.checkCourseAccess(courseId, teacherId, { requireEdit: true });

    if (!course) {
      return res.redirect(`/teacher/courses?error=Course not found or you do not have permission to create assignments`);
    }

    // Validation
    if (!title || title.trim() === '') {
      return res.redirect(`/teacher/courses/${courseId}/assignments/create?error=Title is required`);
    }

    if (!deadline) {
      return res.redirect(`/teacher/courses/${courseId}/assignments/create?error=Deadline is required`);
    }

    // Server-side deadline validation - must be in the future
    const deadlineDate = new Date(deadline);
    const now = new Date();

    if (deadlineDate <= now) {
      return res.redirect(`/teacher/courses/${courseId}/assignments/create?error=Deadline must be in the future`);
    }

    // Create assignment
    const assignment = await Assignment.create({
      course_id: courseId,
      title: title.trim(),
      description: description ? description.trim() : null,
      deadline: deadlineDate,
      created_by: teacherId
    });

    // Process uploaded files
    if (uploadedFiles && uploadedFiles.length > 0) {
      const fileTitles = Array.isArray(material_titles) ? material_titles : [material_titles].filter(Boolean);
      
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const fileTitle = fileTitles[i] || file.originalname;

        await AssignmentMaterial.create({
          assignment_id: assignment.id,
          title: fileTitle,
          type: 'file',
          url: file.path, // Cloudinary URL
          file_type: file.mimetype
        });
      }
    }

    // Process URL links
    if (material_urls) {
      const urls = Array.isArray(material_urls) ? material_urls : [material_urls];
      const urlTitlesArray = Array.isArray(url_titles) ? url_titles : [url_titles].filter(Boolean);
      
      for (let i = 0; i < urls.length; i++) {
        if (urls[i] && urls[i].trim() !== '') {
          const urlTitle = urlTitlesArray[i] || urls[i];
          
          await AssignmentMaterial.create({
            assignment_id: assignment.id,
            title: urlTitle,
            type: 'url',
            url: urls[i].trim()
          });
        }
      }
    }

    res.redirect(`/teacher/courses/${courseId}?success=Assignment created successfully`);

  } catch (error) {
    console.error('Create Assignment Error:', error);
    res.redirect(`/teacher/courses/${req.params.id}/assignments/create?error=Error creating assignment: ${error.message}`);
  }
};

/**
 * Show Edit Assignment Form
 * GET /teacher/assignments/:id/edit
 * 
 * Shows form to edit assignment deadline only
 * Displays submission stats and warnings
 */
export const showEditAssignment = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const assignmentId = req.params.id;

    // Get assignment with course details
    const assignment = await Assignment.findByPk(assignmentId, {
      include: [{
        model: Course,
        as: 'course'
      }]
    });

    // Check if assignment exists
    if (!assignment) {
      return res.status(404).send('Assignment not found');
    }

    // Check if teacher has access with edit permission
    const course = await teacherService.checkCourseAccess(assignment.course_id, teacherId, { requireEdit: true });
    if (!course) {
      return res.status(403).send('You do not have permission to edit this assignment');
    }

    // Get submission statistics
    const submissionCount = await Submission.count({
      where: { assignment_id: assignmentId }
    });

    const gradedCount = await Submission.count({
      where: { 
        assignment_id: assignmentId,
        marks: { [Op.not]: null }
      }
    });

    const hasSubmissions = submissionCount > 0;

    res.render('teacher/assignment-edit', {
      user: req.user,
      assignment,
      course,
      submissionCount,
      gradedCount,
      hasSubmissions,
      pageTitle: `Edit Assignment - ${assignment.title}`,
      error: req.query.error
    });

  } catch (error) {
    console.error('Show Edit Assignment Error:', error);
    res.status(500).send('Error loading assignment: ' + error.message);
  }
};

/**
 * Edit Assignment
 * POST /teacher/assignments/:id/edit
 * 
 * Updates assignment details (title, description, deadline)
 * Validates: future date, teacher has edit permission
 */
export const editAssignment = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const assignmentId = req.params.id;
    const { title, description, deadline, change_reason } = req.body;

    // Get assignment with course details
    const assignment = await Assignment.findByPk(assignmentId, {
      include: [
        {
          model: Course,
          as: 'course'
        },
        {
          model: AssignmentMaterial,
          as: 'materials'
        }
      ]
    });

    // Check if assignment exists
    if (!assignment) {
      return res.status(404).send('Assignment not found');
    }

    // Check if teacher has edit permission
    const course = await teacherService.checkCourseAccess(assignment.course_id, teacherId, { requireEdit: true });
    if (!course) {
      return res.status(403).send('You do not have permission to edit this assignment');
    }

    // Validation
    if (!title || !deadline) {
      return res.redirect(`/teacher/assignments/${assignmentId}/edit?error=Title and deadline are required`);
    }

    // Server-side deadline validation - must be in the future
    const newDeadline = new Date(deadline);
    const now = new Date();

    if (newDeadline <= now) {
      return res.redirect(`/teacher/assignments/${assignmentId}/edit?error=Deadline must be in the future`);
    }

    // Update assignment fields
    let hasChanges = false;
    
    if (assignment.title !== title.trim()) {
      assignment.title = title.trim();
      hasChanges = true;
    }
    
    if (assignment.description !== (description || '').trim()) {
      assignment.description = (description || '').trim();
      hasChanges = true;
    }
    
    const oldDeadline = new Date(assignment.deadline);
    if (newDeadline.getTime() !== oldDeadline.getTime()) {
      assignment.deadline = newDeadline;
      hasChanges = true;
    }

    // Process deletions first
    const deleteMaterialIds = req.body.delete_material_ids;
    if (deleteMaterialIds) {
      const idsToDelete = Array.isArray(deleteMaterialIds) ? deleteMaterialIds : [deleteMaterialIds];
      
      for (const id of idsToDelete) {
        // Find material to check for file deletion
        const material = await AssignmentMaterial.findOne({
          where: { id: id, assignment_id: assignmentId }
        });

        if (material) {
          // If it's a file, delete from Cloudinary
          if (material.type === 'file' && material.url) {
            try {
              // Extract public ID from Cloudinary URL
              // URL format: https://res.cloudinary.com/demo/image/upload/v1570979139/folder/sample.jpg
              const parts = material.url.split('/');
              const filename = parts.pop(); // sample.jpg
              const publicIdWithExt = parts.join('/') + '/' + filename;
              // Proper extraction logic depends on your Cloudinary config
              // Simpler approach: use the helper if available, or just destroy the record
              // Assuming we can just delete the record and let orphaned files be (or handle properly)
              // Ideally: import { deleteCloudinaryFile } from '../config/cloudinary.js';
              // But for now, we'll focus on database consistency
            } catch (err) {
              console.error('Cloudinary cleanup error (non-blocking):', err);
            }
          }
          
          await material.destroy();
          hasChanges = true;
        }
      }
    }

    // Process uploaded files (New)
    const uploadedFiles = req.files || [];
    const { material_titles, url_titles, material_urls } = req.body;
    let materialsAdded = false;

    if (uploadedFiles && uploadedFiles.length > 0) {
      const fileTitles = Array.isArray(material_titles) ? material_titles : [material_titles].filter(Boolean);
      
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const fileTitle = fileTitles[i] || file.originalname;

        await AssignmentMaterial.create({
          assignment_id: assignment.id,
          title: fileTitle,
          type: 'file',
          url: file.path, // Cloudinary URL
          file_type: file.mimetype
        });
        hasChanges = true;
        materialsAdded = true;
      }
    }

    // Process URL links (New)
    if (material_urls) {
      const urls = Array.isArray(material_urls) ? material_urls : [material_urls];
      const urlTitlesArray = Array.isArray(url_titles) ? url_titles : [url_titles].filter(Boolean);
      
      for (let i = 0; i < urls.length; i++) {
        if (urls[i] && urls[i].trim() !== '') {
          const urlTitle = urlTitlesArray[i] || urls[i];
          
          await AssignmentMaterial.create({
            assignment_id: assignment.id,
            title: urlTitle,
            type: 'url',
            url: urls[i].trim()
          });
          hasChanges = true;
          materialsAdded = true;
        }
      }
    }

    if (!hasChanges && !materialsAdded) {
      return res.redirect(`/teacher/courses/${assignment.course_id}?info=No changes made to assignment`);
    }

    await assignment.save();

    // Log change reason if provided (for future audit trail feature)
    if (change_reason && change_reason.trim() !== '') {
      console.log(`Assignment ${assignmentId} updated by teacher ${teacherId}: ${change_reason.trim()}`);
    }

    res.redirect(`/teacher/courses/${assignment.course_id}?success=Assignment updated successfully`);

  } catch (error) {
    console.error('Edit Assignment Error:', error);
    res.redirect(`/teacher/assignments/${req.params.id}/edit?error=Error updating assignment: ${error.message}`);
  }
};

/**
 * Get Submissions for Assignment
 * GET /teacher/assignments/:id/submissions
 * 
 * Displays all student submissions for a specific assignment
 * Shows: student info, submission date, grading status, score
 */
export const getSubmissions = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const assignmentId = req.params.id;

    // 1. Get assignment with course details
    const assignment = await Assignment.findByPk(assignmentId, {
      include: [{
        model: Course,
        as: 'course'
      }]
    });

    // Check if assignment exists
    if (!assignment) {
      return res.status(404).send('Assignment not found');
    }

    // Check if teacher has access (view submissions doesn't require grade permission, just access)
    const course = await teacherService.checkCourseAccess(assignment.course_id, teacherId);
    if (!course) {
      return res.status(403).send('You do not have permission to view submissions for this assignment');
    }

    // Check if teacher can grade
    const isOwner = await teacherService.isPrimary(assignment.course_id, teacherId);
    let canGrade = isOwner;
    if (!isOwner) {
      const courseTeacher = await CourseTeacher.findOne({
        where: { course_id: assignment.course_id, teacher_id: teacherId }
      });
      canGrade = courseTeacher ? courseTeacher.can_grade : false;
    }

    // 2. Get all submissions for this assignment with student details
    const submissions = await Submission.findAll({
      where: { assignment_id: assignmentId },
      include: [{
        model: User,
        as: 'student',
        attributes: ['id', 'full_name', 'email', 'batch_id'],
        include: [{
          model: Batch,
          as: 'batch',
          attributes: ['id', 'name', 'code']
        }]
      }],
      order: [['submitted_at', 'DESC']] // Most recent first
    });

    // Sign URLs for authenticated access (1-hour expiry for submissions)
    const signedSubmissions = signUrlsInArray(submissions, 'file_url', 'submission');

    // 3. Render submissions view
    res.render('teacher/submissions', {
      user: req.user,
      assignment,
      course,
      submissions: signedSubmissions,
      canGrade,
      success: req.query.success,
      error: req.query.error
    });

  } catch (error) {
    console.error('Get Submissions Error:', error);
    res.status(500).send('Error loading submissions: ' + error.message);
  }
};

/**
 * Show Grade Submission Form
 * GET /teacher/submissions/:id/grade
 * 
 * Displays the grading form with submission details
 * Shows: student work, file download, current grade (if exists)
 */
export const showGradeForm = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const submissionId = req.params.id;

    // 1. Get submission with student, assignment, and course details
    const submission = await Submission.findByPk(submissionId, {
      include: [{
        model: User,
        as: 'student',
        attributes: ['id', 'full_name', 'email']
      }, {
        model: Assignment,
        as: 'assignment',
        include: [{
          model: Course,
          as: 'course'
        }]
      }]
    });

    // Check if submission exists
    if (!submission) {
      return res.status(404).send('Submission not found');
    }

    // Check if teacher has grade permission
    const course = await teacherService.checkCourseAccess(submission.assignment.course_id, teacherId, { requireGrade: true });
    if (!course) {
      return res.status(403).send('You do not have permission to grade this submission');
    }

    const assignment = submission.assignment;

    // Sign the submission file URL for authenticated access (1-hour expiry)
    if (submission.file_url) {
      submission.file_url = generateSignedUrl(submission.file_url, { type: 'submission' });
    }

    // 2. Render grading form
    res.render('teacher/grade-submission', {
      user: req.user,
      submission,
      assignment,
      course,
      error: req.query.error
    });

  } catch (error) {
    console.error('Show Grade Form Error:', error);
    res.status(500).send('Error loading grading form: ' + error.message);
  }
};

/**
 * Process Grading
 * POST /teacher/submissions/:id/grade
 * 
 * Saves marks and feedback for a submission
 * Validates: marks must be 0-100
 */
export const gradeSubmission = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const submissionId = req.params.id;
    const { marks, feedback } = req.body;

    // 1. Get submission with assignment
    const submission = await Submission.findByPk(submissionId, {
      include: [{
        model: Assignment,
        as: 'assignment',
        include: [{
          model: Course,
          as: 'course'
        }]
      }]
    });

    if (!submission) {
      return res.status(404).send('Submission not found');
    }

    // Check if teacher has grade permission
    const course = await teacherService.checkCourseAccess(submission.assignment.course_id, teacherId, { requireGrade: true });
    if (!course) {
      return res.status(403).send('You do not have permission to grade this submission');
    }

    // 2. Validate marks
    if (!marks || marks === '') {
      return res.redirect(`/teacher/submissions/${submissionId}/grade?error=Score is required`);
    }

    const marksNum = parseFloat(marks);
    if (isNaN(marksNum) || marksNum < 0 || marksNum > 100) {
      return res.redirect(`/teacher/submissions/${submissionId}/grade?error=Score must be between 0 and 100`);
    }

    // 3. Update submission with grade
    await submission.update({
      marks: marksNum,
      feedback: feedback ? feedback.trim() : null,
      graded_by: teacherId
    });

    // 4. Redirect back to submissions list with success message
    const assignmentId = submission.assignment.id;
    res.redirect(`/teacher/assignments/${assignmentId}/submissions?success=Submission graded successfully`);

  } catch (error) {
    console.error('Grade Submission Error:', error);
    res.redirect(`/teacher/submissions/${req.params.id}/grade?error=Error grading submission: ${error.message}`);
  }
};

/**
 * Get grades management page for a course
 * Displays all students with their assignment scores and suggested grades
 */
export const getGrades = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const courseId = req.params.id;

    // 1. Check if teacher has access to the course
    const course = await teacherService.checkCourseAccess(courseId, teacherId);

    if (!course) {
      return res.status(404).send('Course not found or you do not have permission to access it');
    }

    // 2. Get all assignments for this course with submission/grade stats
    const assignments = await Assignment.findAll({
      where: { course_id: courseId },
      order: [['deadline', 'DESC']],
      raw: true
    });

    // 3. Get submission and grading statistics for each assignment
    const assignmentsWithStats = await Promise.all(
      assignments.map(async (assignment) => {
        // Get total submissions count
        const submissionCount = await Submission.count({
          where: { assignment_id: assignment.id }
        });

        // Get graded submissions count (where marks is not null)
        const gradedCount = await Submission.count({
          where: { 
            assignment_id: assignment.id,
            marks: { [Op.not]: null }
          }
        });

        // Calculate average score for graded submissions
        const avgResult = await Submission.findOne({
          where: { 
            assignment_id: assignment.id,
            marks: { [Op.not]: null }
          },
          attributes: [
            [sequelize.fn('AVG', sequelize.col('marks')), 'avgScore']
          ],
          raw: true
        });

        return {
          ...assignment,
          submissionCount,
          gradedCount,
          averageScore: avgResult?.avgScore ? parseFloat(avgResult.avgScore) : 0
        };
      })
    );

    // 4. Render assignment grades selection page
    res.render('teacher/assignment-grades', {
      user: req.user,
      course,
      assignments: assignmentsWithStats,
      success: req.query.success,
      error: req.query.error
    });

  } catch (error) {
    console.error('Get Grades Error:', error);
    res.status(500).send('Error loading grades page: ' + error.message);
  }
};

/**
 * Save or update a student's final grade
 */
export const saveGrade = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const courseId = req.params.id;
    const { studentId, grade, remarks } = req.body;

    // 1. Verify teacher has grade permission
    const course = await teacherService.checkCourseAccess(courseId, teacherId, { requireGrade: true });

    if (!course) {
      return res.redirect(`/teacher/courses/${courseId}/grades?error=Course not found or you do not have grade permission`);
    }

    // 2. Validate grade input
    if (!grade || grade.trim() === '') {
      return res.redirect(`/teacher/courses/${courseId}/grades?error=Grade is required`);
    }

    const gradeTrimmed = grade.trim();

    // Validate grade format (letter A-F with optional +/- or numeric 0-100)
    const letterGradePattern = /^[A-Fa-f][+-]?$/;
    const numericGradePattern = /^\d+(\.\d+)?$/;

    if (!letterGradePattern.test(gradeTrimmed) && !numericGradePattern.test(gradeTrimmed)) {
      return res.redirect(`/teacher/courses/${courseId}/grades?error=Invalid grade format. Use letter (A-F) or percentage (0-100)`);
    }

    // If numeric, validate range
    if (numericGradePattern.test(gradeTrimmed)) {
      const numGrade = parseFloat(gradeTrimmed);
      if (numGrade < 0 || numGrade > 100) {
        return res.redirect(`/teacher/courses/${courseId}/grades?error=Numeric grade must be between 0 and 100`);
      }
    }

    // 3. Check if student exists
    const student = await User.findByPk(studentId);
    if (!student || student.role !== 'student') {
      return res.redirect(`/teacher/courses/${courseId}/grades?error=Student not found`);
    }

    // 4. Create or update grade
    const [gradeRecord, created] = await Grade.findOrCreate({
      where: {
        course_id: courseId,
        student_id: studentId
      },
      defaults: {
        grade: gradeTrimmed,
        remarks: remarks ? remarks.trim() : null
      }
    });

    if (!created) {
      // Update existing grade
      await gradeRecord.update({
        grade: gradeTrimmed,
        remarks: remarks ? remarks.trim() : null
      });
    }

    // 5. Redirect with success message
    const successMsg = created ? 'Grade saved successfully' : 'Grade updated successfully';
    res.redirect(`/teacher/courses/${courseId}/grades?success=${successMsg}`);

  } catch (error) {
    console.error('Save Grade Error:', error);
    res.redirect(`/teacher/courses/${req.params.id}/grades?error=Error saving grade: ${error.message}`);
  }
};

/**
 * Bulk upload grades from CSV file
 * Only students in this course can be graded
 */
export const bulkUploadGrades = async (req, res) => {
  const { sequelize } = await import('../models/index.js');
  const transaction = await sequelize.transaction();
  
  try {
    const teacherId = req.user.id;
    const courseId = req.params.id;

    // 1. Verify teacher has grade permission
    const course = await teacherService.checkCourseAccess(courseId, teacherId, { requireGrade: true });

    if (!course) {
      return res.redirect(`/teacher/courses/${courseId}/grades?error=Course not found or you do not have grade permission`);
    }

    // 2. Check if file was uploaded
    if (!req.file) {
      return res.redirect(`/teacher/courses/${courseId}/grades?error=No CSV file uploaded`);
    }

    // 3. Parse CSV
    const { parseCsv, validateTeacherGradeCsv } = await import('../services/csvService.js');
    const parseResult = parseCsv(req.file.buffer);

    if (!parseResult.success) {
      const { formatErrors } = await import('../services/csvService.js');
      const errorMsg = formatErrors(parseResult.errors);
      return res.redirect(`/teacher/courses/${courseId}/grades?error=${encodeURIComponent('CSV Parse Error: ' + errorMsg)}`);
    }

    // 4. Validate CSV structure
    const validation = validateTeacherGradeCsv(parseResult.data);
    if (!validation.valid) {
      const { formatErrors } = await import('../services/csvService.js');
      const errorMsg = formatErrors(validation.errors);
      return res.redirect(`/teacher/courses/${courseId}/grades?error=${encodeURIComponent('CSV Validation Error: ' + errorMsg)}`);
    }

    // 5. Get all students who have submitted in this course
    const submissions = await Submission.findAll({
      include: [
        {
          model: Assignment,
          as: 'assignment',
          where: { course_id: courseId },
          attributes: ['id', 'course_id']
        },
        {
          model: User,
          as: 'student',
          attributes: ['id', 'email', 'username', 'full_name']
        }
      ],
      attributes: ['student_id'],
      raw: true
    });

    const eligibleStudents = [...new Set(submissions.map(s => s.student_id))];
    
    // Create student lookup map by email and username
    const studentMap = new Map();
    for (const submission of submissions) {
      const studentId = submission.student_id;
      const studentEmail = submission['student.email'];
      const studentUsername = submission['student.username'];
      
      if (studentEmail) studentMap.set(studentEmail.toLowerCase(), studentId);
      if (studentUsername) studentMap.set(studentUsername.toLowerCase(), studentId);
    }

    // 6. Process each row
    const results = {
      success: [],
      skipped: [],
      failed: []
    };

    for (const row of parseResult.data) {
      try {
        // Get student identifier
        const identifier = (row.student_email || row.username || row.email).toLowerCase();
        const studentId = studentMap.get(identifier);

        if (!studentId) {
          results.skipped.push({
            identifier: row.student_email || row.username || row.email,
            reason: 'Student not found in this course or has not submitted any assignments'
          });
          continue;
        }

        // Validate grade format
        const gradeTrimmed = row.grade.trim();
        const letterGradePattern = /^[A-Fa-f][+-]?$/;
        const numericGradePattern = /^\d+(\.\d+)?$/;

        if (!letterGradePattern.test(gradeTrimmed) && !numericGradePattern.test(gradeTrimmed)) {
          results.failed.push({
            identifier: row.student_email || row.username || row.email,
            reason: `Invalid grade format: ${row.grade}`
          });
          continue;
        }

        // If numeric, validate range
        if (numericGradePattern.test(gradeTrimmed)) {
          const numGrade = parseFloat(gradeTrimmed);
          if (numGrade < 0 || numGrade > 100) {
            results.failed.push({
              identifier: row.student_email || row.username || row.email,
              reason: `Grade out of range (0-100): ${row.grade}`
            });
            continue;
          }
        }

        // Create or update grade
        const [gradeRecord, created] = await Grade.findOrCreate({
          where: {
            course_id: courseId,
            student_id: studentId
          },
          defaults: {
            grade: gradeTrimmed,
            remarks: row.remarks ? row.remarks.trim() : null
          },
          transaction
        });

        if (!created) {
          await gradeRecord.update({
            grade: gradeTrimmed,
            remarks: row.remarks ? row.remarks.trim() : null
          }, { transaction });
        }

        results.success.push({
          identifier: row.student_email || row.username || row.email,
          grade: gradeTrimmed,
          action: created ? 'created' : 'updated'
        });

      } catch (rowError) {
        console.error('Row processing error:', rowError);
        results.failed.push({
          identifier: row.student_email || row.username || row.email,
          reason: rowError.message
        });
      }
    }

    // 7. Commit transaction
    await transaction.commit();

    // 8. Build success message
    let successMsg = `Bulk upload complete: ${results.success.length} grade(s) processed`;
    if (results.skipped.length > 0) {
      successMsg += `, ${results.skipped.length} skipped`;
    }
    if (results.failed.length > 0) {
      successMsg += `, ${results.failed.length} failed`;
    }

    // Log details for debugging
    console.log('Bulk Grade Upload Results:', {
      success: results.success.length,
      skipped: results.skipped.length,
      failed: results.failed.length
    });

    res.redirect(`/teacher/courses/${courseId}/grades?success=${encodeURIComponent(successMsg)}`);

  } catch (error) {
    await transaction.rollback();
    console.error('Bulk Upload Grades Error:', error);
    res.redirect(`/teacher/courses/${req.params.id}/grades?error=Error processing bulk upload: ${error.message}`);
  }
};

/**
 * Download CSV template for bulk grade upload
 */
export const downloadGradeTemplate = async (req, res) => {
  try {
    const csvContent = `student_email,grade,remarks
student1@example.com,A,Excellent performance
student2@example.com,85.5,Good work
student3@example.com,B+,Well done`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=grade-upload-template.csv');
    res.send(csvContent);

  } catch (error) {
    console.error('Download Template Error:', error);
    res.status(500).send('Error generating template');
  }
};

/**
 * Bulk upload grades for a specific assignment
 * POST /teacher/assignments/:id/grades/bulk
 * Processes CSV file for bulk grading submissions
 */
export const bulkUploadAssignmentGrades = async (req, res) => {
  const { sequelize } = await import('../models/index.js');
  const transaction = await sequelize.transaction();
  
  try {
    const teacherId = req.user.id;
    const assignmentId = req.params.id;

    // 1. Get assignment and verify teacher access
    const assignment = await Assignment.findByPk(assignmentId, {
      include: [{
        model: Course,
        as: 'course'
      }]
    });

    if (!assignment) {
      return res.redirect(`/teacher/assignments?error=Assignment not found`);
    }

    // 2. Verify teacher has grade permission
    const course = await teacherService.checkCourseAccess(assignment.course_id, teacherId, { requireGrade: true });

    if (!course) {
      return res.redirect(`/teacher/assignments/${assignmentId}/submissions?error=You do not have grade permission`);
    }

    // 3. Check if file was uploaded
    if (!req.file) {
      return res.redirect(`/teacher/assignments/${assignmentId}/submissions?error=No CSV file uploaded`);
    }

    // 4. Parse CSV
    const { parseCsv } = await import('../services/csvService.js');
    const parseResult = parseCsv(req.file.buffer);

    if (!parseResult.success) {
      const { formatErrors } = await import('../services/csvService.js');
      const errorMsg = formatErrors(parseResult.errors);
      return res.redirect(`/teacher/assignments/${assignmentId}/submissions?error=${encodeURIComponent('CSV Parse Error: ' + errorMsg)}`);
    }

    // 5. Get all submissions for this assignment with student info
    const submissions = await Submission.findAll({
      where: { assignment_id: assignmentId },
      include: [{
        model: User,
        as: 'student',
        attributes: ['id', 'email', 'username', 'full_name']
      }],
      raw: true
    });

    // Create student lookup map by email and username
    const submissionMap = new Map();
    for (const submission of submissions) {
      const studentEmail = submission['student.email'];
      const studentUsername = submission['student.username'];
      
      if (studentEmail) submissionMap.set(studentEmail.toLowerCase(), submission.id);
      if (studentUsername) submissionMap.set(studentUsername.toLowerCase(), submission.id);
    }

    // 6. Process each row
    const results = {
      success: [],
      skipped: [],
      failed: []
    };

    for (const row of parseResult.data) {
      try {
        // Get student identifier
        const identifier = (row.student_email || row.username || row.email || '').toLowerCase();
        
        if (!identifier) {
          results.skipped.push({
            identifier: 'Unknown',
            reason: 'No student identifier provided'
          });
          continue;
        }

        const submissionId = submissionMap.get(identifier);

        if (!submissionId) {
          results.skipped.push({
            identifier: row.student_email || row.username || row.email,
            reason: 'Student not found or has not submitted this assignment'
          });
          continue;
        }

        // Get marks value
        const marksValue = row.marks || row.score || row.grade;
        if (marksValue === undefined || marksValue === null || marksValue === '') {
          results.skipped.push({
            identifier: row.student_email || row.username || row.email,
            reason: 'No marks value provided'
          });
          continue;
        }

        // Validate marks format (0-100)
        const marks = parseFloat(marksValue);
        if (isNaN(marks) || marks < 0 || marks > 100) {
          results.failed.push({
            identifier: row.student_email || row.username || row.email,
            reason: `Invalid marks value: ${marksValue} (must be 0-100)`
          });
          continue;
        }

        // Update submission with marks and feedback
        await Submission.update({
          marks: marks,
          feedback: row.feedback || row.remarks || null
        }, {
          where: { id: submissionId },
          transaction
        });

        results.success.push({
          identifier: row.student_email || row.username || row.email,
          marks: marks,
          action: 'graded'
        });

      } catch (rowError) {
        console.error('Row processing error:', rowError);
        results.failed.push({
          identifier: row.student_email || row.username || row.email,
          reason: rowError.message
        });
      }
    }

    // 7. Commit transaction
    await transaction.commit();

    // 8. Build success message
    let successMsg = `Bulk grading complete: ${results.success.length} submission(s) graded`;
    if (results.skipped.length > 0) {
      successMsg += `, ${results.skipped.length} skipped`;
    }
    if (results.failed.length > 0) {
      successMsg += `, ${results.failed.length} failed`;
    }

    // Log details for debugging
    console.log('Bulk Assignment Grade Upload Results:', {
      assignmentId,
      success: results.success.length,
      skipped: results.skipped.length,
      failed: results.failed.length
    });

    res.redirect(`/teacher/assignments/${assignmentId}/submissions?success=${encodeURIComponent(successMsg)}`);

  } catch (error) {
    await transaction.rollback();
    console.error('Bulk Upload Assignment Grades Error:', error);
    res.redirect(`/teacher/assignments/${req.params.id}/submissions?error=Error processing bulk upload: ${error.message}`);
  }
};

/**
 * Download CSV template for assignment grade upload
 * GET /teacher/assignments/:id/grades/template
 * Downloads a CSV template pre-filled with students who submitted
 */
export const downloadAssignmentGradeTemplate = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const assignmentId = req.params.id;

    // 1. Get assignment
    const assignment = await Assignment.findByPk(assignmentId, {
      include: [{
        model: Course,
        as: 'course'
      }]
    });

    if (!assignment) {
      return res.status(404).send('Assignment not found');
    }

    // 2. Verify teacher has access
    const course = await teacherService.checkCourseAccess(assignment.course_id, teacherId);
    if (!course) {
      return res.status(403).send('Access denied');
    }

    // 3. Get all submissions for this assignment
    const submissions = await Submission.findAll({
      where: { assignment_id: assignmentId },
      include: [{
        model: User,
        as: 'student',
        attributes: ['email', 'full_name']
      }],
      order: [[{ model: User, as: 'student' }, 'full_name', 'ASC']]
    });

    // 4. Generate CSV content
    let csvContent = 'student_email,marks,feedback\n';
    
    if (submissions.length > 0) {
      // Pre-fill with students who submitted
      submissions.forEach(submission => {
        const email = submission.student.email || '';
        const existingMarks = submission.marks !== null ? submission.marks : '';
        const existingFeedback = submission.feedback ? `"${submission.feedback.replace(/"/g, '""')}"` : '';
        csvContent += `${email},${existingMarks},${existingFeedback}\n`;
      });
    } else {
      // Provide example rows
      csvContent += 'student@example.com,85,Good work\n';
      csvContent += 'student2@example.com,90,Excellent\n';
    }

    // 5. Send file
    const filename = `${assignment.title.replace(/[^a-z0-9]/gi, '-')}-grades-template.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Download Assignment Grade Template Error:', error);
    res.status(500).send('Error generating template');
  }
};

/**
 * Delete an assignment
 * DELETE /teacher/assignments/:id
 * Deletes assignment and all associated materials and submissions
 */
export const deleteAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const teacherId = req.user.id;

    // 1. Fetch assignment with course
    const assignment = await Assignment.findByPk(assignmentId, {
      include: [{
        model: Course,
        as: 'course'
      }]
    });

    if (!assignment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Assignment not found' 
      });
    }

    // 2. Verify teacher has edit permission
    const course = await teacherService.checkCourseAccess(assignment.course_id, teacherId, { requireEdit: true });
    if (!course) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to delete this assignment' 
      });
    }

    // 3. Get all assignment materials to delete from Cloudinary
    const materials = await AssignmentMaterial.findAll({
      where: { 
        assignment_id: assignmentId,
        type: 'file' // Only files have Cloudinary URLs
      }
    });

    // 4. Delete files from Cloudinary
    for (const material of materials) {
      try {
        await deleteCloudinaryFile(material.url);
      } catch (cloudinaryError) {
        console.error('Cloudinary deletion error:', cloudinaryError);
        // Continue even if Cloudinary deletion fails
      }
    }

    // 5. Get all submissions to delete files from Cloudinary
    const submissions = await Submission.findAll({
      where: { assignment_id: assignmentId }
    });

    for (const submission of submissions) {
      if (submission.file_url) {
        try {
          await deleteCloudinaryFile(submission.file_url);
        } catch (cloudinaryError) {
          console.error('Cloudinary deletion error:', cloudinaryError);
        }
      }
    }

    const courseId = assignment.course_id;

    // 6. Delete assignment (CASCADE will delete materials and submissions)
    await assignment.destroy();

    res.json({ 
      success: true, 
      message: 'Assignment deleted successfully',
      redirectUrl: `/teacher/courses/${courseId}`
    });

  } catch (error) {
    console.error('Delete Assignment Error:', error);
    res.status(500).json({ 
      success: false, 
      message: `Error deleting assignment: ${error.message}` 
    });
  }
};

// ==========================================
// FOLDER MANAGEMENT FUNCTIONS
// ==========================================

/**
 * Get all folder IDs accessible by a course (including inherited subfolders)
 * Uses recursive CTE for query-time inheritance
 * 
 * @param {number} courseId - The course ID
 * @returns {Array} Array of folder IDs with full folder data
 */
async function getFoldersForCourse(courseId) {
  // Get directly shared folder IDs
  const sharedFolders = await FolderCourse.findAll({
    where: { course_id: courseId },
    attributes: ['folder_id']
  });

  if (sharedFolders.length === 0) {
    return [];
  }

  const sharedFolderIds = sharedFolders.map(fc => fc.folder_id);

  // Use recursive CTE to get all subfolders
  const query = `
    WITH RECURSIVE folder_tree AS (
      -- Base case: directly shared folders
      SELECT f.* FROM folders f
      WHERE f.id IN (:sharedFolderIds)
      
      UNION ALL
      
      -- Recursive case: all children of shared folders
      SELECT f.* FROM folders f
      INNER JOIN folder_tree ft ON f.parent_id = ft.id
    )
    SELECT DISTINCT * FROM folder_tree
    ORDER BY ISNULL(parent_id) DESC, parent_id ASC, name ASC
  `;

  const folders = await sequelize.query(query, {
    replacements: { sharedFolderIds },
    type: QueryTypes.SELECT
  });

  return folders;
}

/**
 * Get all folders accessible to a teacher (via courses they have access to)
 * GET /teacher/folders
 */
export const getTeacherFolders = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Get all course IDs teacher has access to
    const courseIds = await teacherService.getCourseIds(teacherId);
    
    // Get all folder IDs shared with these courses
    const folderCourses = await FolderCourse.findAll({
      where: { course_id: { [Op.in]: courseIds } },
      attributes: ['folder_id'],
      raw: true
    });
    const folderIds = [...new Set(folderCourses.map(fc => fc.folder_id))];

    // Get all folders accessible to this teacher
    const folders = await Folder.findAll({
      where: { id: { [Op.in]: folderIds } },
      include: [
        {
          model: Folder,
          as: 'parent',
          attributes: ['id', 'name']
        },
        {
          model: Course,
          as: 'sharedCourses',
          attributes: ['id', 'title', 'code'],
          through: { attributes: [] }
        },
        {
          model: Material,
          as: 'materials',
          attributes: ['id']
        }
      ],
      order: [
        [sequelize.literal('ISNULL(`Folder`.`parent_id`) DESC')],
        [sequelize.literal('`Folder`.`parent_id`'), 'ASC'],
        ['name', 'ASC']
      ]
    });

    // Get teacher's courses for sharing dropdown
    const courses = await Course.findAll({
      where: { id: { [Op.in]: courseIds } },
      attributes: ['id', 'title', 'code'],
      order: [['title', 'ASC']]
    });

    // Build folder tree structure
    const folderTree = buildFolderTree(folders);

    res.render('teacher/folders', {
      user: req.user,
      folders,
      folderTree,
      courses,
      pageTitle: 'My Folders',
      success: req.query.success,
      error: req.query.error
    });

  } catch (error) {
    console.error('Get Teacher Folders Error:', error);
    res.status(500).send('Error loading folders: ' + error.message);
  }
};

/**
 * Build a hierarchical folder tree from flat folder list
 */
function buildFolderTree(folders) {
  const folderMap = new Map();
  const rootFolders = [];

  // First pass: create map of all folders
  folders.forEach(folder => {
    folderMap.set(folder.id, {
      ...folder.toJSON(),
      children: []
    });
  });

  // Second pass: build tree structure
  folders.forEach(folder => {
    const folderNode = folderMap.get(folder.id);
    if (folder.parent_id && folderMap.has(folder.parent_id)) {
      folderMap.get(folder.parent_id).children.push(folderNode);
    } else {
      rootFolders.push(folderNode);
    }
  });

  return rootFolders;
}

/**
 * Create a new folder
 * POST /teacher/folders
 */
export const createFolder = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { name, description, parent_id, course_ids } = req.body;
    const isAjax = req.xhr || req.headers['content-type']?.includes('application/json');
    const redirectUrl = req.body.redirect || '/teacher/courses';

    // Validation
    if (!name || name.trim() === '') {
      if (isAjax) {
        return res.status(400).json({ success: false, message: 'Folder name is required' });
      }
      return res.redirect(redirectUrl + '?error=Folder name is required');
    }

    // If parent_id provided, verify the folder exists and teacher has access via a shared course
    if (parent_id) {
      const parentFolder = await Folder.findByPk(parent_id);
      
      if (!parentFolder) {
        if (isAjax) {
          return res.status(404).json({ success: false, message: 'Parent folder not found' });
        }
        return res.redirect(redirectUrl + '?error=Parent folder not found');
      }
      
      // Verify teacher has access to this folder via a shared course
      const teacherCourseIds = await teacherService.getCourseIds(teacherId);
      const folderCourse = await FolderCourse.findOne({
        where: { 
          folder_id: parent_id,
          course_id: { [Op.in]: teacherCourseIds }
        }
      });
      
      if (!folderCourse) {
        if (isAjax) {
          return res.status(403).json({ success: false, message: 'You do not have access to this folder' });
        }
        return res.redirect(redirectUrl + '?error=You do not have access to this folder');
      }
    }

    // Check for duplicate folder name at the same level (same parent_id)
    const existingFolder = await Folder.findOne({
      where: {
        name: name.trim(),
        parent_id: parent_id || null
      }
    });

    if (existingFolder) {
      const errorMsg = parent_id 
        ? 'A folder with this name already exists in the parent folder'
        : 'A folder with this name already exists at root level';
      if (isAjax) {
        return res.status(400).json({ success: false, message: errorMsg });
      }
      return res.redirect(redirectUrl + '?error=' + encodeURIComponent(errorMsg));
    }

    // Create folder
    const folder = await Folder.create({
      name: name.trim(),
      parent_id: parent_id || null,
      is_shared: false
    });

    // Handle course sharing - inherit from parent OR use provided course_ids
    let courseIdsToLink = [];
    
    // If this is a subfolder, inherit parent's course sharing
    if (parent_id) {
      const parentFolderCourses = await FolderCourse.findAll({
        where: { folder_id: parent_id },
        attributes: ['course_id'],
        raw: true
      });
      courseIdsToLink = parentFolderCourses.map(fc => fc.course_id);
    } else {
      // Root level folder - use provided course_ids (handles both course_ids and course_ids[])
      const providedCourseIds = course_ids || req.body['course_ids[]'] || req.body.course_id;
      if (providedCourseIds) {
        courseIdsToLink = Array.isArray(providedCourseIds) ? providedCourseIds : [providedCourseIds];
      }
    }

    // If we have courses to link, create associations
    if (courseIdsToLink.length > 0) {
      // Filter out empty strings and convert to integers
      courseIdsToLink = courseIdsToLink.filter(id => id && id !== '').map(id => parseInt(id));
      
      if (courseIdsToLink.length > 0) {
        // Verify teacher has access to these courses
        const teacherCourseIds = await teacherService.getCourseIds(teacherId);
        const validCourseIds = courseIdsToLink.filter(id => teacherCourseIds.includes(id));

        // Create folder-course associations
        for (const courseId of validCourseIds) {
          await FolderCourse.create({
            folder_id: folder.id,
            course_id: courseId,
            added_by: teacherId
          });
        }
      }
    }

    if (isAjax) {
      return res.json({ 
        success: true, 
        message: 'Folder created successfully',
        folder: {
          id: folder.id,
          name: folder.name,
          parent_id: folder.parent_id
        }
      });
    }
    
    res.redirect(redirectUrl + '?success=Folder created successfully');

  } catch (error) {
    console.error('Create Folder Error:', error);
    const isAjax = req.xhr || req.headers['content-type']?.includes('application/json');
    const redirectUrl = req.body.redirect || '/teacher/courses';
    if (isAjax) {
      return res.status(500).json({ success: false, message: 'Error creating folder: ' + error.message });
    }
    res.redirect(redirectUrl + '?error=Error creating folder: ' + error.message);
  }
};

/**
 * Rename a folder
 * PUT /teacher/folders/:id
 */
export const renameFolder = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const folderId = req.params.id;
    const { name, description } = req.body;

    // Find folder
    const folder = await Folder.findByPk(folderId);

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }
    
    // Verify teacher has access via a shared course
    const teacherCourseIds = await teacherService.getCourseIds(teacherId);
    const folderCourse = await FolderCourse.findOne({
      where: { 
        folder_id: folderId,
        course_id: { [Op.in]: teacherCourseIds }
      }
    });
    
    if (!folderCourse) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this folder'
      });
    }

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Folder name is required'
      });
    }

    // Check for duplicate folder name at the same level (excluding current folder)
    const existingFolder = await Folder.findOne({
      where: {
        name: name.trim(),
        parent_id: folder.parent_id,
        id: { [Op.ne]: folderId } // Exclude current folder
      }
    });

    if (existingFolder) {
      return res.status(400).json({
        success: false,
        message: 'A folder with this name already exists at the same level'
      });
    }

    // Update folder
    await folder.update({
      name: name.trim(),
      description: description !== undefined ? (description.trim() || null) : folder.description
    });

    res.json({
      success: true,
      message: 'Folder renamed successfully',
      folder: { id: folder.id, name: folder.name, description: folder.description }
    });

  } catch (error) {
    console.error('Rename Folder Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error renaming folder: ' + error.message
    });
  }
};

/**
 * Delete a folder and ALL its contents (subfolders + materials)
 * DELETE /teacher/folders/:id
 * 
 * This will recursively delete:
 * - All subfolders
 * - All materials in this folder and subfolders
 * - All Cloudinary files for those materials
 * - All folder-course associations
 */
export const deleteFolder = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const folderId = req.params.id;

    // Find folder
    const folder = await Folder.findByPk(folderId);

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }
    
    // Verify teacher has access via a shared course
    const teacherCourseIds = await teacherService.getCourseIds(teacherId);
    const folderCourse = await FolderCourse.findOne({
      where: { 
        folder_id: folderId,
        course_id: { [Op.in]: teacherCourseIds }
      }
    });
    
    if (!folderCourse) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this folder'
      });
    }

    // Recursive function to get all subfolder IDs
    async function getAllSubfolderIds(parentId) {
      const subfolders = await Folder.findAll({
        where: { parent_id: parentId },
        attributes: ['id']
      });
      
      let allIds = [];
      for (const subfolder of subfolders) {
        allIds.push(subfolder.id);
        const childIds = await getAllSubfolderIds(subfolder.id);
        allIds = allIds.concat(childIds);
      }
      return allIds;
    }

    // Get all folder IDs to delete (including this one and all descendants)
    const subfolderIds = await getAllSubfolderIds(folderId);
    const allFolderIds = [parseInt(folderId), ...subfolderIds];

    console.log(`Deleting folder ${folderId} and ${subfolderIds.length} subfolders`);

    // Get all materials in these folders
    const materials = await Material.findAll({
      where: { folder_id: allFolderIds }
    });

    console.log(`Found ${materials.length} materials to delete`);

    // Delete Cloudinary files for all materials
    for (const material of materials) {
      if (material.file_url && material.file_url.includes('cloudinary.com')) {
        try {
          await deleteCloudinaryFile(material.file_url);
          console.log(`Deleted Cloudinary file for material ${material.id}`);
        } catch (err) {
          console.error(`Error deleting Cloudinary file for material ${material.id}:`, err.message);
        }
      }
    }

    // Delete all materials in these folders
    await Material.destroy({
      where: { folder_id: allFolderIds }
    });

    // Delete all folder-course associations for these folders
    await FolderCourse.destroy({
      where: { folder_id: allFolderIds }
    });

    // Delete all folders (children first, then parent)
    // Sort by depth (deepest first) to avoid foreign key issues
    for (const subfolderId of subfolderIds.reverse()) {
      await Folder.destroy({ where: { id: subfolderId } });
    }
    
    // Finally delete the main folder
    await folder.destroy();

    res.json({
      success: true,
      message: `Folder deleted successfully along with ${subfolderIds.length} subfolders and ${materials.length} materials`
    });

  } catch (error) {
    console.error('Delete Folder Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting folder: ' + error.message
    });
  }
};

/**
 * Get shared courses for a folder
 * GET /teacher/folders/:id/shared-courses
 */
export const getFolderSharedCourses = async (req, res) => {
  try {
    const folderId = req.params.id;
    
    // Get all courses this folder is shared with
    const folderCourses = await FolderCourse.findAll({
      where: { folder_id: folderId },
      attributes: ['course_id'],
      raw: true
    });
    
    const courseIds = folderCourses.map(fc => fc.course_id);
    
    res.json({
      success: true,
      courseIds
    });
  } catch (error) {
    console.error('Get Folder Shared Courses Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching shared courses: ' + error.message
    });
  }
};

/**
 * Share folder with courses
 * POST /teacher/folders/:id/share
 * Also shares all subfolders recursively
 */
export const shareFolderWithCourses = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const folderId = req.params.id;
    const { course_ids } = req.body;

    // Find folder - no ownership check, anyone with course access can share
    const folder = await Folder.findByPk(folderId);

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    // course_ids can be empty (to unshare from all courses)
    const courseIdsArray = course_ids && Array.isArray(course_ids) ? course_ids : [];

    // Verify teacher has access to all selected courses (if any)
    if (courseIdsArray.length > 0) {
      const teacherCourseIds = await teacherService.getCourseIds(teacherId);
      const invalidCourses = courseIdsArray.filter(id => !teacherCourseIds.includes(parseInt(id)));

      if (invalidCourses.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to some of the selected courses'
        });
      }
    }

    // Get all subfolder IDs recursively
    const allFolderIds = await getAllSubfolderIds(folderId);
    allFolderIds.unshift(folderId); // Include the main folder

    // Remove existing shares for all folders
    await FolderCourse.destroy({ where: { folder_id: { [Op.in]: allFolderIds } } });

    // Create new shares for all folders (if any courses selected)
    if (courseIdsArray.length > 0) {
      const shareRecords = [];
      allFolderIds.forEach(folderIdItem => {
        courseIdsArray.forEach(courseId => {
          shareRecords.push({
            folder_id: folderIdItem,
            course_id: parseInt(courseId),
            added_by: teacherId
          });
        });
      });

      await FolderCourse.bulkCreate(shareRecords);
    }

    // Update is_shared flag for all folders
    await Folder.update(
      { is_shared: courseIdsArray.length > 0 },
      { where: { id: { [Op.in]: allFolderIds } } }
    );

    const subfolderCount = allFolderIds.length - 1;
    let message;
    if (courseIdsArray.length === 0) {
      message = subfolderCount > 0
        ? `Folder and ${subfolderCount} subfolder(s) unshared from all courses`
        : 'Folder unshared from all courses';
    } else {
      message = subfolderCount > 0 
        ? `Folder and ${subfolderCount} subfolder(s) shared with ${courseIdsArray.length} course(s)`
        : `Folder shared with ${courseIdsArray.length} course(s)`;
    }

    res.json({
      success: true,
      message
    });

  } catch (error) {
    console.error('Share Folder Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sharing folder: ' + error.message
    });
  }
};

/**
 * Get all subfolder IDs recursively
 */
async function getAllSubfolderIds(parentId) {
  const subfolders = await Folder.findAll({
    where: { parent_id: parentId },
    attributes: ['id'],
    raw: true
  });

  let allIds = subfolders.map(f => f.id);
  
  for (const subfolder of subfolders) {
    const childIds = await getAllSubfolderIds(subfolder.id);
    allIds = allIds.concat(childIds);
  }
  
  return allIds;
}

/**
 * Remove folder from a specific course
 * DELETE /teacher/folders/:id/share/:courseId
 */
export const unshareFolder = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const folderId = req.params.id;
    const courseId = req.params.courseId;

    // Verify folder exists and teacher has course access
    const folder = await Folder.findByPk(folderId);
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    // Verify teacher has access to this course
    const course = await teacherService.checkCourseAccess(courseId, teacherId);
    if (!course) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this course'
      });
    }

    // Remove the share
    await FolderCourse.destroy({
      where: { folder_id: folderId, course_id: courseId }
    });

    // Check if folder is still shared with any courses
    const remainingShares = await FolderCourse.count({
      where: { folder_id: folderId }
    });

    // Update is_shared flag
    if (remainingShares === 0) {
      await folder.update({ is_shared: false });
    }

    res.json({
      success: true,
      message: 'Folder removed from course'
    });

  } catch (error) {
    console.error('Unshare Folder Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing folder from course: ' + error.message
    });
  }
};

/**
 * Move material to a folder
 * PUT /teacher/materials/:id/move
 */
export const moveMaterialToFolder = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const materialId = req.params.id;
    const { folder_id } = req.body;

    // Find material
    const material = await Material.findByPk(materialId);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Check teacher has access to the material's course (if course-based)
    if (material.course_id) {
      const course = await teacherService.checkCourseAccess(material.course_id, teacherId, { requireEdit: true });
      if (!course) {
        return res.status(403).json({
          success: false,
          message: 'You do not have edit permission for this material'
        });
      }
    }

    // If folder_id provided, verify folder exists and teacher has access via shared courses
    if (folder_id) {
      const folder = await Folder.findByPk(folder_id);
      if (!folder) {
        return res.status(404).json({
          success: false,
          message: 'Target folder not found'
        });
      }

      // Check teacher has access via any shared course
      const sharedCourseIds = await FolderCourse.findAll({
        where: { folder_id: folder_id },
        attributes: ['course_id']
      }).then(rows => rows.map(r => r.course_id));
      
      if (sharedCourseIds.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Folder is not shared with any courses'
        });
      }
      
      const teacherCourse = await CourseTeacher.findOne({
        where: {
          teacher_id: teacherId,
          course_id: { [Op.in]: sharedCourseIds }
        }
      });
      
      const ownsCourse = await Course.findOne({
        where: {
          id: { [Op.in]: sharedCourseIds },
          teacher_id: teacherId
        }
      });
      
      if (!teacherCourse && !ownsCourse) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this folder'
        });
      }
    }

    // Move material
    await material.update({
      folder_id: folder_id || null,
      // If moving to a folder, material becomes folder-based (not course-based)
      course_id: folder_id ? null : material.course_id
    });

    res.json({
      success: true,
      message: folder_id ? 'Material moved to folder' : 'Material moved to root level'
    });

  } catch (error) {
    console.error('Move Material Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error moving material: ' + error.message
    });
  }
};

/**
 * Get materials for a course (with folder structure)
 * 
 * ARCHITECTURE: Folder-Specific Materials
 * - Materials belong to folders (folder_id required for folder materials)
 * - Folders are shared with courses via FolderCourse table
 * - When viewing a course, we show:
 *   1. Direct materials (course_id set, no folder) - legacy/direct uploads
 *   2. Materials from folders shared with this course (via FolderCourse)
 * 
 * GET /teacher/courses/:id/materials
 */
export const getMaterialsWithFolders = async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    const teacherId = req.user.id;

    // Verify teacher has access to the course
    const course = await teacherService.checkCourseAccess(courseId, teacherId);

    if (!course) {
      return res.status(404).send('Course not found or you do not have permission to access it');
    }

    // Check edit permission
    const isOwner = await teacherService.isPrimary(courseId, teacherId);
    let canEdit = isOwner;
    if (!isOwner) {
      const courseTeacher = await CourseTeacher.findOne({
        where: { course_id: courseId, teacher_id: teacherId }
      });
      canEdit = courseTeacher ? courseTeacher.can_edit : false;
    }

    // Get direct course materials (not in any folder - legacy uploads)
    const directMaterials = await Material.findAll({
      where: { 
        course_id: courseId,
        folder_id: null
      },
      order: [['created_at', 'DESC']]
    });

    // Get folders shared WITH this course (from FolderCourse table)
    const sharedFolderRecords = await FolderCourse.findAll({
      where: { course_id: courseId },
      attributes: ['folder_id'],
      raw: true
    });
    const sharedFolderIds = sharedFolderRecords.map(r => r.folder_id);

    // Get ALL folders shared with this course
    let sharedFolders = [];
    if (sharedFolderIds.length > 0) {
      sharedFolders = await Folder.findAll({
        where: { id: { [Op.in]: sharedFolderIds } },
        attributes: ['id', 'name', 'parent_id', 'is_shared'],
        order: [['name', 'ASC']],
        raw: true
      });
    }

    // Get shared course count for each folder (how many courses share this folder)
    const allFolderCourses = await FolderCourse.findAll({
      where: { folder_id: { [Op.in]: sharedFolderIds.length > 0 ? sharedFolderIds : [0] } },
      attributes: ['folder_id', 'course_id'],
      raw: true
    });
    
    // Create a map of folder_id -> count of shared courses
    const folderSharedCountMap = {};
    allFolderCourses.forEach(fc => {
      if (!folderSharedCountMap[fc.folder_id]) {
        folderSharedCountMap[fc.folder_id] = 0;
      }
      folderSharedCountMap[fc.folder_id]++;
    });

    // Add metadata to shared folders (for display in tree)
    const sharedFoldersForTree = sharedFolders.map(f => ({
      ...f,
      sharedCourseCount: folderSharedCountMap[f.id] || 1
    }));

    // Get materials from folders shared with this course
    let folderMaterials = [];
    if (sharedFolderIds.length > 0) {
      folderMaterials = await Material.findAll({
        where: { 
          folder_id: { [Op.in]: sharedFolderIds }
        },
        order: [['created_at', 'DESC']]
      });
    }

    // Sign URLs for authenticated access
    const signedDirectMaterials = signUrlsInArray(directMaterials, 'file_url', 'material');
    const signedFolderMaterials = signUrlsInArray(folderMaterials, 'file_url', 'material');

    // Build folder tree with ONLY folders shared with this course
    const folderTree = buildFolderTreeWithMaterials(sharedFoldersForTree, signedFolderMaterials);

    // Get all teacher's courses for sharing folders
    const teacherCourseIds = await teacherService.getCourseIds(teacherId);
    const allCourses = await Course.findAll({
      where: { id: { [Op.in]: teacherCourseIds } },
      attributes: ['id', 'code', 'title'],
      order: [['code', 'ASC']]
    });

    res.render('teacher/materials', {
      user: req.user,
      course,
      courses: allCourses,
      materials: signedDirectMaterials,
      folderTree,
      canEdit,
      pageTitle: `Materials - ${course.title}`,
      success: req.query.success,
      error: req.query.error
    });

  } catch (error) {
    console.error('Get Materials With Folders Error:', error);
    res.status(500).send('Error loading materials: ' + error.message);
  }
};

/**
 * Build folder tree with materials included
 */
function buildFolderTreeWithMaterials(folders, materials) {
  const folderMap = new Map();
  const rootFolders = [];

  // Create folder nodes with materials array
  folders.forEach(folder => {
    folderMap.set(folder.id, {
      ...folder,
      materials: materials.filter(m => m.folder_id == folder.id), // Use loose comparison for type safety
      sharedCourseCount: folder.sharedCourseCount || 1, // Preserve shared count
      children: []
    });
  });

  // Build tree structure
  folders.forEach(folder => {
    const folderNode = folderMap.get(folder.id);
    if (folder.parent_id && folderMap.has(folder.parent_id)) {
      folderMap.get(folder.parent_id).children.push(folderNode);
    } else {
      rootFolders.push(folderNode);
    }
  });

  return rootFolders;
}

/**
 * Upload material to a folder
 * POST /teacher/folders/:id/materials
 */
export const uploadMaterialToFolder = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const folderId = req.params.id;
    const { title, description, material_url, course_id } = req.body;

    // Check if folder exists
    const folder = await Folder.findByPk(folderId);
    if (!folder) {
      return res.redirect(`/teacher/folders?error=Folder not found`);
    }

    // Check if folder is shared with any course teacher has access to
    const sharedCourseIds = await FolderCourse.findAll({
      where: { folder_id: folderId },
      attributes: ['course_id']
    }).then(rows => rows.map(r => r.course_id));
    
    if (sharedCourseIds.length === 0) {
      return res.redirect(`/teacher/folders?error=Folder is not shared with any courses`);
    }
    
    // Check if teacher owns or has been granted access to any of the shared courses
    const teacherCourse = await CourseTeacher.findOne({
      where: {
        teacher_id: teacherId,
        course_id: { [Op.in]: sharedCourseIds }
      }
    });
    
    const ownsCourse = await Course.findOne({
      where: {
        id: { [Op.in]: sharedCourseIds },
        teacher_id: teacherId
      }
    });
    
    if (!teacherCourse && !ownsCourse) {
      return res.redirect(`/teacher/folders?error=You do not have access to this folder`);
    }

    // Validation
    if (!title || title.trim() === '') {
      return res.redirect(`/teacher/folders?error=Title is required`);
    }

    let fileUrl = material_url || '';
    let fileType = 'url';

    // Check if file was uploaded
    if (req.file) {
      fileUrl = req.file.path;
      const originalName = req.file.originalname;
      const extMatch = originalName.match(/\.([a-z0-9]+)$/i);
      fileType = extMatch ? extMatch[1].toLowerCase() : 'file';
    } else if (!material_url || material_url.trim() === '') {
      return res.redirect(`/teacher/folders?error=Please upload a file or provide a URL`);
    }

    // Create material in folder (no course_id)
    await Material.create({
      folder_id: folderId,
      course_id: null,
      title: title.trim(),
      description: description ? description.trim() : null,
      file_url: fileUrl,
      file_type: fileType
    });

    // Redirect back to the materials page for the course if provided
    if (course_id) {
      res.redirect(`/teacher/courses/${course_id}/materials?success=Material uploaded to folder successfully`);
    } else {
      res.redirect(`/teacher/folders?success=Material uploaded to folder successfully`);
    }

  } catch (error) {
    console.error('Upload Material to Folder Error:', error);
    res.redirect(`/teacher/folders?error=Error uploading material: ${error.message}`);
  }
};

