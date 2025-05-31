#! /usr/bin/env node
/* eslint-disable no-console */
import fs from "fs";
import syncGDrive, { IKeyConfig, IOptions } from "./";

interface CliOptions extends IOptions {
  help?: boolean;
}

function printHelp() {
  console.log(`
📁 sync-gdrive - Fast parallel Google Drive synchronization

Usage: sync-gdrive <drive_file_folder_id> <dest_path> [options]

Environment Variables:
  GOOGLE_CLIENT_EMAIL    Your Google service account email
  GOOGLE_PRIVATE_KEY     Your Google service account private key

Performance Options:
  --concurrency <num>    Number of parallel downloads (default: 10)
  --batch-size <num>     Files processed per batch (default: 20)
  --sleep-time <ms>      Delay between operations in ms (default: 0)

File Type Options:
  --docs-type <ext>      Google Docs export format (default: docx)
  --sheets-type <ext>    Google Sheets export format (default: xlsx)
  --slides-type <ext>    Google Slides export format (default: pptx)
  --maps-type <ext>      Google Maps export format (default: kml)
  --fallback-type <ext>  Fallback GSuite export format (default: pdf)

Other Options:
  --verbose              Enable verbose logging
  --no-abort-on-error    Continue on errors instead of stopping
  --help                 Show this help message

Examples:
  # Basic sync
  sync-gdrive 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs85j4X_VuSqI ./downloads

  # High performance sync
  sync-gdrive 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs85j4X_VuSqI ./downloads --concurrency 20 --verbose

  # Custom file types
  sync-gdrive 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs85j4X_VuSqI ./downloads --docs-type pdf --sheets-type csv

Rate Limits:
  Google Drive API allows 200 requests/second per user.
  Default concurrency (10) uses ~20 requests/second - well within limits.
  You can safely increase concurrency up to 50 for faster downloads.
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
      console.log(`   Docs export: ${options.docsFileType || "docx"}`);
      console.log(`   Sheets export: ${options.sheetsFileType || "xlsx"}`);
      console.log(`   Slides export: ${options.slidesFileType || "pptx"}`);
    }

    const startTime = Date.now();
    const results = await syncGDrive(
      fileFolderId,
      destFolder,
      keyConfig,
      options
    );
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`\n✅ Sync completed successfully!`);
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📊 Files processed: ${results?.length || 0}`);

    if (options.concurrency && options.concurrency > 1) {
      console.log(
        `🚀 Used ${options.concurrency}x parallel downloads for maximum speed`
      );
    }
  } catch (error) {
    console.error("❌ Sync failed:", error.message);
    if (options?.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
