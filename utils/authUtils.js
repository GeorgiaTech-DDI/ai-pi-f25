/**
 * Authentication Utilities
 * 
 * This module provides utility functions for JWT token verification
 * and authentication middleware for protected routes.
 */

import jwt from 'jsonwebtoken';

/**
 * Verifies a JWT token and returns the decoded payload
 * @param {string} token - The JWT token to verify
 * @returns {Object|null} - Decoded token payload or null if invalid
 */
export function verifyJWT(token) {
  try {
    if (!token) return null;
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is expired (additional safety check)
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return null;
  }
}

/**
 * Extracts JWT token from request cookies
 * @param {Object} req - Express request object
 * @returns {string|null} - JWT token or null if not found
 */
export function getTokenFromRequest(req) {
  try {
    // Parse cookies manually since Next.js doesn't automatically parse them
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;
    
    const cookies = {};
    cookieHeader.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=');
      cookies[key] = decodeURIComponent(value);
    });
    
    return cookies.admin_token || null;
  } catch (error) {
    console.error('Error extracting token from request:', error);
    return null;
  }
}

/**
 * Authentication middleware for API routes
 * @param {Function} handler - The API route handler
 * @returns {Function} - Wrapped handler with authentication
 */
export function requireAuth(handler) {
  return async (req, res) => {
    try {
      const token = getTokenFromRequest(req);
      
      if (!token) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'No authentication token provided'
        });
      }
      
      const decoded = verifyJWT(token);
      
      if (!decoded) {
        // Clear invalid cookie
        res.setHeader('Set-Cookie', [
          'admin_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict'
        ]);
        
        return res.status(401).json({
          error: 'Invalid token',
          message: 'Authentication token is invalid or expired'
        });
      }
      
      // Add user info to request object
      req.user = {
        username: decoded.username,
        role: decoded.role
      };
      
      return handler(req, res);
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return res.status(500).json({
        error: 'Authentication error',
        message: 'Internal server error during authentication'
      });
    }
  };
}

/**
 * Client-side authentication check
 * @returns {Promise<{username: string, role: string}|null>} - User object or null if not authenticated
 */
export async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/status', {
      method: 'GET',
      credentials: 'include',
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.user || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error checking auth status:', error);
    return null;
  }
}

/**
 * Client-side logout function
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export async function logout() {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    
    return response.ok;
  } catch (error) {
    console.error('Logout error:', error);
    return false;
  }
}
