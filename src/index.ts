import { utimesSync, createWriteStream, promises as fs } from "fs";
import path from "path";

import { google, drive_v3 } from "googleapis";
import * as mime from "mime-types";

import IKeyConfig from "./interfaces/IKeyConfig";
import IOptions, { ProgressInfo } from "./interfaces/IOptions";
import ISyncState from "./interfaces/ISyncState";

type Drive = drive_v3.Drive;
type File = drive_v3.Schema$File;

function sanitiseFilename(filename: string) {
  return filename.replace(/[/\\\r\n\t]/g, "_");
}

// Provide a default log function
function log(level: string, ...message: any[]) {
  // eslint-disable-next-line no-console
  console.log(`[${level}] ${message.join(" ")}`);
}

/**
 * Initialise default options and validate user provided option
 * values are valid.
 *
 * @param options
 */
function initIOptions(options: IOptions = {}): IOptions {
  const defaultIOptions: IOptions = {
    verbose: false,
    callback: undefined,
    docsFileType: "docx",
    sheetsFileType: "xlsx",
    slidesFileType: "pptx",
    mapsFileType: "kml",
    fallbackGSuiteFileType: "pdf",
    abortOnError: true,
    logger: {
      debug: log.bind(this, "debug"),
      warn: log.bind(this, "warn"),
      error: log.bind(this, "error"),
    },
    sleepTime: 0,
    concurrency: 10,
    batchSize: 20,
  };

  const mergedIOptions = Object.assign({}, defaultIOptions, options);

  // remove the leading fullstop, if provided
  if (mergedIOptions.docsFileType.startsWith(".")) {
    mergedIOptions.docsFileType = mergedIOptions.docsFileType.substring(1);
  }

  // remove the leading fullstop, if provided
  if (mergedIOptions.sheetsFileType.startsWith(".")) {
    mergedIOptions.sheetsFileType = mergedIOptions.sheetsFileType.substring(1);
  }

  // remove the leading fullstop, if provided
  if (mergedIOptions.slidesFileType.startsWith(".")) {
    mergedIOptions.slidesFileType = mergedIOptions.slidesFileType.substring(1);
  }

  if (!mime.lookup(mergedIOptions.docsFileType)) {
    throw new Error(
      `Unable to resolve mime type for Google Docs export: ${mergedIOptions.docsFileType}`
    );
  }

  if (!mime.lookup(mergedIOptions.sheetsFileType)) {
    throw new Error(
      `Unable to resolve mime type for Google Sheets export: ${mergedIOptions.sheetsFileType}`
    );
  }

  if (!mime.lookup(mergedIOptions.slidesFileType)) {
    throw new Error(
      `Unable to resolve mime type for Google Sheets export: ${mergedIOptions.slidesFileType}`
    );
  }

  if (
    mergedIOptions.verbose &&
    mergedIOptions.logger &&
    !mergedIOptions.logger.debug
  ) {
    throw new Error("Unable to use provided logger for verbose output");
  }

  // Validate concurrency options
  if (mergedIOptions.concurrency && mergedIOptions.concurrency < 1) {
    mergedIOptions.concurrency = 1;
  }

  if (mergedIOptions.batchSize && mergedIOptions.batchSize < 1) {
    mergedIOptions.batchSize = 1;
  }

  return mergedIOptions;
}

/**
 * Converts time to seconds. If the input is
 * a number, then it is assumed to be in milliseconds.
 *
 * @param datetime
 */
function timeAsSeconds(datetime: string | number | Date): number {
  let timeInMilliseconds = 0;
  if (typeof datetime === "string") {
    timeInMilliseconds = Date.parse(datetime);
  } else if (datetime instanceof Date) {
    timeInMilliseconds = datetime.getTime();
  } else {
    timeInMilliseconds = datetime as number;
  }

  return timeInMilliseconds / 1000;
}

// Progress tracking state
let progressState = {
  totalFiles: 0,
  completedFiles: 0,
  downloadedFiles: 0,
  skippedFiles: 0,
  errors: 0,
  startTime: Date.now(),
  lastUpdate: Date.now(),
};

function resetProgressState() {
  progressState = {
    totalFiles: 0,
    completedFiles: 0,
    downloadedFiles: 0,
    skippedFiles: 0,
    errors: 0,
    startTime: Date.now(),
    lastUpdate: Date.now(),
  };
}

