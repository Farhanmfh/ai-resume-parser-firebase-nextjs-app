'use client';

import { useState, useEffect } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '@/firebase/firebase';
import { handleUserSignIn } from '@/firebase/users';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

// MUI imports
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { Google } from '@mui/icons-material';

// Roboto font
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

export default function Login() {
  const [step, setStep] = useState('initial');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);

  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    // Initialize RecaptchaVerifier when component mounts
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        'recaptcha-container'
      );
    }

    // Cleanup function
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, [auth]);

  const handlePhoneNumberChange = (e) => {
    setPhoneNumber(e.target.value);
  };

  const handleOTPChange = (e) => {
    setOtp(e.target.value);
  };

  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func.apply(null, args);
      }, delay);
    };
  };

  const handleSendOtp = async () => {
    if (!phoneNumber.trim()) {
      alert('Please enter a phone number');
      return;
    }

    setIsLoading(true);
    try {
      const displayNumber = phoneNumber;
      const formattedPhoneNumber = phoneNumber.startsWith('+')
        ? phoneNumber
        : `+${phoneNumber.replace(/\D/g, '')}`;
      const confirmation = await signInWithPhoneNumber(
        auth,
        formattedPhoneNumber,
        window.recaptchaVerifier
      );
      setConfirmationResult(confirmation);
      setStep('otp');
      setOtpSent(true);
      setPhoneNumber(displayNumber);
    } catch (error) {
      console.error('Error sending OTP:', error);
      if (error.code === 'auth/too-many-requests') {
        alert('Too many requests. Please try again later.');
      } else {
        alert(error.message || 'Error sending OTP. Please try again.');
      }
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then(widgetId => {
          window.recaptchaVerifier.reset(widgetId);
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedHandleSendOtp = debounce(handleSendOtp, 3000);

  const handleOTPSubmit = async () => {
    if (!otp.trim()) {
      alert('Please enter the verification code');
      return;
    }

    setIsLoading(true);
    try {
      const result = await confirmationResult.confirm(otp);
      console.log('User signed in successfully:', result.user);
      await handleUserSignIn(result.user, true);
      setOtp('');
      router.push('/');
    } catch (error) {
      console.error('Error verifying OTP:', error);
      alert(error.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log('Google sign in successful:', result.user);
      await handleUserSignIn(result.user, result.additionalUserInfo?.isNewUser);
      router.push('/');
    } catch (error) {
      console.error('Error signing in with Google:', error);
      alert(error.message || 'Error signing in with Google. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      router.push('/')
    }
  }, [user, router])

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#000',
        color: 'white',
        p: 2
      }}
    >
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box
          component='img'
          src='/assets/barber-banner.png'
          alt='Barber Shop'
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.7
          }}
        />

        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            pt: 4
          }}
        >
          {step === 'initial' && (
            <>
              <Typography
                variant='h4'
                component='h1'
                sx={{
                  fontWeight: 'bold',
                  mb: 4,
                  px: 1,
                  fontSize: '3rem',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                Book Your Perfect Look in Minutes!
              </Typography>

              <Box sx={{ width: '100%' }}>
                <TextField
                  fullWidth
                  variant='outlined'
                  placeholder='Enter phone number'
                  value={phoneNumber}
                  onChange={handlePhoneNumberChange}
                  disabled={isLoading}
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'white',
                      borderRadius: '30px'
                    }
                  }}
                  inputProps={{
                    inputMode: 'numeric',
                    pattern: '[0-9]*'
                  }}
                />
                <Button
                  fullWidth
                  variant='contained'
                  onClick={debouncedHandleSendOtp}
                  disabled={isLoading}
                  sx={{
                    mb: 2,
                    height: 56,
                    borderRadius: '30px',
                    bgcolor: '#1a73e8',
                    '&:hover': {
                      bgcolor: '#1557b0'
                    }
                  }}
                >
                  {isLoading ? <CircularProgress size={24} /> : 'Continue'}
                </Button>

                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <Typography
                    variant='body2'
                    sx={{ color: 'rgba(255,255,255,0.7)' }}
                  >
                    Or
                  </Typography>
                </Box>

                <Button
                  fullWidth
                  variant='contained'
                  startIcon={<Google />}
                  onClick={handleGoogleSignIn}
                  sx={{
                    height: 56,
                    borderRadius: '30px',
                    bgcolor: 'white',
                    color: 'black',
                    '&:hover': {
                      bgcolor: '#f5f5f5'
                    }
                  }}
                >
                  Continue with Google
                </Button>

                <div id='recaptcha-container'></div>
              </Box>
            </>
          )}
          {step === 'otp' && (
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'white'
              }}
            >
              <Typography variant='h6' sx={{ mb: 3 }}>
                Enter the code sent to {phoneNumber}
              </Typography>

              <TextField
                fullWidth
                variant='outlined'
                placeholder='Enter 6-digit code'
                value={otp}
                onChange={handleOTPChange}
                disabled={isLoading}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'white',
                    borderRadius: '30px'
                  }
                }}
                inputProps={{ maxLength: 6 }}
              />

              <Button
                fullWidth
                variant='contained'
                onClick={handleOTPSubmit}
                disabled={isLoading}
                sx={{
                  mb: 2,
                  height: 56,
                  borderRadius: '30px',
                  bgcolor: '#1a73e8',
                  '&:hover': {
                    bgcolor: '#1557b0'
                  }
                }}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Verify'}
              </Button>

              <Button
                variant='text'
                onClick={() => {
                  setStep('initial');
                  setOtpSent(false);
                }}
                sx={{
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                Change Phone Number
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
