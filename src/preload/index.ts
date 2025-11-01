import { contextBridge, ipcRenderer } from 'electron';

export interface DeleteFilesResult {
  success: boolean;
  deleted?: number;
  failed?: number;
  message: string;
  errors?: Array<{ file: string; error: string }>;
}

export interface ElectronAPI {
  deleteFiles: (filePaths: string[]) => Promise<DeleteFilesResult>;
  platform: string;
  isElectron: boolean;
}

// Security: Use contextBridge to safely expose APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // File deletion API
  deleteFiles: (filePaths: string[]) =>
    ipcRenderer.invoke('delete-files', filePaths) as Promise<DeleteFilesResult>,

  // Platform detection
  platform: process.platform,
  isElectron: true
});

// Type declaration for TypeScript in renderer
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
