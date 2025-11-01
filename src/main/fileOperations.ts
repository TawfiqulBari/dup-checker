import { ipcMain, dialog } from 'electron';
import { unlink } from 'fs/promises';
import { normalize } from 'path';

export interface DeleteFilesResult {
  success: boolean;
  deleted?: number;
  failed?: number;
  message: string;
  errors?: Array<{ file: string; error: string }>;
}

export function setupFileOperations() {
  // Handle file deletion requests
  ipcMain.handle('delete-files', async (event, filePaths: string[]): Promise<DeleteFilesResult> => {
    try {
      // Security: Show confirmation dialog
      const result = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Cancel', 'Delete'],
        defaultId: 0,
        cancelId: 0,
        title: 'Confirm File Deletion',
        message: `Are you sure you want to delete ${filePaths.length} file(s)?`,
        detail: 'This action cannot be undone. The files will be permanently deleted from your system.',
        noLink: true
      });

      if (result.response !== 1) {
        return {
          success: false,
          message: 'Deletion cancelled by user'
        };
      }

      // Validate file paths (security measure to prevent path traversal)
      const validatedPaths: string[] = [];
      const invalidPaths: string[] = [];

      for (const fp of filePaths) {
        try {
          const normalized = normalize(fp);
          // Check for path traversal attempts
          if (normalized.includes('..') || normalized !== fp) {
            invalidPaths.push(fp);
          } else {
            validatedPaths.push(normalized);
          }
        } catch (err) {
          invalidPaths.push(fp);
        }
      }

      if (invalidPaths.length > 0) {
        console.warn('Invalid file paths detected:', invalidPaths);
      }

      // Delete files
      const results = await Promise.allSettled(
        validatedPaths.map(fp => unlink(fp))
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failedCount = results.length - successCount;

      const errors: Array<{ file: string; error: string }> = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          errors.push({
            file: validatedPaths[index],
            error: result.reason?.message || 'Unknown error'
          });
        }
      });

      return {
        success: true,
        deleted: successCount,
        failed: failedCount + invalidPaths.length,
        message: `Successfully deleted ${successCount} file(s). ${failedCount + invalidPaths.length} failed.`,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('Error in delete-files handler:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });
}
