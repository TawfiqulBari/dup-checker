interface NativeFolder { id: string; name: string; absolute: string }
interface NativeEntry { id: string; name: string; path: string; size: number; mtime: number; type: string }
declare global {
  interface Window {
    desktopAPI?: {
      chooseFolder(): Promise<NativeFolder | null>;
      gpuInfo(): Promise<{ active?: boolean; deviceString?: string; deviceId?: number; vendorId?: number }[]>;
      resetScan(): Promise<void>;
      listFolder(id: string): Promise<NativeEntry[]>;
      validateFile(id: string): Promise<void>;
      hashFile(id: string): Promise<string>;
      confirmRemoval(ids: string[]): Promise<boolean>;
      trashFile(id: string): Promise<void>;
      smokeTest: boolean;
      reportSmoke(result: unknown): Promise<void>;
    };
  }
}
export type NativeFile = File & { nativeId?: string };
export const nativeUrl = (file: File): string | undefined => (file as NativeFile).nativeId ? `dupmedia://${(file as NativeFile).nativeId}/media` : undefined;
export const imageBlob = async (file: File): Promise<Blob> => nativeUrl(file) ? (await fetch(nativeUrl(file)!)).blob() : file;

// Adapt native folder access to the same interface used by the browser UI.
export async function chooseNativeFolder(): Promise<FileSystemDirectoryHandle> {
  const api = window.desktopAPI!;
  const root = await api.chooseFolder();
  if (!root) throw new DOMException('Cancelled', 'AbortError');
  let entries: NativeEntry[] | undefined;
  const fileHandle = (entry: NativeEntry) => ({
    kind: 'file', name: entry.name,
    isSameEntry: async (other: { nativeId?: string }) => other.nativeId === entry.id,
    nativeId: entry.id,
    getFile: async () => {
      await api.validateFile(entry.id);
      const file = new File([], entry.name, { type: entry.type, lastModified: entry.mtime }) as NativeFile;
      Object.defineProperty(file, 'size', { value: entry.size });
      file.nativeId = entry.id;
      return file;
    },
  });
  const directory = (prefix: string): unknown => ({
    kind: 'directory', name: prefix ? prefix.split('/').at(-1) : root.name, absolute: root.absolute,
    isSameEntry: async (other: { absolute?: string }) => other.absolute === root.absolute,
    resolve: async (other: { absolute?: string }) => other.absolute?.toLowerCase().startsWith(root.absolute.toLowerCase() + '\\') ? ['nested'] : null,
    async *values() {
      entries ??= await api.listFolder(root.id);
      const directories = new Set<string>();
      for (const entry of entries) {
        const relative = prefix ? entry.path.startsWith(prefix + '/') ? entry.path.slice(prefix.length + 1) : null : entry.path;
        if (!relative) continue;
        if (relative.includes('/')) {
          const name = relative.split('/')[0];
          if (!directories.has(name)) { directories.add(name); yield directory(prefix ? `${prefix}/${name}` : name); }
        } else yield fileHandle(entry);
      }
    },
    getFileHandle: async (name: string) => {
      const entry = entries?.find(entry => entry.path === (prefix ? `${prefix}/${name}` : name));
      if (!entry) throw new Error('File not found');
      return fileHandle(entry);
    },
    removeEntry: async (name: string) => {
      const entry = entries?.find(entry => entry.path === (prefix ? `${prefix}/${name}` : name));
      if (!entry) throw new Error('File not found');
      await api.trashFile(entry.id);
    },
  });
  return directory('') as FileSystemDirectoryHandle;
}
