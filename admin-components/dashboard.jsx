import React from 'react';
import { Box, H2, H4, Text, Illustration, Button } from '@adminjs/design-system';

const Dashboard = () => {
  return (
    <Box variant="grey">
      <Box variant="white" p="xxl" m="xxl" style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Box flex flexDirection="row" alignItems="center" mb="xl">
          <Illustration variant="DocumentCheck" width={100} height={100} />
          <Box ml="xl">
            <H2>Welcome to LMS EduManage Admin</H2>
            <Text>Manage users, courses, batches, and system settings from this panel.</Text>
          </Box>
        </Box>
        
        <Box flex flexDirection="row" flexWrap="wrap" mt="xl">
          <Box width={[1, 1/2, 1/4]} p="lg">
            <Box variant="card" p="xl" style={{ textAlign: 'center', borderRadius: '8px' }}>
              <H4>Users</H4>
              <Text>Manage students, teachers, and administrators</Text>
            </Box>
          </Box>
          
          <Box width={[1, 1/2, 1/4]} p="lg">
            <Box variant="card" p="xl" style={{ textAlign: 'center', borderRadius: '8px' }}>
              <H4>Courses</H4>
              <Text>Create and manage course offerings</Text>
            </Box>
          </Box>
          
          <Box width={[1, 1/2, 1/4]} p="lg">
            <Box variant="card" p="xl" style={{ textAlign: 'center', borderRadius: '8px' }}>
              <H4>Batches</H4>
              <Text>Organize students into batches</Text>
            </Box>
          </Box>
          
          <Box width={[1, 1/2, 1/4]} p="lg">
            <Box variant="card" p="xl" style={{ textAlign: 'center', borderRadius: '8px' }}>
              <H4>Enrollments</H4>
              <Text>Manage batch enrollments</Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
