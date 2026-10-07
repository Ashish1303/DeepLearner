'use client';
import { useContext } from 'react';
import { AuthContext } from '../components/auth/auth-provider';
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Auth provider required');
  return value;
}
