import { FileWithHandle } from '../types';
import { chooseNativeFolder, NativeFile } from './desktop';

type DirectoryPicker = (options: { mode: 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
export const getDirectoryPicker = (): DirectoryPicker | undefined =>
  window.desktopAPI ? chooseNativeFolder : (window as Window & { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker?.bind(window);

export async function readFolder(directory: FileSystemDirectoryHandle, signal: AbortSignal): Promise<FileWithHandle[]> {
  const files: FileWithHandle[] = [];
  const walk = async (folder: FileSystemDirectoryHandle, path: string): Promise<void> => {
    const iterable = folder as FileSystemDirectoryHandle & { values(): AsyncIterableIterator<FileSystemHandle> };
    for await (const entry of iterable.values()) {
      signal.throwIfAborted();
      const entryPath = `${path}/${entry.name}`;
      if (entry.kind === 'directory') await walk(entry as FileSystemDirectoryHandle, entryPath);
      else {
        const handle = entry as FileSystemFileHandle;
        const file = await handle.getFile();
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;
        files.push({ id: (file as NativeFile).nativeId || entryPath, path: entryPath, file, handle, parentHandle: folder, metadata: { size: file.size }, thumbnail: '' });
      }
    }
  };
  await walk(directory, directory.name);
  return files;
}

export async function validateFile(file: FileWithHandle): Promise<void> {
  if (!file.handle || !file.parentHandle) throw new Error('Choose this folder again using folder access.');
  const current = await file.parentHandle.getFileHandle(file.file.name);
  if (!await current.isSameEntry(file.handle)) throw new Error('File was replaced since scanning. Scan again.');
  const latest = await current.getFile();
  if (latest.size !== file.file.size || latest.lastModified !== file.file.lastModified) {
    throw new Error('File changed since scanning. Scan again.');
  }
}

export async function removeFile(file: FileWithHandle): Promise<void> {
  await validateFile(file);
  await file.parentHandle!.removeEntry(file.file.name);
}
