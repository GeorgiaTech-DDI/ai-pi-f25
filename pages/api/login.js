/**
 * Admin Login API Endpoint
 * 
 * This endpoint handles admin authentication with the following security measures:
 * - bcrypt password hashing
 * - JWT token generation
 * - Secure HTTP-only cookies
 * - Rate limiting for brute force protection
 * - Input validation and sanitization
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Rate limiter configuration - max 10 attempts per minute per IP
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
  points: 10, // Number of attempts
  duration: 60, // Per 60 seconds
});

/**
 * Validates environment variables required for authentication
 */
function validateEnvironment() {
  const requiredEnvVars = ['JWT_SECRET'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
  
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
}

/**
 * Validates and sanitizes input data
 */
function validateInput(username, password) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new Error('Invalid input format');
  }
  
  // Trim whitespace and limit length to prevent abuse
  const cleanUsername = username.trim();
  const cleanPassword = password.trim();
  
  if (cleanUsername.length === 0 || cleanPassword.length === 0) {
    throw new Error('Username and password cannot be empty');
  }
  
  if (cleanUsername.length > 100 || cleanPassword.length > 500) {
    throw new Error('Input length exceeds maximum allowed');
  }
  
  return { cleanUsername, cleanPassword };
}

/**
 * Generates a JWT token with appropriate claims and expiration
 */
function generateJWT(username) {
  const payload = {
    username,
    role: 'admin',
    iat: Math.floor(Date.now() / 1000), // Issued at
    exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60), // Expires in 8 hours
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256' });
}

/**
 * Sets secure HTTP-only cookie with JWT token
 */
function setSecureCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.setHeader('Set-Cookie', [
    `admin_token=${token}; ` +
    `HttpOnly; ` +
    `Path=/; ` +
    `SameSite=Strict; ` +
    `Max-Age=${8 * 60 * 60}; ` + // 8 hours
    (isProduction ? 'Secure; ' : '') // Only secure in production
  ]);
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests'
    });
  }
  
  try {
    // Validate environment configuration
    validateEnvironment();
    
    
    // Check rate limiting
    try {
      await rateLimiter.consume(req);
    } catch (rateLimiterRes) {
      const remainingPoints = rateLimiterRes.remainingPoints;
      const msBeforeNext = rateLimiterRes.msBeforeNext;
      
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Too many login attempts. Please try again later.',
        retryAfter: Math.ceil(msBeforeNext / 1000)
      });
    }
    
    // Parse and validate request body
    const { username, password } = req.body;
    let cleanUsername, cleanPassword;
    
    try {
      ({ cleanUsername, cleanPassword } = validateInput(username, password));
    } catch (validationError) {
      return res.status(400).json({
        error: 'Invalid input',
        message: validationError.message
      });
    }
    
    // Check username match (case-sensitive)
    const ADMIN_USERNAME = 'admin'; // Using hardcoded admin username
    if (cleanUsername !== ADMIN_USERNAME) {
      // Always use the same delay even for invalid usernames to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100));
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid username or password'
      });
    }
    
    // Verify password using bcrypt
    try {
      // Using hardcoded password hash for admin123
      const ADMIN_PASSWORD_HASH = '$2b$12$tLsd86Rk5oe5cUzYCH.Mru3n28oiij5zK1hn1t3ab.mOrjhFjDNKm';
      const isPasswordValid = await bcrypt.compare(cleanPassword, ADMIN_PASSWORD_HASH);
      
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid username or password'
        });
      }
    } catch (bcryptError) {
      console.error('Bcrypt error:', bcryptError);
      return res.status(500).json({
        error: 'Authentication error',
        message: 'Internal server error during authentication'
      });
    }
    
    // Generate JWT token
    let token;
    try {
      token = generateJWT(cleanUsername);
    } catch (jwtError) {
      console.error('JWT generation error:', jwtError);
      return res.status(500).json({
        error: 'Token generation failed',
        message: 'Internal server error during token generation'
      });
    }
    
    // Set secure cookie
    setSecureCookie(res, token);
    
    // Successful authentication response
    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      user: {
        username: cleanUsername,
        role: 'admin'
      }
    });
    
  } catch (error) {
    console.error('Login endpoint error:', error);
    
    // Don't expose internal errors to clients
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  }
}
