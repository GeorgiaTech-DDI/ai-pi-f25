import "../styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { inter } from "../utils/fonts";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "../lib/msal";
import { validateGatechEmail } from "../lib/msal";
import SessionWarning from "../components/SessionWarning";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

// Inner component that can use AuthContext
function AppContent({ Component, pageProps }) {
  const { lastActivity, extendSession } = useAuth();
  
  return (
    <>
      <main className={`${inter.className}`}>
        <Component {...pageProps} />
        <Analytics />
        <SpeedInsights />
      </main>
      <SessionWarning lastActivity={lastActivity} onExtendSession={extendSession} />
    </>
  );
}

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [isRedirectHandled, setIsRedirectHandled] = useState(false);
  
  useEffect(() => {
    // Handle redirect response from Azure AD BEFORE rendering app
    const handleRedirect = async () => {
      try {
        console.log('🔐 Starting handleRedirectPromise...');
        const response = await msalInstance.handleRedirectPromise();
        
        console.log('🔐 handleRedirectPromise completed. Response:', response);
        console.log('🔐 Current accounts:', msalInstance.getAllAccounts());
        
        if (response) {
          console.log('🔐 Azure redirect response received:', response);
          const email = response.account.username;
          
          // Validate email domain
          if (!validateGatechEmail(email)) {
            console.error('🔐 Invalid email domain:', email);
            
            // Logout the user immediately
            await msalInstance.logoutRedirect({
              account: response.account,
              postLogoutRedirectUri: window.location.origin + '/admin/login'
            });
            
            alert('Only @gatech.edu email addresses are allowed to access this portal.');
            return;
          }
          
          console.log('✅ Valid @gatech.edu user authenticated:', email);
          console.log('🔐 Accounts after auth:', msalInstance.getAllAccounts());
        } else {
          console.log('🔐 No redirect response (user may already be authenticated or first load)');
          console.log('🔐 Existing accounts:', msalInstance.getAllAccounts());
        }
      } catch (error) {
        console.error('🔐 Error handling redirect:', error);
      } finally {
        console.log('🔐 Marking redirect as handled, rendering app...');
        // Mark redirect handling as complete
        setIsRedirectHandled(true);
      }
    };
    
    handleRedirect();
  }, []);
  
  // Don't render app until redirect is handled
  if (!isRedirectHandled) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f8fafc'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e2e8f0',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
  
  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>
        <AppContent Component={Component} pageProps={pageProps} />
      </AuthProvider>
    </MsalProvider>
  );
}

export default MyApp;
