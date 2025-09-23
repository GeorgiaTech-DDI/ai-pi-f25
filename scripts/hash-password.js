#!/usr/bin/env node
/**
 * Password Hashing Helper Script
 * 
 * This script generates a bcrypt hash for a password to be used in the .env.local file.
 * Usage: node scripts/hash-password.js "your_password_here"
 * 
 * The generated hash should be stored in the ADMIN_PASSWORD_HASH environment variable.
 */

import bcrypt from 'bcrypt';

// Get password from command line arguments
const password = process.argv[2];

if (!password) {
  console.error('Error: Please provide a password as an argument.');
  console.log('Usage: node scripts/hash-password.js "your_password_here"');
  process.exit(1);
}

// Validate password strength
if (password.length < 8) {
  console.error('Error: Password must be at least 8 characters long.');
  process.exit(1);
}

const hasUpperCase = /[A-Z]/.test(password);
const hasLowerCase = /[a-z]/.test(password);
const hasNumbers = /\d/.test(password);
const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
  console.warn('Warning: For better security, password should contain:');
  console.warn('- At least one uppercase letter');
  console.warn('- At least one lowercase letter');
  console.warn('- At least one number');
  console.warn('- At least one special character');
  console.warn('');
}

async function hashPassword() {
  try {
    // Use saltRounds = 12 for good security
    const saltRounds = 12;
    const hash = await bcrypt.hash(password, saltRounds);
    
    console.log('Password hashed successfully!');
    console.log('');
    console.log('Add the following to your .env.local file:');
    console.log('ADMIN_PASSWORD_HASH=' + hash);
    console.log('');
    console.log('⚠️  SECURITY WARNING: Never share this hash or store it in version control!');
    
  } catch (error) {
    console.error('Error hashing password:', error);
    process.exit(1);
  }
}

hashPassword();
