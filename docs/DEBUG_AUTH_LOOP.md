# Debugging Authentication Loop Issue

## 🔍 **How to Debug**

I've added extensive logging to help diagnose the issue. Here's what to do:

### **Step 1: Open Browser Console**

1. Open your app in the browser
2. Open Developer Tools (F12 or right-click → Inspect)
3. Go to the **Console** tab
4. Clear any existing logs (click the 🚫 icon)

### **Step 2: Attempt Login**

1. Go to `/admin/login`
2. Click "Sign in with Microsoft"
3. Enter your @gatech.edu credentials
4. Watch the console logs carefully

### **Step 3: Analyze the Logs**

You should see logs in this order. **Copy the exact logs and send them to me.**

#### **Expected Flow (Working):**

```
🔐 Starting handleRedirectPromise...
🔐 handleRedirectPromise completed. Response: {...}
🔐 Current accounts: [{...}]
🔐 Azure redirect response received: {...}
✅ Valid @gatech.edu user authenticated: user@gatech.edu
🔐 Accounts after auth: [{username: "user@gatech.edu", ...}]
🔐 Marking redirect as handled, rendering app...
🔐 AuthContext: Setting up MSAL auth listener...
🔐 AuthContext: inProgress = none
🔐 AuthContext: accounts = [{username: "user@gatech.edu", ...}]
🔐 AuthContext: No auth in progress, checking accounts...
🔐 AuthContext: MSAL account found: user@gatech.edu
🔐 AuthContext: Email validation passed, setting user...
✅ AuthContext: @gatech.edu user authenticated successfully
🔐 AuthContext: Setting loading to false
🔒 Access granted - user authenticated: user@gatech.edu
```

#### **Broken Flow (What might be happening):**

**Scenario A: No redirect response**
```
🔐 Starting handleRedirectPromise...
🔐 handleRedirectPromise completed. Response: null
🔐 Current accounts: []  ← NO ACCOUNTS!
🔐 No redirect response
🔐 Existing accounts: []
🔐 Marking redirect as handled, rendering app...
🔐 AuthContext: accounts = []
🔐 AuthContext: No MSAL account found, setting user to null
🔒 Access denied - redirecting to login  ← PROBLEM!
```

**Scenario B: Redirect response but account not stored**
```
🔐 Starting handleRedirectPromise...
🔐 handleRedirectPromise completed. Response: {...}
🔐 Current accounts: []  ← RESPONSE EXISTS BUT NO ACCOUNT STORED!
✅ Valid @gatech.edu user authenticated: user@gatech.edu
🔐 Accounts after auth: []  ← STILL EMPTY!
🔐 Marking redirect as handled, rendering app...
🔐 AuthContext: accounts = []
🔐 AuthContext: No MSAL account found
🔒 Access denied - redirecting to login
```

**Scenario C: Auth in progress**
```
🔐 Starting handleRedirectPromise...
🔐 handleRedirectPromise completed. Response: {...}
✅ Valid @gatech.edu user authenticated: user@gatech.edu
🔐 Marking redirect as handled, rendering app...
🔐 AuthContext: inProgress = handleRedirect  ← STILL IN PROGRESS!
🔐 AuthContext: Auth in progress, keeping loading state...
(Gets stuck in loading state)
```

---

## 🐛 **Common Issues & Solutions**

### **Issue 1: `accounts` array is empty after `handleRedirectPromise()`**

**Symptom:**
```
Response: {...}  ← Response exists
Current accounts: []  ← But no accounts!
```

**Cause:** MSAL might not be properly configured or cache is corrupted

**Solution:**
1. Clear browser localStorage:
   ```javascript
   localStorage.clear();
   ```
2. Clear browser cookies
3. Try logging in again

---

### **Issue 2: `response` is `null`**

**Symptom:**
```
Response: null
No redirect response
```

**Cause:** Azure AD isn't redirecting with auth code, or redirect was already handled

**Possible reasons:**
- Wrong redirect URI in Azure AD
- Wrong redirect URI in environment variable
- Already logged in (this is normal on subsequent loads)

**Solution:**
1. Check Azure Portal → App Registration → Authentication
2. Verify redirect URI matches: `https://your-app.vercel.app/admin/dashboard`
3. Check environment variable `NEXT_PUBLIC_AZURE_AD_REDIRECT_URI`

---

### **Issue 3: `inProgress` is not 'none'**

**Symptom:**
```
AuthContext: inProgress = handleRedirect
Auth in progress, keeping loading state...
```

**Cause:** MSAL thinks auth is still in progress

**Solution:**
This shouldn't happen after `handleRedirectPromise()` completes. If it does, there's a bug in MSAL integration.

