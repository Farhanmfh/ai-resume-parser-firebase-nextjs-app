'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import withAuth from '@/firebase/withAuth';
import { db, storage } from '@/firebase/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Divider,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';

function AiResumeParserPage({ user }) {
  const [file, setFile] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const [question, setQuestion] = useState('');
  const [chatMessages, setChatMessages] = useState([]); // {role: 'user'|'assistant', content}
  const theme = useTheme();
  const [numPages, setNumPages] = useState(null);
  const [pdfError, setPdfError] = useState('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  const pdfBlobUrlRef = useRef('');
  const isPdf = useMemo(
    () => (file?.type === 'application/pdf') || (uploadedUrl?.toLowerCase()?.includes('.pdf')),
    [file, uploadedUrl]
  );

  // Fetch PDF as blob to avoid CORS issues
  useEffect(() => {
    if (uploadedUrl && isPdf) {
      const fetchPdfAsBlob = async () => {
        try {
          console.log('Fetching PDF as blob from Firebase Storage');
          // Use Firebase Storage SDK instead of fetch to avoid CORS
          const storageRef = ref(storage, storagePath);
          const blob = await getBlob(storageRef);
          const blobUrl = URL.createObjectURL(blob);
          setPdfBlobUrl(blobUrl);
          pdfBlobUrlRef.current = blobUrl;
          console.log('PDF blob created successfully');
        } catch (error) {
          console.error('Error fetching PDF as blob:', error);
          setPdfError('Failed to load PDF. You can still download and view the file.');
        }
      };
      
      fetchPdfAsBlob();
    }
    
    // Cleanup blob URL when component unmounts or URL changes
    return () => {
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
        pdfBlobUrlRef.current = '';
      }
    };
  }, [uploadedUrl, isPdf, storagePath]);

  const maxBytes = 5 * 1024 * 1024; // 5MB
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const suggestedQuestions = useMemo(() => {
    const base = [
      'What are the key skills in this resume?',
      'How well does this resume fit a Frontend Developer role?',
      'Summarize this candidate\'s experience in 3 bullet points.',
    ];
    if (!file) return base;
    const name = (file?.name || '').replace(/\.[^.]+$/, '');
    return [
      `Give a quick profile summary for candidate: ${name}`,
      'List notable achievements and impact metrics.',
      'Identify gaps relative to a Senior Engineer JD.',
    ];
  }, [file]);

  const validate = () => {
    if (!file) return 'Please choose a resume file (PDF or DOC/DOCX).';
    if (!allowedTypes.includes(file.type)) return 'Only PDF or DOC/DOCX files are allowed.';
    if (file.size > maxBytes) return 'File size must be 5MB or smaller.';
    return '';
  };

  const handleFileChange = (e) => {
    const chosen = e.target.files?.[0] || null;
    // Clean up previous blob URL
    if (pdfBlobUrlRef.current) {
      URL.revokeObjectURL(pdfBlobUrlRef.current);
      pdfBlobUrlRef.current = '';
    }
    setFile(chosen);
    setUploadedUrl('');
    setStoragePath('');
    setError('');
    setPdfError('');
    setNumPages(null);
    setPdfBlobUrl('');
  };

  async function handleUpload() {
    setError('');
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const safeName = (file.name || 'resume').replace(/[^a-z0-9.]/gi, '_').toLowerCase();
      const path = `resumes/${timestamp}_${user?.id || 'user'}_${safeName}`;
      const storageRef = ref(storage, path);

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setUploadedUrl(url);
      setStoragePath(path);
      setIsUploading(false); // stop spinner as soon as file upload completes

      // Save metadata with retry mechanism
      const saveToFirestore = async (retryCount = 0) => {
        try {
          console.log('Attempting to save to Firestore, attempt:', retryCount + 1);
          console.log('User ID:', user?.id);
          console.log('Collection path:', 'resumes');
          
          const docData = {
            userId: user?.id || null,
            filePath: path,
            fileURL: url,
            uploadedAt: serverTimestamp(),
            source: 'ai-resume-parser',
          };
          console.log('Document data to save:', docData);
          
          const docRef = await addDoc(collection(db, 'resumes'), docData);
          console.log('Resume metadata saved to Firestore successfully, doc ID:', docRef.id);
        } catch (error) {
          console.error(`Firestore save attempt ${retryCount + 1} failed:`, error);
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          console.error('Full error object:', error);
          
          if (retryCount < 2) {
            console.log(`Retrying in 2 seconds... (attempt ${retryCount + 1})`);
            // Retry after 2 seconds
            setTimeout(() => saveToFirestore(retryCount + 1), 2000);
          } else {
            console.error('All retry attempts failed');
            setError('Uploaded file saved, but we could not save details. Please retry later.');
          }
        }
      };

      // Start the save process
      saveToFirestore();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err?.message || 'Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  const ask = (text) => {
    if (!uploadedUrl) {
      setError('Upload a resume first to ask questions.');
      return;
    }
    if (!text?.trim()) return;
    setChatMessages((prev) => [...prev, { role: 'user', content: text.trim() }]);
    setQuestion('');
    // Placeholder assistant response. Hook up to your AI API later.
    setChatMessages((prev) => [
      ...prev,
      { role: 'assistant', content: 'AI analysis coming soon. Connect /api/check-fit to generate answers.' },
    ]);
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'background.default',
      color: 'text.primary',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 380px' }, gap: 2, p: 2 }}>
        {/* Left: Chat + Upload */}
        <Paper elevation={0} sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', p: 2, minHeight: 'calc(100vh - 96px)', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Upload Resume</Typography>
            <Typography variant="caption" color="text.secondary">PDF, DOC, DOCX. Max 5MB.</Typography>

            {error ? (
              <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>
            ) : null}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <input
                id="resume-input-arp"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="resume-input-arp">
                <Button variant="outlined" component="span">
                  {file ? 'Change file' : 'Choose resume'}
                </Button>
              </label>
              {file ? (
                <Typography variant="body2" color="text.secondary">{file.name}</Typography>
              ) : null}
              <Box sx={{ flexGrow: 1 }} />
              <Button onClick={handleUpload} disabled={!file || isUploading} variant="contained" color="primary">
                {isUploading ? <CircularProgress size={18} /> : 'Upload'}
              </Button>
            </Box>

            {uploadedUrl ? (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Uploaded: <a href={uploadedUrl} target="_blank" rel="noreferrer">View file</a>
              </Typography>
            ) : null}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {uploadedUrl && isPdf ? (
              <Paper variant="outlined" sx={{ p: 1, bgcolor: 'background.default' }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>PDF Preview:</Typography>
                {!pdfBlobUrl ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" sx={{ ml: 1 }}>Preparing PDF...</Typography>
                  </Box>
                ) : pdfError ? (
                  <Alert severity="warning" sx={{ mt: 1 }}>{pdfError}</Alert>
                ) : (
                  <>
                    <Document
                      file={pdfBlobUrl}
                      onLoadSuccess={({ numPages: n }) => {
                        console.log('PDF loaded successfully:', n, 'pages');
                        setNumPages(n);
                        setPdfError('');
                      }}
                      onLoadError={(error) => {
                        console.error('PDF load error:', error);
                        setPdfError('Failed to render PDF preview. You can still download and view the file.');
                      }}
                      loading={
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                          <CircularProgress size={24} />
                          <Typography variant="body2" sx={{ ml: 1 }}>Loading PDF...</Typography>
                        </Box>
                      }
                    >
                      <Page 
                        pageNumber={1} 
                        width={500} 
                        renderTextLayer={false} 
                        renderAnnotationLayer={false}
                        onLoadSuccess={() => console.log('Page 1 loaded successfully')}
                        onLoadError={(error) => console.error('Page load error:', error)}
                      />
                    </Document>
                    {numPages && numPages > 1 ? (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Showing page 1 of {numPages}
                      </Typography>
                    ) : null}
                  </>
                )}
              </Paper>
            ) : uploadedUrl && !isPdf ? (
              <Alert severity="info">Preview available for PDF only. Use the link above to view the uploaded file.</Alert>
            ) : null}
            {chatMessages.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Your conversation will appear here after you upload and start asking questions.
              </Typography>
            ) : chatMessages.map((m, idx) => (
              <Box key={idx} sx={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                bgcolor: m.role === 'user' ? 'primary.dark' : 'background.default',
                color: 'text.primary',
                px: 2,
                py: 1.25,
                borderRadius: 2,
                maxWidth: '85%'
              }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.content}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>

        {/* Right: Q&A Panel */}
        <Paper elevation={0} sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', p: 2, minHeight: 'calc(100vh - 96px)' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Questions</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload a resume, then ask questions or pick a suggestion.
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {suggestedQuestions.map((q) => (
              <Chip key={q} label={q} onClick={() => ask(q)} />
            ))}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask something about the resume..."
              multiline
              minRows={2}
              fullWidth
              sx={{ borderRadius: 1 }}
            />
            <Button variant="contained" onClick={() => ask(question)} disabled={!question.trim()} sx={{ alignSelf: 'flex-end' }}>
              Ask
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

export default withAuth(AiResumeParserPage, ['standardUser']);


