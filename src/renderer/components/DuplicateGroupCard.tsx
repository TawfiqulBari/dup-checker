
import React from 'react';
import { DuplicateGroup, FileWithHandle } from '../../shared/types';
import FileCard from './FileCard';

interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  selectedFiles: Set<string>;
  onSelectionChange: (newSelection: Set<string>) => void;
}

const DuplicateGroupCard: React.FC<DuplicateGroupCardProps> = ({ group, selectedFiles, onSelectionChange }) => {
  const handleSelectAllDuplicates = () => {
    const newSelection = new Set(selectedFiles);
    const isAllSelected = group.slice(1).every(file => newSelection.has(file.id));

    group.slice(1).forEach(file => {
      if (isAllSelected) {
        newSelection.delete(file.id);
      } else {
        newSelection.add(file.id);
      }
    });
    onSelectionChange(newSelection);
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

  const sortedGroup = [...group].sort((a, b) => b.metadata.size - a.metadata.size);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden">
      <div className="p-4 bg-slate-100 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Found {group.length} duplicates
        </h3>
        <button
          onClick={handleSelectAllDuplicates}
          className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
        >
          Select all duplicates
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
        {sortedGroup.map((file, index) => (
          <FileCard
            key={file.id}
            file={file}
            isOriginal={index === 0}
            isSelected={selectedFiles.has(file.id)}
            onToggleSelection={handleFileToggle}
          />
        ))}
      </div>
    </div>
  );
};

export default DuplicateGroupCard;
