/**
 * Teacher Routes
 * Handles teacher-specific routes (dashboard, courses, assignments, etc.)
 * Phase 4: Full implementation pending
 */

import express from 'express';

const router = express.Router();

/**
 * Teacher Dashboard (Placeholder)
 * GET /teacher/dashboard
 */
router.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Teacher Dashboard - LMS EduManage</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          min-height: 100vh;
        }
        .container {
          background: white;
          border-radius: 10px;
          padding: 40px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        h1 { color: #333; margin-top: 0; }
        .info { background: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .user-info { background: #ecfdf5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .links { margin: 20px 0; }
        .links a { 
          display: inline-block;
          margin: 5px 10px 5px 0;
          padding: 10px 20px;
          background: #f59e0b;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          transition: background 0.3s;
        }
        .links a:hover { background: #d97706; }
        .logout { background: #dc2626 !important; }
        .logout:hover { background: #b91c1c !important; }
        .status { color: #d97706; font-weight: bold; }
        ul { line-height: 1.8; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>👨‍🏫 Teacher Dashboard</h1>
        
        <div class="user-info">
          <p><strong>Welcome, ${req.user.full_name}!</strong></p>
          <p>Role: <span class="status">${req.user.role.toUpperCase()}</span></p>
          <p>Email: ${req.user.email}</p>
          <p>Username: ${req.user.username}</p>
        </div>

        <div class="info">
          <h3>✅ Authentication Working!</h3>
          <p>You have successfully logged in as a teacher. The role-based redirect is working correctly.</p>
        </div>

        <div class="info">
          <h3>🚀 Coming Soon in Phase 4</h3>
          <p>Teacher features will include:</p>
          <ul>
            <li>Course Management</li>
            <li>Material Upload</li>
            <li>Assignment Creation</li>
            <li>View Submissions</li>
            <li>Grade Assignments</li>
            <li>Manage Student Grades</li>
          </ul>
        </div>

        <div class="links">
          <a href="/auth/change-password">Change Password</a>
          <a href="/auth/logout" class="logout">Logout</a>
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          <em>This is a temporary placeholder. Full teacher dashboard will be implemented in Phase 4.</em>
        </p>
      </div>
    </body>
    </html>
  `);
});

export default router;
