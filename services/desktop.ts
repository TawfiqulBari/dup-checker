import { NativeFolder, NativeEntry, SavedSession, SessionPatch, SessionSummary } from './sessionTypes';
import { FileWithHandle } from '../types';
declare global {
  interface Window {
    desktopAPI?: {
      chooseFolder(): Promise<NativeFolder | null>;
      gpuInfo(): Promise<{ active?: boolean; deviceString?: string; deviceId?: number; vendorId?: number }[]>;
      resetScan(): Promise<void>;
      listFolder(id: string): Promise<NativeEntry[]>;
      validateFile(id: string): Promise<void>;
      hashFile(id: string): Promise<string>;
      getCachedFile(id: string): Promise<{ exact?: string; visual?: string | string[] }>;
      cacheVisual(id: string, visual: string | string[]): Promise<void>;
      listSessions(): Promise<SessionSummary[]>;
      beginSession(items: { id: string; nativeId: string; path: string; folderSide?: string }[]): Promise<SavedSession>;
      saveSession(id: string, patch: SessionPatch): Promise<void>;
      loadSession(id: string): Promise<SavedSession>;
      refreshSession(id: string): Promise<SavedSession>;
      forgetSession(id: string): Promise<void>;
      confirmRemoval(ids: string[]): Promise<boolean>;
      trashFile(id: string): Promise<void>;
      smokeTest: boolean;
      reportSmoke(result: unknown): Promise<void>;
      mutateSmokeFixtures(png: number[]): Promise<void>;
    };
  }
}
export type NativeFile = File & { nativeId?: string; cachedExact?: boolean };
export const nativeUrl = (file: File): string | undefined => (file as NativeFile).nativeId ? `dupmedia://${(file as NativeFile).nativeId}/media` : undefined;
export const imageBlob = async (file: File): Promise<Blob> => nativeUrl(file) ? (await fetch(nativeUrl(file)!)).blob() : file;

// Adapt native folder access to the same interface used by the browser UI.
export async function chooseNativeFolder(): Promise<FileSystemDirectoryHandle> {
  const api = window.desktopAPI!;
  const root = await api.chooseFolder();
  if (!root) throw new DOMException('Cancelled', 'AbortError');
  return createNativeDirectory(root);
}

export function createNativeFile(entry: NativeEntry): NativeFile {
  const file = new File([], entry.name, { type: entry.type, lastModified: entry.mtime }) as NativeFile;
  Object.defineProperty(file, 'size', { value: entry.size });
  file.nativeId = entry.id;
  file.cachedExact = !!entry.cached?.exact;
  return file;
}

export function createNativeDirectory(root: NativeFolder, savedEntries?: NativeEntry[], directoryPrefix = ''): FileSystemDirectoryHandle {
  const api = window.desktopAPI!;
  let entries = savedEntries;
  let entryMap = savedEntries ? new Map(savedEntries.map(entry => [entry.path, entry])) : undefined;
  const fileHandle = (entry: NativeEntry) => ({
    kind: 'file', name: entry.name,
    isSameEntry: async (other: { nativeId?: string }) => other.nativeId === entry.id,
    nativeId: entry.id,
    getFile: async () => {
      await api.validateFile(entry.id);
      return createNativeFile(entry);
    },
  });
  const directory = (prefix: string): unknown => ({
    kind: 'directory', name: prefix ? prefix.split('/').at(-1) : root.name, absolute: root.absolute,
    isSameEntry: async (other: { absolute?: string }) => other.absolute === root.absolute,
    resolve: async (other: { absolute?: string }) => other.absolute?.toLowerCase().startsWith(root.absolute.toLowerCase().replace(/[\\/]+$/, '') + '\\') ? ['nested'] : null,
    async *values() {
      entries ??= await api.listFolder(root.id);
      entryMap ??= new Map(entries.map(entry => [entry.path, entry]));
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
      const entry = entryMap?.get(prefix ? `${prefix}/${name}` : name);
      if (!entry) throw new Error('File not found');
      return fileHandle(entry);
    },
    getDirectoryHandle: async (name: string) => directory(prefix ? `${prefix}/${name}` : name),
    removeEntry: async (name: string) => {
      const entry = entryMap?.get(prefix ? `${prefix}/${name}` : name);
      if (!entry) throw new Error('File not found');
      await api.trashFile(entry.id);
    },
  });
  return directory(directoryPrefix) as FileSystemDirectoryHandle;
}

export async function restoreSessionFiles(session: SavedSession): Promise<FileWithHandle[]> {
  const directories = new Map<string, FileSystemDirectoryHandle>();
  session.roots.forEach(root => directories.set(root.id, createNativeDirectory(root, session.manifest.filter(file => file.entry.rootId === root.id).map(file => file.entry))));
  return Promise.all(session.manifest.map(async saved => {
    let parent = directories.get(saved.entry.rootId)!;
    for (const part of saved.entry.path.split('/').slice(0, -1)) parent = await parent.getDirectoryHandle(part);
    return { id: saved.id, path: saved.path, folderSide: saved.folderSide, file: createNativeFile(saved.entry), handle: await parent.getFileHandle(saved.entry.name), parentHandle: parent, metadata: { size: saved.entry.size }, thumbnail: `dupmedia://${saved.nativeId}/media`, contentHash: saved.entry.cached?.exact };
  }));
}
