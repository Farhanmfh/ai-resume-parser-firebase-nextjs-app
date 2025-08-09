'use client';
import { Container, Box, Typography, Button, Stack } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <Container maxWidth="sm" sx={{ minHeight: "70vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <Box
        sx={{
          mt: 10,
          textAlign: "center",
          p: 4,
          borderRadius: 4,
          boxShadow: 3,
          bgcolor: "background.paper"
        }}
      >
        <Stack spacing={3} alignItems="center">
          <ErrorOutlineIcon sx={{ fontSize: 80, color: "warning.main" }} />
          <Box>
            <Typography variant="h2" fontWeight="bold" color="text.primary" gutterBottom>
              404
            </Typography>
            <Typography variant="h4" fontWeight="medium" color="text.secondary" gutterBottom>
              Page Not Found
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            Oops! The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </Typography>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => router.push("/")}
            fullWidth
            size="large"
          >
            Back to Home
          </Button>
        </Stack>
      </Box>
    </Container>
  );
}
