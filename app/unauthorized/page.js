'use client'
import { Box, Typography, Button, Container, Stack } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useRouter } from "next/navigation";

export default function Unauthorized() {
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
        <Stack spacing={2} alignItems="center">
          <LockOutlinedIcon sx={{ fontSize: 60, color: "error.main" }} />
          <Typography variant="h4" fontWeight="bold">
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You don&apos;t have permission to view this page.
          </Typography>
          <Button variant="contained" color="primary" onClick={() => router.push("/")}>
            Go to Home
          </Button>
        </Stack>
      </Box>
    </Container>
  );
}
