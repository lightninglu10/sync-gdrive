# Sync GDrive 🚀

High-performance Google Drive synchronization library with **smart incremental sync**, **parallel downloads**, and **beautiful progress bars**.

## ✨ Key Features

- **🔄 Smart Incremental Sync** - Resume interrupted downloads, skip up-to-date files
- **⚡ Parallel Downloads** - 10-20x faster with configurable concurrency
- **📊 Progress Bars** - Beautiful real-time progress with download/skip counts
- **🛠️ Powerful CLI** - Complete command-line interface with performance tuning
- **🎯 Flexible Export** - Custom formats for Google Docs, Sheets, Slides
- **🔐 Service Account Auth** - Secure authentication via Google service accounts

## 🚀 Quick Start

### CLI Usage (Recommended)

```bash
# Install globally
npm install -g sync-gdrive

# Set up authentication
export GOOGLE_CLIENT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
export GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Smart incremental sync (resumes perfectly!)
sync-gdrive "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs85j4X_VuSqI" ./downloads

# High-performance sync with progress
sync-gdrive "YOUR_FOLDER_ID" ./downloads --concurrency 20 --verbose
```

**Progress Output:**

```
🔍 Phase 1: Scanning for files...
████████████ | 100% | Scanning | Discovering files and folders...
📥 Phase 2: Downloading files...
████████████ | 67% | 234/350 Files (↓45 ⊘189) | report.pdf | 15.2 files/sec | ETA: 8s

✅ Sync completed successfully!
⏱️  Duration: 23.4 seconds
📊 Files processed: 350
📥 Downloaded: 45 files
⊘ Skipped: 305 files
💡 305 files were up-to-date and skipped. Use --force-download to re-download all files.
```

### Library Usage

```javascript
// Regular JS
const gdriveSync = require("sync-gdrive");

const keyConfig = {
  clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
  privateKey: process.env.GOOGLE_PRIVATE_KEY,
};

// Basic usage with smart defaults
await syncGDrive(fileOrFolderId, destFolder, keyConfig);

// High-performance with progress callback
const options = {
  concurrency: 15, // 15 parallel downloads
  verbose: true, // Detailed logging
  progressCallback: (progress) => {
    console.log(
      `${progress.completedFiles}/${progress.totalFiles} files - ${progress.speed}`
    );
  },
};

await syncGDrive(fileOrFolderId, destFolder, keyConfig, options);
```

```typescript
// TypeScript
import syncGDrive, { IKeyConfig } from "sync-gdrive";

const keyConfig: IKeyConfig = {
  clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
  privateKey: process.env.GOOGLE_PRIVATE_KEY,
};

await syncGDrive(fileOrFolderId, destFolder, keyConfig, options);
```

## 🔄 Incremental Sync Magic

### **Perfect Resume Capability**

```bash
# Download gets interrupted...
sync-gdrive YOUR_FOLDER_ID ./backup
# Downloaded 150/500 files... ^C

# Resume exactly where you left off!
sync-gdrive YOUR_FOLDER_ID ./backup
# ████████████ | 100% | 500/500 Files (↓350 ⊘150) | 🎉 Skipped 150, downloaded 350
```

### **Sync Mode Options**

```bash
# Smart incremental (default) - compares timestamps
sync-gdrive YOUR_FOLDER_ID ./backup

# Force re-download everything
sync-gdrive YOUR_FOLDER_ID ./backup --force-download

# Skip existing files completely
sync-gdrive YOUR_FOLDER_ID ./backup --skip-existing

# Enhanced precision (size + time matching)
sync-gdrive YOUR_FOLDER_ID ./backup --check-size-and-time
```

## ⚡ Performance Features

### **Parallel Downloads**

- **Default**: 10 concurrent downloads
- **High-speed**: Up to 50 concurrent downloads
- **Rate-limit safe**: Stays well under Google's 200 requests/second limit

### **Smart API Usage**

- **Incremental sync**: Only downloads changed files
- **Metadata caching**: Minimal API calls for unchanged files
- **Batch processing**: Efficient file discovery

### **Speed Improvements**

- **10-20x faster** than sequential downloading
- **Near-instant updates** for mostly-unchanged folders
- **Configurable concurrency** for optimal performance

## 📖 Documentation & Examples

