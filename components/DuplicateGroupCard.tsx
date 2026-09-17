
import React from 'react';
import { DuplicateGroup, FileWithHandle } from '../types';
import FileCard from './FileCard';
import { sortGroup, toggleDuplicates, isExactGroup } from '../services/selection';

interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  selectedFiles: Set<string>;
  onSelectionChange: (newSelection: Set<string>) => void;
  keeperId?: string;
  onKeep: (id: string) => void;
  onCompare: () => void;
  reviewed: boolean;
  onToggleReviewed: () => void;
}

const DuplicateGroupCard: React.FC<DuplicateGroupCardProps> = ({ group, selectedFiles, onSelectionChange, keeperId, onKeep, onCompare, reviewed, onToggleReviewed }) => {
  const handleSelectAllDuplicates = () => {
    onSelectionChange(toggleDuplicates(group, selectedFiles, keeperId));
  };
  
  const handleFileToggle = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    onSelectionChange(newSelection);
  };

  const sortedGroup = sortGroup(group, keeperId);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden">
      <div className="p-4 bg-slate-100 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          <span className={isExactGroup(group) ? 'text-green-600 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>{isExactGroup(group) ? 'Exact copies' : 'Visually similar'}</span> · {group.length} files
        </h3>
        <div className="flex flex-wrap gap-4"><button onClick={onToggleReviewed} aria-pressed={reviewed} className="text-sm font-medium text-green-700 dark:text-green-400">{reviewed ? 'Reviewed ✓' : 'Mark reviewed'}</button><button onClick={onCompare} className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Compare</button><button
          onClick={handleSelectAllDuplicates}
          className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
        >
          {sortedGroup.slice(1).every(file => selectedFiles.has(file.id)) ? 'Clear selection' : 'Select copies'}
        </button></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
        {sortedGroup.map((file, index) => (
          <FileCard
            key={file.id}
            file={file}
            isOriginal={index === 0}
            isSelected={selectedFiles.has(file.id)}
            onToggleSelection={handleFileToggle}
            onKeep={() => onKeep(file.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default DuplicateGroupCard;
