import type { User, UserRole } from '../types';

interface JwtPayload {
  sub: string;
  unique_name: string;
  jti: string;
  exp: string;
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': string;
  phoneNumber: string;
  Name: string;
  Email: string;
  School: string;
  EntityUserId: string;
  [key: string]: string;
}

/**
 * Decode a JWT token without verification (client-side only).
 * We only need the payload to extract user claims.
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64url → Base64 → decode
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '=='.slice(0, (4 - (base64.length % 4)) % 4);
    const jsonString = atob(padded);
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

/**
 * Extract a User object from a JWT token string.
 */
export function extractUserFromToken(token: string): User | null {
  const payload = decodeJwt(token);
  if (!payload) return null;

  const roleClaim =
    payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || '';

  return {
    id: payload.sub || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || '',
    name: payload.Name || payload.unique_name || '',
    email: payload.Email || '',
    phoneNumber: payload.phoneNumber || '',
    role: roleClaim.toLowerCase() as UserRole,
    entityUserId: payload.EntityUserId || '',
    schoolId: payload.School || '',
  };
}

/**
 * Check if a JWT token is expired.
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload?.exp) return true;
  const expMs = parseInt(payload.exp, 10) * 1000;
  return Date.now() >= expMs;
}
