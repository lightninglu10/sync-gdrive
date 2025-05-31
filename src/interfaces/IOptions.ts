interface IOptions {
  verbose?: boolean;
  callback?: Function;
  docsFileType?: string;
  sheetsFileType?: string;
  slidesFileType?: string;
  mapsFileType?: string;
  fallbackGSuiteFileType?: string;
  abortOnError?: boolean;
  logger?: any;
  sleepTime?: number;
  supportsAllDrives?: boolean;
  includeItemsFromAllDrives?: boolean;
  concurrency?: number;
  batchSize?: number;
  progressCallback?: (progress: ProgressInfo) => void;
  showProgress?: boolean;
  forceDownload?: boolean;
  skipExisting?: boolean;
  checkSizeAndTime?: boolean;
}

interface ProgressInfo {
  phase: "scanning" | "downloading" | "complete";
  totalFiles?: number;
  completedFiles: number;
  currentFile?: string;
  totalSize?: number;
  downloadedSize?: number;
  speed?: string;
  eta?: string;
  errors?: number;
  skippedFiles?: number;
  downloadedFiles?: number;
}

export default IOptions;
export { ProgressInfo };