async function isGDriveFileNewer(
  gDriveFile: File,
  filePath: string,
  options: IOptions
): Promise<{ shouldDownload: boolean; reason: string }> {
  // Force download option
  if (options.forceDownload) {
    return { shouldDownload: true, reason: "force-download" };
  }

  try {
    const stats = await fs.stat(filePath);

    // Skip existing option
    if (options.skipExisting) {
      return { shouldDownload: false, reason: "skip-existing" };
    }

    const fsModifiedTime = timeAsSeconds(stats.mtime);
    const driveModifiedTime = timeAsSeconds(gDriveFile.modifiedTime);

    // Enhanced checking with size and time
    if (options.checkSizeAndTime && gDriveFile.size) {
      const localSize = stats.size;
      const driveSize = parseInt(gDriveFile.size);

      if (
        localSize === driveSize &&
        Math.abs(driveModifiedTime - fsModifiedTime) < 1
      ) {
        return { shouldDownload: false, reason: "same-size-and-time" };
      }
    }

    if (driveModifiedTime > fsModifiedTime) {
      return { shouldDownload: true, reason: "drive-newer" };
    } else {
      return { shouldDownload: false, reason: "local-newer-or-same" };
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      return { shouldDownload: true, reason: "file-not-exists" };
    } else {
      throw err;
    }
  }
}

async function downloadFile(
  drive: Drive,
  file,
  destFolder: string,
  options: IOptions = {}
) {
  const filePath = path.join(destFolder, sanitiseFilename(file.name));
  const { shouldDownload, reason } = await isGDriveFileNewer(
    file,
    filePath,
    options
  );

  if (shouldDownload) {
    if (options.verbose) {
      options.logger.debug("downloading newer: ", filePath);
      options.logger.debug("creating file: ", filePath);
    }
    const dest = createWriteStream(filePath);

    let fileId = file.id;
    if (file.shortcutDetails) {
      fileId = file.shortcutDetails.targetId;
    }

    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: "media",
      },
      {
        responseType: "stream",
      }
    );

    return new Promise((resolve, reject) => {
      response.data
        .on("error", reject)
        .pipe(dest)
        .on("error", reject)
        .on("finish", () => {
          // apply time stamp from the drive
          utimesSync(
            filePath,
            timeAsSeconds(file.createdTime),
            timeAsSeconds(file.modifiedTime)
          );
          resolve({
            file: filePath,
            updated: true,
          });
        });
    });
  }

  if (options.verbose) {
    const reasonMap = {
      "skip-existing": "file exists (skip-existing option)",
      "local-newer-or-same": "local file is newer or same",
      "same-size-and-time": "file identical (size and time match)",
      "force-download": "forced download",
    };
    options.logger.debug(
      `skipping: ${filePath} (${reasonMap[reason] || reason})`
    );
  }

  return {
    file: filePath,
    updated: false,
    reason,
  };
}

async function exportFile(
  drive: Drive,
  file: File,
  destFolder: string,
  mimeType: string,
  suffix: string,
  options: IOptions = {}
): Promise<ISyncState> {
  const name = sanitiseFilename(file.name) + suffix;
  const filePath = path.join(destFolder, name);

  const { shouldDownload, reason } = await isGDriveFileNewer(
    file,
    filePath,
    options
  );

  if (shouldDownload) {
    if (options.verbose) {
      options.logger.debug("downloading newer: ", filePath);
      options.logger.debug("exporting to file: ", filePath);
    }

    const dest = createWriteStream(filePath);

    let fileId = file.id;
    if (file.shortcutDetails) {
      fileId = file.shortcutDetails.targetId;
    }

    // For Google Docs files only
    const response = await drive.files.export(
      {
        fileId,
        mimeType,
      },
      {
        responseType: "stream",
      }
    );

    return new Promise((resolve, reject) => {
      response.data
        .on("error", reject)
        .pipe(dest)
        .on("error", reject)
        .on("finish", () => {
          // apply time stamp from the drive
          utimesSync(
            filePath,
            timeAsSeconds(file.createdTime),
            timeAsSeconds(file.modifiedTime)
          );
          resolve({
            file: filePath,
            updated: true,
          });
        });
    });
  }

  if (options.verbose) {
    const reasonMap = {
      "skip-existing": "file exists (skip-existing option)",
      "local-newer-or-same": "local file is newer or same",
      "same-size-and-time": "file identical (size and time match)",
      "force-download": "forced download",
    };
    options.logger.debug(
      `skipping: ${filePath} (${reasonMap[reason] || reason})`
    );
  }

  return {
    file: filePath,
    updated: false,
    reason,
  };
}

