# Pinecone Setup Guide for Vercel Deployment

## 📋 Overview

This application uses **Pinecone** as a vector database to store:
- Document embeddings (for RAG queries)
- File metadata (for the admin dashboard)

---

## 🔧 Step 1: Create a Pinecone Account

1. Go to https://www.pinecone.io/
2. Click **"Sign Up"** (free tier available)
3. Sign up with email or Google

---

## 🗄️ Step 2: Create an Index

Once logged in:

1. **Click "Create Index"** (or "Indexes" → "Create Index")

2. **Configure the index:**
   ```
   Name:        rag-embeddings
   Dimensions:  1024
   Metric:      cosine
   ```

3. **Why these settings?**
   - **Name:** `rag-embeddings` (or set `PINECONE_INDEX_NAME` env var)
   - **Dimensions:** `1024` (matches the `intfloat/multilingual-e5-large` model)
   - **Metric:** `cosine` (standard for text similarity)

4. **Click "Create Index"**

---

## 🔑 Step 3: Get Your API Key

1. In Pinecone Console, click **"API Keys"** in the left sidebar
2. You'll see your **API Key** (looks like: `pcsk_xxxxx-xxxxx-xxxxx`)
3. **Copy this key** (you'll need it for Vercel)

---

## ⚙️ Step 4: Add Environment Variables to Vercel

### **Option A: Vercel Dashboard**

1. Go to https://vercel.com/dashboard
2. Click your project
3. Click **"Settings"** → **"Environment Variables"**
4. Add these variables:

   ```
   PINECONE_API_KEY = pcsk_xxxxx-xxxxx-xxxxx
   PINECONE_INDEX_NAME = rag-embeddings
   ```

5. **Important:** Select environments:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

6. Click **"Save"**

### **Option B: Vercel CLI**

```bash
vercel env add PINECONE_API_KEY
# Paste your API key when prompted

vercel env add PINECONE_INDEX_NAME
# Type: rag-embeddings
```

---

## 🤖 Step 5: Add Embedding Provider

You need **one** of these for generating embeddings:

### **Option A: DeepInfra (Recommended)**

1. Go to https://deepinfra.com/
2. Sign up and get API key
3. Add to Vercel:
   ```
   DEEPINFRA_API_KEY = your_deepinfra_key
   ```

### **Option B: Hugging Face**

1. Go to https://huggingface.co/settings/tokens
2. Create a token (read access)
3. Add to Vercel:
   ```
   HF_API_KEY = hf_xxxxx
   HF_API_URL = https://api-inference.huggingface.co
   ```

---

## 🔄 Step 6: Redeploy

After adding environment variables:

### **Option A: Automatic (if connected to Git)**
- Just **push your code** → Vercel auto-deploys

### **Option B: Manual**
1. Go to Vercel Dashboard → Deployments
2. Click **"Redeploy"** on latest deployment
3. Check **"Use existing Build Cache"** (faster)
4. Click **"Redeploy"**

---

## ✅ Step 7: Verify It Works

1. **Go to your deployed URL** → `/admin/login`
2. **Login with @gatech.edu account**
3. **Check dashboard:**
   - ✅ Should show "No files uploaded yet" (empty table)
   - ❌ If error, check what message you see

### **Common Error Messages:**

**"PINECONE_API_KEY is missing"**
→ API key not set in Vercel (check Step 4)

**"No embedding provider configured"**
→ Need DEEPINFRA_API_KEY or HF_API_KEY (check Step 5)

**"Pinecone index 'rag-embeddings' not found"**
→ Index not created or wrong name (check Step 2)

---

## 📊 Verifying Index Setup

### **Check Index Dimensions**

In Pinecone Console:
1. Click your index (`rag-embeddings`)
2. Check **"Dimensions"** = `1024`
3. If wrong, **delete** and recreate

### **Check Index Stats**

- **Vectors:** Should be `0` initially
- **Metric:** Should be `cosine`
- **Status:** Should be `Ready`

---

## 🚀 Testing File Upload

Once everything is configured:

1. **Create a small test file** (`test.txt`):
   ```
   This is a test file for the RAG system.
   It contains some sample content to verify file uploads work correctly.
   ```

2. **Go to dashboard** → Upload Files section

3. **Upload the file:**
   - Select `test.txt`
   - Add description: "Test file"
   - Click **"Upload File"**

4. **Verify:**
   - ✅ Should see "File uploaded successfully!"
   - ✅ File appears in table
   - ✅ Pinecone shows vectors > 0

---

## 🔍 Troubleshooting

### **Dashboard still shows errors after setup:**

1. **Check Vercel Runtime Logs:**
   - Vercel Dashboard → Deployments → Latest → **"Runtime Logs"**
   - Refresh dashboard to trigger request
   - Look for error messages

2. **Check environment variables are set:**
   - Vercel Dashboard → Settings → Environment Variables
   - Make sure all 3 environments are checked

3. **Redeploy after adding env vars:**
   - Env vars only take effect on **new deployments**
   - Must redeploy for changes to apply

### **"Index not found" but it exists:**

- Check `PINECONE_INDEX_NAME` matches exactly
- Check you're in the right Pinecone project
- Try recreating the index

### **Upload works but query fails:**

- Check vector dimensions match (1024)
- Check embedding provider is working
- Check Vercel function logs for errors

---

## 📝 Required Environment Variables Summary

```bash
# Pinecone (REQUIRED)
PINECONE_API_KEY=pcsk_xxxxx
PINECONE_INDEX_NAME=rag-embeddings

# Embedding Provider (ONE REQUIRED)
DEEPINFRA_API_KEY=xxxxx       # Option A (recommended)
# OR
HF_API_KEY=hf_xxxxx           # Option B
HF_API_URL=https://api-inference.huggingface.co

# Azure AD (for authentication)
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=xxxxx
NEXT_PUBLIC_AZURE_AD_TENANT_ID=xxxxx
NEXT_PUBLIC_AZURE_AD_REDIRECT_URI=https://your-app.vercel.app/admin/dashboard

# OpenRouter (for chat)
OPENROUTER_API_KEY=xxxxx
```

---

## ✅ Checklist

Before deployment:
- [ ] Pinecone account created
- [ ] Index created (name: `rag-embeddings`, dim: 1024, metric: cosine)
- [ ] API key copied
- [ ] Environment variables added to Vercel
- [ ] Embedding provider configured (DeepInfra or HuggingFace)
- [ ] Redeployed Vercel app
- [ ] Tested dashboard login
- [ ] Tested file upload

---

*Created: 2025-10-24*
*For: Vercel deployment with Pinecone vector database*

