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

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create MySQLStore
const MySQLStore = MySQLStoreFactory(session);

// 3. Configuration files (ORDER MATTERS - cloudinary BEFORE upload middleware)
import './config/cloudinary.js';  // Initialize Cloudinary first
import sequelize from './config/database.js';
import './config/passport.js';  // Initialize Passport strategies

// 4. Import models and sync function
import {
  User,
  Batch,
  Course,
  BatchEnrollment,
  Material,
  Assignment,
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
      resource: Material,
      options: {
        listProperties: ['id', 'course_id', 'title', 'file_url'],
        editProperties: ['course_id', 'title', 'file_url', 'description'],
      }
    },
    {
      resource: Assignment,
      options: {
        listProperties: ['id', 'course_id', 'title', 'deadline', 'created_by'],
        editProperties: ['course_id', 'title', 'description', 'deadline', 'created_by'],
      }
    },
    {
      resource: Submission,
      options: {
        listProperties: ['id', 'assignment_id', 'student_id', 'submitted_at', 'marks'],
        editProperties: ['assignment_id', 'student_id', 'file_url', 'submission_text', 'marks', 'feedback', 'graded_by'],
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
      console.log('\n⚠️  Next Steps (Phase 2):');
      console.log('   - Implement authentication routes (Task 2.1-2.8)');
      console.log('   - Create seed users for testing');
      console.log('   - Build login/logout functionality\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