async function downloadContent(
  drive: Drive,
  file: File,
  path: string,
  options: IOptions
) {
  let result;

  try {
    let fileMimeType = file.mimeType;
    if (file.shortcutDetails) {
      fileMimeType = file.shortcutDetails.targetMimeType;
    }

    if (file.mimeType === "application/vnd.google-apps.document") {
      const exportimeType = mime.lookup(options.docsFileType);
      if (!exportimeType) {
        throw new Error(
          `Unable to resolve mime type for Google Docs export: ${options.docsFileType}`
        );
      }
      result = await exportFile(
        drive,
        file,
        path,
        exportimeType,
        `.${options.docsFileType}`,
        options
      );
    } else if (fileMimeType === "application/vnd.google-apps.spreadsheet") {
      const exportimeType = mime.lookup(options.sheetsFileType);
      if (!exportimeType) {
        throw new Error(
          `Unable to resolve mime type for Google Sheets export: ${options.sheetsFileType}`
        );
      }
      result = await exportFile(
        drive,
        file,
        path,
        exportimeType,
        `.${options.sheetsFileType}`,
        options
      );
    } else if (fileMimeType === "application/vnd.google-apps.presentation") {
      const exportimeType = mime.lookup(options.slidesFileType);
      if (!exportimeType) {
        throw new Error(
          `Unable to resolve mime type for Google Slides export: ${options.slidesFileType}`
        );
      }
      result = await exportFile(
        drive,
        file,
        path,
        exportimeType,
        `.${options.slidesFileType}`,
        options
      );
    } else if (fileMimeType === "application/vnd.google-apps.map") {
      const exportimeType = mime.lookup(options.mapsFileType);
      if (!exportimeType) {
        throw new Error(
          `Unable to resolve mime type for Google Maps export: ${options.mapsFileType}`
        );
      }
      result = await exportFile(
        drive,
        file,
        path,
        exportimeType,
        `.${options.mapsFileType}`,
        options
      );
    } else if (
      fileMimeType &&
      fileMimeType.startsWith("application/vnd.google-apps")
    ) {
      // eslint-disable-next-line no-console
      const exportimeType = mime.lookup(options.fallbackGSuiteFileType);
      if (!exportimeType) {
        throw new Error(
          `Unable to resolve mime type for fallback GSuite export: ${options.fallbackGSuiteFileType}`
        );
      }
      result = await exportFile(
        drive,
        file,
        path,
        exportimeType,
        `.${options.fallbackGSuiteFileType}`,
        options
      );
    } else {
      // eslint-disable-next-line no-console
      result = await downloadFile(drive, file, path, options);
    }

    // Report successful download
    updateProgress(options, file.name, result);

    return result;
  } catch (error) {
    // Report failed download
    updateProgress(options, file.name, {
      updated: false,
      reason: error.message,
    });
    throw error;
  }
}

