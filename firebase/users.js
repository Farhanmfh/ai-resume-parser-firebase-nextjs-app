'use client';
import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import axios from 'axios';
import { mapUserData } from './mapUserData';
import { setUserCookie, removeUserCookie } from './userCookies';

// Function to handle user sign in
export const handleUserSignIn = async (user) => {
  try {
    // For new users, set initial role
    if (user.metadata.creationTime === user.metadata.lastSignInTime) {
      await updateRole(user.uid, 'standardUser');
      // Force token refresh to get the new role
      await user.getIdToken(true);
    }

    // Map user data and save to cookie
    const userData = await mapUserData(user);
    setUserCookie(userData);
    return userData;

  } catch (error) {
    console.error('Error in handleUserSignIn:', error);
    throw error;
  }
};

// Function to sign in with Google
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return await handleUserSignIn(result.user);
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

// Function to update user role (for admin use)
export const updateUserRole = async (userId, newRole) => {
  try {
    // Update role via Cloud Run endpoint
    await updateRole(userId, newRole);
    
    // Force token refresh if it's the current user
    if (auth.currentUser?.uid === userId) {
      await auth.currentUser.getIdToken(true);
      // Update cookie with new role
      const userData = await mapUserData(auth.currentUser);
      setUserCookie(userData);
    }
    
    return true;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

// Function to update role via Cloud Run
async function updateRole(uid, role) {
  try {
    const response = await axios.post('https://setuserrole-palgmtgdda-uc.a.run.app', {
      uid: uid,
      role: role
    });
    console.log('Role update response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating role:', error.response?.data || error.message);
    throw error;
  }
}

// Function to sign out
export const signOut = async () => {
  try {
    await auth.signOut();
    removeUserCookie();
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};
