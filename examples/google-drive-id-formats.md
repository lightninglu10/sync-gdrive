# 🆔 Google Drive ID Formats Guide

The sync-gdrive tool now supports **two formats** for specifying Google Drive IDs, with the new prefixed format being **recommended** for clarity and reliability.

## **🎯 Formats Supported**

### **✅ New Format (Recommended): `gdrive:ID`**

```bash
# Download with new format
sync-gdrive --from gdrive:1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --to ./my-folder

# Upload with new format
sync-gdrive --from ./my-folder --to gdrive:1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
```

### **🔄 Legacy Format (Still Works): Raw ID**

```bash
# Download with legacy format
sync-gdrive --from 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --to ./my-folder

# Upload with legacy format
sync-gdrive --from ./my-folder --to 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
```

## **🚀 Why Use the New Format?**

### **🎯 100% Unambiguous**

- **Old way**: Guesses based on string length and characters
- **New way**: Explicitly tells the tool "this is a Google Drive ID"

### **🛡️ Prevents False Matches**

```bash
# This could be confused as a Google Drive ID (if it's 25-50 chars):
sync-gdrive --from my_really_long_local_filename_123456789 --to ./output

# This is crystal clear:
sync-gdrive --from gdrive:1ABC123... --to ./output
```

### **🔮 Future-Proof**

- Won't break if Google changes their ID format
- Could support other cloud providers later (`dropbox:`, `onedrive:`, etc.)

### **📖 Self-Documenting**

- Team members immediately understand what the ID refers to
- No need to guess "Is this a local path or Google Drive ID?"

## **🔍 How to Get Your Google Drive ID**

1. **Open Google Drive** in your browser
2. **Navigate to the folder** you want to sync
3. **Look at the URL** in your address bar:
   ```
   https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
   ```
4. **Copy the ID** (the part after `/folders/`):
   ```
   1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
   ```
5. **Use with prefix**:
   ```bash
   sync-gdrive --from gdrive:1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --to ./my-folder
   ```

## **⚖️ Backwards Compatibility**

**Both formats work!** The tool:

1. **First checks** for the `gdrive:` prefix
2. **Falls back** to the old heuristic detection for raw IDs
3. **No breaking changes** for existing scripts

## **🏆 Best Practices**

- ✅ **Use `gdrive:` prefix** for new scripts and documentation
- ✅ **Keep legacy format** in existing working scripts (no need to change)
- ✅ **Share examples** using the new format to help your team
- ✅ **Document your IDs** clearly when sharing with others

## **🔧 Examples in Action**

### **Development Workflow**

```bash
# Download company templates
sync-gdrive --from gdrive:1ABC123_company_templates --to ./templates

# Upload your work back
sync-gdrive --from ./my-project --to gdrive:1XYZ789_project_uploads --verbose
```

### **Backup Workflow**

```bash
# Daily backup script
sync-gdrive --from ./important-docs --to gdrive:1BACKUP123_daily_sync --force-download
```

### **Team Sharing**

```bash
# Clear team documentation
sync-gdrive --from gdrive:1TEAM456_shared_resources --to ./team-resources
```
