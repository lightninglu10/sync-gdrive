#! /usr/bin/env node
/* eslint-disable no-console */
import fs from "fs";
import cliProgress from "cli-progress";
import syncGDrive, { IKeyConfig, IOptions } from "./";

interface CliOptions extends IOptions {
  help?: boolean;
  noProgress?: boolean;
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

function printHelp() {
  console.log(`
📁 sync-gdrive - Fast parallel Google Drive synchronization with incremental sync

Usage: sync-gdrive <drive_file_folder_id> <dest_path> [options]

Environment Variables:
  GOOGLE_CLIENT_EMAIL    Your Google service account email
  GOOGLE_PRIVATE_KEY     Your Google service account private key

Performance Options:
  --concurrency <num>    Number of parallel downloads (default: 10)
  --batch-size <num>     Files processed per batch (default: 20)
  --sleep-time <ms>      Delay between operations in ms (default: 0)

Incremental Sync Options:
  --force-download       Re-download all files even if they exist locally
  --skip-existing        Skip all files that exist locally (no time check)
  --check-size-and-time  Enhanced checking: skip if size AND time match exactly

File Type Options:
  --docs-type <ext>      Google Docs export format (default: docx)
  --sheets-type <ext>    Google Sheets export format (default: xlsx)
  --slides-type <ext>    Google Slides export format (default: pptx)
  --maps-type <ext>      Google Maps export format (default: kml)
  --fallback-type <ext>  Fallback GSuite export format (default: pdf)

Other Options:
  --verbose              Enable verbose logging
  --no-abort-on-error    Continue on errors instead of stopping
  --no-progress          Disable progress bars
  --help                 Show this help message

Incremental Sync Behavior:
  By default, sync-gdrive uses smart incremental sync:
  • Skips files that exist locally and are newer or same age
  • Downloads files that don't exist or are older locally
  • Compares modification times between Google Drive and local files
  • Perfect for resuming interrupted syncs!

Examples:
  # Smart incremental sync (default) - resumes perfectly
  sync-gdrive 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs85j4X_VuSqI ./downloads

  # Force re-download everything
  sync-gdrive 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs85j4X_VuSqI ./downloads --force-download

  # Skip existing files completely (fastest for checking)
  sync-gdrive 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs85j4X_VuSqI ./downloads --skip-existing

  # Enhanced precision checking
  sync-gdrive 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs85j4X_VuSqI ./downloads --check-size-and-time

  # High performance with progress (shows downloaded vs skipped)
  sync-gdrive 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs85j4X_VuSqI ./downloads --concurrency 20 --verbose

Progress Bars Show:
  • Files (↓15 ⊘23) - Downloaded 15, Skipped 23 files
  • Real-time sync status and speed
  • Detailed logging in verbose mode shows skip reasons

Rate Limits:
  Google Drive API allows 200 requests/second per user.
  Default concurrency (10) uses ~20 requests/second - well within limits.
  Incremental sync only requests files that need updating!
`);
}

function parseCliOptions(): {
  options: CliOptions;
  fileFolderId?: string;
  destFolder?: string;
} {
  const args = process.argv.slice(2);
  const options: CliOptions = {};
  let fileFolderId: string | undefined;
  let destFolder: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (arg === "--no-abort-on-error") {
      options.abortOnError = false;
    } else if (arg === "--no-progress") {
      options.noProgress = true;
    } else if (arg === "--concurrency") {
      const value = parseInt(args[++i], 10);
      if (isNaN(value) || value < 1) {
        console.error("❌ Error: --concurrency must be a positive number");
        process.exit(1);
      }
      options.concurrency = value;
    } else if (arg === "--batch-size") {
      const value = parseInt(args[++i], 10);
      if (isNaN(value) || value < 1) {
        console.error("❌ Error: --batch-size must be a positive number");
        process.exit(1);
      }
      options.batchSize = value;
    } else if (arg === "--sleep-time") {
      const value = parseInt(args[++i], 10);
      if (isNaN(value) || value < 0) {
        console.error("❌ Error: --sleep-time must be a non-negative number");
        process.exit(1);
      }
      options.sleepTime = value;
    } else if (arg === "--docs-type") {
      options.docsFileType = args[++i];
    } else if (arg === "--sheets-type") {
      options.sheetsFileType = args[++i];
    } else if (arg === "--slides-type") {
      options.slidesFileType = args[++i];
    } else if (arg === "--maps-type") {
      options.mapsFileType = args[++i];
    } else if (arg === "--fallback-type") {
      options.fallbackGSuiteFileType = args[++i];
    } else if (arg === "--force-download") {
      options.forceDownload = true;
    } else if (arg === "--skip-existing") {
      options.skipExisting = true;
    } else if (arg === "--check-size-and-time") {
      options.checkSizeAndTime = true;
    } else if (!arg.startsWith("--")) {
      if (!fileFolderId) {
        fileFolderId = arg;
      } else if (!destFolder) {
        destFolder = arg;
      } else {
        console.error(`❌ Error: Unexpected argument '${arg}'`);
        process.exit(1);
      }
    } else {
      console.error(`❌ Error: Unknown option '${arg}'`);
      console.log("Use --help for usage information");
      process.exit(1);
    }
  }

