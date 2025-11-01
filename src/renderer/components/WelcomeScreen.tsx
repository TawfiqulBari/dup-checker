import React from 'react';

interface WelcomeScreenProps {
  onSelectFolder: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectFolder }) => {
  return (
    <div className="text-center max-w-2xl mx-auto mt-16 p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
      <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-4">Find Duplicate Files</h2>
      <p className="text-slate-600 dark:text-slate-300 mb-8">
        Select a folder to scan for visually similar images and videos. Dup-Checker analyzes file content, not just names, to find true duplicates.
      </p>
      <button
        onClick={onSelectFolder}
        className="inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white font-bold rounded-md shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        Select Folder to Scan
      </button>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-6">
          All processing is done securely in your browser. Your files are never uploaded.
      </p>
    </div>
  );
};

export default WelcomeScreen;