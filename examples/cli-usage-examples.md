# 🚀 CLI Usage Examples

The enhanced CLI now supports many options for performance tuning, configuration, and **beautiful progress bars**!

## Basic Usage

```bash
# Simple sync with progress bar (default behavior)
sync-gdrive YOUR_FOLDER_ID ./downloads

# Progress bar shows:
# 🔍 Phase 1: Scanning for files...
# ████████████ | 100% | Scanning | Discovering files and folders...
# 📥 Phase 2: Downloading files...
# ████████████ | 45% | 234/520 Files | presentation.pptx | 12.3 files/sec | ETA: 23s
```

## Progress Bar Features

### **📊 Two-Phase Progress Tracking**

1. **🔍 Scanning Phase**: Discovers and counts all files in your Drive folder
2. **📥 Download Phase**: Shows real-time download progress with speed and ETA

### **📈 Real-time Metrics**

- **File Count**: Current/Total files processed
- **Speed**: Files per second download rate
- **ETA**: Estimated time to completion
- **Errors**: Count of failed downloads (sync continues)
- **Current File**: Name of file being downloaded

### **⚡ Smart Progress Behavior**

**🎯 Key Feature: Skipped files count as "completed"!**

This means the progress bar advances for BOTH downloaded and skipped files:

```bash
# Second run with many skips - progress bar flies!
████████████ | 67% | 234/350 Files (↓15 ⊘219) | report.pdf | 58.3 files/sec | ETA: 2s
                                    ↑    ↑
                            Downloaded  Skipped (both advance progress!)
```

**Why this matters:**

- ✅ **Satisfying progress** - You see continuous advancement even when mostly skipping
- ⚡ **Fast completion** - Subsequent syncs complete quickly with high skip ratios
- 🔄 **Resume capability** - Interrupted downloads show meaningful progress on restart
- 📊 **Accurate completion** - Always reaches 100% regardless of download/skip ratio

### **🎛️ Progress Bar Options**

```bash
# Show progress bars (default)
sync-gdrive YOUR_FOLDER_ID ./downloads

# Disable progress bars (for scripts/logging)
sync-gdrive YOUR_FOLDER_ID ./downloads --no-progress

# Progress with verbose logging
sync-gdrive YOUR_FOLDER_ID ./downloads --verbose
```

## Performance Tuning Examples

### Maximum Speed (High Concurrency)

```bash
# Super fast downloads with progress tracking
sync-gdrive YOUR_FOLDER_ID ./downloads --concurrency 20 --verbose

# Progress shows much higher speeds:
# ████████████ | 67% | 89/133 Files | budget.xlsx | 18.7 files/sec | ETA: 2s
```

### Conservative/Slow (for unstable connections)

```bash
# Slower, more reliable downloads with progress
sync-gdrive YOUR_FOLDER_ID ./downloads --concurrency 2 --sleep-time 500

# Progress shows slower but steady progress:
# ████████████ | 23% | 45/195 Files | report.pdf | 2.1 files/sec | ETA: 71s
```

## File Type Customization

### Export Google Docs as PDF

```bash
sync-gdrive YOUR_FOLDER_ID ./downloads --docs-type pdf --verbose

# Progress shows export conversions:
# ████████████ | 88% | 76/86 Files | meeting-notes.pdf | 8.2 files/sec | ETA: 1s
```

## Debug and Monitoring

### Verbose Output with Progress

```bash
# See detailed progress AND file-by-file logging
sync-gdrive YOUR_FOLDER_ID ./downloads --verbose --concurrency 15

# Shows both progress bar AND detailed logs:
# ████████████ | 34% | 127/374 Files | data.csv | 15.3 files/sec | ETA: 16s
# [debug] FILE 1BxiMVs... ./downloads data.csv
# [debug] downloading newer: ./downloads/data.csv
```

### Progress Without Console Noise

```bash
# Clean progress display without verbose logging
sync-gdrive YOUR_FOLDER_ID ./downloads --concurrency 10

# Shows only progress bars and final summary
```

