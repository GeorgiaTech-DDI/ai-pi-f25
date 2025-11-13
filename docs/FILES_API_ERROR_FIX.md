# Files API Error - "Request Entity..." ✅

## 🐛 **The Error**

```
Error: Unexpected token 'R', "Request En"... is not valid JSON
```

## 🔍 **What's Happening**

1. Dashboard loads successfully ✅
2. Tries to fetch files: `GET /api/files`
3. **API returns 500 Internal Server Error**
4. Error response is **plain text**, not JSON
5. Frontend tries to parse as JSON → fails

---

## ✅ **Fix #1: Better Error Handling (Done)**

Updated `pages/admin/dashboard.tsx` to handle both JSON and text error responses:

```typescript
if (!response.ok) {
  // Try to parse as JSON, fallback to text
  let errorMessage = 'Failed to load files';
  try {
    const errorData = await response.json();
    errorMessage = errorData.error || errorMessage;
  } catch {
    const errorText = await response.text();
    errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
  }
  throw new Error(errorMessage);
}
```

Now you'll see the **actual error message** instead of "Unexpected token 'R'".

---

## 🔍 **Fix #2: Find the Root Cause**

The 500 error from `/api/files` is likely caused by:

### **Most Likely: Missing Environment Variables**

The API needs these to work:
```bash
PINECONE_API_KEY=xxx
PINECONE_INDEX_NAME=rag-embeddings
```

**Check in Vercel:**
1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify `PINECONE_API_KEY` is set
3. Verify `PINECONE_INDEX_NAME` is set
4. If missing → Add them → Redeploy

---

### **Possible: Pinecone Index Doesn't Exist**

The API tries to query Pinecone index. If the index doesn't exist:

**Check in Pinecone:**
1. Go to [Pinecone Console](https://app.pinecone.io)
2. Check if index `rag-embeddings` exists
3. If not → Create it:
   - Name: `rag-embeddings`
   - Dimensions: `1024`
   - Metric: `cosine`

---

### **Possible: Pinecone API Error**

If Pinecone is configured but still errors:

**Debug by checking Vercel logs:**
1. Vercel Dashboard → Your Project → Deployments
2. Click on the latest deployment → Runtime Logs
3. Look for errors from `/api/files`
4. You should see: `Files API error: [actual error]`

---

## 🧪 **Testing**

**After the fix, refresh the dashboard:**

**Scenario A: Pinecone Not Configured**
- Error message will now show: "Internal server error" or specific Pinecone error
- Check Vercel logs for details

**Scenario B: Pinecone Empty (No Files)**
- ✅ No error
- Shows: "No files uploaded yet."
- This is **normal** for a fresh setup!

**Scenario C: Everything Works**
- ✅ File list loads (empty or with files)
- No errors

---

## 📋 **Deployment Checklist for File Management**

To make the file upload feature work on Vercel:

### **Required Environment Variables:**
```bash
# Pinecone (for file storage)
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=rag-embeddings

# Embeddings (choose one)
DEEPINFRA_API_KEY=your_deepinfra_key
# OR
HF_API_KEY=your_huggingface_key
HF_API_URL=https://api-inference.huggingface.co

# Already configured (for auth)
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=xxx
NEXT_PUBLIC_AZURE_AD_TENANT_ID=xxx
NEXT_PUBLIC_AZURE_AD_REDIRECT_URI=https://ai-pi-f25.vercel.app/admin/dashboard
NEXT_PUBLIC_AZURE_AD_POST_LOGOUT_REDIRECT_URI=https://ai-pi-f25.vercel.app/admin/login
```

### **Pinecone Setup:**
1. ✅ Create Pinecone account
2. ✅ Create index: `rag-embeddings` (1024 dimensions, cosine metric)
3. ✅ Get API key
4. ✅ Add to Vercel env vars

### **DeepInfra Setup (for embeddings):**
1. ✅ Create DeepInfra account
2. ✅ Get API key
3. ✅ Add `DEEPINFRA_API_KEY` to Vercel

---

## 🎯 **What to Do Now**

### **Step 1: Check What Error You Actually Get**

With the fix applied, refresh the dashboard and check the error message:

**In the browser:**
- Look at the error banner on the dashboard
- It should now show a meaningful error message

**In Vercel logs:**
- Go to Vercel → Deployments → Latest → Runtime Logs
- Look for errors from `/api/files`

### **Step 2: Based on the Error:**

**If error mentions "Pinecone":**
- Check Pinecone API key in Vercel
- Verify index exists

**If error mentions "embeddings" or "DeepInfra":**
- Not needed for **loading** files (only for uploading)
- File list should still work

**If error is "Unauthorized":**
- Check that user email is being sent in headers
- Should be fixed by authentication working now

---

## 💡 **Expected Behavior**

**Fresh Deployment (No Files Yet):**
```
✅ Dashboard loads
✅ File table shows: "No files uploaded yet."
✅ Can click "Upload File" button
✅ No errors
```

**After Uploading Files:**
```
✅ Files appear in table
✅ Shows filename, size, chunks, date
✅ Can delete files
✅ Can upload more files
```

---

## 🔧 **Quick Debug Commands**

**In browser console, run:**
```javascript
// Test the files API directly
fetch('/api/files', {
  headers: {
    'x-user-email': 'your-email@gatech.edu',
    'x-user-name': 'Your Name'
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Expected response:**
```json
{
  "files": []
}
```

**Or with error:**
```json
{
  "error": "Specific error message"
}
```

---

## ✅ **Summary**

**What I Fixed:**
- Better error handling in dashboard (shows actual error instead of JSON parse error)

**What You Need to Check:**
1. Refresh dashboard → see what the **actual error** is now
2. Check Vercel environment variables (Pinecone)
3. Check Vercel runtime logs for details
4. Create Pinecone index if needed

**Most Likely Issue:**
- Pinecone not configured in Vercel yet
- This is expected if you haven't set up the vector database

**Status:** 
- ✅ Authentication fixed!
- ⏳ File management needs Pinecone configuration

Let me know what error message you see now and I can help with the specific configuration needed!

