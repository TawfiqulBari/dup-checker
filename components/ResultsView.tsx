import React, { useState } from 'react';
import { DuplicateGroup } from '../types';
import DuplicateGroupCard from './DuplicateGroupCard';
import InstructionsModal from './InstructionsModal';
import { removeFile, validateFile } from '../services/folderAccess';
import { sortGroup, groupKey, isExactGroup } from '../services/selection';
import ComparisonModal from './ComparisonModal';

interface ResultsViewProps {
  duplicateGroups: DuplicateGroup[];
  selectedFiles: Set<string>;
  onSelectionChange: (newSelection: Set<string>) => void;
  onNewScan: () => void;
  onFilesRemoved: (removed: Set<string>) => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({
  duplicateGroups,
  selectedFiles,
  onSelectionChange,
  onNewScan,
  onFilesRemoved,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removalMessage, setRemovalMessage] = useState('');
  const [keepers, setKeepers] = useState<Record<string, string>>({});
  const [matchFilter, setMatchFilter] = useState('all');
  const [mediaFilter, setMediaFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [comparisonKey, setComparisonKey] = useState<string | null>(null);
  const ordered = (group: DuplicateGroup) => sortGroup(group, keepers[groupKey(group)]);
  const chooseKeeper = (group: DuplicateGroup, id: string) => {
    if (isRemoving || !group.some(file => file.id === id)) return;
    setKeepers(current => ({ ...current, [groupKey(group)]: id }));
    const selection = new Set(selectedFiles);
    selection.delete(id);
    onSelectionChange(selection);
  };
  const visibleGroups = duplicateGroups.filter(group =>
    (matchFilter === 'all' || (matchFilter === 'exact' ? isExactGroup(group) : !isExactGroup(group))) &&
    (mediaFilter === 'all' || group.some(file => file.file.type.startsWith(mediaFilter + '/'))) &&
    (!search.trim() || group.some(file => file.path.toLowerCase().includes(search.trim().toLowerCase()))),
  );
  const comparisonGroup = duplicateGroups.find(group => groupKey(group) === comparisonKey);
  const hiddenSelected = duplicateGroups.filter(group => !visibleGroups.includes(group)).flat().filter(file => selectedFiles.has(file.id)).length;
  const canRemove = duplicateGroups.flat().every(file => file.handle && file.parentHandle);

  const handleRemove = async () => {
    const copies = duplicateGroups.flatMap(group => ordered(group).slice(1)).filter(file => selectedFiles.has(file.id));
    if (!copies.length || isRemoving) return;
    if (!window.confirm(`Permanently delete ${copies.length} selected file(s)?\n\nBrowser deletion does not use the Recycle Bin or Trash and cannot be undone. The KEEP file in each set will remain. Review visual matches before continuing.`)) return;
    setIsRemoving(true);
    const removed = new Set<string>();
    const failures: string[] = [];
    try {
      for (const file of copies) {
        try {
          const group = duplicateGroups.find(group => group.some(member => member.id === file.id))!;
          await validateFile(ordered(group)[0]);
          await removeFile(file);
          removed.add(file.id);
        } catch (error) {
          failures.push(`${file.path}: ${error instanceof Error ? error.message : 'Could not remove file'}`);
        }
      }
      const nextKeepers: Record<string, string> = {};
      duplicateGroups.forEach(group => {
        const remaining = group.filter(file => !removed.has(file.id));
        if (remaining.length > 1) nextKeepers[groupKey(remaining)] = ordered(group)[0].id;
      });
      setKeepers(nextKeepers);
      onFilesRemoved(removed);
      setRemovalMessage(`Removed ${removed.size} file(s).${failures.length ? '\n' + failures.join('\n') : ''}`);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleCopyPaths = async () => {
    const pathsToCopy = duplicateGroups.flat()
        .filter(f => selectedFiles.has(f.id))
        .map(f => f.path)
        .join('\n');
    
    if (pathsToCopy) {
      try {
        await navigator.clipboard.writeText(pathsToCopy);
        setIsModalOpen(true);
      } catch (err) {
        alert('Could not copy paths. Clipboard access requires HTTPS or localhost and browser permission.');
      }
    }
  };


  if (duplicateGroups.length === 0) {
    return (
      <div className="text-center max-w-2xl mx-auto mt-16 p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
        <h2 className="text-3xl font-extrabold text-green-600 dark:text-green-400 mb-4">No matching sets remaining</h2>
        {removalMessage && <p role="status" className="whitespace-pre-wrap mb-4">{removalMessage}</p>}
        <p className="text-slate-600 dark:text-slate-300 mb-8">
          No matches were found among the files we could compare. Check any scan issues above for files that could not be fully processed.
        </p>
        <button
          onClick={onNewScan}
          className="inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white font-bold rounded-md shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Scan Another Folder
        </button>
      </div>
    );
  }

  const totalDuplicates = duplicateGroups.reduce((acc, group) => acc + group.length - 1, 0);
  const potentialSpaceSaved = duplicateGroups.flat().reduce((acc, file) => {
    return selectedFiles.has(file.id) ? acc + file.metadata.size : acc;
  }, 0);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div>
      {isModalOpen && <InstructionsModal onClose={() => setIsModalOpen(false)} />}
      {comparisonGroup && <ComparisonModal group={comparisonGroup} keeperId={keepers[groupKey(comparisonGroup)]} onKeep={id => chooseKeeper(comparisonGroup, id)} onClose={() => setComparisonKey(null)} />}
      {removalMessage && <p role="status" className="whitespace-pre-wrap p-4 mb-4 bg-slate-200 dark:bg-slate-700 rounded-md">{removalMessage}</p>}
      <div className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm py-4 mb-6 -mx-4 px-4 border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Found {totalDuplicates} possible duplicate files in {duplicateGroups.length} sets.
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Selected {selectedFiles.size} files ({formatBytes(potentialSpaceSaved)})
            </p>
          </div>
          <div className="flex gap-2">
             <button
              onClick={onNewScan}
              disabled={isRemoving}
              className="px-4 py-2 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-semibold rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition"
            >
              New Scan
            </button>
            {canRemove && <button onClick={handleRemove} disabled={selectedFiles.size === 0 || isRemoving} className="px-6 py-2 bg-red-600 text-white font-bold rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
              {isRemoving ? 'Removing…' : `Remove selected (${selectedFiles.size})`}
            </button>}
            <button
              onClick={handleCopyPaths}
              disabled={selectedFiles.size === 0}
              className="px-6 py-2 bg-sky-600 text-white font-bold rounded-md shadow-md hover:bg-sky-700 disabled:bg-sky-300 dark:disabled:bg-sky-800 disabled:cursor-not-allowed transition"
            >
              Copy Paths ({selectedFiles.size})
            </button>
          </div>
        </div>
      </div>
       <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        <strong>Review your matches:</strong> Exact copies have identical contents; visual matches may differ. The largest file is kept by default. Choose “Keep this file” to protect a different copy. {canRemove ? 'Remove selected deletes files permanently, without the Recycle Bin or Trash.' : 'Direct removal requires a browser with folder access, such as Chrome or Edge on desktop. You can copy paths here for manual cleanup.'}
      </p>

      <fieldset disabled={isRemoving} className="flex flex-wrap items-end gap-4 p-4 mb-6 bg-white dark:bg-slate-800 rounded-lg">
        <label className="text-sm">Match type<select value={matchFilter} onChange={event => setMatchFilter(event.target.value)} className="block mt-1 p-2 border rounded bg-white dark:bg-slate-900"><option value="all">All matches</option><option value="exact">Exact copies</option><option value="similar">Visually similar</option></select></label>
        <label className="text-sm">Media<select value={mediaFilter} onChange={event => setMediaFilter(event.target.value)} className="block mt-1 p-2 border rounded bg-white dark:bg-slate-900"><option value="all">Images and videos</option><option value="image">Images</option><option value="video">Videos</option></select></label>
        <label className="text-sm flex-1">Find a file or folder<input value={search} onChange={event => setSearch(event.target.value)} type="search" placeholder="Search paths…" className="block w-full mt-1 p-2 border rounded bg-white dark:bg-slate-900" /></label>
        <button onClick={() => onSelectionChange(new Set())} className="px-4 py-2 text-indigo-600 dark:text-indigo-400">Clear selection</button>
        <p role="status" className="w-full text-sm">Showing {visibleGroups.length} of {duplicateGroups.length} sets.{hiddenSelected > 0 && ` ${hiddenSelected} selected file(s) are hidden by filters and are still included in removal.`}</p>
      </fieldset>
      {visibleGroups.length === 0 && <p className="text-center py-8">No matches for these filters. Try another search or choose All matches.</p>}

      <fieldset disabled={isRemoving} className="space-y-8">
        {visibleGroups.map(group => (
          <DuplicateGroupCard
            key={groupKey(group)}
            group={group}
            selectedFiles={selectedFiles}
            onSelectionChange={onSelectionChange}
            keeperId={keepers[groupKey(group)]}
            onKeep={id => chooseKeeper(group, id)}
            onCompare={() => setComparisonKey(groupKey(group))}
          />
        ))}
      </fieldset>
    </div>
  );
};

export default ResultsView;
