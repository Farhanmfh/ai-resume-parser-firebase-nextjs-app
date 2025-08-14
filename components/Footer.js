'use client';

import { Box, Container, Typography, Link as MuiLink } from '@mui/material';

export default function Footer() {
  return (
    <Box component="footer" sx={{ mt: 'auto', borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Container maxWidth="lg" sx={{ py: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          © {new Date().getFullYear()} AI Resume Parser
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Project created by Mohammed Farhan Hussain - Roll No.2314507660
        </Typography>

      </Container>
    </Box>
  );
}


