import React, { useEffect, useRef, useState } from 'react';
import { DuplicateGroup } from '../types';
import { sortGroup, isExactGroup } from '../services/selection';

interface Props {
  group: DuplicateGroup;
  keeperId?: string;
  onKeep: (id: string) => void;
  onClose: () => void;
}

export default function ComparisonModal({ group, keeperId, onKeep, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keeper = sortGroup(group, keeperId)[0];
  const [candidateId, setCandidateId] = useState(group.find(file => file.id !== keeper.id)!.id);
  const candidate = group.find(file => file.id === candidateId && file.id !== keeper.id) || group.find(file => file.id !== keeper.id)!;
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="comparison-title" className="w-full max-w-6xl max-h-[90vh] overflow-auto p-6 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 backdrop:bg-black/70">
    <div className="flex justify-between gap-4 mb-4"><h2 id="comparison-title" className="text-xl font-bold">Compare {isExactGroup(group) ? 'exact copies' : 'visual matches'}</h2><button autoFocus onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-md">Close</button></div>
    <p className="mb-4 text-sm">{isExactGroup(group) ? 'These files have identical contents.' : 'These files look similar but may contain meaningful differences. Check both before selecting a copy.'}</p>
    <label className="block mb-4">Compare against <select value={candidate.id} onChange={event => setCandidateId(event.target.value)} className="ml-2 p-2 max-w-full rounded border bg-white dark:bg-slate-900">{group.filter(file => file.id !== keeper.id).map(file => <option key={file.id} value={file.id}>{file.folderSide ? `Folder ${file.folderSide === 'first' ? '1' : '2'}: ` : ''}{file.path}</option>)}</select></label>
    <div className="grid md:grid-cols-2 gap-6">{[keeper, candidate].map((file, index) => <section key={file.id}>
      <h3 className="font-bold mb-2">{index === 0 ? 'Keeping' : 'Comparing'}</h3>
      <div className="h-80 bg-slate-100 dark:bg-slate-900 rounded-lg">{file.file.type.startsWith('image/') ? <img src={file.thumbnail} alt={file.file.name} className="w-full h-full object-contain" /> : <video src={file.thumbnail} controls preload="metadata" className="w-full h-full object-contain" />}</div>
      <p className="break-all mt-3 font-semibold">{file.path}</p>
      {file.folderSide && <p className="text-sm text-indigo-600 dark:text-indigo-400">Folder {file.folderSide === 'first' ? '1' : '2'}</p>}
      <p className="text-sm mt-1">{file.metadata.size.toLocaleString()} bytes · Modified {new Date(file.file.lastModified).toLocaleString()}</p>
      {index === 1 && <button onClick={() => { setCandidateId(keeper.id); onKeep(file.id); }} className="mt-3 px-4 py-2 rounded-md bg-indigo-600 text-white">Keep this file instead</button>}
    </section>)}</div>
  </dialog>;
}