## Real-World Scenarios

### Fast Backup of Large Folders

```bash
# Optimized for speed with progress tracking
sync-gdrive YOUR_FOLDER_ID ./backup \
  --concurrency 25 \
  --batch-size 50 \
  --verbose

# Example output:
# 🔍 Phase 1: Scanning for files...
# ████████████ | 100% | Scanning | Counting files in subfolders...
# 📥 Phase 2: Downloading files...
# ████████████ | 42% | 1,247/2,958 Files | project-files.zip | 23.1 files/sec | ETA: 74s
```

### Daily Sync Script (No Progress Bars)

```bash
#!/bin/bash
# daily-sync.sh - For automated scripts

export GOOGLE_CLIENT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
export GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Disable progress bars for clean logging
sync-gdrive "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs85j4X_VuSqI" /backup/gdrive \
  --concurrency 15 \
  --docs-type pdf \
  --sheets-type xlsx \
  --no-progress \
  --verbose \
  --no-abort-on-error

# Output will be clean log messages without progress bars
```

### Interactive Monitoring

```bash
# Perfect for interactive use - see everything happening
sync-gdrive YOUR_FOLDER_ID ./downloads \
  --concurrency 10 \
  --verbose

# Shows:
# 🚀 Starting Google Drive sync...
# 📁 Source: Google Drive file/folder ID 'YOUR_FOLDER_ID'
# 💾 Destination: './downloads'
#
# ⚙️  Configuration:
#    Concurrency: 10 parallel downloads
#    Progress bars: enabled
#
# 🔍 Phase 1: Scanning for files...
# ████████████ | 100% | Scanning | Preparing download queue...
# 📥 Phase 2: Downloading files...
# ████████████ | 78% | 234/300 Files | presentation.pptx | 12.3 files/sec | ETA: 5s
# [debug] FILE 1BxiMVs... ./downloads presentation.pptx
# [debug] downloading newer: ./downloads/presentation.pptx
```

## Performance Guidelines

| Scenario             | Concurrency | Progress Display  | Use Case                    |
| -------------------- | ----------- | ----------------- | --------------------------- |
| **Interactive**      | 5-10        | Progress bars ON  | Manual syncing, monitoring  |
| **Automated Script** | 10-15       | Progress bars OFF | Cron jobs, CI/CD            |
| **Fast Manual**      | 15-25       | Progress bars ON  | Large one-time syncs        |
| **Conservative**     | 2-5         | Progress bars ON  | Slow/unreliable connections |

## Progress Bar Demo

Want to see what the progress bars look like? Run the demo:

```bash
# See a simulation of progress bars in action
node examples/progress-bar-demo.js

# Shows realistic scanning and downloading phases
# with actual file names and timing
```

## Rate Limit Information

- **Google Drive API Limit**: 200 requests/second per user
- **Library Usage**: ~2 requests per file (list + download)
- **Safe Concurrency**: Up to 50 parallel downloads
- **Recommended**: 10-20 for most users
- **Progress Impact**: Scanning adds ~1 request per folder (minimal overhead)

## Help and Options

```bash
# Show all available options including progress settings
sync-gdrive --help

# Key progress-related options:
# --no-progress    Disable progress bars (for scripts)
# --verbose        Show detailed logs alongside progress
# --concurrency    Higher values = faster progress updates
```

## Troubleshooting Progress Bars

### Progress Bars Not Showing?

```bash
# Make sure you're not redirecting output
sync-gdrive YOUR_FOLDER_ID ./downloads

# NOT: sync-gdrive YOUR_FOLDER_ID ./downloads > log.txt
# Use --no-progress for file redirection instead
```

### Progress Bars Interfering with Scripts?

```bash
# Disable for clean logging
sync-gdrive YOUR_FOLDER_ID ./downloads --no-progress --verbose
```

### Want Only Final Summary?

```bash
# Minimal output - just the essentials
sync-gdrive YOUR_FOLDER_ID ./downloads --no-progress
```
