'use client';
import { useEffect } from 'react';
import { Box } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    console.log('Home page effect - loading:', loading, 'user:', user);
    if (!loading && !user) {
      console.log('No user found after loading, redirecting to login');
      router.push('/login');
    }
  }, [user, router, loading]);

  return (
    <Box sx={{ pb: 7 }}>
      <div>Resume Parser</div>
    </Box>
  );
}
