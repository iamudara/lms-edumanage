// CRITICAL: dotenv MUST be first (before any other imports)
import 'dotenv/config';

// 2. Import dependencies
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import passport from 'passport';
import bodyParser from 'body-parser';
import AdminJS from 'adminjs';
import { ComponentLoader } from 'adminjs';
import * as AdminJSExpress from '@adminjs/express';
import * as AdminJSSequelize from '@adminjs/sequelize';
import { v2 as cloudinary } from 'cloudinary';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create MySQLStore
const MySQLStore = MySQLStoreFactory(session);

// 3. Configuration files (ORDER MATTERS - cloudinary BEFORE upload middleware)
import cloudinaryConfig, { deleteCloudinaryFile } from './config/cloudinary.js';  // Initialize Cloudinary first
import sequelize from './config/database.js';
import './config/passport.js';  // Initialize Passport strategies

// 4. Import models and sync function
import {
  User,
  Batch,
  Course,
  CourseTeacher,
  BatchEnrollment,
  Folder,
  FolderCourse,
  Material,
  Assignment,
  AssignmentMaterial,
  Submission,
  Grade,
  syncDatabase
} from './models/index.js';

// 5. Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// 6. Register AdminJS adapter (BEFORE creating AdminJS instance)
AdminJS.registerAdapter({
  Resource: AdminJSSequelize.Resource,
  Database: AdminJSSequelize.Database,
});

// 7. ComponentLoader for custom dashboard
const componentLoader = new ComponentLoader();

const Components = {
  Dashboard: componentLoader.add('Dashboard', path.resolve(__dirname, 'admin-components/dashboard.jsx')),
};

// 8. Configure MySQL session store (NOT memory store - critical for Railway)
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  createDatabaseTable: true,  // Auto-create sessions table
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
});

// 8. Setup middleware (ORDER CRITICAL)
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24  // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages middleware (simple implementation)
app.use((req, res, next) => {
  res.locals.success_msg = req.session.success_msg || null;
  res.locals.error_msg = req.session.error_msg || null;
  delete req.session.success_msg;
  delete req.session.error_msg;
  next();
});

// Make user available in all views
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

