'use client';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import withAuth from '@/firebase/withAuth';
import { db, storage } from '@/firebase/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFileBlobUrl, } from '@/utils/storageHelper';
import { extractPdfText, getFormattedTextForAI, getTextStatistics, extractResumeSections } from '@/utils/pdfTextExtractor';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import ReactMarkdown from 'react-markdown';
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
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';

function AiResumeParserPage({ user }) {
  const [file, setFile] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const [question, setQuestion] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  const pdfBlobUrlRef = useRef('');
  const chatEndRef = useRef(null);

  // Chat tabs state
  const [activeTab, setActiveTab] = useState(0); // 0: General Chat, 1: Resume Context Chat
  const [generalChatMessages, setGeneralChatMessages] = useState([]); // General AI chat
  const [resumeContextMessages, setResumeContextMessages] = useState([]); // Resume-specific chat
  const [showTabSwitchNotice, setShowTabSwitchNotice] = useState(false);

  // Resume analysis state
  const [resumeText, setResumeText] = useState('');
  const [jobRequirements, setJobRequirements] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState('');
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [extractedPdfData, setExtractedPdfData] = useState(null);

  // Resizable layout state
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false); // Use ref to avoid state update delays

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  const isPdf = useMemo(
    () => (file?.type === 'application/pdf') || (uploadedUrl?.toLowerCase()?.includes('.pdf')),
    [file, uploadedUrl]
  );

  // Drag and drop handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      const droppedFile = droppedFiles[0];
      if (droppedFile.type === 'application/pdf') {
        setPendingFile(droppedFile);
        setShowUploadModal(true);
      } else {
        setError('Only PDF files are allowed.');
      }
    }
  }, []);

  const handleFileConfirmation = useCallback((confirmedFile) => {
    setFile(confirmedFile);
    setPendingFile(null);
    // Keep modal open for upload step
    setError('');
    setPdfError('');
    setPdfBlobUrl('');
    setResumeText('');
    setAnalysisResult(null);
    setAnalysisError('');
    setResumeContextMessages([]);
    setActiveTab(0);
    setShowTabSwitchNotice(false);
    setExtractedPdfData(null);
  }, []);

  const handleCancelUpload = useCallback(() => {
    setPendingFile(null);
    setShowUploadModal(false);
  }, []);

  // Auto-scroll to bottom when new messages arrive (but not on initial load)
  const currentMessages = activeTab === 0 ? generalChatMessages : resumeContextMessages;
  const prevMessagesLengthRef = useRef(0);

  useEffect(() => {
    // Only auto-scroll if we actually have new messages (not on initial load)
    if (currentMessages.length > prevMessagesLengthRef.current && chatEndRef.current) {
      // Use a small delay to ensure the DOM has updated
      setTimeout(() => {
        if (chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
    prevMessagesLengthRef.current = currentMessages.length;
  }, [currentMessages]);

  // Fallback PDF text extraction method
  const fallbackPdfExtraction = useCallback(async (pdfUrl) => {
    try {
      // Try to use the existing PDF.js instance if available
      let pdfjsLib;
      try {
        pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      } catch (importError) {
        console.error('Failed to import PDF.js for fallback:', importError);
        return null;
      }

      let pdf;

      // Try to use the File object first if available
      if (file && file.type === 'application/pdf') {
        try {
          console.log('Fallback: Using File object for PDF extraction...');
          const loadingTask = pdfjsLib.getDocument(URL.createObjectURL(file));
          pdf = await loadingTask.promise;
        } catch (fileError) {
          console.error('Failed to load PDF from File object:', fileError);
          // Fall back to URL
          try {
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            pdf = await loadingTask.promise;
          } catch (urlError) {
            console.error('Failed to load PDF from URL:', urlError);
            return null;
          }
        }
      } else {
        // Try to create a new document from the URL
        try {
          const loadingTask = pdfjsLib.getDocument(pdfUrl);
          pdf = await loadingTask.promise;
        } catch (pdfError) {
          console.error('Failed to load PDF for fallback:', pdfError);
          return null;
        }
      }

      let fullText = '';
      try {
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }
      } catch (textError) {
        console.error('Failed to extract text from PDF pages:', textError);
        return null;
      }

      return fullText.trim();
    } catch (error) {
      console.error('Fallback extraction failed:', error);
      return null;
    }
  }, [file]);

  // Extract text from PDF using improved extraction utility
  const extractPdfTextHandler = useCallback(async (pdfUrl) => {
    try {
      setIsExtractingText(true);
      setResumeText('');

      let extractedData;

      // Try to use the File object directly if available (more reliable)
      if (file && file.type === 'application/pdf') {
        console.log('Using File object for PDF text extraction...', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        });
        extractedData = await extractPdfText(file);
      } else {
        // Fallback to URL-based extraction
        console.log('Using URL for PDF text extraction...', { pdfUrl });
        try {
          extractedData = await extractPdfText(pdfUrl);
        } catch (urlError) {
          console.log('URL-based extraction failed, trying File object as fallback...');
          // If URL extraction fails and we have a file, try using the file directly
          if (file && file.type === 'application/pdf') {
            console.log('Retrying with File object...');
            extractedData = await extractPdfText(file);
          } else {
            throw urlError; // Re-throw if we don't have a file to fall back to
          }
        }
      }

      // Get formatted text for AI context
      const formattedText = getFormattedTextForAI(extractedData);
      setResumeText(formattedText);

      // Store additional extracted data for potential future use
      setExtractedPdfData(extractedData);

      // Auto-switch to Resume Context tab when text is successfully extracted
      if (formattedText.trim()) {
        setActiveTab(1);
        setShowTabSwitchNotice(true);
        // Hide the notice after 5 seconds
        setTimeout(() => setShowTabSwitchNotice(false), 5000);

        // Also clear any previous analysis results when switching
        setAnalysisResult(null);
        setAnalysisError('');
      }
    } catch (error) {
      console.error('PDF text extraction error:', error);
      setResumeText(''); // Clear text if extraction fails

      // Provide more user-friendly error messages
      let errorMessage = 'Failed to extract text from PDF. Analysis may not work properly.';

      if (error.message.includes('CORS restrictions')) {
        errorMessage = 'PDF text extraction failed due to browser security restrictions. The file will still be displayed but text analysis may not work.';
      } else if (error.message.includes('Invalid PDF')) {
        errorMessage = 'The uploaded file appears to be corrupted or not a valid PDF. Please try uploading a different PDF file.';
      } else if (error.message.includes('Password required')) {
        errorMessage = 'This PDF is password-protected and cannot be processed. Please upload an unprotected PDF file.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Unable to access the PDF file for text extraction. The file will still be displayed but text analysis may not work.';
      }

      setAnalysisError(errorMessage);

      // Try fallback extraction method
      try {
        console.log('Attempting fallback PDF text extraction...');
        const fallbackText = await fallbackPdfExtraction(pdfUrl);
        if (fallbackText) {
          setResumeText(fallbackText);
          setAnalysisError('Basic text extraction succeeded, but some formatting may be lost.');
        }
      } catch (fallbackError) {
        console.error('Fallback extraction also failed:', fallbackError);
      }
    } finally {
      setIsExtractingText(false);
    }
  }, [file, setActiveTab, setShowTabSwitchNotice, setAnalysisResult, setAnalysisError, fallbackPdfExtraction]);

  // Fetch PDF URL for display and extract text
  useEffect(() => {
    if (uploadedUrl && isPdf && storagePath) {
      const fetchPdfUrl = async () => {
        try {
          // Use our utility helper to get the PDF URL
          const result = await getFileBlobUrl(storagePath);
          if (result && result.directUrl) {
            setPdfBlobUrl(result.directUrl);
            pdfBlobUrlRef.current = result.directUrl;
            setPdfError(''); // Clear any previous errors

            // Extract text from PDF
            await extractPdfTextHandler(result.directUrl);
          } else {
            setPdfError('Failed to load PDF. You can still download and view the file.');
          }
        } catch (error) {
          console.error('PDF fetch error:', error);
          setPdfError('Failed to load PDF. You can still download and view the file.');
        }
      };

      fetchPdfUrl();
    }

    // No cleanup needed for iframe URLs
    return () => {
      // Cleanup not needed for iframe
    };
  }, [uploadedUrl, isPdf, storagePath, extractPdfTextHandler]);

  const maxBytes = 5 * 1024 * 1024; // 5MB
  const allowedTypes = [
    'application/pdf',
  ];

  const suggestedQuestions = useMemo(() => [
    'Explain how AI works in simple terms',
    'What are the benefits of machine learning?',
    'How can technology improve productivity?',
    'What is the future of artificial intelligence?',
    'Explain blockchain technology briefly',
  ], []);

  const validate = () => {
    if (!file) return 'Please choose a resume file (PDF only).';
    if (!allowedTypes.includes(file.type)) return 'Only PDF files are allowed.';
    if (file.size > maxBytes) return 'File size must be 5MB or smaller.';
    return '';
  };

  const handleFileChange = (e) => {
    const chosen = e.target.files?.[0] || null;
    if (chosen) {
      setPendingFile(chosen);
      setShowUploadModal(true);
    }
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

      // Close the modal after successful upload
      setShowUploadModal(false);

      // Save metadata with retry mechanism
      const saveToFirestore = async (retryCount = 0) => {
        try {
          const docData = {
            userId: user?.id || null,
            filePath: path,
            fileURL: url,
            uploadedAt: serverTimestamp(),
            source: 'ai-resume-parser',
          };

          await addDoc(collection(db, 'resumes'), docData);
        } catch (error) {
          if (retryCount < 2) {
            // Retry after 2 seconds
            setTimeout(() => saveToFirestore(retryCount + 1), 2000);
          } else {
            setError('Uploaded file saved, but we could not save details. Please retry later.');
          }
        }
      };

      // Start the save process
      saveToFirestore();
    } catch (err) {
      setError(err?.message || 'Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  // Resize handlers
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    isResizingRef.current = true;
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e) => {
      if (!isResizingRef.current) return;

      const container = document.querySelector('.resizable-container');
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;

      // Limit the width between 20% and 80%
      if (newLeftWidth >= 20 && newLeftWidth <= 80) {
        setLeftPanelWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const ask = async (text) => {
    if (!text?.trim()) return;

    const userMessage = text.trim();
    const isResumeContext = activeTab === 1;

    // Add message to appropriate chat
    if (isResumeContext) {
      setResumeContextMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    } else {
      setGeneralChatMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    }

    setQuestion('');
    setIsChatLoading(true);

    try {
      if (isResumeContext && resumeText) {
        // Resume context chat - include resume text in the prompt
        let prompt = `You are an AI assistant analyzing a resume. Here is the resume content:`;

        // Add PDF metadata if available
        if (extractedPdfData?.metadata) {
          prompt += `\n\nDOCUMENT INFO:
- Title: ${extractedPdfData.metadata.title || 'Not specified'}
- Author: ${extractedPdfData.metadata.author || 'Not specified'}
- Pages: ${extractedPdfData.metadata.numPages}
- Tables Found: ${extractedPdfData.tables?.length || 0}`;
        }

        // Add extracted resume sections if available
        if (extractedPdfData) {
          const resumeSections = extractResumeSections(extractedPdfData);
          const availableSections = Object.entries(resumeSections)
            .filter(([_, sections]) => sections.length > 0)
            .map(([sectionType, sections]) => `${sectionType}: ${sections.length} items found`)
            .join(', ');

          if (availableSections) {
            prompt += `\n\nRESUME SECTIONS DETECTED:
${availableSections}`;
          }
        }

        prompt += `\n\nRESUME CONTENT:
${resumeText}

USER QUESTION: ${userMessage}

Please answer the question based on the resume content above. If the question cannot be answered from the resume, say so. Provide specific insights from the resume when possible.`;

        console.log('Calling Gemini API with prompt:', prompt.substring(0, 100) + '...');
        const response = await fetch('https://geminichat-uzr46nuzga-uc.a.run.app', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: { message: prompt } }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Gemini API response:', data);

        // Handle both response formats: direct HTTP and httpsCallable wrapper
        const responseData = data.result || data;

        if (responseData.success) {
          setResumeContextMessages((prev) => [
            ...prev,
            { role: 'assistant', content: responseData.response }
          ]);
        } else {
          throw new Error(responseData.error || 'Unknown error from Firebase Function');
        }
      } else {
        // General chat
        console.log('Calling Gemini API with message:', userMessage);
        const response = await fetch('https://geminichat-uzr46nuzga-uc.a.run.app', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: { message: userMessage } }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Gemini API response:', data);

        // Handle both response formats: direct HTTP and httpsCallable wrapper
        const responseData = data.result || data;

        if (responseData.success) {
          setGeneralChatMessages((prev) => [
            ...prev,
            { role: 'assistant', content: responseData.response }
          ]);
        } else {
          throw new Error(responseData.error || 'Unknown error from Firebase Function');
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = `Sorry, I encountered an error while processing your request: ${error.message}. Please try again.`;
      if (isResumeContext) {
        setResumeContextMessages((prev) => [...prev, { role: 'assistant', content: errorMessage }]);
      } else {
        setGeneralChatMessages((prev) => [...prev, { role: 'assistant', content: errorMessage }]);
      }
    } finally {
      setIsChatLoading(false);
    }
  };

  // Analyze resume against job requirements
  const analyzeResume = async () => {
    if (!resumeText?.trim()) {
      setAnalysisError('Please upload a resume first to extract text content.');
      return;
    }

    if (!jobRequirements?.trim()) {
      setAnalysisError('Please enter job requirements to analyze against.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError('');
    setAnalysisResult(null);

    try {
      // Get text statistics for better analysis context
      let analysisContext = resumeText.trim();

      if (extractedPdfData) {
        const stats = getTextStatistics(extractedPdfData);
        const resumeSections = extractResumeSections(extractedPdfData);

        // Get available sections
        const availableSections = Object.entries(resumeSections)
          .filter(([_, sections]) => sections.length > 0)
          .map(([sectionType, sections]) => `${sectionType}: ${sections.length} items`)
          .join(', ');

        analysisContext = `RESUME ANALYSIS CONTEXT:
Document Statistics:
- Total Words: ${stats.totalWords}
- Total Sentences: ${stats.totalSentences}
- Pages: ${stats.totalPages}
- Tables Found: ${stats.tableCount}

Resume Sections Detected:
${availableSections || 'No specific sections detected'}

RESUME CONTENT:
${resumeText.trim()}

JOB REQUIREMENTS:
${jobRequirements.trim()}`;
      } else {
        analysisContext = `RESUME CONTENT:
${resumeText.trim()}

JOB REQUIREMENTS:
${jobRequirements.trim()}`;
      }

      console.log('Calling Resume Analysis API with context length:', analysisContext.length);
      const response = await fetch('https://analyzeresume-uzr46nuzga-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            resumeText: analysisContext,
            jobRequirements: jobRequirements.trim()
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Resume Analysis API response:', data);

      // Handle both response formats: direct HTTP and httpsCallable wrapper
      const responseData = data.result || data;

      if (responseData.success) {
        setAnalysisResult(responseData.response);
      } else {
        throw new Error(responseData.error || 'Unknown error from analysis function');
      }
    } catch (error) {
      console.error('Resume analysis error:', error);
      let errorMessage = 'Failed to analyze resume. Please try again.';

      if (error.message.includes('HTTP error! status:')) {
        errorMessage = `Server error (${error.message.split('status: ')[1]}). Please try again later.`;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setAnalysisError(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Clear analysis results
  const clearAnalysis = () => {
    setAnalysisResult(null);
    setAnalysisError('');
    setJobRequirements('');
  };

  // Clear chat based on active tab
  const clearChat = () => {
    if (activeTab === 0) {
      setGeneralChatMessages([]);
    } else {
      setResumeContextMessages([]);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'background.default',
      color: 'text.primary',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Box
        className="resizable-container"
        sx={{
          display: 'flex',
          gap: 0,
          p: 2,
          height: 'calc(100vh - 96px)',
          position: 'relative'
        }}
      >
        {/* Left: Upload + PDF Preview + Resume Analysis */}
        <Paper
          elevation={0}
          sx={{
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            p: 2,
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            width: `${leftPanelWidth}%`,
            minWidth: '300px',
            maxWidth: '80%',
            overflowY: 'auto'
          }}
        >
          {/* PDF Preview Section - Show at top when uploaded */}
          {uploadedUrl && isPdf && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>PDF Preview</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    href={uploadedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ minWidth: 'auto', px: 1 }}
                  >
                    Open in New Tab
                  </Button>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'center', minHeight: '300px', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.default' }}>
                {!pdfBlobUrl ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" sx={{ mt: 1 }}>Loading PDF...</Typography>
                  </Box>
                ) : pdfError ? (
                  <Alert severity="warning" sx={{ mt: 1 }}>{pdfError}</Alert>
                ) : (
                  <iframe
                    src={pdfBlobUrl}
                    width="100%"
                    height="400px"
                    style={{
                      border: 'none',
                      borderRadius: '4px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    title="PDF Preview"
                    scrolling="no"
                    onLoad={() => {
                      // PDF loaded successfully
                      setPdfError('');
                    }}
                    onError={() => {
                      setPdfError('Failed to load PDF. You can still download and view the file.');
                    }}
                  />
                )}
              </Box>
            </Box>
          )}

          {/* Resume Analysis Section */}
          {resumeText && activeTab === 1 && (
            <>
              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AssessmentIcon color="primary" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Resume Analysis</Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Enter job requirements to analyze how well this resume matches the position.
                  {resumeText && (
                    <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        ✓ Text extracted: {resumeText.length} characters
                      </Typography>
                    </Box>
                  )}
                </Typography>

                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={jobRequirements}
                  onChange={(e) => setJobRequirements(e.target.value)}
                  placeholder="Paste job description and requirements here..."
                  variant="outlined"
                  sx={{ mb: 2 }}
                />

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Button
                    variant="contained"
                    onClick={analyzeResume}
                    disabled={!jobRequirements.trim() || isAnalyzing}
                    startIcon={isAnalyzing ? <CircularProgress size={20} /> : <AssessmentIcon />}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Analyze Resume'}
                  </Button>

                  {analysisResult && (
                    <Button
                      variant="outlined"
                      onClick={clearAnalysis}
                      size="small"
                    >
                      Clear Analysis
                    </Button>
                  )}
                </Box>

                {analysisError && (
                  <Alert severity="error" sx={{ mb: 2 }}>{analysisError}</Alert>
                )}

                {analysisResult && (
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      bgcolor: 'background.default',
                      border: 1,
                      borderColor: 'primary.main',
                      borderRadius: 2
                    }}
                  >
                    <Box sx={{
                      fontSize: '0.875rem',
                      lineHeight: 1.6,
                      '& h1, & h2, & h3, & h4, & h5, & h6': {
                        mt: 0, mb: 1, color: 'text.primary',
                        fontWeight: 600
                      },
                      '& h1': { fontSize: '1.25rem' },
                      '& h2': { fontSize: '1.125rem' },
                      '& h3, & h4, & h5, & h6': { fontSize: '1rem' },
                      '& p': {
                        mt: 0, mb: 1, '&:last-child': { mb: 0 }
                      },
                      '& ul, & ol': {
                        mt: 0, mb: 1, pl: 2
                      },
                      '& li': {
                        mb: 0.5
                      },
                      '& strong, & b': {
                        fontWeight: 600
                      },
                      '& em, & i': {
                        fontStyle: 'italic'
                      },
                      '& code': {
                        bgcolor: 'action.hover',
                        px: 0.5,
                        py: 0.25,
                        borderRadius: 0.5,
                        fontFamily: 'monospace',
                        fontSize: '0.875em'
                      },
                      '& pre': {
                        bgcolor: 'action.hover',
                        p: 1,
                        borderRadius: 1,
                        overflow: 'auto',
                        '& code': {
                          bgcolor: 'transparent',
                          p: 0
                        }
                      },
                      '& blockquote': {
                        borderLeft: 3,
                        borderColor: 'primary.main',
                        pl: 2,
                        ml: 0,
                        my: 1,
                        fontStyle: 'italic',
                        color: 'text.secondary'
                      },
                      '& hr': {
                        border: 'none',
                        borderTop: 1,
                        borderColor: 'divider',
                        my: 1
                      }
                    }}>
                      <ReactMarkdown>{analysisResult}</ReactMarkdown>
                    </Box>
                  </Paper>
                )}
              </Box>
            </>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Upload Section - Moved to bottom when file is uploaded */}
          {
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Upload Resume</Typography>
              <Typography variant="caption" color="text.secondary">PDF only. Max 5MB.</Typography>
              {error ? (
                <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>
              ) : null}

              {/* File Info Display */}
              {file && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Selected file: {file.name}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setFile(null);
                        setShowUploadModal(true);
                      }}
                    >
                      Change File
                    </Button>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Typography>
                </Box>
              )}

              {uploadedUrl ? (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Uploaded: <a href={uploadedUrl} target="_blank" rel="noopener noreferrer">View file</a>
                  {isPdf && isExtractingText && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <CircularProgress size={16} />
                      <Typography variant="caption" color="text.secondary">
                        Extracting text from PDF...
                      </Typography>
                    </Box>
                  )}
                  {isPdf && resumeText && !isExtractingText && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="success.main" sx={{ fontWeight: 500, display: 'block', mb: 1 }}>
                        ✓ Text extracted successfully! Resume Context tab is now available.
                      </Typography>
                    </Box>
                  )}
                </Typography>
              ) : null}

              {/* Drag and Drop Zone */}
              <Box
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                sx={{
                  border: 2,
                  borderStyle: 'dashed',
                  borderColor: isDragOver ? 'primary.main' : 'divider',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  bgcolor: isDragOver ? 'action.hover' : 'background.default',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover',
                  }
                }}
              >
                <CloudUploadIcon
                  sx={{
                    fontSize: 48,
                    color: isDragOver ? 'primary.main' : 'text.secondary',
                    mb: 2
                  }}
                />
                <Typography variant="h6" sx={{ mb: 1, color: isDragOver ? 'primary.main' : 'text.primary' }}>
                  {isDragOver ? 'Drop your PDF here' : 'Drag & Drop PDF Resume'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  or click below to browse files
                </Typography>

                <input
                  id="resume-input-arp"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <label htmlFor="resume-input-arp">
                  <Button variant="outlined" component="span">
                    Choose resume
                  </Button>
                </label>
              </Box>
            </Box>
          }


        </Paper>

        {/* Resizable Divider */}
        <Box
          onMouseDown={handleMouseDown}
          onClick={(e) => e.stopPropagation()}
          sx={{
            width: '12px',
            bgcolor: isResizing ? 'primary.main' : 'rgba(0,0,0,0.1)',
            cursor: 'col-resize',
            position: 'relative',
            userSelect: 'none',
            transition: 'background-color 0.1s',
            border: '1px solid transparent',
            '&:hover': {
              bgcolor: 'action.hover',
              borderColor: 'primary.main',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: isResizing ? '4px' : '2px',
              height: '60px',
              bgcolor: isResizing ? 'white' : 'divider',
              borderRadius: '1px',
              transition: 'all 0.1s',
            },
            '&:hover::after': {
              bgcolor: 'primary.main',
              width: '3px',
            }
          }}
        />

        {/* Right: PDF Viewer + Chat Interface */}
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: '300px',
          gap: 2
        }}>


          {/* Chat Interface */}
          <Paper
            elevation={0}
            sx={{
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              p: 2,
              flex: 1,
              minHeight: '40%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Chat Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>AI Chat Assistant</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const newWidth = leftPanelWidth === 50 ? 70 : 50;
                    setLeftPanelWidth(newWidth);
                  }}
                  sx={{ minWidth: 'auto', px: 1 }}
                  title="Test width change"
                >
                  Layout: <VerticalSplitIcon />
                </Button>
                {((activeTab === 0 && generalChatMessages.length > 0) || (activeTab === 1 && resumeContextMessages.length > 0)) && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={clearChat}
                    sx={{ minWidth: 'auto', px: 1 }}
                  >
                    Clear Chat
                  </Button>
                )}
              </Box>
            </Box>

            {/* Chat Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs
                value={activeTab}
                onChange={(e, newValue) => setActiveTab(newValue)}
                sx={{ minHeight: 'auto' }}
              >
                <Tab
                  label="General Chat"
                  sx={{
                    minHeight: 'auto',
                    py: 1,
                    fontSize: '0.875rem'
                  }}
                />
                <Tab
                  label="Resume Context"
                  disabled={!resumeText}
                  sx={{
                    minHeight: 'auto',
                    py: 1,
                    fontSize: '0.875rem',
                    '&.Mui-disabled': {
                      opacity: 0.5,
                    },
                    ...(resumeText && {
                      color: 'success.main',
                      fontWeight: 600,
                    })
                  }}
                />
              </Tabs>
            </Box>

            {/* Resume Context Notice */}
            {activeTab === 1 && !resumeText && (
              <Alert severity="info" sx={{ mb: 2 }}>
                📄 Upload a PDF resume to enable resume context chat and analysis. This tab will allow you to ask questions specifically about the uploaded resume and analyze it against job requirements.
              </Alert>
            )}

            {/* Auto-switch Notice */}
            {showTabSwitchNotice && activeTab === 1 && (
              <Alert
                severity="success"
                sx={{ mb: 2 }}
                onClose={() => setShowTabSwitchNotice(false)}
              >
                🎯 Auto-switched to Resume Context tab! You can now ask questions about the uploaded resume and analyze it against job requirements.
              </Alert>
            )}

            {/* Chat Messages */}
            <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
              {(() => {
                const messages = activeTab === 0 ? generalChatMessages : resumeContextMessages;

                if (messages.length === 0) {
                  if (activeTab === 0) {
                    return (
                      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        <Typography variant="body1" sx={{ mb: 2 }}>👋 Welcome! I&apos;m your AI assistant.</Typography>
                        <Typography variant="body2">Ask me anything or pick a suggestion below to get started.</Typography>
                      </Box>
                    );
                  } else {
                    return (
                      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        <Typography variant="body1" sx={{ mb: 2 }}>📄 Resume Context Chat</Typography>
                        <Typography variant="body2">Ask questions about the uploaded resume to get AI-powered insights.</Typography>
                      </Box>
                    );
                  }
                }

                return messages.map((m, idx) => (
                  <Box key={idx} sx={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    bgcolor: m.role === 'user' ? 'primary.main' : 'background.default',
                    color: m.role === 'user' ? 'white' : 'text.primary',
                    px: 3,
                    py: 2,
                    borderRadius: 3,
                    maxWidth: '85%',
                    border: m.role === 'assistant' ? 1 : 0,
                    borderColor: 'divider',
                    boxShadow: m.role === 'user' ? 1 : 0
                  }}>
                    {m.role === 'user' ? (
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{m.content}</Typography>
                    ) : (
                      <Box sx={{
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                        '& h1, & h2, & h3, & h4, & h5, & h6': {
                          mt: 0, mb: 1, color: 'text.primary',
                          fontWeight: 600
                        },
                        '& h1': { fontSize: '1.25rem' },
                        '& h2': { fontSize: '1.125rem' },
                        '& h3, & h4, & h5, & h6': { fontSize: '1rem' },
                        '& p': {
                          mt: 0, mb: 1, '&:last-child': { mb: 0 }
                        },
                        '& ul, & ol': {
                          mt: 0, mb: 1, pl: 2
                        },
                        '& li': {
                          mb: 0.5
                        },
                        '& strong, & b': {
                          fontWeight: 600
                        },
                        '& em, & i': {
                          fontStyle: 'italic'
                        },
                        '& code': {
                          bgcolor: 'action.hover',
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 0.5,
                          fontFamily: 'monospace',
                          fontSize: '0.875em'
                        },
                        '& pre': {
                          bgcolor: 'action.hover',
                          p: 1,
                          borderRadius: 1,
                          overflow: 'auto',
                          '& code': {
                            bgcolor: 'transparent',
                            p: 0
                          }
                        },
                        '& blockquote': {
                          borderLeft: 3,
                          borderColor: 'primary.main',
                          pl: 2,
                          ml: 0,
                          my: 1,
                          fontStyle: 'italic',
                          color: 'text.secondary'
                        },
                        '& hr': {
                          border: 'none',
                          borderTop: 1,
                          borderColor: 'divider',
                          my: 1
                        }
                      }}>
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </Box>
                    )}
                  </Box>
                ));
              })()}

              {isChatLoading && (
                <Box sx={{
                  alignSelf: 'flex-start',
                  bgcolor: 'background.default',
                  px: 3,
                  py: 2,
                  borderRadius: 3,
                  border: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">AI is thinking...</Typography>
                </Box>
              )}
              <div ref={chatEndRef} />
            </Box>

            {/* Suggested Questions */}
            {(() => {
              const messages = activeTab === 0 ? generalChatMessages : resumeContextMessages;

              if (messages.length === 0) {
                if (activeTab === 0) {
                  return (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Try asking:</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {suggestedQuestions.map((q) => (
                          <Chip
                            key={q}
                            label={q}
                            onClick={() => ask(q)}
                            variant="outlined"
                            size="small"
                            sx={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Box>
                    </Box>
                  );
                } else {
                  return (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Try asking about the resume:</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {[
                          'What are the candidate\'s key skills?',
                          'How many years of experience do they have?',
                          'What technologies are they proficient in?',
                          'What is their educational background?',
                          'What are their main achievements?',
                          'Analyze this resume against a software developer role',
                          'What are the strengths and weaknesses of this resume?',
                          'Suggest improvements for this resume'
                        ].map((q) => (
                          <Chip
                            key={q}
                            label={q}
                            onClick={() => ask(q)}
                            variant="outlined"
                            size="small"
                            sx={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Box>
                    </Box>
                  );
                }
              }
              return null;
            })()}

            {/* Input Area */}
            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (question.trim() && !isChatLoading) {
                        ask(question);
                      }
                    }
                  }}
                  placeholder={activeTab === 0 ? "Ask anything... (Press Enter to send)" : "Ask about the resume... (Press Enter to send)"}
                  multiline
                  minRows={1}
                  maxRows={4}
                  fullWidth
                  sx={{
                    borderRadius: 2,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
                <Button
                  variant="contained"
                  onClick={() => ask(question)}
                  disabled={!question.trim() || isChatLoading}
                  sx={{
                    borderRadius: 2,
                    minWidth: '60px',
                    height: '40px'
                  }}
                >
                  {isChatLoading ? <CircularProgress size={20} /> : '→'}
                </Button>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Upload Confirmation Modal */}
      <Dialog
        open={showUploadModal}
        onClose={handleCancelUpload}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudUploadIcon color="primary" />
          {!file ? 'Confirm File Selection' : 'Upload Resume'}
        </DialogTitle>
        <DialogContent>
          {!file ? (
            <>
              <DialogContentText sx={{ mb: 2 }}>
                Are you sure you want to select this file?
              </DialogContentText>
              {pendingFile && (
                <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, mb: 2 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                    {pendingFile.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Size: {(pendingFile.size / 1024 / 1024).toFixed(2)} MB
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Type: {pendingFile.type}
                  </Typography>
                </Box>
              )}
              <DialogContentText variant="caption" color="text.secondary">
                This will replace any previously selected file and clear current analysis results.
              </DialogContentText>
            </>
          ) : (
            <>
              <DialogContentText sx={{ mb: 2 }}>
                Ready to upload your resume?
              </DialogContentText>
              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, mb: 2 }}>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                  {file.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Type: {file.type}
                </Typography>
              </Box>
              <DialogContentText variant="caption" color="text.secondary">
                Click Upload to proceed with the upload process.
              </DialogContentText>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={handleCancelUpload} variant="outlined">
            Cancel
          </Button>
          {!file ? (
            <Button
              onClick={() => handleFileConfirmation(pendingFile)}
              variant="contained"
              color="primary"
              disabled={!pendingFile}
            >
              Select File
            </Button>
          ) : (
            <Button
              onClick={handleUpload}
              variant="contained"
              color="primary"
              disabled={!file || isUploading}
            >
              {isUploading ? <CircularProgress size={18} /> : 'Upload'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default withAuth(AiResumeParserPage, ['standardUser']);