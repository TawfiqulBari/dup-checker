import React, { useState, useCallback, useRef } from 'react';
import { DuplicateGroup, FileWithHandle, ScanProgress, ScanState } from '../shared/types';
import { findDuplicates } from './services/hashingService';
import WelcomeScreen from './components/WelcomeScreen';
import ScanningProgress from './components/ScanningProgress';
import ResultsView from './components/ResultsView';

const App: React.FC = () => {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [scanProgress, setScanProgress] = useState<ScanProgress>({ status: 'Idle', processed: 0, total: 0 });
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setScanState('idle');
    setDuplicates([]);
    setScanProgress({ status: 'Idle', processed: 0, total: 0 });
    setSelectedFiles(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const startScan = useCallback(async (fileList: FileList) => {
    setScanState('scanning');
    
    const allFiles = Array.from(fileList);
    const supportedFiles = allFiles.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));

    setScanProgress({ status: 'Reading file metadata...', processed: 0, total: supportedFiles.length });
    
    const filesToScan: FileWithHandle[] = [];

    let processedCount = 0;
    for (const file of supportedFiles) {
      const path = (file as any).webkitRelativePath; // Use non-standard property to get relative path
      const thumbnail = URL.createObjectURL(file);
      let metadata: FileWithHandle['metadata'] = { size: file.size };

      try {
        if (file.type.startsWith('image/')) {
          const img = new Image();
          img.src = thumbnail;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          metadata.dimensions = { width: img.width, height: img.height };
        } else if (file.type.startsWith('video/')) {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.src = thumbnail;
          await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = reject;
          });
          metadata.duration = video.duration;
        }
        filesToScan.push({ id: `${path}-${file.lastModified}`, file, path, metadata, thumbnail });
      } catch (e) {
        console.warn(`Could not read metadata for ${path}`, e);
        URL.revokeObjectURL(thumbnail); // Clean up blob URL if metadata reading fails
      }
      processedCount++;
      setScanProgress({ status: 'Reading file metadata...', processed: processedCount, total: supportedFiles.length });
    }

    const foundDuplicates = await findDuplicates(filesToScan, setScanProgress);
    setDuplicates(foundDuplicates);
    setScanState('done');
  }, []);

  const handleFilesSelected = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      startScan(files);
    } else {
      setScanState('idle');
    }
  }, [startScan]);

  const handleSelectFolder = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const renderContent = () => {
    switch (scanState) {
      case 'scanning':
        return <ScanningProgress progress={scanProgress} />;
      case 'done':
        return (
          <ResultsView
            duplicateGroups={duplicates}
            selectedFiles={selectedFiles}
            onSelectionChange={setSelectedFiles}
            onNewScan={resetState}
          />
        );
      case 'idle':
      default:
        return <WelcomeScreen onSelectFolder={handleSelectFolder} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
       <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilesSelected}
        style={{ display: 'none' }}
        {...{ webkitdirectory: "", directory: "" }}
        multiple
      />
      <header className="py-4 px-6 bg-white dark:bg-slate-800/50 shadow-sm">
        <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Dup-Checker</h1>
      </header>
      <main className="container mx-auto p-4 md:p-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;