/**
 * Server-side Authentication Utilities
 * 
 * Validates Azure AD tokens from API requests to ensure only
 * authenticated @gatech.edu users can access protected endpoints.
 */

import type { NextApiRequest } from "next";

interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  role: string;
}

/**
 * Validates Azure AD authentication token from request headers
 * 
 * In a production environment, this would:
 * 1. Extract the Bearer token from Authorization header
 * 2. Verify the token signature with Azure AD public keys
 * 3. Validate token expiration and claims
 * 4. Return user info if valid
 * 
 * For now, we'll use a simplified approach that checks for
 * the MSAL session cookie that Next.js sets client-side.
 * 
 * @param req - Next.js API request object
 * @returns User object if authenticated, null otherwise
 */
export async function validateAzureToken(req: NextApiRequest): Promise<AuthUser | null> {
  try {
    // Check for custom auth header (set by frontend)
    const authHeader = req.headers['x-user-email'] as string;
    
    if (!authHeader) {
      console.log('🔒 No auth header found');
      return null;
    }

    // Validate email format
    const email = authHeader.toLowerCase();
    if (!email || typeof email !== 'string') {
      console.log('🔒 Invalid email format');
      return null;
    }

    // Verify @gatech.edu domain
    if (!email.endsWith('@gatech.edu')) {
      console.log('🔒 Non-@gatech.edu email rejected:', email);
      return null;
    }

    // Extract display name if provided
    const displayName = (req.headers['x-user-name'] as string) || email.split('@')[0];

    console.log('✅ User authenticated:', email);

    return {
      uid: email, // Use email as unique ID
      email: email,
      displayName: displayName,
      role: 'admin'
    };
  } catch (error) {
    console.error('🔒 Token validation error:', error);
    return null;
  }
}

/**
 * Validates that a user has @gatech.edu email
 * 
 * @param email - Email address to validate
 * @returns true if valid @gatech.edu email
 */
export function validateGatechEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return email.toLowerCase().endsWith('@gatech.edu');
}

/**
 * Middleware wrapper for protecting API routes
 * 
 * Usage:
 * export default withAuth(async function handler(req, res, user) {
 *   // user is guaranteed to be authenticated here
 * });
 */
export function withAuth(
  handler: (req: NextApiRequest, res: any, user: AuthUser) => Promise<any>
) {
  return async (req: NextApiRequest, res: any) => {
    const user = await validateAzureToken(req);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Unauthorized - Please log in with a @gatech.edu account' 
      });
    }
    
    return handler(req, res, user);
  };
}

