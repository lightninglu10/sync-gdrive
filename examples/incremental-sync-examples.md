# 🔄 Incremental Sync Guide

The sync-gdrive library now includes **powerful incremental sync capabilities** that make it perfect for resuming interrupted downloads, daily backups, and efficient updates.

## **✅ Key Features**

### **🧠 Smart Default Behavior**

- **Compares modification times** between Google Drive and local files
- **Skips files** that are already up-to-date locally
- **Downloads only** files that are new or have been updated
- **Perfect for resuming** interrupted syncs

### **📊 Progress Tracking**

- Shows **downloaded vs skipped** file counts in real-time
- Progress bars display: `Files (↓15 ⊘23)` = Downloaded 15, Skipped 23
- Verbose mode explains **why** each file was skipped

## **🚀 Usage Examples**

### **Default Smart Incremental Sync**

```bash
# First time - downloads everything
sync-gdrive YOUR_FOLDER_ID ./backup

# Output:
# ████████████ | 100% | 245/245 Files (↓245 ⊘0) | document.pdf | 15.2 files/sec
# ✅ Sync completed successfully!
# 📊 Files processed: 245
# 📥 Downloaded: 245 files
# ⊘ Skipped: 0 files

# Second run - only downloads changed files
sync-gdrive YOUR_FOLDER_ID ./backup

# Output:
# ████████████ | 100% | 245/245 Files (↓3 ⊘242) | new-report.docx | 45.1 files/sec
# ✅ Sync completed successfully!
# 📊 Files processed: 245
# 📥 Downloaded: 3 files
# ⊘ Skipped: 242 files
# 💡 242 files were up-to-date and skipped. Use --force-download to re-download all files.
```

### **Resume Interrupted Downloads**

```bash
# Download gets interrupted...
sync-gdrive YOUR_FOLDER_ID ./backup --verbose
# [debug] downloading newer: ./backup/file1.pdf
# [debug] downloading newer: ./backup/file2.docx
# ^C (interrupted)

# Resume exactly where you left off
sync-gdrive YOUR_FOLDER_ID ./backup --verbose
# [debug] skipping: ./backup/file1.pdf (local file is newer or same)
# [debug] skipping: ./backup/file2.docx (local file is newer or same)
# [debug] downloading newer: ./backup/file3.xlsx
# Perfect resume! ✨
```

## **⚙️ Sync Mode Options**

### **1. Smart Incremental (Default)**

```bash
sync-gdrive YOUR_FOLDER_ID ./backup
# Compares modification times
# Downloads if Google Drive file is newer
```

### **2. Force Download Everything**

```bash
sync-gdrive YOUR_FOLDER_ID ./backup --force-download
# Re-downloads ALL files regardless of local state
# Useful for: corruption recovery, format changes
```

### **3. Skip All Existing Files**

```bash
sync-gdrive YOUR_FOLDER_ID ./backup --skip-existing
# Skips ANY file that exists locally (no time check)
# Useful for: quick scanning, partial recovery
```

### **4. Enhanced Precision Checking**

```bash
sync-gdrive YOUR_FOLDER_ID ./backup --check-size-and-time
# Skips if BOTH file size AND timestamp match exactly
# Most accurate but slightly slower
```

## **📋 Real-World Scenarios**

### **Daily Backup Script**

```bash
#!/bin/bash
# daily-backup.sh - Efficient incremental backups

export GOOGLE_CLIENT_EMAIL="service-account@project.iam.gserviceaccount.com"
export GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."

# Smart incremental sync - only downloads changes
sync-gdrive "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs85j4X_VuSqI" /backup/gdrive \
  --verbose \
  --no-progress \
  --concurrency 15

# Example output:
# [debug] skipping: /backup/gdrive/old-file.pdf (local file is newer or same)
# [debug] downloading newer: /backup/gdrive/updated-report.docx
# [debug] downloading newer: /backup/gdrive/new-presentation.pptx
# 📥 Downloaded: 2 files, ⊘ Skipped: 1,247 files
```

### **Disaster Recovery**

```bash
# After data loss - force re-download everything
sync-gdrive YOUR_FOLDER_ID ./recovery --force-download --verbose

# Shows detailed progress for every file:
# ████████████ | 23% | 145/632 Files (↓145 ⊘0) | critical-data.xlsx | 12.3 files/sec
```

### **Check for Updates Only**

