/**
 * Admin Routes
 * Handles admin-specific routes (dashboard, tools, etc.)
 * Phase 3: Full implementation pending
 */

import express from 'express';

const router = express.Router();

/**
 * Admin Dashboard (Placeholder)
 * GET /admin/dashboard
 */
router.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admin Dashboard - LMS EduManage</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        .container {
          background: white;
          border-radius: 10px;
          padding: 40px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        h1 { color: #333; margin-top: 0; }
        .info { background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .user-info { background: #ecfdf5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .links { margin: 20px 0; }
        .links a { 
          display: inline-block;
          margin: 5px 10px 5px 0;
          padding: 10px 20px;
          background: #4f46e5;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          transition: background 0.3s;
        }
        .links a:hover { background: #4338ca; }
        .logout { background: #dc2626 !important; }
        .logout:hover { background: #b91c1c !important; }
        .status { color: #16a34a; font-weight: bold; }
        ul { line-height: 1.8; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎯 Admin Dashboard</h1>
        
        <div class="user-info">
          <p><strong>Welcome, ${req.user.full_name}!</strong></p>
          <p>Role: <span class="status">${req.user.role.toUpperCase()}</span></p>
          <p>Email: ${req.user.email}</p>
          <p>Username: ${req.user.username}</p>
        </div>

        <div class="info">
          <h3>✅ Authentication Working!</h3>
          <p>You have successfully logged in as an admin. The role-based redirect is working correctly.</p>
        </div>

        <div class="info">
          <h3>📋 Phase 2 Status: Almost Complete!</h3>
          <p>You've completed:</p>
          <ul>
            <li>✅ Task 2.1: Passport Configuration</li>
            <li>✅ Task 2.2: Authentication Routes</li>
            <li>✅ Task 2.3: Authentication Controller</li>
            <li>✅ Task 2.4: Login View</li>
            <li>✅ Task 2.5: Change Password View</li>
            <li>✅ Task 2.6: Seed Initial Users</li>
            <li>✅ Task 2.7: Root Route Handler</li>
            <li>⏳ Task 2.8: Authentication Testing (In Progress)</li>
          </ul>
        </div>

        <div class="info">
          <h3>🚀 Next Steps</h3>
          <p><strong>Phase 3:</strong> Admin Panel + Batch System</p>
          <ul>
            <li>Task 3.1: AdminJS Setup</li>
            <li>Task 3.2: Admin Routes Structure</li>
            <li>Task 3.3: Admin Dashboard (Full Implementation)</li>
            <li>And more...</li>
          </ul>
        </div>

        <div class="links">
          <a href="/admin">AdminJS Panel</a>
          <a href="/auth/change-password">Change Password</a>
          <a href="/auth/logout" class="logout">Logout</a>
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          <em>This is a temporary placeholder. Full admin dashboard will be implemented in Phase 3.</em>
        </p>
      </div>
    </body>
    </html>
  `);
});

export default router;
