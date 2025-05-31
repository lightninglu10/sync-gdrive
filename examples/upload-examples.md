# 📤 Upload Examples - Local to Google Drive

The sync-gdrive tool now supports **bidirectional sync** with a clean `--from` and `--to` interface!

## **🎯 How It Works**

The direction is determined automatically based on your source and destination:

- **📥 Download**: `--from <google-drive-id> --to <local-path>`
- **📤 Upload**: `--from <local-path> --to <google-drive-id>`

## **📤 Upload Examples**

### **Upload a Single File**

```bash
# Upload a document to Google Drive
sync-gdrive --from ./report.pdf --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

# Upload with verbose logging
sync-gdrive --from ./presentation.pptx --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --verbose
```

### **Upload an Entire Folder**

```bash
# Upload local folder to Google Drive
sync-gdrive --from ./my-documents --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

# Fast parallel upload
sync-gdrive --from ./photos --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --concurrency 5
```

### **Incremental Upload (Smart Sync)**

```bash
# Only upload new/changed files (default behavior)
sync-gdrive --from ./workspace --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

# Force re-upload all files
sync-gdrive --from ./workspace --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --force-download

# Skip files that already exist (fastest check)
sync-gdrive --from ./workspace --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --skip-existing
```

### **Upload with Folder Creation Control**

```bash
# Create folders in Google Drive as needed (default)
sync-gdrive --from ./project --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

# Don't create folders - only upload to existing structure
sync-gdrive --from ./project --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --no-create-folders
```

## **📥 Download Examples (Same Interface)**

### **Download from Google Drive**

```bash
# Download folder from Google Drive to local
sync-gdrive --from 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --to ./downloads

# Download with custom export formats
sync-gdrive --from 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --to ./downloads \
  --docs-type pdf --sheets-type csv --slides-type pdf
```

## **🔄 Bidirectional Workflow**

### **Daily Backup Workflow**

```bash
# Morning: Download latest from Google Drive
sync-gdrive --from 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --to ./workspace

# Work on files locally...

# Evening: Upload changes back to Google Drive
sync-gdrive --from ./workspace --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
```

### **Project Collaboration**

```bash
# Sync project folder both ways
# Download latest changes
sync-gdrive --from 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --to ./project --verbose

# Upload your changes
sync-gdrive --from ./project --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --verbose
```

## **⚡ Performance Options**

### **High-Speed Upload**

```bash
# Fast upload with progress tracking
sync-gdrive --from ./large-folder --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms \
  --concurrency 5 --batch-size 10 --verbose
```

### **Safe Upload (Rate-Limited)**

```bash
# Conservative upload for large datasets
sync-gdrive --from ./backup --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms \
  --concurrency 2 --batch-size 5
```

## **📊 Progress Tracking**

The progress bars show **uploaded vs skipped** files, just like downloads:

```
✅ Scanning: Discovering files and folders...
📤 Files (↑45 ⊘12) │██████████████████████░░░░░░░░│ 57/70 │ 12.3 files/sec │ ETA: 0:01
   📁 Uploading: project/src/components/Header.tsx
```

- **↑45** = 45 files uploaded
- **⊘12** = 12 files skipped (already exist and up-to-date)

## **🛠️ Advanced Options**

### **Enhanced Incremental Upload**

```bash
# Compare both file size and modification time
sync-gdrive --from ./documents --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms \
  --check-size-and-time --verbose
```

### **Automation-Friendly Upload**

```bash
# No progress bars for scripts
sync-gdrive --from ./backup --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms \
  --no-progress --no-abort-on-error
```

## **🔧 Authentication**

Set up your Google service account credentials:

```bash
# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"

# Then run any sync command
sync-gdrive --from ./folder --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
```

## **💡 Tips & Best Practices**

### **Finding Google Drive Folder IDs**

1. Open the folder in Google Drive web interface
2. Look at the URL: `https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`
3. The ID is the long string after `/folders/`

### **Incremental Sync Behavior**

- **Default**: Smart sync - only uploads files that are newer locally
- **`--force-download`**: Re-uploads everything (good for ensuring consistency)
- **`--skip-existing`**: Skips any file that exists in Drive (fastest)
- **`--check-size-and-time`**: Compares both file size and modification time

### **Performance Recommendations**

- **Small files**: `--concurrency 5 --batch-size 10`
- **Large files**: `--concurrency 2 --batch-size 5`
- **Mixed content**: `--concurrency 3 --batch-size 8` (default will be safe)

### **Error Handling**

```bash
# Continue uploading even if some files fail
sync-gdrive --from ./folder --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms \
  --no-abort-on-error --verbose
```

The upload functionality includes the same robust error handling and incremental sync features as downloads, making it perfect for reliable backups and collaboration workflows!
