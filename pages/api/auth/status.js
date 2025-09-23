/**
 * Authentication Status API Endpoint
 * 
 * This endpoint checks the current authentication status of the user
 * by verifying their JWT token from cookies.
 */

import { requireAuth } from '../../../utils/authUtils';

async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'This endpoint only accepts GET requests'
    });
  }

  try {
    // If we get here, the user is authenticated (thanks to requireAuth middleware)
    return res.status(200).json({
      authenticated: true,
      user: req.user
    });
  } catch (error) {
    console.error('Auth status error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  }
}

// Wrap with authentication middleware
export default requireAuth(handler);
