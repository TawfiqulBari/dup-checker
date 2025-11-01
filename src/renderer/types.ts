export interface FileWithHandle {
  id: string;
  file: File;
  handle?: FileSystemFileHandle;
  path: string;
  metadata: {
    size: number;
    dimensions?: { width: number; height: number };
    duration?: number;
  };
  thumbnail: string;
}

export type DuplicateGroup = FileWithHandle[];

export interface ScanProgress {
  status: string;
  processed: number;
  total: number;
}

export type ScanState = 'idle' | 'scanning' | 'done';