// 9. Create AdminJS instance
const adminJs = new AdminJS({
  componentLoader,
  resources: [
    {
      resource: User,
      options: {
        listProperties: ['id', 'username', 'email', 'full_name', 'role', 'batch_id'],
        editProperties: ['username', 'email', 'password', 'full_name', 'role', 'batch_id'],
        filterProperties: ['username', 'email', 'role', 'batch_id'],
      }
    },
    {
      resource: Batch,
      options: {
        listProperties: ['id', 'name', 'code', 'year'],
        editProperties: ['name', 'code', 'description', 'year'],
      }
    },
    {
      resource: Course,
      options: {
        listProperties: ['id', 'title', 'code', 'teacher_id'],
        editProperties: ['title', 'code', 'description', 'teacher_id'],
        properties: {
          teacher_id: {
            description: 'Primary teacher (creator) of the course. Use "Course Teachers" to assign additional teachers.'
          }
        },
        actions: {
          delete: {
            before: async (request, context) => {
              const { record, currentAdmin } = context;
              
              if (request.method === 'post') {
                // Get course ID from the record
                const courseId = record.id();
                
                // Count related records
                const assignmentCount = await Assignment.count({ where: { course_id: courseId } });
                const materialCount = await Material.count({ where: { course_id: courseId } });
                const enrollmentCount = await BatchEnrollment.count({ where: { course_id: courseId } });
                
                // Add notice to the record
                if (assignmentCount > 0 || materialCount > 0 || enrollmentCount > 0) {
                  record.params.deleteWarning = `⚠️ WARNING: Deleting this course will also delete:\\n` +
                    `- ${assignmentCount} assignment(s)\\n` +
                    `- ${materialCount} material(s)\\n` +
                    `- ${enrollmentCount} batch enrollment(s)\\n` +
                    `This action cannot be undone!`;
                }
              }
              
              return request;
            },
            component: false,
            guard: 'Are you sure you want to delete this course? This will also delete all assignments, materials, submissions, and batch enrollments associated with it. This action cannot be undone!',
          }
        }
      }
    },
    {
      resource: CourseTeacher,
      options: {
        navigation: {
          name: 'Course Management',
          icon: 'Book'
        },
        listProperties: ['id', 'course_id', 'teacher_id', 'is_primary', 'can_edit', 'can_grade'],
        editProperties: ['course_id', 'teacher_id', 'is_primary', 'can_edit', 'can_grade'],
        filterProperties: ['course_id', 'teacher_id', 'is_primary'],
        properties: {
          course_id: {
            description: 'Select the course to assign a teacher to'
          },
          teacher_id: {
            description: 'Select the teacher to assign (must have teacher role)'
          },
          is_primary: {
            description: 'Is this the primary teacher? (Only one primary per course)'
          },
          can_edit: {
            description: 'Can this teacher edit course materials and assignments?'
          },
          can_grade: {
            description: 'Can this teacher grade student submissions?'
          }
        },
        actions: {
          new: {
            before: async (request) => {
              // Validate that the user is a teacher
              if (request.payload && request.payload.teacher_id) {
                const teacher = await User.findByPk(request.payload.teacher_id);
                if (!teacher || teacher.role !== 'teacher') {
                  throw new Error('Selected user must have teacher role');
                }
              }
              return request;
            }
          },
          edit: {
            before: async (request) => {
              // Validate that the user is a teacher
              if (request.payload && request.payload.teacher_id) {
                const teacher = await User.findByPk(request.payload.teacher_id);
                if (!teacher || teacher.role !== 'teacher') {
                  throw new Error('Selected user must have teacher role');
                }
              }
              return request;
            }
          }
        }
      }
    },
    {
      resource: BatchEnrollment,
      options: {
        listProperties: ['id', 'batch_id', 'course_id'],
        editProperties: ['batch_id', 'course_id'],
      }
    },
    {
      resource: Folder,
      options: {
        navigation: {
          name: 'Folder Management',
          icon: 'Folder'
        },
        listProperties: ['id', 'name', 'parent_id', 'is_shared'],
        editProperties: ['name', 'parent_id', 'is_shared'],
        filterProperties: ['name', 'is_shared'],
        showProperties: ['id', 'name', 'parent_id', 'is_shared', 'createdAt', 'updatedAt'],
        properties: {
          name: {
            isTitle: true,
            position: 1
          },
          parent_id: {
            description: 'Parent folder (leave empty for root level folder)',
            position: 2
          },
          is_shared: {
            description: 'Whether this folder is shared with any courses',
            position: 3
          }
        },
        actions: {
          delete: {
            before: async (request, context) => {
              if (request.method === 'post') {
                const folderId = context.record.id();
                
                // Check for subfolders
                const subfolderCount = await Folder.count({ where: { parent_id: folderId } });
                if (subfolderCount > 0) {
                  throw new Error('Cannot delete folder with subfolders. Delete subfolders first.');
                }
                
                // Delete materials in this folder from Cloudinary
                const materials = await Material.findAll({ where: { folder_id: folderId } });
                for (const material of materials) {
                  if (material.file_url && material.file_url.includes('cloudinary.com')) {
                    try {
                      await deleteCloudinaryFile(material.file_url);
                    } catch (error) {
                      console.error('Error deleting material file from Cloudinary:', error);
                    }
                  }
                }
                
                // Delete materials
                await Material.destroy({ where: { folder_id: folderId } });
                
                // Delete folder-course associations
                await FolderCourse.destroy({ where: { folder_id: folderId } });
              }
              
              return request;
            },
            guard: 'Are you sure you want to delete this folder? This will also delete all materials inside and remove all course sharing. This action cannot be undone!',
          }
        }
      }
    },
    {
      resource: FolderCourse,
      options: {
        navigation: {
          name: 'Folder Management',
          icon: 'Share'
        },
        listProperties: ['id', 'folder_id', 'course_id', 'added_by', 'created_at'],
        editProperties: ['folder_id', 'course_id', 'added_by'],
        filterProperties: ['folder_id', 'course_id', 'added_by'],
        showProperties: ['id', 'folder_id', 'course_id', 'added_by', 'created_at'],
        properties: {
          folder_id: {
            description: 'The folder being shared',
            position: 1
          },
          course_id: {
            description: 'The course this folder is shared with',
            position: 2
          },
          added_by: {
            description: 'Teacher who shared this folder',
            position: 3
          }
        }
      }
    },
    {
      resource: Material,
      options: {
        listProperties: ['id', 'course_id', 'folder_id', 'title', 'file_url'],
        editProperties: ['course_id', 'folder_id', 'title', 'file_url', 'description'],
        filterProperties: ['course_id', 'folder_id', 'title'],
        properties: {
          course_id: {
            description: 'Course this material belongs to (optional if in a folder)'
          },
          folder_id: {
            description: 'Folder this material belongs to (optional if course-based)'
          }
        },
        actions: {
          delete: {
            before: async (request, context) => {
              if (request.method === 'post') {
                const material = await Material.findByPk(context.record.id());
                
                // Delete material file from Cloudinary if exists
                if (material && material.file_url) {
                  try {
                    await deleteCloudinaryFile(material.file_url);
                    console.log(`Deleted course material from Cloudinary`);
                  } catch (error) {
                    console.error('Error deleting material file from Cloudinary:', error);
                  }
                }
              }
              
              return request;
            },
            guard: 'Are you sure you want to delete this material? This will also delete the file from Cloudinary. This action cannot be undone!',
          }
        }
      }
    },
    {
      resource: Assignment,
      options: {
        listProperties: ['id', 'course_id', 'title', 'deadline', 'created_by'],
        editProperties: ['course_id', 'title', 'description', 'deadline', 'created_by'],
        actions: {
          delete: {
            before: async (request, context) => {
              if (request.method === 'post') {
                const assignmentId = context.record.id();
                
                // Get all assignment materials to delete from Cloudinary
                const materials = await AssignmentMaterial.findAll({
                  where: { assignment_id: assignmentId }
                });
                
                // Delete each material file from Cloudinary
                for (const material of materials) {
                  if (material.url && material.type === 'file') {
                    try {
                      await deleteCloudinaryFile(material.url);
                      console.log(`Deleted assignment material from Cloudinary`);
                    } catch (error) {
                      console.error('Error deleting assignment material from Cloudinary:', error);
                    }
                  }
                }
                
                // Get all submissions to delete their files from Cloudinary
                const submissions = await Submission.findAll({
                  where: { assignment_id: assignmentId }
                });
                
                // Delete each submission file from Cloudinary
                for (const submission of submissions) {
                  if (submission.file_url) {
                    try {
                      await deleteCloudinaryFile(submission.file_url);
                      console.log(`Deleted submission file from Cloudinary`);
                    } catch (error) {
                      console.error('Error deleting submission file from Cloudinary:', error);
                    }
                  }
                }
              }
              
              return request;
            },
            guard: 'Are you sure you want to delete this assignment? This will also delete all assignment materials, submissions, and their files from Cloudinary. This action cannot be undone!',
          }
        }
      }
    },
    {
      resource: AssignmentMaterial,
      options: {
        listProperties: ['id', 'assignment_id', 'title', 'type', 'url'],
        editProperties: ['assignment_id', 'title', 'type', 'url', 'file_type', 'description'],
        actions: {
          delete: {
            before: async (request, context) => {
              if (request.method === 'post') {
                const material = await AssignmentMaterial.findByPk(context.record.id());
                
                // Delete assignment material file from Cloudinary if exists and is a file type
                if (material && material.url && material.type === 'file') {
                  try {
                    await deleteCloudinaryFile(material.url);
                    console.log(`Deleted assignment material from Cloudinary`);
                  } catch (error) {
                    console.error('Error deleting assignment material file from Cloudinary:', error);
                  }
                }
              }
              
              return request;
            },
            guard: 'Are you sure you want to delete this assignment material? If this is a file, it will also be deleted from Cloudinary. This action cannot be undone!',
          }
        }
      }
    },
    {
      resource: Submission,
      options: {
        listProperties: ['id', 'assignment_id', 'student_id', 'submitted_at', 'marks'],
        editProperties: ['assignment_id', 'student_id', 'file_url', 'submission_text', 'marks', 'feedback', 'graded_by'],
        actions: {
          delete: {
            before: async (request, context) => {
              if (request.method === 'post') {
                const submission = await Submission.findByPk(context.record.id());
                
                // Delete submission file from Cloudinary if exists
                if (submission && submission.file_url) {
                  try {
                    await deleteCloudinaryFile(submission.file_url);
                    console.log(`Deleted submission file from Cloudinary`);
                  } catch (error) {
                    console.error('Error deleting submission file from Cloudinary:', error);
                  }
                }
              }
              
              return request;
            },
            guard: 'Are you sure you want to delete this submission? This will also delete the submitted file from Cloudinary. This action cannot be undone!',
          }
        }
      }
    },
    {
      resource: Grade,
      options: {
        listProperties: ['id', 'course_id', 'student_id', 'grade'],
        editProperties: ['course_id', 'student_id', 'grade', 'remarks'],
      }
    }
  ],
  rootPath: '/admin',
  dashboard: {
    component: Components.Dashboard,
  },
  branding: {
    companyName: 'LMS EduManage',
    logo: false,
    softwareBrothers: false,
  },
  locale: {
    language: 'en',
    translations: {
      en: {
        messages: {
          loginWelcome: 'Admin Panel - LMS EduManage',
        }
      }
    }
  }
});

