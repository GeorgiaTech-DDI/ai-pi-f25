/**
 * Logout API Endpoint
 * 
 * This endpoint handles user logout by clearing the authentication cookie.
 */

export default function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests'
    });
  }

  try {
    // Clear the authentication cookie
    res.setHeader('Set-Cookie', [
      'admin_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict' +
      (process.env.NODE_ENV === 'production' ? '; Secure' : '')
    ]);

    return res.status(200).json({
      success: true,
      message: 'Successfully logged out'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during logout'
    });
  }
}
