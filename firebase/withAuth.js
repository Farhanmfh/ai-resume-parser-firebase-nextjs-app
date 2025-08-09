'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Box, CircularProgress } from '@mui/material';

const withAuth = (WrappedComponent, allowedRoles = []) => {
  return function ProtectedRoute(props) {
    const { user, loading, checkRole } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading) {
        if (!user) {
          console.log('🔒 No user found, redirecting to /login');
          router.replace('/login');
          return;
        }
        
        if (!checkRole(allowedRoles)) {
          console.log(`🚫 User role '${user.role}' not authorized for ${allowedRoles.join(', ')}. Redirecting.`);
          router.replace('/unauthorized');
          return;
        }
      }
    }, [user, loading, router, checkRole, allowedRoles]);

    if (loading || !user || !checkRole(allowedRoles)) {
      return (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh' 
        }}>
          <CircularProgress />
        </Box>
      );
    }

    return <WrappedComponent {...props} user={user} />;
  };
};

export default withAuth;
