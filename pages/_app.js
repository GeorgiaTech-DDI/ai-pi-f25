import "../styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { inter } from "../utils/fonts";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "../lib/msal";
import { validateGatechEmail } from "../lib/msal";
import SessionWarning from "../components/SessionWarning";
import { useEffect } from "react";
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
  
  useEffect(() => {
    // Handle redirect response from Azure AD
    const handleRedirect = async () => {
      try {
        const response = await msalInstance.handleRedirectPromise();
        
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
          
          // If we're on the login page, redirect to dashboard
          if (window.location.pathname === '/admin/login') {
            console.log('🔐 Redirecting to dashboard after successful login...');
            router.push('/admin/dashboard');
          }
        }
      } catch (error) {
        console.error('🔐 Error handling redirect:', error);
      }
    };
    
    handleRedirect();
  }, [router]);
  
  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>
        <AppContent Component={Component} pageProps={pageProps} />
      </AuthProvider>
    </MsalProvider>
  );
}

export default MyApp;