async function visitDirectory(
  drive: Drive,
  fileId: string,
  folderPath: string,
  options: IOptions,
  callback?: Function
): Promise<ISyncState[]> {
  let nextPageToken;
  let allSyncStates: ISyncState[] = [];

  do {
    const response = await drive.files.list({
      supportsAllDrives: options.supportsAllDrives,
      includeItemsFromAllDrives: options.includeItemsFromAllDrives,
      pageToken: nextPageToken,
      spaces: "drive",
      fields:
        "nextPageToken, files(id, name, parents, mimeType, createdTime, modifiedTime, shortcutDetails)",
      q: `'${fileId}' in parents`,
      pageSize: 200,
    });

    // Needed to get further results
    nextPageToken = response.data.nextPageToken;

    const files = response.data.files;

    // Separate files and folders for different processing strategies
    const folders = files.filter(
      (file) => file.mimeType === "application/vnd.google-apps.folder"
    );
    const regularFiles = files.filter(
      (file) => file.mimeType !== "application/vnd.google-apps.folder"
    );

    // Process regular files in parallel batches
    if (regularFiles.length > 0) {
      const fileProcessor = async (file) => {
        if (options.verbose) {
          options.logger.debug("FILE", file.id, folderPath, file.name);
        }
        return await downloadContent(drive, file, folderPath, options);
      };

      const fileSyncStates = await processBatch(
        regularFiles,
        fileProcessor,
        options.concurrency
      );
      allSyncStates = allSyncStates.concat(fileSyncStates);
    }

    // Process folders (can also be done in parallel, but with more care for directory creation)
    const folderProcessor = async (folder) => {
      const childFolderPath = path.join(folderPath, folder.name);

      if (options.verbose) {
        options.logger.debug("DIR", folder.id, childFolderPath, folder.name);
      }

      await fs.mkdir(childFolderPath, { recursive: true });

      // No sleep needed - Google Drive API allows 200 requests/second per user
      // Our parallel implementation uses much less than this limit

      return await visitDirectory(drive, folder.id, childFolderPath, options);
    };

    // Process folders with controlled concurrency (usually lower than files)
    const folderConcurrency = Math.max(
      1,
      Math.floor((options.concurrency || 5) / 2)
    );
    const folderSyncStates = await processBatch(
      folders,
      folderProcessor,
      folderConcurrency
    );

    // Flatten the folder results since each returns an array
    for (const folderResult of folderSyncStates) {
      allSyncStates = allSyncStates.concat(folderResult);
    }

    // continue until there is no next page
  } while (nextPageToken);

  return allSyncStates;
}

async function fetchContents(
  drive: Drive,
  fileId: string,
  destFolder: string,
  options: IOptions
) {
  const response = await drive.files.get({
    fileId: fileId,
    fields: "id, name, parents, mimeType, createdTime, modifiedTime",
    supportsAllDrives: options.supportsAllDrives,
  });

  const { data } = response;

  if (data.mimeType === "application/vnd.google-apps.folder") {
    return await visitDirectory(drive, fileId, destFolder, options);
  } else {
    return await downloadContent(drive, data, destFolder, options);
  }
}

async function syncGDrive(
  fileFolderId: string,
  destFolder: string,
  keyConfig: IKeyConfig,
  options?: IOptions
) {
  try {
    // Reset progress tracking for new sync
    resetProgressState();

    const auth = new google.auth.JWT(
      keyConfig.clientEmail,
      null,
      keyConfig.privateKey,
      [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.appdata",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive.metadata",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
        "https://www.googleapis.com/auth/drive.photos.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
      null
    );

    google.options({ auth });

    const drive = google.drive("v3");

    const finalOptions = initIOptions(options);

    // If progress tracking is enabled, do a quick scan to count total files
    if (finalOptions.progressCallback) {
      finalOptions.progressCallback({
        phase: "scanning",
        completedFiles: 0,
        errors: 0,
      });

      progressState.totalFiles = await countTotalFiles(
        drive,
        fileFolderId,
        finalOptions
      );
    }

    return fetchContents(drive, fileFolderId, destFolder, finalOptions);
  } catch (error) {
    log(error);
  }
}

async function countTotalFiles(
  drive: Drive,
  fileId: string,
  options: IOptions
): Promise<number> {
  let totalFiles = 0;
  let nextPageToken;

  // Check if this is a single file or folder
  const response = await drive.files.get({
    fileId: fileId,
    fields: "id, name, parents, mimeType, createdTime, modifiedTime",
    supportsAllDrives: options.supportsAllDrives,
  });

  if (response.data.mimeType !== "application/vnd.google-apps.folder") {
    return 1; // Single file
  }

  // Count files in this folder and subfolders
  do {
    const listResponse = await drive.files.list({
      supportsAllDrives: options.supportsAllDrives,
      includeItemsFromAllDrives: options.includeItemsFromAllDrives,
      pageToken: nextPageToken,
      spaces: "drive",
      fields: "nextPageToken, files(id, name, parents, mimeType)",
      q: `'${fileId}' in parents`,
      pageSize: 200,
    });

    nextPageToken = listResponse.data.nextPageToken;
    const files = listResponse.data.files || [];

    // Count regular files
    totalFiles += countFilesInResponse(files);

    // Recursively count files in subfolders
    const folders = files.filter(
      (file) => file.mimeType === "application/vnd.google-apps.folder"
    );
    for (const folder of folders) {
      totalFiles += await countTotalFiles(drive, folder.id!, options);
    }
  } while (nextPageToken);

  return totalFiles;
}

export { syncGDrive, syncFromTo, IKeyConfig, IOptions };
export default syncGDrive;

// ref: https://developers.google.com/drive/v3/web/folder
// ref: https://www.npmjs.com/package/googleapis
// ref: https://developers.google.com/drive/v3/web/search-parameters
// ref: https://developers.google.com/drive/v3/web/manage-downloads
// ref: https://developers.google.com/drive/v3/reference/files#resource

/**
 * Process items in parallel batches with controlled concurrency
 */
async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map((item) => processor(item));
    const batchResults = await Promise.allSettled(batchPromises);

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        // Log the error but continue with other files
        console.error("Error processing item:", result.reason);
      }
    }
  }

  return results;
}

