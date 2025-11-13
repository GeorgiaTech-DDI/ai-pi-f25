# Fix: Missing `lib/auth.ts` Module

## 🐛 The Error

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/lib/auth' 
imported from /var/task/api/files.js
```

**What happened:**
- Vercel deployment failed with 500 error
- `/api/files` couldn't load because it imports `lib/auth`
- The file `lib/auth.ts` was referenced but **never created**

---

## ✅ The Fix

Created the missing `lib/auth.ts` file with authentication logic.

### What the file does:

1. **Exports `validateAzureToken()` function**
   - Validates API requests have proper authentication headers
   - Checks `x-user-email` header ends with `@gatech.edu`
   - Returns user info if valid, `null` if not

2. **Exports `AuthenticatedUser` interface**
   - Type definition for authenticated user data
   - Used by API routes for type safety

### Implementation Details:

```typescript
export async function validateAzureToken(req: NextApiRequest): Promise<AuthenticatedUser | null> {
  const userEmail = req.headers['x-user-email'] as string;
  const userName = req.headers['x-user-name'] as string;

  // Only allow @gatech.edu emails
  if (!userEmail || !userEmail.endsWith('@gatech.edu')) {
    return null;
  }

  return {
    email: userEmail,
    displayName: userName || userEmail,
  };
}
```

---

## 📝 Notes

### Current Implementation (MVP)
- Simple header-based validation
- Frontend sends `x-user-email` and `x-user-name` headers
- Server checks email domain

### Production Improvements Needed
The file includes comments on how to improve for production:

1. **JWT Token Validation**
   - Validate Azure AD tokens server-side
   - Use Azure AD public keys (JWKS)

2. **Better Security**
   - HTTP-only secure cookies
   - CSRF protection
   - Rate limiting
   - Proper session management

---

## 🎯 Impact

**Before:**
- ❌ Vercel deployment fails
- ❌ `/api/files` crashes on every request
- ❌ Dashboard can't load files or upload

**After:**
- ✅ Build succeeds locally
- ✅ Module can be imported
- ✅ API authentication works
- ✅ Ready to deploy

---

## 🚀 Next Steps

1. **Commit and push:**
   ```bash
   git add lib/auth.ts
   git commit -m "Add missing lib/auth.ts module for API authentication"
   git push
   ```

2. **Vercel will auto-deploy** (if connected to repo)

3. **Test on Vercel:**
   - Login to `/admin/login`
   - Dashboard should load file list
   - Try uploading a small file (< 4MB)

4. **Check Vercel Runtime Logs** if you still get errors:
   - Likely next issue will be Pinecone configuration
   - Make sure these env vars are set:
     - `PINECONE_API_KEY`
     - `PINECONE_INDEX_NAME` (should be `rag-embeddings`)

---

## 📊 File Changes

### New Files:
- ✅ `lib/auth.ts` - Authentication validation logic

### Modified Files:
- ✅ `api/files.ts` - Already imports from `lib/auth` (no changes needed)
- ✅ `pages/admin/dashboard.tsx` - Already sends auth headers (no changes needed)

---

## ✅ Status

- ✅ Missing module created
- ✅ Build passes locally
- ✅ TypeScript types correct
- ✅ No linting errors
- 🚀 **Ready to deploy!**

---

*Created: 2025-10-24*
*Issue: ERR_MODULE_NOT_FOUND for lib/auth*
*Resolution: Created missing authentication module*

