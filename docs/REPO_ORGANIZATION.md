# Repository Organization Guide

**Last Updated:** November 26, 2025  
**Maintainer:** chenastn

---

## 📁 Directory Structure

This document outlines the standardized organization structure for the AI PI repository to ensure consistency and maintainability across team contributions.

### **Root Directory (`/`)**

The root directory should **ONLY** contain:

```
/
├── .env                    # Environment variables (gitignored)
├── .gitignore             # Git ignore rules
├── next-env.d.ts          # Next.js TypeScript declarations
├── next.config.js         # Next.js configuration
├── package.json           # Project dependencies
├── pnpm-lock.yaml         # Package lock file
├── tsconfig.json          # TypeScript configuration
├── components/            # React components
├── context/               # React context providers
├── docs/                  # 📚 ALL documentation files
├── lib/                   # Core library functions
├── pages/                 # Next.js pages and API routes
├── public/                # Static assets
├── scripts/               # Utility scripts
├── styles/                # CSS modules
└── utils/                 # Utility functions
```

### **Documentation Directory (`/docs`)**

**ALL markdown documentation files must be placed in `/docs`**. This includes:

- Feature documentation
- Bug fix summaries
- Setup guides
- Implementation notes
- Architecture documents
- Troubleshooting guides

**❌ DO NOT:**
- Place `.md` files in the root directory (except README.md in root if needed)
- Create scattered documentation across multiple directories
- Duplicate documentation in different locations

**✅ DO:**
- Place all documentation in `/docs`
- Use descriptive, UPPERCASE filenames (e.g., `FEATURE_NAME.md`)
- Update `/docs/README.md` with links to new documentation
- Categorize documentation appropriately

---

## 📚 Documentation Categories

All documentation in `/docs` is organized into these categories:

### **1. Core Documentation**
Project overview, architecture, and high-level implementation summaries
- `AI_PI_V2_REPORT.md`
- `IMPLEMENTATION_SUMMARY.md`
- `QUICK_REFERENCE.md`

### **2. Authentication & Security**
Authentication setup, security best practices, and configuration guides
- `AZURE_OAUTH_SETUP.md`
- `AUTHENTICATION_ROADMAP.md`
- `SECURITY_ENHANCEMENTS.md`

### **3. Bug Fixes & Troubleshooting**
Detailed documentation of bugs encountered and their solutions
- `*_FIX.md` files
- `DEBUG_*.md` files

### **4. Database & Storage**
Vector database setup, configuration, and optimization guides
- `PINECONE_*.md` files

### **5. Analytics & Monitoring**
Analytics implementation, query logging, and monitoring features
- `ANALYTICS_*.md` files
- `QUERY_LOG_*.md` files

### **6. Feature Documentation**
New feature implementations and enhancements
- `*_FEATURE.md` files
- `*_IMPLEMENTATION.md` files

### **7. Testing**
Testing procedures, test plans, and validation documentation
- `TESTING_*.md` files

---

## 🔄 Contribution Guidelines

### **Adding New Documentation**

When adding new documentation:

1. **Choose the right category** from the list above
2. **Create the file in `/docs`** with a descriptive UPPERCASE name
3. **Update `/docs/README.md`** to include the new file in the appropriate category
4. **Follow the naming convention:**
   - Bug fixes: `COMPONENT_NAME_FIX.md`
   - Features: `FEATURE_NAME_FEATURE.md` or `FEATURE_IMPLEMENTATION.md`
   - Guides: `TOOL_SETUP_GUIDE.md`
   - Debug docs: `DEBUG_ISSUE_NAME.md`

### **File Naming Conventions**

- Use UPPERCASE with underscores: `MY_FEATURE_NAME.md`
- Be descriptive but concise
- Include the type suffix:
  - `_FIX.md` - Bug fixes
  - `_FEATURE.md` - Feature documentation
  - `_GUIDE.md` - Setup/how-to guides
  - `_IMPLEMENTATION.md` - Implementation details
  - `_ROADMAP.md` - Future planning documents

### **Before Committing**

Always run this checklist:

- [ ] All `.md` files (except root README) are in `/docs`
- [ ] `/docs/README.md` index is updated with new files
- [ ] Files follow naming conventions
- [ ] Documentation is in the correct category
- [ ] No duplicate documentation exists

---

## 🚨 Common Mistakes to Avoid

### **❌ Don't Do This:**

```
/
├── MY_NEW_FEATURE.md          # ❌ Wrong location
├── bug-fix-summary.md         # ❌ Wrong naming
├── temp_notes.md              # ❌ Temporary files in root
├── docs/
│   └── MY_NEW_FEATURE.md      # ❌ Duplicate
```

### **✅ Do This:**

```
/
├── docs/
│   ├── MY_NEW_FEATURE.md      # ✅ Correct location
│   ├── BUG_FIX_SUMMARY.md     # ✅ Correct naming
│   └── README.md              # ✅ Updated index
```

---

## 🔧 Reorganization Commands

If you find misplaced documentation files, use these commands to reorganize:

### **Move all root `.md` files to `/docs`:**

```bash
cd /path/to/ai-pi
mv *.md docs/ 2>/dev/null || true
# Restore root README if it exists
git restore README.md 2>/dev/null || true
```

### **Check for scattered documentation:**

```bash
# Find all markdown files not in docs/
find . -name "*.md" -not -path "./docs/*" -not -path "./node_modules/*" -not -path "./.next/*"
```

### **Verify organization:**

```bash
# List all documentation
ls -1 docs/*.md
```

---

## 📝 Recent Reorganization (Nov 26, 2025)

### **Files Moved from Root to `/docs`:**

1. `ANALYTICS_ZERO_VECTOR_FIX.md`
2. `GENERAL_FALLBACK_LOGGING_FIX.md`
3. `LARGE_FILE_UPLOAD_SOLUTIONS.md`
4. `PDF_SUPPORT_FEATURE.md`
5. `PDF_UPLOAD_FIX_SUMMARY.md`
6. `QUERY_CLASSIFICATION_FEATURE.md`
7. `QUERY_LOG_TABLE_ENHANCEMENTS.md`
8. `QUERY_LOG_TABLE_FEATURE.md`
9. `SMART_FALLBACK_IMPLEMENTATION.md`

### **New Files Added:**

- `docs/AI_PI_V2_REPORT.md` - Comprehensive system report
- `docs/REPO_ORGANIZATION.md` - This file

### **Updated Files:**

- `docs/README.md` - Added comprehensive documentation index

---

## 🤝 Team Collaboration

### **For All Team Members:**

- **Before pulling from main:** Check if your local changes follow this organization
- **Before creating a PR:** Ensure all documentation is properly organized
- **When reviewing PRs:** Verify documentation placement and naming
- **Communication:** Discuss major documentation structure changes with the team

### **For New Contributors:**

1. Read this document first
2. Review `/docs/README.md` for the documentation index
3. Check existing files for naming and structure examples
4. Ask questions before creating new top-level directories

---

## 📞 Questions?

If you're unsure about where to place documentation:

1. Check the categories in `/docs/README.md`
2. Look for similar existing documentation
3. Ask in the team chat
4. Default to `/docs` and we can reorganize if needed

---

**Remember:** A well-organized repository is easier to maintain, onboard new members, and scale over time. When in doubt, keep it organized! 🎯