- **[📋 Incremental Sync Guide](examples/incremental-sync-examples.md)** - Complete guide to resumable downloads
- **[🚀 CLI Usage Examples](examples/cli-usage-examples.md)** - Performance tuning and advanced usage
- **[📊 Progress Bar Demo](examples/progress-bar-demo.js)** - See progress bars in action

## 🛠️ CLI Reference

### **Incremental Sync Options**

```bash
--force-download       # Re-download all files even if they exist locally
--skip-existing        # Skip all files that exist locally (no time check)
--check-size-and-time  # Enhanced checking: skip if size AND time match exactly
```

### **Performance Options**

```bash
--concurrency <num>    # Number of parallel downloads (default: 10)
--batch-size <num>     # Files processed per batch (default: 20)
--sleep-time <ms>      # Delay between operations in ms (default: 0)
```

### **File Type Options**

```bash
--docs-type <ext>      # Google Docs export format (default: docx)
--sheets-type <ext>    # Google Sheets export format (default: xlsx)
--slides-type <ext>    # Google Slides export format (default: pptx)
--maps-type <ext>      # Google Maps export format (default: kml)
--fallback-type <ext>  # Fallback GSuite export format (default: pdf)
```

### **Other Options**

```bash
--verbose              # Enable verbose logging with skip reasons
--no-abort-on-error    # Continue on errors instead of stopping
--no-progress          # Disable progress bars (for scripts)
--help                 # Show complete help message
```

## 📋 Library Options

When using as a library, the `options` parameter supports:

### **Performance & Sync Control**

- **concurrency**: Number of parallel downloads (default: 10)
- **batchSize**: Files processed per batch (default: 20)
- **sleepTime**: Delay between operations in ms (default: 0)
- **forceDownload**: Re-download all files (default: false)
- **skipExisting**: Skip all existing files (default: false)
- **checkSizeAndTime**: Enhanced precision checking (default: false)

### **File Types & Export**

- **docsFileType**: Google Docs export format (default: "docx")
- **sheetsFileType**: Google Sheets export format (default: "xlsx")
- **slidesFileType**: Google Slides export format (default: "pptx")
- **mapsFileType**: Google Maps export format (default: "kml")
- **fallbackGSuiteFileType**: Fallback export format (default: "pdf")

### **Debugging & Monitoring**

- **verbose**: Enable debug logging (default: false)
- **logger**: Custom logger with debug/warn/error methods
- **progressCallback**: Function to receive progress updates
- **abortOnError**: Stop on first error (default: true)

### **Google Drive API**

- **supportsAllDrives**: Support shared drives (default: false)
- **includeItemsFromAllDrives**: Include shared drive items (default: false)

## 🏆 Real-World Examples

### **Daily Backup Script**

```bash
#!/bin/bash
# Smart incremental backup - only downloads changes!
sync-gdrive "YOUR_FOLDER_ID" /backup/gdrive \
  --verbose \
  --concurrency 15 \
  --no-progress
```

### **Disaster Recovery**

```bash
# Force re-download everything after data loss
sync-gdrive "YOUR_FOLDER_ID" ./recovery --force-download --verbose
```

### **Development Workflow**

```bash
# Fast sync for development - skip unchanged files
sync-gdrive "YOUR_FOLDER_ID" ./content --concurrency 25 --verbose
```

## 🔧 Google Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Drive API
4. Create a Service Account
5. Generate and download JSON key
6. Share your Google Drive folder with the service account email

**Environment Setup:**

```bash
export GOOGLE_CLIENT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
export GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

## 📈 Performance Benchmarks

**Example sync performance:**

```
Initial Sync:     2,456 files in 8m 32s  (4.8 files/sec)
Daily Update:     2,456 files in 12s     (204.7 files/sec) ← Only 8 files changed!
Force Re-sync:    2,456 files in 3m 45s  (10.9 files/sec) ← 20x concurrency
```

## 🤝 Contributing

Contributions welcome! Please see issues for current needs.

## 📄 License

MIT License - see LICENSE file for details.

## 👥 Contributors

- Andre John Mas (Original author)
- Enhanced with incremental sync, parallel downloads, and CLI improvements

---

Perfect for automated backups, content management systems, development workflows, and any application needing reliable Google Drive synchronization! 🎯
