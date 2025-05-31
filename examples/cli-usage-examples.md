# 🚀 CLI Usage Examples

The enhanced CLI now supports many options for performance tuning and configuration.

## Basic Usage

```bash
# Simple sync (uses default settings: concurrency=10, sleepTime=0)
sync-gdrive YOUR_FOLDER_ID ./downloads
```

## Performance Tuning Examples

### Maximum Speed (High Concurrency)

```bash
# Super fast downloads - 20 parallel downloads
sync-gdrive YOUR_FOLDER_ID ./downloads --concurrency 20 --verbose

# Even faster - 50 parallel downloads (max safe for API limits)
sync-gdrive YOUR_FOLDER_ID ./downloads --concurrency 50 --batch-size 30
```

### Conservative/Slow (for unstable connections)

```bash
# Slower, more reliable downloads with delays
sync-gdrive YOUR_FOLDER_ID ./downloads --concurrency 2 --sleep-time 500

# Very conservative - one at a time
sync-gdrive YOUR_FOLDER_ID ./downloads --concurrency 1 --sleep-time 1000
```

## File Type Customization

### Export Google Docs as PDF

```bash
sync-gdrive YOUR_FOLDER_ID ./downloads --docs-type pdf --verbose
```

### Export Everything as Different Formats

```bash
sync-gdrive YOUR_FOLDER_ID ./downloads \
  --docs-type pdf \
  --sheets-type csv \
  --slides-type pdf \
  --fallback-type pdf
```

## Debug and Monitoring

### Verbose Output

```bash
# See detailed progress and configuration
sync-gdrive YOUR_FOLDER_ID ./downloads --verbose --concurrency 15
```

### Continue on Errors

```bash
# Don't stop sync if individual files fail
sync-gdrive YOUR_FOLDER_ID ./downloads --no-abort-on-error --verbose
```

## Real-World Scenarios

### Fast Backup of Large Folders

```bash
# Optimized for speed with large batches
sync-gdrive YOUR_FOLDER_ID ./backup \
  --concurrency 25 \
  --batch-size 50 \
  --sleep-time 0 \
  --verbose
```

### Daily Sync Script

```bash
#!/bin/bash
# daily-sync.sh

export GOOGLE_CLIENT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
export GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

sync-gdrive "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs85j4X_VuSqI" /backup/gdrive \
  --concurrency 15 \
  --docs-type pdf \
  --sheets-type xlsx \
  --verbose \
  --no-abort-on-error
```

### Bandwidth-Limited Environment

```bash
# For slower connections or bandwidth limits
sync-gdrive YOUR_FOLDER_ID ./downloads \
  --concurrency 3 \
  --sleep-time 2000 \
  --batch-size 5
```

## Performance Guidelines

| Scenario         | Concurrency | Sleep Time | Notes                                    |
| ---------------- | ----------- | ---------- | ---------------------------------------- |
| **Max Speed**    | 50          | 0ms        | Uses ~100 req/sec (well under 200 limit) |
| **Fast**         | 20          | 0ms        | Uses ~40 req/sec (recommended)           |
| **Default**      | 10          | 0ms        | Uses ~20 req/sec (safe for all users)    |
| **Conservative** | 5           | 500ms      | For unstable connections                 |
| **Very Slow**    | 1           | 1000ms     | Original behavior                        |

## Rate Limit Information

- **Google Drive API Limit**: 200 requests/second per user
- **Library Usage**: ~2 requests per file (list + download)
- **Safe Concurrency**: Up to 50 parallel downloads
- **Recommended**: 10-20 for most users

## Help and Options

```bash
# Show all available options
sync-gdrive --help

# Short help
sync-gdrive -h
```
