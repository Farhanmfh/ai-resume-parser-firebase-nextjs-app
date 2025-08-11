'use client';

import { Box, Container, Typography, Link as MuiLink } from '@mui/material';

export default function Footer() {
  return (
    <Box component="footer" sx={{ mt: 'auto', borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Container maxWidth="lg" sx={{ py: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          © {new Date().getFullYear()} AI Resume Parser
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <MuiLink href="/" underline="hover" color="text.secondary" variant="body2">
            Home
          </MuiLink>
          <MuiLink href="/login" underline="hover" color="text.secondary" variant="body2">
            Login
          </MuiLink>
        </Box>
      </Container>
    </Box>
  );
}