Try waiting a few seconds and checking `inProgress` value again.

---

### **Issue 4: Multiple `handleRedirectPromise()` calls**

**Symptom:**
```
🔐 Starting handleRedirectPromise...
🔐 Starting handleRedirectPromise...  ← DUPLICATE!
```

**Cause:** Component rendering multiple times, calling `handleRedirectPromise()` twice

**Problem:** This can cause issues! `handleRedirectPromise()` should only be called ONCE.

**Solution:** Check if `useEffect` dependency array is correct (should be `[]`)

---

## 🔧 **Additional Debugging Steps**

### **Check 1: Verify MSAL Instance**

In browser console, run:
```javascript
console.log('MSAL accounts:', window.msalInstance?.getAllAccounts());
```

You should see your account if logged in.

### **Check 2: Check localStorage**

In browser console, run:
```javascript
Object.keys(localStorage).filter(key => key.includes('msal'));
```

You should see MSAL cache keys if auth succeeded.

### **Check 3: Check Current URL**

After Azure AD redirects, check the URL:
```javascript
console.log('Current URL:', window.location.href);
```

Should be:
```
https://your-app.vercel.app/admin/dashboard?code=...&state=...
```

### **Check 4: Network Tab**

1. Open Developer Tools → Network tab
2. Filter by "Fetch/XHR"
3. Look for requests to `login.microsoftonline.com`
4. Check if auth succeeded (Status 200)

---

## 📋 **What to Send Me**

Please provide:

1. **Console logs** (full output, copy all logs starting from "Starting handleRedirectPromise")

2. **Current URL** after Azure AD redirects

3. **Environment variable value:**
   ```
   NEXT_PUBLIC_AZURE_AD_REDIRECT_URI = ?
   ```

4. **Azure AD registered redirect URIs** (screenshot or list)

5. **Any error messages** in console (red text)

---

## 🎯 **Quick Tests**

### **Test A: Check if account exists**

After redirect, run in console:
```javascript
console.log('Accounts:', msalInstance.getAllAccounts());
```

**Expected:** Array with your account  
**If empty:** Problem with MSAL configuration or redirect handling

### **Test B: Manual account check**

After redirect, run:
```javascript
const accounts = msalInstance.getAllAccounts();
if (accounts.length > 0) {
  console.log('✅ Account found:', accounts[0].username);
} else {
  console.log('❌ No accounts found!');
  console.log('LocalStorage keys:', Object.keys(localStorage));
}
```

### **Test C: Check AuthContext state**

Add this to browser console after redirect:
```javascript
// This won't work directly, but you can check the React DevTools
// Install React DevTools extension and check AuthContext state
```

---

## 🚨 **Most Likely Causes**

Based on the symptoms, here are the most common causes:

### **1. Wrong Redirect URI** (90% likely)
- Check `NEXT_PUBLIC_AZURE_AD_REDIRECT_URI` matches Azure AD config
- Should be: `https://your-app.vercel.app/admin/dashboard`
- NOT: `https://your-app.vercel.app` or `/admin/login`

### **2. Browser Cache** (5% likely)
- Old MSAL cache causing issues
- Clear localStorage and cookies

### **3. MSAL Configuration** (3% likely)
- `navigateToLoginRequestUrl: false` might be causing issues
- Check `lib/msal.ts` configuration

### **4. Race Condition Still Exists** (2% likely)
- Even with our fix, there might be edge cases
- Need more detailed logs to diagnose

---

## 💡 **Temporary Workaround**

If you need to test other features while debugging this:

**Option 1: Disable ProtectedRoute temporarily**

In `pages/admin/dashboard.tsx`, comment out the `ProtectedRoute` wrapper:
```javascript
// return (
//   <ProtectedRoute>
     return (
       <div>...dashboard content...</div>
     );
//   </ProtectedRoute>
// );
```

**⚠️ WARNING:** This removes auth protection! Only for testing!

**Option 2: Always assume authenticated**

In `components/ProtectedRoute.js`:
```javascript
// Comment out the redirect
if (!loading && !isAuthenticated) {
  // console.log('🔒 Access denied - redirecting to login');
  // router.replace('/admin/login');
  return <div>Not authenticated but showing anyway for debug</div>;
}
```

---

## 📝 **Next Steps**

1. **Clear browser cache and localStorage**
2. **Try logging in with console open**
3. **Copy ALL console logs**
4. **Send logs to me for analysis**

With the detailed logs, I can pinpoint exactly where the authentication flow is breaking.

The logs will show us:
- ✅ If `handleRedirectPromise()` works
- ✅ If accounts are being stored
- ✅ If AuthContext is receiving the accounts
- ✅ Where exactly the flow breaks

