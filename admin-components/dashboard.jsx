import React from 'react';
import { Box, H2, H5, Button, Text } from '@adminjs/design-system';

const Dashboard = () => {
  return (
    <Box variant="grey">
      <Box bg="white" flex flexDirection="column" p="xxl">
        <H2 mb="xl">🎓 LMS EduManage - Admin Panel</H2>
        
        <Text mb="xl" fontSize="lg" color="grey60">
          Welcome to the admin dashboard. Use the sidebar to manage database records or choose a quick action below.
        </Text>

        <Box mb="xl">
          <Box
            flex
            flexDirection="row"
            flexWrap="wrap"
            style={{ gap: '20px' }}
          >
            <Button
              size="lg"
              variant="primary"
              onClick={() => window.location.href = '/admin/dashboard'}
              style={{ flex: '1 1 200px' }}
            >
              📊 Statistics Dashboard
            </Button>
            
            <Button
              size="lg"
              variant="primary"
              onClick={() => window.location.href = '/admin/tools'}
              style={{ flex: '1 1 200px' }}
            >
              📤 Bulk Operations
            </Button>
            
            <Button
              size="lg"
              variant="primary"
              onClick={() => window.location.href = '/admin/resources/batches'}
              style={{ flex: '1 1 200px' }}
            >
              👥 Batch Management
            </Button>
            
            <Button
              size="lg"
              variant="danger"
              onClick={() => window.location.href = '/auth/logout'}
              style={{ flex: '1 1 200px' }}
            >
              🚪 Logout
            </Button>
          </Box>
        </Box>

        <Box bg="bg" p="xl" borderRadius="default">
          <H5 mb="default">💡 Quick Tips</H5>
          <Text fontSize="sm" mb="sm">
            • Use the <strong>sidebar</strong> to manage Users, Batches, Courses, Materials, Assignments, Submissions, and Grades
          </Text>
          <Text fontSize="sm" mb="sm">
            • Click <strong>Statistics Dashboard</strong> to view charts and analytics
          </Text>
          <Text fontSize="sm">
            • Click <strong>Bulk Operations</strong> to upload CSV files for mass user creation, enrollments, or grades
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
