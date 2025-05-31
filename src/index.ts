import { utimesSync, createWriteStream, promises as fs } from "fs";
import path from "path";

import { google, drive_v3 } from "googleapis";
import * as mime from "mime-types";

import IKeyConfig from "./interfaces/IKeyConfig";
import IOptions from "./interfaces/IOptions";
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

/**
 * Checkes to see if the GDrive file is newer than the local file
 *
 * @param file
 * @param path
 */
async function isGDriveFileNewer(gDriveFile: File, filePath: string) {
  try {
    const stats = await fs.stat(filePath);
    const fsModifiedTime = timeAsSeconds(stats.mtime);
    const driveModifiedTime = timeAsSeconds(gDriveFile.modifiedTime);
    return driveModifiedTime > fsModifiedTime;
  } catch (err) {
    if (err.code === "ENOENT") {
      return true;
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
  if (await isGDriveFileNewer(file, filePath)) {
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

  return {
    file: filePath,
    updated: false,
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

  if (await isGDriveFileNewer(file, filePath)) {
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

  return {
    file: filePath,
    updated: false,
  };
}

async function downloadContent(
  drive: Drive,
  file: File,
  path: string,
  options: IOptions
) {
  let result;

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

  return result;
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

    return fetchContents(
      drive,
      fileFolderId,
      destFolder,
      initIOptions(options)
    );
  } catch (error) {
    log(error);
  }
}

export { syncGDrive, IKeyConfig, IOptions };
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
