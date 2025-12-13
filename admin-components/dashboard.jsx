import React from 'react';
import { Box, H2, H4, Text, Illustration, Button, Icon } from '@adminjs/design-system';

const Dashboard = () => {
  return (
    <Box variant="grey">
      {/* Navigation Header */}
      <Box variant="white" p="lg" mx="xxl" mt="xxl" style={{ 
          borderRadius: '8px 8px 0 0', 
          borderBottom: '1px solid #e0e0e0',
          background: 'linear-gradient(to right, #ffffff, #f9fafb)' 
      }} flex flexDirection="row" justifyContent="space-between" alignItems="center">
          <Box flex flexDirection="row" gap="lg" alignItems="center">
              <Box mr="xl" style={{ borderRight: '1px solid #eee', paddingRight: '16px' }}>
                  <H4 m="0">Admin Panel</H4>
              </Box>
              <Button as="a" href="/admin/dashboard" variant="primary" size="lg" mr="lg" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <Icon icon="Home" mr="sm" />
                  Dashboard Overview
              </Button>
              <Button as="a" href="/admin/tools" variant="primary" size="lg" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <Icon icon="Tools" mr="sm" />
                  Bulk Tools
              </Button>
          </Box>
          <Button as="a" href="/auth/logout" variant="danger" size="lg" ml="lg">
              <Icon icon="LogOut" mr="sm" />
              Logout
          </Button>
      </Box>
      <Box variant="white" p="xxl" mx="xxl" mb="xxl" style={{ borderRadius: '0 0 8px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <Box flex flexDirection="row" alignItems="center" mb="xl">
          <Illustration variant="DocumentCheck" width={100} height={100} />
          <Box ml="xl">
            <H2>Welcome to LMS EduManage Admin</H2>
            <Text>Manage users, courses, batches, and system settings from this panel.</Text>
          </Box>
        </Box>
        
        <Box flex flexDirection="row" flexWrap="wrap" mt="xl">
          <Box width={[1, 1/2, 1/4]} p="lg">
            <Box variant="card" p="xl" style={{ textAlign: 'center', borderRadius: '8px', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <H4>Users</H4>
              <Text>Manage students, teachers, and administrators</Text>
            </Box>
          </Box>
          
          <Box width={[1, 1/2, 1/4]} p="lg">
            <Box variant="card" p="xl" style={{ textAlign: 'center', borderRadius: '8px', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <H4>Courses</H4>
              <Text>Create and manage course offerings</Text>
            </Box>
          </Box>
          
          <Box width={[1, 1/2, 1/4]} p="lg">
            <Box variant="card" p="xl" style={{ textAlign: 'center', borderRadius: '8px', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <H4>Batches</H4>
              <Text>Organize students into batches</Text>
            </Box>
          </Box>
          
          <Box width={[1, 1/2, 1/4]} p="lg">
            <Box variant="card" p="xl" style={{ textAlign: 'center', borderRadius: '8px', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
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