```bash
# Fast check without downloading - see what's changed
sync-gdrive YOUR_FOLDER_ID ./check --skip-existing --verbose

# Output shows what would be downloaded:
# [debug] skipping: ./check/existing-file.pdf (file exists - skip-existing option)
# [debug] FILE abc123 ./check new-file.docx (would download)
```

### **High-Performance Sync**

```bash
# Maximum speed with incremental benefits
sync-gdrive YOUR_FOLDER_ID ./downloads \
  --concurrency 25 \
  --check-size-and-time \
  --verbose

# Progress shows efficiency:
# ████████████ | 78% | 1,247/1,596 Files (↓234 ⊘1,013) | data.csv | 28.7 files/sec
```

## **🔍 Verbose Logging Examples**

### **Understanding Skip Reasons**

```bash
sync-gdrive YOUR_FOLDER_ID ./backup --verbose
```

**Output explains each decision:**

```
[debug] skipping: ./backup/report.pdf (local file is newer or same)
[debug] skipping: ./backup/data.xlsx (same size and time match)
[debug] downloading newer: ./backup/updated-doc.docx
[debug] skipping: ./backup/image.jpg (file exists - skip-existing option)
```

### **Skip Reason Categories**

- `local-newer-or-same` - Local file timestamp >= Google Drive timestamp
- `same-size-and-time` - Both file size and timestamp match exactly (with --check-size-and-time)
- `skip-existing` - File exists locally (with --skip-existing option)
- `file-not-exists` - File doesn't exist locally (will download)
- `drive-newer` - Google Drive file is newer (will download)
- `force-download` - Forced download regardless of state (with --force-download)

## **⚡ Performance Impact**

### **Speed Improvements**

- **First sync**: Downloads everything (baseline speed)
- **Subsequent syncs**: Skip unchanged files = **10-50x faster**
- **Large folders**: Most files skipped = **Near-instant updates**

### **API Usage Reduction**

- **Default behavior**: Checks file metadata (1 API call) before download decision
- **Skipped files**: No download API call needed
- **Result**: Dramatically reduced API usage and rate limit friendly

### **Example Metrics**

```
Initial Sync:     2,456 files in 8m 32s  (4.8 files/sec)
Daily Update:     2,456 files in 12s     (204.7 files/sec)
                  ↑ Only 8 files actually downloaded!
```

## **🛠️ Troubleshooting**

### **Files Not Downloading?**

```bash
# Check what's being skipped and why
sync-gdrive YOUR_FOLDER_ID ./backup --verbose

# Force download if needed
sync-gdrive YOUR_FOLDER_ID ./backup --force-download
```

### **Want to See What Would Download?**

```bash
# Dry-run mode: see files without downloading
sync-gdrive YOUR_FOLDER_ID ./test --skip-existing --verbose
```

### **Corrupted Local Files?**

```bash
# Re-download everything to fix corruption
sync-gdrive YOUR_FOLDER_ID ./backup --force-download
```

### **Different Time Zones?**

The library handles timezone differences automatically by using UTC timestamps from Google Drive API.

## **💡 Pro Tips**

### **Optimal Workflows**

1. **Setup**: Use default incremental sync
2. **Daily/Regular**: Same command - only downloads changes
3. **Recovery**: Add `--force-download` when needed
4. **Monitoring**: Use `--verbose` to see what's happening

### **Best Practices**

- **Don't modify** local files manually (affects timestamp comparison)
- **Use `--force-download`** after changing export formats (e.g., docx → pdf)
- **Monitor progress bars** to see download/skip ratio
- **Check verbose logs** if behavior seems unexpected

### **Performance Tuning**

```bash
# Fast incremental sync with monitoring
sync-gdrive YOUR_FOLDER_ID ./backup \
  --concurrency 20 \
  --verbose \
  --check-size-and-time

# Conservative incremental sync
sync-gdrive YOUR_FOLDER_ID ./backup \
  --concurrency 5 \
  --sleep-time 200
```

## **📈 Monitoring Success**

Good incremental sync indicators:

- **High skip ratio**: `Files (↓5 ⊘245)` means working well
- **Fast completion**: Much faster than initial sync
- **Verbose logs**: Show logical skip reasons
- **Consistent results**: Same files skipped on repeated runs

---

The incremental sync functionality makes sync-gdrive perfect for production use, automated backups, and development workflows where you need reliable, efficient synchronization! 🚀
