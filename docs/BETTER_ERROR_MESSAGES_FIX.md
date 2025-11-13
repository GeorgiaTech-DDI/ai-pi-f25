# Fix: Better Error Messages from API

## 🐛 The Problem

Dashboard was showing:
```
Error: <!DOCTYPE html>...
```

This was the **entire HTML error page** from Next.js's 500 error handler. The actual error was hidden inside Vercel's runtime logs.

---

## 🔍 Root Cause

The `/api/files` endpoint was:
1. Crashing due to missing environment variables or Pinecone configuration
2. Returning a generic 500 error that Vercel rendered as HTML
3. Not validating configuration before trying to use Pinecone
4. Not providing helpful error messages

---

## ✅ The Fix

### 1. **Added Configuration Validation**

Added checks at the **top of the handler** before doing anything else:

```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ⚙️ CONFIGURATION CHECK - Before anything else
  if (!process.env.PINECONE_API_KEY) {
    return res.status(500).json({ 
      error: "Server configuration error: PINECONE_API_KEY is missing. Please configure Pinecone in Vercel environment variables." 
    });
  }

  if (!process.env.DEEPINFRA_API_KEY && !process.env.HF_API_KEY) {
    return res.status(500).json({ 
      error: "Server configuration error: No embedding provider configured. Set DEEPINFRA_API_KEY or HF_API_KEY." 
    });
  }
  
  // Then continue with authentication and handling...
}
```

### 2. **Better Error Handling in `handleGetFiles()`**

Added specific error detection for common Pinecone issues:

```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : "Failed to fetch files";
  
  // Check for common Pinecone errors
  if (errorMessage.includes("Index") && errorMessage.includes("not found")) {
    return res.status(500).json({ 
      error: `Pinecone index '${process.env.PINECONE_INDEX_NAME || "rag-embeddings"}' not found. Please create it in Pinecone Console with 1024 dimensions.` 
    });
  }
  
  return res.status(500).json({ error: `Failed to fetch files: ${errorMessage}` });
}
```

### 3. **Improved Generic Error Handler**

Changed the top-level catch to include the actual error message:

```typescript
catch (error) {
  console.error("Files API error:", error);
  const errorMessage = error instanceof Error ? error.message : "Internal server error";
  return res.status(500).json({ error: errorMessage });
}
```

---

## 🎯 Impact

### **Before:**
```
Error: <!DOCTYPE html><html>... (entire HTML page)
```
❌ No idea what's wrong
❌ Have to check Vercel logs
❌ Confusing for users

### **After:**
```
Error: Server configuration error: PINECONE_API_KEY is missing. Please configure Pinecone in Vercel environment variables.
```
✅ Clear, actionable error message
✅ Tells you exactly what to fix
✅ No need to dig through logs

---

## 📋 Possible Error Messages

After this fix, you'll see **helpful** error messages like:

### **Missing Pinecone API Key:**
```
Server configuration error: PINECONE_API_KEY is missing. 
Please configure Pinecone in Vercel environment variables.
```

### **Missing Embedding Provider:**
```
Server configuration error: No embedding provider configured. 
Set DEEPINFRA_API_KEY or HF_API_KEY.
```

### **Pinecone Index Not Found:**
```
Pinecone index 'rag-embeddings' not found. 
Please create it in Pinecone Console with 1024 dimensions.
```

### **Other Errors:**
```
Failed to fetch files: [actual error message]
```

---

## 🚀 Next Steps

1. **Commit and deploy:**
   ```bash
   git add api/files.ts pages/admin/dashboard.tsx
   git commit -m "Add better error messages and configuration validation"
   git push
   ```

2. **After deployment, check dashboard**
   - You'll now see a **clear error message**
   - Follow the instructions in the error to fix it

3. **Most likely next steps:**
   - Add `PINECONE_API_KEY` to Vercel env vars
   - Add `DEEPINFRA_API_KEY` or `HF_API_KEY`
   - Create Pinecone index if needed

---

## ✅ Status

- ✅ Configuration validation added
- ✅ Better error messages implemented
- ✅ Pinecone-specific error detection
- ✅ Build passes locally
- ✅ No linting errors
- 🚀 **Ready to deploy!**

---

*Created: 2025-10-24*
*Issue: API returning HTML 500 error instead of JSON*
*Resolution: Added configuration validation and better error messages*

