import type { NextApiRequest } from 'next';

/**
 * Authenticated user information
 */
export interface AuthenticatedUser {
  email: string;
  displayName: string;
}

/**
 * Validates Azure AD authentication for API routes
 * 
 * This is a simple header-based validation for MVP.
 * In production, you would validate JWT tokens from Azure AD.
 * 
 * @param req - The Next.js API request
 * @returns The authenticated user if valid, null otherwise
 */
export async function validateAzureToken(req: NextApiRequest): Promise<AuthenticatedUser | null> {
  // Extract user information from headers
  // These are set by the frontend after successful Azure AD login
  const userEmail = req.headers['x-user-email'] as string;
  const userName = req.headers['x-user-name'] as string;

  // Validate email exists and is from Georgia Tech
  if (!userEmail || !userEmail.endsWith('@gatech.edu')) {
    return null;
  }

  // Return authenticated user
  return {
    email: userEmail,
    displayName: userName || userEmail,
  };
}

/**
 * NOTE: This is a simplified authentication approach for MVP.
 * 
 * For production, you should:
 * 1. Use server-side JWT validation with Azure AD public keys
 * 2. Implement proper session management
 * 3. Add rate limiting
 * 4. Add CSRF protection
 * 5. Use secure HTTP-only cookies instead of headers
 * 
 * Example with JWT validation:
 * ```typescript
 * import { jwtVerify } from 'jose';
 * 
 * const JWKS_URI = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
 * 
 * export async function validateAzureToken(req: NextApiRequest) {
 *   const token = req.headers.authorization?.split('Bearer ')[1];
 *   if (!token) return null;
 *   
 *   try {
 *     const { payload } = await jwtVerify(token, getKey);
 *     if (!payload.email?.endsWith('@gatech.edu')) return null;
 *     return { email: payload.email, displayName: payload.name };
 *   } catch {
 *     return null;
 *   }
 * }
 * ```
 */
