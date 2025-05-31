#!/usr/bin/env node
/* eslint-disable no-console */
import fs from "fs";
import cliProgress from "cli-progress";
import { syncGDrive, syncFromTo } from "./";
import { google } from "googleapis";
import path from "path";

interface CliOptions {
  help?: boolean;
  verbose?: boolean;
  docsFileType?: string;
  sheetsFileType?: string;
  slidesFileType?: string;
  mapsFileType?: string;
  concurrency?: number;
  batchSize?: number;
  sleepTime?: number;
  forceDownload?: boolean;
  skipExisting?: boolean;
  checkSizeAndTime?: boolean;
  createFolders?: boolean;
  preserveTimestamps?: boolean;
  showProgress?: boolean;
  abortOnError?: boolean;
  progressCallback?: (progress: any) => void;
  testFolder?: boolean;
}

// Progress bar setup
let progressBars: {
  scanning?: cliProgress.SingleBar;
  downloading?: cliProgress.SingleBar;
  multibar?: cliProgress.MultiBar;
} = {};

function createProgressBars() {
  const multibar = new cliProgress.MultiBar(
    {
      clearOnComplete: false,
      hideCursor: true,
      format:
        " {bar} | {percentage}% | {value}/{total} {type} | {filename} | {speed} | ETA: {eta}s",
      barCompleteChar: "█",
      barIncompleteChar: "░",
      barsize: 30,
    },
    cliProgress.Presets.shades_classic
  );

  return {
    multibar,
    scanning: multibar.create(100, 0, {
      type: "Scanning",
      filename: "Counting files...",
      speed: "",
      eta: "?",
    }),
    downloading: null, // Will be created after scanning
  };
}

function updateProgressBar(progress: any) {
  if (!progressBars.multibar) return;

  if (progress.phase === "scanning") {
    if (progressBars.scanning) {
      progressBars.scanning.update(progress.completedFiles, {
        filename: "Discovering files and folders...",
        speed: "",
        eta: "?",
      });
    }
  } else if (progress.phase === "downloading") {
    // Create downloading bar if it doesn't exist
    if (!progressBars.downloading && progress.totalFiles) {
      progressBars.scanning?.stop();
      progressBars.downloading = progressBars.multibar.create(
        progress.totalFiles,
        0,
        {
          type: "Files",
          filename: "Starting download...",
          speed: progress.speed || "",
          eta: progress.eta || "?",
        }
      );
    }

    if (progressBars.downloading) {
      const filename = progress.currentFile
        ? progress.currentFile.length > 30
          ? "..." + progress.currentFile.slice(-27)
          : progress.currentFile
        : "Processing...";

      // Enhanced type display with downloaded/skipped counts
      let typeDisplay = "Files";
      if (progress.downloadedFiles || progress.skippedFiles) {
        typeDisplay = `Files (↓${progress.downloadedFiles || 0} ⊘${
          progress.skippedFiles || 0
        })`;
      }
      if (progress.errors > 0) {
        typeDisplay += ` ❌${progress.errors}`;
      }

      progressBars.downloading.update(progress.completedFiles, {
        filename,
        speed: progress.speed || "",
        eta: progress.eta || "?",
        type: typeDisplay,
      });
    }
  } else if (progress.phase === "complete") {
    progressBars.downloading?.stop();
    progressBars.scanning?.stop();
  }
}