function updateProgress(
  options: IOptions,
  currentFile?: string,
  result?: { updated: boolean; reason?: string }
) {
  if (!options.progressCallback) return;

  if (result) {
    if (result.updated) {
      progressState.downloadedFiles++;
    } else {
      progressState.skippedFiles++;
    }
    progressState.completedFiles++;
  }

  const now = Date.now();
  const elapsed = (now - progressState.startTime) / 1000;
  const speed = progressState.completedFiles / elapsed;
  const remaining = progressState.totalFiles - progressState.completedFiles;
  const eta = remaining > 0 ? Math.round(remaining / speed) : 0;

  // Determine if this is an upload or download operation
  const isUpload =
    currentFile &&
    (result?.reason === "created" ||
      result?.reason === "updated" ||
      result?.reason === "new-file" ||
      result?.reason === "local-newer");

  const progress: ProgressInfo = {
    phase:
      progressState.totalFiles > 0
        ? isUpload
          ? "uploading"
          : "downloading"
        : "scanning",
    totalFiles: progressState.totalFiles || undefined,
    completedFiles: progressState.completedFiles,
    downloadedFiles: isUpload ? 0 : progressState.downloadedFiles,
    uploadedFiles: isUpload ? progressState.downloadedFiles : 0,
    skippedFiles: progressState.skippedFiles,
    currentFile,
    speed: `${speed.toFixed(1)} files/sec`,
    eta:
      eta > 0
        ? `${Math.floor(eta / 60)}:${(eta % 60).toString().padStart(2, "0")}`
        : undefined,
    errors: progressState.errors,
  };

  // Throttle updates to every 100ms
  if (now - progressState.lastUpdate > 100) {
    options.progressCallback(progress);
    progressState.lastUpdate = now;
  }
}

function countFilesInResponse(files: any[]): number {
  return files.filter(
    (file) => file.mimeType !== "application/vnd.google-apps.folder"
  ).length;
}

/**
 * Check if a path is a Google Drive folder ID or a local filesystem path
 * Supports both prefixed format (gdrive:1ABC123...) and raw ID format for backwards compatibility
 */
function isGoogleDriveId(path: string): boolean {
  // New prefixed format: gdrive:1ABC123...
  if (path.startsWith("gdrive:")) {
    return true;
  }

  // Backwards compatibility: heuristic detection for raw IDs
  // Google Drive IDs are typically 25-50 characters of alphanumeric and some special chars
  // Local paths usually contain slashes or backslashes
  const driveIdPattern = /^[a-zA-Z0-9_-]{25,50}$/;
  const hasPathSeparators = path.includes("/") || path.includes("\\");

  return driveIdPattern.test(path) && !hasPathSeparators;
}

/**
 * Extract the actual Google Drive ID from a path, handling both prefixed and raw formats
 */
function extractGoogleDriveId(path: string): string {
  if (path.startsWith("gdrive:")) {
    return path.substring(7); // Remove 'gdrive:' prefix
  }
  return path; // Raw ID format
}

/**
 * Upload a local file to Google Drive
 */
