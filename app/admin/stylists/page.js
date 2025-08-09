'use client';
import { useState, useEffect, useRef } from 'react';
import { getStylists, addStylist, updateStylist, deleteStylist } from '@/firebase/stylists';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import StarIcon from '@mui/icons-material/Star';
import Image from 'next/image';

export default function StylistsPage() {
  const [stylists, setStylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadStylists();
  }, []);

  const loadStylists = async () => {
    try {
      const stylistsData = await getStylists();
      setStylists(stylistsData);
      setError(null);
    } catch (err) {
      console.error('Error loading stylists:', err);
      setError('Failed to load stylists');
    } finally {
      setLoading(false);
    }
  };

  const [open, setOpen] = useState(false);
  const [editingStylist, setEditingStylist] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    specialization: '',
    image: '',
    isTopRated: false,
  });

  const handleOpen = (stylist = null) => {
    if (stylist) {
      setEditingStylist(stylist);
      setFormData({
        name: stylist.name,
        specialization: stylist.specialization,
        image: stylist.image,
        isTopRated: stylist.isTopRated,
      });
    } else {
      setEditingStylist(null);
      setFormData({
        name: '',
        specialization: '',
        image: '',
        isTopRated: false,
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingStylist(null);
  };

  const handleSubmit = async () => {
    try {
      const imageFile = fileInputRef.current?.files[0];
      if (editingStylist) {
        const updatedStylist = await updateStylist(editingStylist.id, formData, imageFile);
        setStylists(stylists.map(s => 
          s.id === editingStylist.id 
            ? updatedStylist
            : s
        ));
      } else {
        const newStylist = await addStylist(formData, imageFile);
        setStylists([...stylists, newStylist]);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      handleClose();
    } catch (err) {
      console.error('Error saving stylist:', err);
      setError('Failed to save stylist');
    }
  };

  const handleDelete = async (stylistId) => {
    try {
      const stylist = stylists.find(s => s.id === stylistId);
      await deleteStylist(stylistId, stylist?.image);
      setStylists(stylists.filter(s => s.id !== stylistId));
    } catch (err) {
      console.error('Error deleting stylist:', err);
      setError('Failed to delete stylist');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h5">
          Stylists
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
        >
          Add Stylist
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {loading ? (
        <Typography>Loading stylists...</Typography>
      ) : (
        <Grid container spacing={3}>
          {stylists.map((stylist) => (
            <Grid item xs={12} sm={6} md={4} key={stylist.id}>
              <Card sx={{ borderRadius: 2 }}>
                <CardMedia
                  component="img"
                  height="200"
                  image={stylist.image}
                  alt={stylist.name}
                  sx={{ objectFit: 'cover' }}
                />
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h6" component="div">
                      {stylist.name}
                    </Typography>
                    {stylist.isTopRated && (
                      <Chip
                        icon={<StarIcon sx={{ color: '#FFD700 !important' }} />}
                        label="Top Rated"
                        size="small"
                        sx={{ bgcolor: 'rgba(255, 215, 0, 0.1)' }}
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {stylist.specialization}
                  </Typography>
                </CardContent>
                <CardActions>
                  <IconButton 
                    color="primary"
                    onClick={() => handleOpen(stylist)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton 
                    color="error"
                    onClick={() => handleDelete(stylist.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>
          {editingStylist ? 'Edit Stylist' : 'Add New Stylist'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Stylist Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              label="Specialization"
              fullWidth
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
            />
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const previewUrl = URL.createObjectURL(file);
                  setFormData({ ...formData, image: previewUrl });
                }
              }}
            />
            <Button
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
              fullWidth
              sx={{ height: 56 }}
            >
              {formData.image ? 'Change Image' : 'Upload Image'}
            </Button>
            {formData.image && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Image
                  src={formData.image}
                  alt="Preview"
                  width={500}
                  height={300}
                  style={{
                    objectFit: 'cover',
                    borderRadius: 8
                  }}
                />
              </Box>
            )}
            <Button
              variant="outlined"
              onClick={() => setFormData({ ...formData, isTopRated: !formData.isTopRated })}
              startIcon={<StarIcon sx={{ color: formData.isTopRated ? '#FFD700' : 'inherit' }} />}
            >
              {formData.isTopRated ? 'Remove Top Rated' : 'Mark as Top Rated'}
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button 
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.name || !formData.specialization || !formData.image}
          >
            {editingStylist ? 'Save Changes' : 'Add Stylist'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