  return { options, fileFolderId, destFolder };
}

async function main() {
  const { options, fileFolderId, destFolder } = parseCliOptions();

  try {
    if (options.help) {
      printHelp();
      process.exit(0);
    }

    let okay = true;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    if (!clientEmail) {
      console.log(
        "❌ No client email specified. Be sure to set GOOGLE_CLIENT_EMAIL env variable."
      );
      okay = false;
    }

    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!privateKey) {
      console.log(
        "❌ No Google API private key specified. Be sure to set GOOGLE_PRIVATE_KEY env variable."
      );
      okay = false;
    }

    if (!fileFolderId || !destFolder) {
      console.log("❌ Missing required arguments");
      console.log(
        "Usage: sync-gdrive <drive_file_folder_id> <dest_path> [options]"
      );
      console.log("Use --help for more information");
      process.exit(1);
    }

    if (!okay) {
      process.exit(1);
    }

    // Unescape new lines
    privateKey = privateKey.replace(/\\n/g, "\n");

    try {
      fs.accessSync(destFolder, fs.constants.R_OK | fs.constants.W_OK);
    } catch (error) {
      console.log(
        `❌ Destination folder '${destFolder}' does not exist or is not writable by current user`
      );
      process.exit(1);
    }

    const keyConfig: IKeyConfig = {
      clientEmail: clientEmail,
      privateKey: privateKey,
    };

    // Setup progress tracking
    if (!options.noProgress) {
      progressBars = createProgressBars();
      options.progressCallback = updateProgressBar;
    }

    // Show configuration
    console.log("🚀 Starting Google Drive sync...");
    console.log(`📁 Source: Google Drive file/folder ID '${fileFolderId}'`);
    console.log(`💾 Destination: '${destFolder}'`);

    if (options.verbose) {
      console.log("\n⚙️  Configuration:");
      console.log(
        `   Concurrency: ${options.concurrency || 10} parallel downloads`
      );
      console.log(`   Batch size: ${options.batchSize || 20} files per batch`);
      console.log(
        `   Sleep time: ${options.sleepTime || 0}ms between operations`
      );

      // Show sync mode
      let syncMode = "Smart incremental (compares modification times)";
      if (options.forceDownload) {
        syncMode = "Force download (re-download all files)";
      } else if (options.skipExisting) {
        syncMode = "Skip existing (no downloading if file exists)";
      } else if (options.checkSizeAndTime) {
        syncMode = "Enhanced incremental (size + time matching)";
      }
      console.log(`   Sync mode: ${syncMode}`);

      console.log(`   Docs export: ${options.docsFileType || "docx"}`);
      console.log(`   Sheets export: ${options.sheetsFileType || "xlsx"}`);
      console.log(`   Slides export: ${options.slidesFileType || "pptx"}`);
      console.log(
        `   Progress bars: ${options.noProgress ? "disabled" : "enabled"}`
      );
    }

    console.log(""); // Add space before progress bars

    const startTime = Date.now();
    const results = await syncGDrive(
      fileFolderId,
      destFolder,
      keyConfig,
      options
    );
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // Clean up progress bars
    if (progressBars.multibar) {
      progressBars.multibar.stop();
    }

    console.log(`\n✅ Sync completed successfully!`);
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);

    // Enhanced summary with download/skip stats
    const totalFiles = results?.length || 0;
    const downloadedFiles = results?.filter((r) => r.updated).length || 0;
    const skippedFiles = totalFiles - downloadedFiles;

    console.log(`📊 Files processed: ${totalFiles}`);
    if (totalFiles > 0) {
      console.log(`📥 Downloaded: ${downloadedFiles} files`);
      console.log(`⊘ Skipped: ${skippedFiles} files`);
    }

    if (options.concurrency && options.concurrency > 1) {
      console.log(
        `🚀 Used ${options.concurrency}x parallel downloads for maximum speed`
      );
    }

    const avgSpeed = results?.length
      ? ((results.length / duration) * 60).toFixed(1)
      : "0";
    console.log(`📈 Average speed: ${avgSpeed} files/minute`);

    if (skippedFiles > 0 && !options.forceDownload) {
      console.log(
        `💡 ${skippedFiles} files were up-to-date and skipped. Use --force-download to re-download all files.`
      );
    }
  } catch (error) {
    // Clean up progress bars on error
    if (progressBars.multibar) {
      progressBars.multibar.stop();
    }

    console.error("\n❌ Sync failed:", error.message);
    if (options?.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
