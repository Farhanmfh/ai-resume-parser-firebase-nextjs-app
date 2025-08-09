'use client';
import { Box, Typography, Grid, Paper, CircularProgress } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import SpaIcon from '@mui/icons-material/Spa';
import EventIcon from '@mui/icons-material/Event';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import withAuth from '@/firebase/withAuth';

const stats = [
  {
    title: 'Total Stylists',
    value: '0',
    icon: <PeopleIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
  },
  {
    title: 'Active Services',
    value: '0',
    icon: <SpaIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
  },
  {
    title: 'Today\'s Bookings',
    value: '0',
    icon: <EventIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
  },
];

function AdminDashboard({ user }) {
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 4 }}>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        {stats.map((stat) => (
          <Grid item xs={12} sm={4} key={stat.title}>
            <Paper
              sx={{
                p: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                borderRadius: 2,
              }}
            >
              {stat.icon}
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {stat.title}
                </Typography>
                <Typography variant="h4">
                  {stat.value}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default withAuth(AdminDashboard, ['admin', 'superadmin']);
