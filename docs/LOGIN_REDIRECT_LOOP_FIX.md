# Login Redirect Loop - FIXED ✅

## 🐛 **The Problem**

After successfully logging in with Azure AD, the user was redirected back to the login page instead of the dashboard, creating a confusing experience.

---

## 🔍 **Root Cause**

The issue was with MSAL's default behavior and redirect handling:

1. **Azure AD Redirect:** After authentication, Azure AD redirects back to the `redirectUri` (which was the login page: `/admin/login`)

2. **MSAL Default Behavior:** MSAL's `navigateToLoginRequestUrl` defaults to `true`, which means:
   - After handling the redirect response
   - MSAL tries to navigate back to the page where login was initiated
   - This was the login page, creating a loop

3. **Missing Navigation Logic:** The `_app.js` handled the redirect response and validated the email, but **didn't navigate to the dashboard** after successful authentication

---

## ✅ **The Solution**

Made three key changes:

### **1. Disabled MSAL Auto-Navigation**

**File:** `lib/msal.ts`

**Added:**
```typescript
auth: {
  // ... other config
  navigateToLoginRequestUrl: false,  // ← NEW: We handle navigation manually
}
```

**Why:** This prevents MSAL from automatically navigating back to the login page. We take full control of where to redirect after login.

---

### **2. Explicit Redirect URI**

**File:** `lib/msal.ts`

**Changed:**
```typescript
// Before
redirectUri: process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI || window.location.origin

// After
redirectUri: process.env.NEXT_PUBLIC_AZURE_AD_REDIRECT_URI || window.location.origin + '/admin/login'
```

**Why:** Makes it explicit that Azure AD should redirect back to `/admin/login`, not just the home page.

---

### **3. Manual Redirect to Dashboard**

**File:** `pages/_app.js`

**Added:**
```typescript
const router = useRouter();

useEffect(() => {
  const handleRedirect = async () => {
    const response = await msalInstance.handleRedirectPromise();
    
    if (response) {
      // Validate email
      if (!validateGatechEmail(email)) {
        // Logout non-gatech users
        return;
      }
      
      // ← NEW: If on login page, redirect to dashboard
      if (window.location.pathname === '/admin/login') {
        console.log('🔐 Redirecting to dashboard after successful login...');
        router.push('/admin/dashboard');
      }
    }
  };
  
  handleRedirect();
}, [router]);
```

**Why:** After validating the email, we explicitly redirect to `/admin/dashboard` if we're still on the login page.

---

## 🎯 **How It Works Now**

### **Complete Login Flow:**

```
1. User on /admin/login
   ↓
2. Clicks "Sign in with Microsoft"
   ↓
3. Browser redirects to Azure AD
   (https://login.microsoftonline.com/...)
   ↓
4. User enters @gatech.edu credentials
   ↓
5. Azure AD validates credentials
   ↓
6. Azure AD redirects back to:
   https://your-app.vercel.app/admin/login
   + auth code in URL
   ↓
7. App loads (pages/_app.js runs)
   ↓
8. handleRedirectPromise() processes auth code
   ↓
9. Validates email domain (@gatech.edu)
   ✅ Valid → Continue
   ❌ Invalid → Logout & show error
   ↓
10. Check current path = /admin/login
    ↓
11. router.push('/admin/dashboard')
    ↓
12. User sees dashboard! ✅
```

---

## 📊 **Before vs After**

| Step | Before (Broken) | After (Fixed) |
|------|-----------------|---------------|
| **Azure AD redirects to** | `/admin/login` | `/admin/login` |
| **MSAL processes redirect** | ✅ Yes | ✅ Yes |
| **Email validated** | ✅ Yes | ✅ Yes |
| **MSAL auto-navigates** | ❌ Back to `/admin/login` | ✅ Disabled |
| **Manual redirect to dashboard** | ❌ No | ✅ Yes |
| **Final result** | ❌ Stuck on login page | ✅ Dashboard loads |

---

## 🔧 **Files Changed**

### **1. `lib/msal.ts`**
- Added `navigateToLoginRequestUrl: false`
- Made `redirectUri` explicitly point to `/admin/login`

### **2. `pages/_app.js`**
- Added `useRouter` hook
- Added manual redirect to dashboard after successful login
- Only redirects if currently on `/admin/login` page

---

## 🧪 **Testing**

### **Test Successful Login:**
1. Go to `/admin/login`
2. Click "Sign in with Microsoft"
3. Enter @gatech.edu credentials
4. After login, should see:
   - Console log: `🔐 Azure redirect response received`
   - Console log: `✅ Valid @gatech.edu user authenticated`
   - Console log: `🔐 Redirecting to dashboard after successful login...`
5. **Expected:** Dashboard loads ✅
6. **Expected:** URL is `/admin/dashboard` ✅

