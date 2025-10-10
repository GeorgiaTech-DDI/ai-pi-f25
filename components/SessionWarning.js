/**
 * Session Warning Component
 * 
 * Shows a warning to users before their session times out due to inactivity.
 * Provides options to extend the session or logout gracefully.
 */

import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';

const SESSION_WARNING_TIME = 5 * 60 * 1000; // Show warning 5 minutes before timeout
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes total

export default function SessionWarning({ lastActivity, onExtendSession }) {
  const { instance } = useMsal();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (!lastActivity) return;

    const checkSession = () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;
      const timeUntilTimeout = SESSION_TIMEOUT - timeSinceActivity;
      const timeUntilWarning = SESSION_TIMEOUT - SESSION_WARNING_TIME - timeSinceActivity;

      if (timeUntilTimeout <= 0) {
        // Session has expired
        setShowWarning(false);
        instance.logoutPopup({
          postLogoutRedirectUri: window.location.origin
        }).catch(err => {
          console.error('🔐 Session timeout logout error:', err);
        });
      } else if (timeUntilWarning <= 0 && timeUntilTimeout > 0) {
        // Show warning
        setShowWarning(true);
        setTimeRemaining(Math.ceil(timeUntilTimeout / 1000));
      } else {
        // No warning needed yet
        setShowWarning(false);
      }
    };

    const interval = setInterval(checkSession, 1000); // Check every second
    checkSession(); // Initial check

    return () => clearInterval(interval);
  }, [lastActivity, instance]);

  const handleExtendSession = () => {
    onExtendSession();
    setShowWarning(false);
  };

  const handleLogout = () => {
    setShowWarning(false);
    instance.logoutPopup({
      postLogoutRedirectUri: window.location.origin
    }).catch(err => {
      console.error('🔐 Logout error:', err);
    });
  };

  if (!showWarning) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        maxWidth: '400px',
        width: '90%',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '24px',
          marginBottom: '16px'
        }}>
          ⏰
        </div>
        
        <h3 style={{
          margin: '0 0 12px 0',
          color: '#1f2937',
          fontSize: '18px',
          fontWeight: '600'
        }}>
          Session Timeout Warning
        </h3>
        
        <p style={{
          margin: '0 0 20px 0',
          color: '#6b7280',
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          Your session will expire in <strong>{Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</strong> due to inactivity.
        </p>
        
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center'
        }}>
          <button
            onClick={handleExtendSession}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
          >
            Extend Session
          </button>
          
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
          >
            Logout Now
          </button>
        </div>
        
        <p style={{
          margin: '16px 0 0 0',
          color: '#9ca3af',
          fontSize: '12px'
        }}>
          Click anywhere outside this dialog to dismiss
        </p>
      </div>
    </div>
  );
}