function showHelp() {
  console.log(`
🚀 sync-gdrive - High-performance Google Drive sync tool

USAGE:
  sync-gdrive --from <source> --to <destination> [options]

SYNC DIRECTIONS:
  📥 Download: --from <google-drive-id> --to <local-path>
  📤 Upload:   --from <local-path> --to <google-drive-id>

GOOGLE DRIVE ID FORMATS:
  New (recommended): gdrive:1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
  Legacy (still works): 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

EXAMPLES:
  # Download from Google Drive to local folder (new format)
  sync-gdrive --from gdrive:1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --to ./my-folder

  # Upload local folder to Google Drive (new format)
  sync-gdrive --from ./my-folder --to gdrive:1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

  # Legacy format still works for backwards compatibility
  sync-gdrive --from 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms --to ./my-folder

REQUIRED:
  --from <source>         Source path (Google Drive ID or local path)
  --to <destination>      Destination path (local path or Google Drive ID)

PERFORMANCE OPTIONS:
  --concurrency <n>       Parallel downloads/uploads (default: 10)
  --batch-size <n>        Files per batch (default: 20)  
  --sleep-time <ms>       Delay between operations (default: 0)

INCREMENTAL SYNC OPTIONS:
  --force-download        Re-download/upload all files (ignore timestamps)
  --skip-existing         Skip files that already exist (no timestamp check)
  --check-size-and-time   Enhanced comparison (size + timestamp matching)

UPLOAD-SPECIFIC OPTIONS:
  --no-create-folders     Don't create folders in Google Drive
  --preserve-timestamps   Preserve file modification times (when possible)

FILE TYPE OPTIONS (Downloads):
  --docs-type <ext>       Google Docs export format (default: docx)
  --sheets-type <ext>     Google Sheets export format (default: xlsx)
  --slides-type <ext>     Google Slides export format (default: pptx)
  --maps-type <ext>       Google Maps export format (default: kml)

UTILITY OPTIONS:
  --verbose              Show detailed operation logs
  --no-progress          Disable progress bars (for scripts)
  --no-abort-on-error    Continue on errors (don't stop)
  --test-folder          Test Google Drive folder access before syncing
  --help                 Show this help message

AUTHENTICATION:
  Set GOOGLE_APPLICATION_CREDENTIALS environment variable to your service account key file.

RATE LIMIT SAFE COMBINATIONS:
  🚀 Fast & Safe:      --concurrency 5 --batch-size 10
  🛡️  Very Safe:       --concurrency 3 --batch-size 8  
  🐌 Maximum Safety:   --concurrency 2 --batch-size 5

For more examples and documentation: https://github.com/your-repo/sync-gdrive
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    verbose: false,
    concurrency: 10,
    batchSize: 20,
    sleepTime: 0,
    docsFileType: "docx",
    sheetsFileType: "xlsx",
    slidesFileType: "pptx",
    mapsFileType: "kml",
    showProgress: true,
    abortOnError: true,
    forceDownload: false,
    skipExisting: false,
    checkSizeAndTime: false,
    createFolders: true,
    preserveTimestamps: false,
    testFolder: false,
  };

  let fromPath = "";
  let toPath = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
        break;

      case "--from":
        if (!nextArg) {
          console.error("❌ Error: --from requires a source path");
          process.exit(1);
        }
        fromPath = nextArg;
        i++;
        break;

      case "--to":
        if (!nextArg) {
          console.error("❌ Error: --to requires a destination path");
          process.exit(1);
        }
        toPath = nextArg;
        i++;
        break;

      case "--verbose":
        options.verbose = true;
        break;

      case "--concurrency":
        if (!nextArg || isNaN(parseInt(nextArg))) {
          console.error("❌ Error: --concurrency requires a number");
          process.exit(1);
        }
        options.concurrency = parseInt(nextArg);
        i++;
        break;

      case "--batch-size":
        if (!nextArg || isNaN(parseInt(nextArg))) {
          console.error("❌ Error: --batch-size requires a number");
          process.exit(1);
        }
        options.batchSize = parseInt(nextArg);
        i++;
        break;

      case "--sleep-time":
        if (!nextArg || isNaN(parseInt(nextArg))) {
          console.error(
            "❌ Error: --sleep-time requires a number (milliseconds)"
          );
          process.exit(1);
        }
        options.sleepTime = parseInt(nextArg);
        i++;
        break;

      case "--docs-type":
        if (!nextArg) {
          console.error("❌ Error: --docs-type requires a file extension");
          process.exit(1);
        }
        options.docsFileType = nextArg;
        i++;
        break;

      case "--sheets-type":
        if (!nextArg) {
          console.error("❌ Error: --sheets-type requires a file extension");
          process.exit(1);
        }
        options.sheetsFileType = nextArg;
        i++;
        break;

      case "--slides-type":
        if (!nextArg) {
          console.error("❌ Error: --slides-type requires a file extension");
          process.exit(1);
        }
        options.slidesFileType = nextArg;
        i++;
        break;

      case "--maps-type":
        if (!nextArg) {
          console.error("❌ Error: --maps-type requires a file extension");
          process.exit(1);
        }
        options.mapsFileType = nextArg;
        i++;
        break;

      case "--no-progress":
        options.showProgress = false;
        break;

      case "--no-abort-on-error":
        options.abortOnError = false;
        break;

      case "--force-download":
        options.forceDownload = true;
        break;

      case "--skip-existing":
        options.skipExisting = true;
        break;

      case "--check-size-and-time":
        options.checkSizeAndTime = true;
        break;

      case "--no-create-folders":
        options.createFolders = false;
        break;

      case "--preserve-timestamps":
        options.preserveTimestamps = true;
        break;

      case "--test-folder":
        options.testFolder = true;
        break;

      default:
        if (arg.startsWith("--")) {
          console.error(`❌ Error: Unknown option: ${arg}`);
          console.log("💡 Use --help to see available options");
          process.exit(1);
        }
        break;
    }
  }

  return { fromPath, toPath, options };
}

async function main() {
  try {
    const { fromPath, toPath, options } = parseArgs();

    // Validate required arguments
    if (!fromPath) {
      console.error("❌ Error: --from is required");
      console.log("💡 Use --help to see usage examples");
      process.exit(1);
    }

    if (!toPath) {
      console.error("❌ Error: --to is required");
      console.log("💡 Use --help to see usage examples");
      process.exit(1);
    }

    // Load service account credentials
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!keyPath) {
      console.error(
        "❌ Error: GOOGLE_APPLICATION_CREDENTIALS environment variable not set"
      );
      console.log("💡 Point this to your Google service account JSON file");
      process.exit(1);
    }

    let keyConfig;
    try {
      const keyData = fs.readFileSync(keyPath, "utf8");
      const rawKeyConfig = JSON.parse(keyData);

      // Map Google service account JSON properties to our interface
      keyConfig = {
        clientEmail: rawKeyConfig.client_email,
        privateKey: rawKeyConfig.private_key,
      };

      // Validate required fields
      if (!keyConfig.clientEmail || !keyConfig.privateKey) {
        throw new Error(
          "Service account file missing required fields: client_email or private_key"
        );
      }
    } catch (error) {
      console.error(`❌ Error reading service account file: ${error.message}`);
      process.exit(1);
    }

    // Determine sync direction and validate
    const isFromGoogleDrive =
      fromPath.startsWith("gdrive:") ||
      (/^[a-zA-Z0-9_-]{25,50}$/.test(fromPath) &&
        !fromPath.includes("/") &&
        !fromPath.includes("\\"));
    const isToGoogleDrive =
      toPath.startsWith("gdrive:") ||
      (/^[a-zA-Z0-9_-]{25,50}$/.test(toPath) &&
        !toPath.includes("/") &&
        !toPath.includes("\\"));

    console.log("🚀 Starting sync-gdrive...\n");

    if (isFromGoogleDrive && !isToGoogleDrive) {
      console.log(`📥 **Download Mode**: Google Drive → Local`);
      console.log(`   From: Google Drive folder ${fromPath}`);
      console.log(`   To:   ${path.resolve(toPath)}`);
    } else if (!isFromGoogleDrive && isToGoogleDrive) {
      console.log(`📤 **Upload Mode**: Local → Google Drive`);
      console.log(`   From: ${path.resolve(fromPath)}`);
      console.log(`   To:   Google Drive folder ${toPath}`);
    } else if (isFromGoogleDrive && isToGoogleDrive) {
      console.error(
        "❌ Error: Google Drive to Google Drive sync is not yet supported"
      );
      process.exit(1);
    } else {
      console.error("❌ Error: Local to local sync is not supported");
      console.log("💡 Use standard file copy tools for local operations");
      process.exit(1);
    }

    if (options.verbose) {
      console.log("\n⚙️  Configuration:");
      console.log(
        `   Concurrency: ${options.concurrency || 10} parallel operations`
      );
      console.log(`   Batch size: ${options.batchSize || 20} files per batch`);
      console.log(
        `   Sleep time: ${options.sleepTime || 0}ms between operations`
      );

      // Show sync mode
      let syncMode = "Smart incremental (compares modification times)";
      if (options.forceDownload) {
        syncMode = isFromGoogleDrive
          ? "Force download (re-download all files)"
          : "Force upload (re-upload all files)";
      } else if (options.skipExisting) {
        syncMode = "Skip existing (no transfer if file exists)";
      } else if (options.checkSizeAndTime) {
        syncMode = "Enhanced incremental (size + time matching)";
      }

      console.log(`   Sync mode: ${syncMode}`);

      if (!isFromGoogleDrive) {
        console.log(
          `   Create folders: ${options.createFolders ? "Yes" : "No"}`
        );
        console.log(
          `   Preserve timestamps: ${options.preserveTimestamps ? "Yes" : "No"}`
        );
      }

      console.log(
        `   File exports: docs→${options.docsFileType}, sheets→${options.sheetsFileType}, slides→${options.slidesFileType}`
      );
    }

    // Set up progress tracking
    if (options.showProgress) {
      progressBars = createProgressBars();
      options.progressCallback = updateProgressBar;
    }

    console.log("");

    // Test folder access if requested or if we detect potential issues
    const targetFolderId = isFromGoogleDrive ? fromPath : toPath;
    if (options.testFolder && (isFromGoogleDrive || isToGoogleDrive)) {
      const testResult = await testFolderAccess(targetFolderId, keyConfig);
      if (!testResult) {
        console.error(
          "\n❌ Folder access test failed. Fix the permissions above before syncing."
        );
        process.exit(1);
      }
      console.log("\n" + "=".repeat(50) + "\n");
    }

    // Start sync
    const startTime = Date.now();
    const results = await syncFromTo(fromPath, toPath, keyConfig, options);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Clean up progress bars
    if (progressBars.multibar) {
      progressBars.multibar.stop();
    }

    // Show final summary
    const downloaded = Array.isArray(results)
      ? results.filter((r) => r.updated).length
      : results?.updated
      ? 1
      : 0;
    const skipped = Array.isArray(results)
      ? results.filter((r) => !r.updated).length
      : results?.updated
      ? 0
      : 1;
    const total = downloaded + skipped;

    console.log("\n✅ Sync completed!");
    console.log(
      `   ${isFromGoogleDrive ? "Downloaded" : "Uploaded"}: ${downloaded} files`
    );
    console.log(`   Skipped: ${skipped} files`);
    console.log(`   Total: ${total} files in ${duration}s`);

    if (total > 0) {
      const rate = (total / parseFloat(duration)).toFixed(1);
      console.log(`   Rate: ${rate} files/sec`);
    }
  } catch (error) {
    if (progressBars.multibar) {
      progressBars.multibar.stop();
    }

    console.error("\n❌ Sync failed:", error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function testFolderAccess(
  folderId: string,
  keyConfig: any
): Promise<boolean> {
  try {
    console.log("📁 Testing Google Drive folder access...\n");

    // Clean folder ID (remove gdrive: prefix if present)
    const cleanFolderId = folderId.startsWith("gdrive:")
      ? folderId.substring(7)
      : folderId;
    console.log(`🔍 Testing access to folder: ${cleanFolderId}`);
    console.log(`🔐 Using service account: ${keyConfig.clientEmail}\n`);

    // Set up authentication
    const auth = new google.auth.JWT(
      keyConfig.clientEmail,
      null,
      keyConfig.privateKey,
      [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
      null
    );

    google.options({ auth });
    const drive = google.drive("v3");

    // Test 1: Get folder info
    console.log("📋 Test 1: Get folder information...");
    const folderInfo = await drive.files.get({
      fileId: cleanFolderId,
      fields: "id, name, parents, mimeType, capabilities",
    });

    console.log(`✅ Folder found: "${folderInfo.data.name}"`);
    console.log(`   Type: ${folderInfo.data.mimeType}`);
    console.log(
      `   Can create files: ${
        folderInfo.data.capabilities?.canAddChildren || "unknown"
      }`
    );

    if (folderInfo.data.mimeType !== "application/vnd.google-apps.folder") {
      console.warn("⚠️  Warning: This is not a folder, it's a file!");
      return false;
    }

    // Test 2: List contents
    console.log("\n📂 Test 2: List folder contents...");
    const contents = await drive.files.list({
      q: `'${cleanFolderId}' in parents`,
      fields: "files(id, name, mimeType)",
      pageSize: 5,
    });

    const files = contents.data.files || [];
    console.log(`✅ Found ${files.length} items in folder`);

    if (files.length > 0) {
      console.log("   Sample items:");
      files.slice(0, 3).forEach((file) => {
        const type =
          file.mimeType === "application/vnd.google-apps.folder" ? "📁" : "📄";
        console.log(`   ${type} ${file.name}`);
      });
    }

    // Test 3: Check upload permissions
    console.log("\n📤 Test 3: Check upload permissions...");

    if (folderInfo.data.capabilities?.canAddChildren === false) {
      console.warn(
        "⚠️  Warning: Cannot create files in this folder (read-only access)"
      );
      console.log(
        '💡 Make sure the service account has "Editor" permissions, not just "Viewer"'
      );
      return false;
    } else {
      console.log("✅ Upload permissions look good");
    }

    console.log("\n🎉 Folder access test passed!");
    return true;
  } catch (error: any) {
    console.error(`\n❌ Folder access test failed: ${error.message}`);

    if (error.code === 404) {
      console.log("\n🔧 Possible solutions:");
      console.log("1. 📝 Share the folder with your service account:");
      console.log(`   - Go to Google Drive and find the folder`);
      console.log(`   - Right-click → Share`);
      console.log(`   - Add: ${keyConfig.clientEmail}`);
      console.log(`   - Give "Editor" permissions`);
      console.log("");
      console.log("2. 🔍 Double-check the folder ID:");
      console.log(`   - Current ID: ${folderId}`);
      console.log(
        `   - Get it from the URL: https://drive.google.com/drive/folders/FOLDER_ID`
      );
    } else if (error.code === 403) {
      console.log("\n🔧 Permission denied. Make sure:");
      console.log("1. 📝 The folder is shared with your service account");
      console.log(
        '2. 🔓 The service account has "Editor" permissions (not just "Viewer")'
      );
      console.log(
        "3. 🌐 Google Drive API is enabled in your Google Cloud project"
      );
    }

    return false;
  }
}

if (require.main === module) {
  main();
}
