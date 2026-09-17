export interface FileWithHandle {
  id: string;
  file: File;
  handle?: FileSystemFileHandle;
  parentHandle?: FileSystemDirectoryHandle;
  path: string;
  metadata: {
    size: number;
    dimensions?: { width: number; height: number };
    duration?: number;
  };
  thumbnail: string;
  contentHash?: string;
  folderSide?: 'first' | 'second';
}

export type DuplicateGroup = FileWithHandle[];

export interface ScanProgress {
  status: string;
  processed: number;
  total: number;
  cachedFiles?: number;
}

export type ScanState = 'idle' | 'scanning' | 'done';
