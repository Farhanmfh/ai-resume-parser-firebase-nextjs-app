'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { signInWithGoogle } from '@/firebase/users';

// MUI
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Divider,
  CircularProgress,
} from '@mui/material';
import { Google } from '@mui/icons-material';

export default function Login() {
  const router = useRouter();
  const { user, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) router.replace('/ai-resume-parser');
  }, [user, router]);

  const handleEmailLogin = async () => {
    setError('');
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password);
      router.replace('/ai-resume-parser');
    } catch (e) {
      setError(e?.message || 'Failed to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/ai-resume-parser');
    } catch (e) {
      setError(e?.message || 'Failed to sign in with Google.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        background:
          'linear-gradient(135deg, rgba(35,89,255,0.08) 0%, rgba(0,0,0,0.02) 100%)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          p: 4,
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Welcome back
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in with your email or Google account
            </Typography>
          </Box>

          {error ? (
            <Box
              sx={{
                p: 1.5,
                bgcolor: 'rgba(255,0,0,0.06)',
                border: '1px solid rgba(255,0,0,0.2)',
                borderRadius: 1,
                color: 'error.main',
              }}
            >
              <Typography variant="body2">{error}</Typography>
            </Box>
          ) : null}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
            />
            <Button
              variant="contained"
              onClick={handleEmailLogin}
              disabled={isLoading}
              fullWidth
              sx={{ height: 44 }}
            >
              {isLoading ? <CircularProgress size={20} /> : 'Sign in'}
            </Button>
          </Box>

          <Divider>or</Divider>

          <Button
            variant="outlined"
            startIcon={<Google />}
            onClick={handleGoogleLogin}
            disabled={isLoading}
            fullWidth
            sx={{ height: 44 }}
          >
            Continue with Google
          </Button>

          <Divider sx={{ my: 0 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Want to upload a resume?
            </Typography>
            <Button component={Link} href="/" variant="text">
              Back to Home
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
