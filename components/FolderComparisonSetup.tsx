import React, { useEffect, useRef, useState } from 'react';
import { FileWithHandle } from '../types';
import { getDirectoryPicker, readFolder } from '../services/folderAccess';

export default function FolderComparisonSetup({ onScan, onBack }: { onScan: (files: FileWithHandle[]) => void; onBack: () => void }) {
  const [folders, setFolders] = useState<(FileSystemDirectoryHandle | undefined)[]>([]);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const choose = async (index: number) => {
    try {
      const picker = getDirectoryPicker();
      if (!picker) throw new Error('Two-folder comparison requires folder access. Open this app in desktop Chrome or Edge.');
      const folder = await picker({ mode: 'readwrite' });
      const other = folders[index === 0 ? 1 : 0];
      if (other && (await folder.isSameEntry(other) || await folder.resolve(other) !== null || await other.resolve(folder) !== null)) {
        throw new Error('Choose two separate folders. They cannot be the same folder or contain one another.');
      }
      setFolders(current => { const next = [...current]; next[index] = folder; return next; });
      setError('');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setError(error instanceof Error ? error.message : 'Could not open folder.');
    }
  };
  const scan = async () => {
    if (!folders[0] || !folders[1]) return;
    const active = new AbortController();
    controller.current = active;
    setReading(true);
    setError('');
    try {
      const files: FileWithHandle[] = [];
      for (const [index, folder] of folders.entries()) {
        const side = index === 0 ? 'first' : 'second';
        const entries = await readFolder(folder!, active.signal);
        if (!entries.length) throw new Error(`Folder ${index + 1} (${folder!.name}) contains no recognized images or videos.`);
        files.push(...entries.map(file => ({ ...file, id: `${side}:${file.id}`, folderSide: side as 'first' | 'second' })));
      }
      active.signal.throwIfAborted();
      onScan(files);
    } catch (error) {
      if (active.signal.aborted) return;
      setError(error instanceof Error ? error.message : 'Could not read folders.');
      setReading(false);
    }
  };
  return <section className="max-w-2xl mx-auto mt-12 p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
    <h2 className="text-2xl font-bold mb-3">Compare two folders</h2>
    <p className="mb-6">Find matches shared by both folders, including subfolders. Sets found only inside one folder are excluded. You can choose which copy to keep when reviewing results.</p>
    {error && <p role="alert" className="mb-4 text-amber-700 dark:text-amber-400">{error}</p>}
    <fieldset disabled={reading} className="grid sm:grid-cols-2 gap-4 mb-6">{[0, 1].map(index => <button key={index} onClick={() => choose(index)} className="p-6 border-2 border-dashed border-indigo-400 rounded-lg text-left"><span className="block font-bold">Choose folder {index + 1}</span><span className="block mt-2 break-all">{folders[index]?.name || 'No folder selected'}</span></button>)}</fieldset>
    {reading && <p role="status" className="mb-4">Reading both folders…</p>}
    <div className="flex gap-3"><button onClick={scan} disabled={reading || !folders[0] || !folders[1]} className="px-5 py-3 rounded-md bg-indigo-600 text-white disabled:opacity-50">Compare folders</button><button onClick={onBack} className="px-5 py-3 rounded-md bg-slate-200 dark:bg-slate-700">{reading ? 'Cancel' : 'Back'}</button></div>
  </section>;
}