// Build AdminJS router
const adminRouter = AdminJSExpress.buildRouter(adminJs);

// 10. Import route files and middleware
import { isAuthenticated, isAdmin, isTeacher, isStudent } from './middleware/auth.js';
import errorHandler from './middleware/errorHandler.js';

// Import route modules
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import teacherRoutes from './routes/teacher.js';
import studentRoutes from './routes/student.js';

// 11. Register routes (ORDER CRITICAL - specific routes BEFORE AdminJS)
// Root route
app.get('/', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }

  // Role-based redirect
  switch (req.user.role) {
    case 'admin':
      return res.redirect('/admin/dashboard');
    case 'teacher':
      return res.redirect('/teacher/dashboard');
    case 'student':
      return res.redirect('/student/dashboard');
    default:
      return res.redirect('/auth/login');
  }
});

// Authentication routes (MUST come BEFORE protected routes)
app.use('/auth', authRoutes);

// Custom admin routes (MUST come BEFORE AdminJS route)
app.use('/admin', isAuthenticated, isAdmin, adminRoutes);

// AdminJS route (MUST be LAST admin route - catches all /admin/*)
app.use('/admin', isAuthenticated, isAdmin, adminRouter);

// Other role-based routes
app.use('/teacher', isAuthenticated, isTeacher, teacherRoutes);
app.use('/student', isAuthenticated, isStudent, studentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).send(`
    <h1>404 - Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
    <a href="/">Go Home</a>
  `);
});

// 12. Error handler (MUST be LAST middleware)
app.use(errorHandler);

// 13. Sync database then start server (CRITICAL ORDER)
async function startServer() {
  try {
    console.log('🔄 Syncing database...');
    await syncDatabase();
    console.log('✅ Database synced successfully');
    
    app.listen(PORT, () => {
      console.log('\n🚀 Server started successfully!');
      console.log(`📍 Server running on: http://localhost:${PORT}`);
      console.log(`🔐 AdminJS panel: http://localhost:${PORT}/admin`);
      console.log(`📚 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