### **Test Non-@gatech.edu Email:**
1. Try to login with non-gatech email (e.g., gmail.com)
2. After Azure AD login, should see:
   - Alert: "Only @gatech.edu email addresses are allowed to access this portal."
   - Logged out immediately
   - Back on `/admin/login`
3. **Expected:** Cannot access dashboard ✅

### **Test Direct Dashboard Access:**
1. Logout (if logged in)
2. Try to access `/admin/dashboard` directly
3. **Expected:** Redirected to `/admin/login` (by ProtectedRoute) ✅

### **Test Already Authenticated:**
1. Login successfully
2. Try to access `/admin/login` again
3. **Expected:** Immediately redirected to `/admin/dashboard` ✅
   - This is handled by the login page's `useEffect`

---

## 🎓 **Technical Details**

### **Why `navigateToLoginRequestUrl: false`?**

By default, MSAL tries to be helpful:
- When you call `loginRedirect()`, MSAL stores the current URL
- After auth completes, it navigates back to that stored URL
- This is called "login request URL"

**Problem:** In our case:
- Login initiated from `/admin/login`
- After auth, MSAL wants to go back to `/admin/login`
- This creates a loop!

**Solution:** 
- Set `navigateToLoginRequestUrl: false`
- We manually control navigation
- Redirect to `/admin/dashboard` instead

---

### **Why Check `window.location.pathname`?**

The `_app.js` runs on **every page load**, not just login. We only want to redirect to dashboard if:
1. User just completed authentication (response exists)
2. User is currently on the login page

**Without this check:**
- If user navigates to homepage `/` and is authenticated
- We'd redirect them to dashboard unnecessarily
- This would prevent accessing other pages!

**With this check:**
- Only redirect if on `/admin/login` after auth
- Other pages work normally

---

## 💡 **Alternative Solutions (Not Used)**

### **Option 1: Change Redirect URI to Dashboard**

Could set `redirectUri` to `/admin/dashboard`:
```typescript
redirectUri: window.location.origin + '/admin/dashboard'
```

**Pros:**
- Azure AD sends user directly to dashboard
- No need for manual redirect

**Cons:**
- Must register `/admin/dashboard` in Azure AD
- Breaks if dashboard URL changes
- Less flexible (what if we want different post-login pages?)

---

### **Option 2: Use `redirectStartPage` Parameter**

MSAL supports `redirectStartPage` in `loginRedirect()`:
```typescript
await instance.loginRedirect({
  ...loginRequest,
  redirectStartPage: '/admin/dashboard'
});
```

**Pros:**
- MSAL handles navigation

**Cons:**
- **Doesn't work when `navigateToLoginRequestUrl: false`**
- Still requires handling in `_app.js`
- Less explicit control

---

### **Why We Chose Manual Redirect:**

✅ Full control over navigation logic  
✅ Easy to debug (explicit router.push)  
✅ Can add conditions (e.g., redirect based on user role)  
✅ Works consistently across all scenarios  
✅ Clear flow in code  

---

## 🔍 **Debugging Tips**

If login still redirects to login page:

### **1. Check Browser Console**
Look for these logs in order:
```
🔐 Initiating Azure OAuth login...
🔐 Azure redirect response received: {account: {...}}
✅ Valid @gatech.edu user authenticated: user@gatech.edu
🔐 Redirecting to dashboard after successful login...
```

**Missing logs?** Check which step is failing.

---

### **2. Check MSAL Config**
In browser console:
```javascript
console.log(msalInstance.config);
```

Should show:
```javascript
{
  auth: {
    navigateToLoginRequestUrl: false,  // ← Should be false
    redirectUri: "https://your-app.vercel.app/admin/login"
  }
}
```

---

### **3. Check Auth State**
```javascript
const accounts = msalInstance.getAllAccounts();
console.log('Accounts:', accounts);
```

Should show your account after login.

---

### **4. Check Router**
```javascript
console.log('Current path:', window.location.pathname);
console.log('Router ready:', router.isReady);
```

---

## 📝 **Summary**

**Problem:** Login redirected back to login page (loop)

**Root Cause:** 
- MSAL's `navigateToLoginRequestUrl` defaulted to `true`
- No manual redirect to dashboard after auth

**Solution:**
1. Set `navigateToLoginRequestUrl: false` in MSAL config
2. Added manual redirect in `_app.js` after successful auth
3. Only redirect when on `/admin/login` page

**Result:** ✅ Login now redirects to dashboard correctly!

---

## 🚀 **Status**

✅ **FIXED - Ready to Deploy**

The login flow now works as expected:
- User clicks login → Azure AD → Dashboard
- No more redirect loop
- Clean user experience

---

## 🎯 **Key Takeaway**

When using MSAL redirect flow:
1. Set `navigateToLoginRequestUrl: false` for manual control
2. Handle navigation in `handleRedirectPromise()` callback
3. Check current path before redirecting
4. Be explicit about where users should land post-login

This gives you full control and avoids MSAL's "helpful" auto-navigation that can cause loops!

