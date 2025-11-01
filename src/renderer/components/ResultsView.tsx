import React, { useState } from 'react';
import { DuplicateGroup } from '../../shared/types';
import { hasNativeFileOperations } from '../../shared/platformDetection';
import DuplicateGroupCard from './DuplicateGroupCard';
import InstructionsModal from './InstructionsModal';

interface ResultsViewProps {
  duplicateGroups: DuplicateGroup[];
  selectedFiles: Set<string>;
  onSelectionChange: (newSelection: Set<string>) => void;
  onNewScan: () => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({
  duplicateGroups,
  selectedFiles,
  onSelectionChange,
  onNewScan,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const canDeleteNatively = hasNativeFileOperations();

  const handleDeleteFiles = async () => {
    if (!canDeleteNatively || !window.electronAPI) {
      // Fallback to clipboard copy for web version
      handleCopyPaths();
      return;
    }

    setIsDeleting(true);
    try {
      const pathsToDelete = duplicateGroups
        .flat()
        .filter((f) => selectedFiles.has(f.id))
        .map((f) => f.path);

      const result = await window.electronAPI.deleteFiles(pathsToDelete);

      if (result.success) {
        alert(result.message);

        // Remove deleted files from selection
        const newSelection = new Set(selectedFiles);
        pathsToDelete.forEach((path) => {
          const fileToRemove = duplicateGroups
            .flat()
            .find((f) => f.path === path);
          if (fileToRemove) {
            newSelection.delete(fileToRemove.id);
          }
        });
        onSelectionChange(newSelection);

        // Refresh the scan to update the view
        setTimeout(() => {
          alert('Please run a new scan to see updated results.');
        }, 500);
      } else {
        alert(`Deletion failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete files. See console for details.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyPaths = () => {
    const pathsToCopy = duplicateGroups.flat()
        .filter(f => selectedFiles.has(f.id))
        .map(f => f.path)
        .join('\n');
    
    if (pathsToCopy) {
      navigator.clipboard.writeText(pathsToCopy).then(() => {
        setIsModalOpen(true);
      }, (err) => {
        alert('Failed to copy paths. See console for details.');
        console.error('Could not copy text: ', err);
      });
    }
  };


  if (duplicateGroups.length === 0) {
    return (
      <div className="text-center max-w-2xl mx-auto mt-16 p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
        <h2 className="text-3xl font-extrabold text-green-600 dark:text-green-400 mb-4">No Duplicates Found!</h2>
        <p className="text-slate-600 dark:text-slate-300 mb-8">
          Congratulations! We scanned your folder and found no duplicate images or videos.
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
      <div className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm py-4 mb-6 -mx-4 px-4 border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Found {totalDuplicates} duplicate files in {duplicateGroups.length} sets.
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Selected {selectedFiles.size} files ({formatBytes(potentialSpaceSaved)})
            </p>
          </div>
          <div className="flex gap-2">
             <button
              onClick={onNewScan}
              className="px-4 py-2 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-semibold rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition"
            >
              New Scan
            </button>
            {canDeleteNatively ? (
              <button
                onClick={handleDeleteFiles}
                disabled={selectedFiles.size === 0 || isDeleting}
                className="px-6 py-2 bg-red-600 text-white font-bold rounded-md shadow-md hover:bg-red-700 disabled:bg-red-300 dark:disabled:bg-red-800 disabled:cursor-not-allowed transition"
              >
                {isDeleting ? 'Deleting...' : `Delete Selected (${selectedFiles.size})`}
              </button>
            ) : (
              <button
                onClick={handleCopyPaths}
                disabled={selectedFiles.size === 0}
                className="px-6 py-2 bg-sky-600 text-white font-bold rounded-md shadow-md hover:bg-sky-700 disabled:bg-sky-300 dark:disabled:bg-sky-800 disabled:cursor-not-allowed transition"
              >
                Copy Paths ({selectedFiles.size})
              </button>
            )}
          </div>
        </div>
      </div>
       <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        <strong>How to delete files:</strong> {canDeleteNatively
          ? 'Select the duplicates you want to remove and click "Delete Selected". A confirmation dialog will appear before deletion.'
          : 'Select the duplicates you want to remove, click "Copy Paths", and follow the on-screen instructions to use your system\'s terminal.'}
      </p>

      <div className="space-y-8">
        {duplicateGroups.map((group, index) => (
          <DuplicateGroupCard
            key={index}
            group={group}
            selectedFiles={selectedFiles}
            onSelectionChange={onSelectionChange}
          />
        ))}
      </div>
    </div>
  );
};

export default ResultsView;