async function uploadFile(
  drive: Drive,
  localFilePath: string,
  parentFolderId: string,
  options: IOptions = {}
): Promise<ISyncState> {
  try {
    const fileName = path.basename(localFilePath);
    const stats = await fs.stat(localFilePath);

    if (options.verbose) {
      options.logger.debug("uploading file: ", localFilePath);
    }

    // Check if file already exists in Drive
    const existingFiles = await drive.files.list({
      q: `name='${fileName}' and '${parentFolderId}' in parents and trashed=false`,
      fields: "files(id, name, modifiedTime, size)",
      supportsAllDrives: options.supportsAllDrives,
    });

    const existingFile = existingFiles.data.files?.[0];
    let shouldUpload = true;
    let reason = "new-file";

    if (existingFile) {
      const localModifiedTime = timeAsSeconds(stats.mtime);
      const driveModifiedTime = timeAsSeconds(existingFile.modifiedTime);

      if (options.forceDownload) {
        shouldUpload = true;
        reason = "force-upload";
      } else if (options.skipExisting) {
        shouldUpload = false;
        reason = "skip-existing";
      } else if (options.checkSizeAndTime && existingFile.size) {
        const driveSize = parseInt(existingFile.size);
        if (
          stats.size === driveSize &&
          Math.abs(localModifiedTime - driveModifiedTime) < 1
        ) {
          shouldUpload = false;
          reason = "same-size-and-time";
        }
      } else if (localModifiedTime <= driveModifiedTime) {
        shouldUpload = false;
        reason = "drive-newer-or-same";
      } else {
        reason = "local-newer";
      }
    }

    if (!shouldUpload) {
      if (options.verbose) {
        options.logger.debug(`skipping upload: ${localFilePath} (${reason})`);
      }
      return {
        file: localFilePath,
        updated: false,
        reason,
      };
    }

    // Determine MIME type
    const mimeType = mime.lookup(localFilePath) || "application/octet-stream";

    // Create readable stream
    const media = {
      mimeType,
      body: require("fs").createReadStream(localFilePath),
    };

    const fileMetadata = {
      name: fileName,
      parents: [parentFolderId],
    };

    let uploadedFile;
    if (existingFile) {
      // Update existing file
      uploadedFile = await drive.files.update({
        fileId: existingFile.id,
        media,
        fields: "id, name, modifiedTime",
        supportsAllDrives: options.supportsAllDrives,
      });
    } else {
      // Create new file
      uploadedFile = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: "id, name, modifiedTime",
        supportsAllDrives: options.supportsAllDrives,
      });
    }

    if (options.verbose) {
      options.logger.debug(
        `uploaded: ${localFilePath} -> ${uploadedFile.data.name}`
      );
    }

    return {
      file: localFilePath,
      updated: true,
      reason: existingFile ? "updated" : "created",
    };
  } catch (error) {
    if (options.verbose) {
      options.logger.error(`failed to upload ${localFilePath}:`, error.message);
    }
    throw error;
  }
}

/**
 * Upload a local directory to Google Drive
 */
