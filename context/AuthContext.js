'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '@/firebase/firebase';
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile
} from 'firebase/auth';
import { mapUserData } from '@/firebase/mapUserData';
import { setUserCookie, removeUserCookie, getUserFromCookie } from '@/firebase/userCookies';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthContextProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    user: null,
    loading: true
  });

  useEffect(() => {
    // Check for existing session on client-side
    const userFromCookie = getUserFromCookie();
    if (userFromCookie) {
      setAuthState({
        user: userFromCookie,
        loading: false
      });
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Map user data and save to cookie
          const userData = await mapUserData(firebaseUser);
          setUserCookie(userData);
          setAuthState({
            user: userData,
            loading: false
          });
        } catch (error) {
          console.error('Error updating user data:', error);
          removeUserCookie();
          setAuthState({
            user: null,
            loading: false
          });
        }
      } else {
        removeUserCookie();
        setAuthState({
          user: null,
          loading: false
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const signup = async (email, password, name) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, {
      displayName: name
    });
    return userCredential.user;
  };

  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    removeUserCookie();
    setAuthState({
      user: null,
      loading: false
    });
  };

  // Helper function to check if user has required role
  const checkRole = (allowedRoles = []) => {
    if (!authState.user) return false;
    if (allowedRoles.length === 0) return true;
    return allowedRoles.includes(authState.user.role);
  };

  return (
    <AuthContext.Provider value={{
      user: authState.user ? {
        ...authState.user,
        userRole: authState.user.role // For backward compatibility
      } : null,
      loading: authState.loading,
      login,
      signup,
      logout,
      checkRole
    }}>
      {!authState.loading && children}
    </AuthContext.Provider>
  );
};
