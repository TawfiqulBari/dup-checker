
import React from 'react';
import { ScanProgress } from '../types';

interface ScanningProgressProps {
  progress: ScanProgress;
}

const ScanningProgress: React.FC<ScanningProgressProps> = ({ progress }) => {
  const percentage = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;

  return (
    <div className="max-w-2xl mx-auto mt-16 p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg text-center">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Scanning in Progress...</h2>
      <p className="text-slate-600 dark:text-slate-300 mb-6">{progress.status}</p>
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 mb-2">
        <div
          className="bg-indigo-600 h-4 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {progress.processed} / {progress.total} files
      </p>
    </div>
  );
};

export default ScanningProgress;
