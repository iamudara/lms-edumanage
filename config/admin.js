import AdminJS from 'adminjs';
import * as AdminJSSequelize from '@adminjs/sequelize';
import * as AdminJSExpress from '@adminjs/express';
import { ComponentLoader } from 'adminjs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resources
import { UserResource } from '../admin-resources/user.resource.js';
import { BatchResource } from '../admin-resources/batch.resource.js';
import { CourseResource } from '../admin-resources/course.resource.js';
import { CourseTeacherResource } from '../admin-resources/courseTeacher.resource.js';
import { BatchEnrollmentResource } from '../admin-resources/batchEnrollment.resource.js';
import { FolderResource } from '../admin-resources/folder.resource.js';
import { FolderCourseResource } from '../admin-resources/folderCourse.resource.js';
import { MaterialResource } from '../admin-resources/material.resource.js';
import { AssignmentResource } from '../admin-resources/assignment.resource.js';
import { AssignmentMaterialResource } from '../admin-resources/assignmentMaterial.resource.js';
import { SubmissionResource } from '../admin-resources/submission.resource.js';
import { GradeResource } from '../admin-resources/grade.resource.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Register adapter
AdminJS.registerAdapter({
  Resource: AdminJSSequelize.Resource,
  Database: AdminJSSequelize.Database,
});

const componentLoader = new ComponentLoader();

const Components = {
  Dashboard: componentLoader.add('Dashboard', path.resolve(rootDir, 'admin-components/dashboard.jsx')),
};

const adminJs = new AdminJS({
  componentLoader,
  resources: [
    UserResource,
    BatchResource,
    CourseResource,
    CourseTeacherResource,
    BatchEnrollmentResource,
    FolderResource,
    FolderCourseResource,
    MaterialResource,
    AssignmentResource,
    AssignmentMaterialResource,
    SubmissionResource,
    GradeResource
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

// Build router
const adminRouter = AdminJSExpress.buildRouter(adminJs);

export { adminJs, adminRouter };
