'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { mapUserData } from '@/firebase/mapUserData';
import { removeUserCookie, setUserCookie, getUserFromCookie } from '@/firebase/userCookies';
import { isProfileComplete } from '@/firebase/profileUtils';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const logout = async () => {
    try {
      await auth.signOut();
      removeUserCookie();
      setUser(null);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    // Get user from cookie on initial load
    const userFromCookie = getUserFromCookie();
    if (!userFromCookie) {
      setUser(null);
      setLoading(false);
      return;
    }
    setUser(userFromCookie);

 

    // Listen for token changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userData = await mapUserData(user);
          setUserCookie(userData);
          setUser(userData);

        } catch (error) {
          console.error('Error updating user data:', error);
          removeUserCookie();
          setUser(null);
        }
      } else {
        removeUserCookie();
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return {
    user,
    loading,
    logout,
  };
}
