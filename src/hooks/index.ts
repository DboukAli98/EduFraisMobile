export { useResponsive } from './useResponsive';
export { useAnimatedEntry, staggerDelay } from './useAnimatedEntry';

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { setCredentials, logout as logoutAction } from '../store/slices/authSlice';
import { useLoginMutation, useLogoutMutation } from '../services/api/apiSlice';
import { extractUserFromToken } from '../utils/jwt';
import type { UserRole, LoginRequest } from '../types';

// Re-export typed hooks from store
export { useAppDispatch, useAppSelector } from '../store/store';

/**
 * Hook for authentication actions and state.
 * Login calls the API, decodes the JWT to extract user claims, and stores both.
 */
export function useAuth() {
  const dispatch = useAppDispatch();
  const { user, token, isAuthenticated, isLoading, error } = useAppSelector(
    (state) => state.auth,
  );
  const [loginMutation] = useLoginMutation();
  const [logoutMutation] = useLogoutMutation();

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const result = await loginMutation(credentials).unwrap();
      if (result.success && result.token) {
        const decoded = extractUserFromToken(result.token);
        if (decoded) {
          dispatch(
            setCredentials({
              user: decoded,
              token: result.token,
            }),
          );
        }
      }
      return result;
    },
    [dispatch, loginMutation],
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation().unwrap();
    } catch {
      // Logout even if API call fails (token may already be invalid)
    } finally {
      dispatch(logoutAction());
    }
  }, [dispatch, logoutMutation]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
  };
}

/**
 * Hook that returns the current user's role from auth state.
 */
export function useRole(): UserRole | null {
  const user = useAppSelector((state) => state.auth.user);
  return user?.role ?? null;
}
