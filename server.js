// CRITICAL: dotenv MUST be first (before any other imports)
import 'dotenv/config';

console.log('🚀 Starting Application...');
console.log('📌 Node Environment:', process.env.NODE_ENV);
console.log('📌 Port:', process.env.PORT || 3000);


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

  syncDatabase
} from './models/index.js';

// 5. Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Trust Railway proxy for secure cookies (CRITICAL for production HTTPS)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// 6. AdminJS configuration (Imported from config)
import { adminJs, adminRouter } from './config/admin.js';

// 7. Configure MySQL session store (NOT memory store - critical for Railway)
// Support both connection URL (Railway) and individual vars (local dev)
const databaseUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;

let sessionStoreConfig;
if (databaseUrl) {
  // Production: Parse connection URL
  const url = new URL(databaseUrl);
  sessionStoreConfig = {
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1), // Remove leading slash
    createDatabaseTable: true,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  };
} else {
  // Development: Use individual environment variables
  sessionStoreConfig = {
    host: process.env.DB_HOST,
    port: 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    createDatabaseTable: true,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  };
}



let sessionStore;
try {
  sessionStore = new MySQLStore(sessionStoreConfig);
  console.log('✅ Session store initialized');
} catch (error) {
  console.error('❌ Failed to initialize session store:', error);
  // Fallback to memory store if crucial, or exit
  // For now, let's log and rethrow or handle graceful failure
  console.error('Check your DATABASE_URL or MYSQL_URL format.');
}

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
  rolling: true, // Reset maxAge on every response (keep session alive if active)
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
    httpOnly: true,
    maxAge: 1000 * 60 * 30  // 30 minutes (idle timeout)
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
  res.status(404).render('error/404', {
    user: req.user || null
  });
});

// 12. Error handler (MUST be LAST middleware)
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  
  // Don't expose error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).render('error/500', {
    user: req.user || null,
    error: isDevelopment ? err : null
  });
});

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
