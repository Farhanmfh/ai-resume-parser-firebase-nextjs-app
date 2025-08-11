 'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Divider,
  Container,
  Alert,
} from '@mui/material';
import { db, storage } from '@/firebase/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/ai-resume-parser');
    }
  }, [user, loading, router]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState('');

  const maxBytes = 5 * 1024 * 1024; // 5MB
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const validate = () => {
    if (!name.trim() || !email.trim() || !file) {
      return 'Please fill in name, email, and choose a resume file.';
    }
    if (!allowedTypes.includes(file.type)) {
      return 'Only PDF or DOC/DOCX files are allowed.';
    }
    if (file.size > maxBytes) {
      return 'File size must be 5MB or smaller.';
    }
    return '';
  };

  const handleFileChange = (e) => {
    const chosen = e.target.files?.[0] || null;
    setFile(chosen);
    setError('');
    setSuccess('');
  };

  async function withTimeout(promise, ms) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Request timed out')), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setUploadedUrl('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const timestamp = Date.now();
      const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const storagePath = `resumes/${timestamp}_${safeName}_${file.name}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setUploadedUrl(url);

      // Add a hard timeout so UI never hangs if Firestore retries
      await withTimeout(
        addDoc(collection(db, 'resumes'), {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          filePath: storagePath,
          fileURL: url,
          uploadedAt: serverTimestamp(),
        }),
        10000
      );

      setSuccess('Your resume was uploaded successfully.');
      setName('');
      setEmail('');
      setFile(null);
    } catch (err) {
      console.error('Resume upload error:', err);
      if (uploadedUrl) {
        setError('Uploaded file saved, but we could not save your details. Please retry later.');
      } else {
        setError(err?.message || 'Failed to upload resume. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
          Upload your resume
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter your details and attach your resume (PDF or DOC/DOCX). Recruiters will review it.
        </Typography>

        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
            {uploadedUrl ? (
              <>
                {' '}•{' '}
                <a href={uploadedUrl} target="_blank" rel="noreferrer">View file</a>
              </>
            ) : null}
          </Alert>
        ) : null}
        {success ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
            {uploadedUrl ? (
              <>
                {' '}•{' '}
                <a href={uploadedUrl} target="_blank" rel="noreferrer">View file</a>
              </>
            ) : null}
          </Alert>
        ) : null}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />

            <Box>
              <input
                id="resume-input"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="resume-input">
                <Button variant="outlined" component="span">
                  {file ? 'Change file' : 'Choose resume'}
                </Button>
              </label>
              {file ? (
                <Typography variant="body2" sx={{ ml: 2, display: 'inline' }}>
                  {file.name}
                </Typography>
              ) : null}
              <Typography variant="caption" color="text.secondary" display="block">
                Max size 5MB. Allowed types: PDF, DOC, DOCX.
              </Typography>
            </Box>

            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              sx={{ height: 44 }}
            >
              {isSubmitting ? <CircularProgress size={20} /> : 'Submit'}
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Are you a recruiter?
          </Typography>
          <Button component={Link} href="/login" variant="outlined">
            Recruiter Login
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