async function uploadDirectory(
  drive: Drive,
  localDirPath: string,
  parentFolderId: string,
  options: IOptions
): Promise<ISyncState[]> {
  const results: ISyncState[] = [];

  try {
    const entries = await fs.readdir(localDirPath, { withFileTypes: true });

    // Separate files and directories
    const files = entries.filter((entry) => entry.isFile());
    const directories = entries.filter((entry) => entry.isDirectory());

    // Process files in parallel batches
    if (files.length > 0) {
      const fileProcessor = async (fileEntry) => {
        const localFilePath = path.join(localDirPath, fileEntry.name);
        const result = await uploadFile(
          drive,
          localFilePath,
          parentFolderId,
          options
        );
        updateProgress(options, fileEntry.name, result);
        return result;
      };

      const fileResults = await processBatch(
        files,
        fileProcessor,
        options.concurrency || 5
      );
      results.push(...fileResults);
    }

    // Process directories
    for (const dirEntry of directories) {
      const localSubDirPath = path.join(localDirPath, dirEntry.name);

      // Check if folder exists in Drive
      const existingFolders = await drive.files.list({
        q: `name='${dirEntry.name}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id, name)",
        supportsAllDrives: options.supportsAllDrives,
      });

      let folderId;
      if (existingFolders.data.files?.length > 0) {
        folderId = existingFolders.data.files[0].id;
        if (options.verbose) {
          options.logger.debug(`using existing folder: ${dirEntry.name}`);
        }
      } else if (options.createFolders !== false) {
        // Create folder in Drive
        const folderMetadata = {
          name: dirEntry.name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId],
        };

        const folder = await drive.files.create({
          requestBody: folderMetadata,
          fields: "id, name",
          supportsAllDrives: options.supportsAllDrives,
        });

        folderId = folder.data.id;
        if (options.verbose) {
          options.logger.debug(`created folder: ${dirEntry.name}`);
        }
      } else {
        if (options.verbose) {
          options.logger.debug(
            `skipping folder creation: ${dirEntry.name} (createFolders=false)`
          );
        }
        continue;
      }

      // Recursively upload subdirectory
      const subResults = await uploadDirectory(
        drive,
        localSubDirPath,
        folderId,
        options
      );
      results.push(...subResults);
    }
  } catch (error) {
    if (options.verbose) {
      options.logger.error(
        `failed to upload directory ${localDirPath}:`,
        error.message
      );
    }
    throw error;
  }

  return results;
}

/**
 * Main sync function that handles both download and upload based on from/to parameters
 */
async function syncFromTo(
  fromPath: string,
  toPath: string,
  keyConfig: IKeyConfig,
  options?: IOptions
) {
  try {
    // Reset progress tracking for new sync
    resetProgressState();

    const auth = new google.auth.JWT(
      keyConfig.clientEmail,
      null,
      keyConfig.privateKey,
      [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.appdata",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive.metadata",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
        "https://www.googleapis.com/auth/drive.photos.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
      null
    );

    google.options({ auth });
    const drive = google.drive("v3");
    const finalOptions = initIOptions(options);

    // Determine sync direction
    const fromIsGoogleDrive = isGoogleDriveId(fromPath);
    const toIsGoogleDrive = isGoogleDriveId(toPath);

    if (fromIsGoogleDrive && !toIsGoogleDrive) {
      // Download: Google Drive -> Local
      if (finalOptions.verbose) {
        finalOptions.logger.debug(
          `Downloading from Google Drive (${fromPath}) to local (${toPath})`
        );
      }
      const driveId = extractGoogleDriveId(fromPath);
      return await syncGDrive(driveId, toPath, keyConfig, finalOptions);
    } else if (!fromIsGoogleDrive && toIsGoogleDrive) {
      // Upload: Local -> Google Drive
      if (finalOptions.verbose) {
        finalOptions.logger.debug(
          `Uploading from local (${fromPath}) to Google Drive (${toPath})`
        );
      }

      // Check if from path exists
      const stats = await fs.stat(fromPath);
      const driveId = extractGoogleDriveId(toPath);

      if (stats.isFile()) {
        // Upload single file
        return await uploadFile(drive, fromPath, driveId, finalOptions);
      } else if (stats.isDirectory()) {
        // Count total files for progress tracking
        if (finalOptions.progressCallback) {
          finalOptions.progressCallback({
            phase: "scanning",
            completedFiles: 0,
            errors: 0,
          });
          progressState.totalFiles = await countLocalFiles(fromPath);
        }

        // Upload directory
        return await uploadDirectory(drive, fromPath, driveId, finalOptions);
      } else {
        throw new Error(`Unsupported file type: ${fromPath}`);
      }
    } else if (fromIsGoogleDrive && toIsGoogleDrive) {
      throw new Error("Google Drive to Google Drive sync is not yet supported");
    } else {
      throw new Error(
        "Local to local sync is not supported - use standard file copy tools"
      );
    }
  } catch (error) {
    log(error);
    throw error;
  }
}

/**
 * Count total files in a local directory recursively
 */
async function countLocalFiles(dirPath: string): Promise<number> {
  let totalFiles = 0;

  try {
    const stats = await fs.stat(dirPath);
    if (stats.isFile()) {
      return 1;
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        totalFiles++;
      } else if (entry.isDirectory()) {
        totalFiles += await countLocalFiles(fullPath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
    if (error.code !== "EACCES" && error.code !== "EPERM") {
      throw error;
    }
  }

  return totalFiles;
}
