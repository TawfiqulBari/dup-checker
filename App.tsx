import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DuplicateGroup, FileWithHandle, ScanProgress, ScanState } from './types';
import { findDuplicates } from './services/hashingService';
import WelcomeScreen from './components/WelcomeScreen';
import ScanningProgress from './components/ScanningProgress';
import ResultsView from './components/ResultsView';
import { getDirectoryPicker, readFolder } from './services/folderAccess';
import FolderComparisonSetup from './components/FolderComparisonSetup';
import { spansFolders } from './services/selection';

const App: React.FC = () => {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [scanProgress, setScanProgress] = useState<ScanProgress>({ status: 'Idle', processed: 0, total: 0 });
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [compareFolders, setCompareFolders] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const urlsRef = useRef<string[]>([]);
  const releaseUrls = useCallback(() => {
    urlsRef.current.forEach(url => URL.revokeObjectURL(url));
    urlsRef.current = [];
  }, []);
  useEffect(() => () => { controllerRef.current?.abort(); releaseUrls(); }, [releaseUrls]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    controllerRef.current?.abort();
    releaseUrls();
    setError('');
    setWarnings([]);
    setCompareFolders(false);
    setScanState('idle');
    setDuplicates([]);
    setScanProgress({ status: 'Idle', processed: 0, total: 0 });
    setSelectedFiles(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const startScan = useCallback(async (fileList: FileList | FileWithHandle[]) => {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    releaseUrls();
    setError('');
    setWarnings([]);
    setSelectedFiles(new Set());
    setScanState('scanning');
    const scanWarnings: string[] = [];
    try {
      const supportedFiles = Array.isArray(fileList) ? fileList.map(f => f.file) : Array.from(fileList).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
      if (!supportedFiles.length) throw new Error('This folder contains no recognized images or videos. Choose another folder.');
      const filesToScan: FileWithHandle[] = Array.isArray(fileList) ? fileList : supportedFiles.map((file, index) => ({
        id: String(index), file, path: file.webkitRelativePath || file.name,
        metadata: { size: file.size }, thumbnail: '',
      }));
      const allMatches = await findDuplicates(filesToScan, setScanProgress, controller.signal, message => scanWarnings.push(message));
      const foundDuplicates = filesToScan.some(file => file.folderSide) ? allMatches.filter(spansFolders) : allMatches;
      controller.signal.throwIfAborted();
      // Only retain previews for files actually displayed in results.
      foundDuplicates.flat().forEach(file => {
        file.thumbnail = URL.createObjectURL(file.file);
        urlsRef.current.push(file.thumbnail);
      });
      setDuplicates(foundDuplicates);
      setWarnings(scanWarnings);
      setScanState('done');
    } catch (error) {
      if (controller.signal.aborted) return;
      releaseUrls();
      setError(error instanceof Error ? error.message : 'The scan failed. Please try again.');
      setScanState('idle');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [releaseUrls]);

  const handleFilesSelected = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      startScan(files);
    } else {
      setScanState('idle');
    }
  }, [startScan]);

  const handleSelectFolder = useCallback(async () => {
    const picker = getDirectoryPicker();
    if (!picker) { fileInputRef.current?.click(); return; }
    try {
      const directory = await picker({ mode: 'readwrite' });
      const controller = new AbortController();
      controllerRef.current = controller;
      setError('');
      setScanState('scanning');
      setScanProgress({ status: 'Reading folder...', processed: 0, total: 0 });
      const files = await readFolder(directory, controller.signal);
      controller.signal.throwIfAborted();
      await startScan(files);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setError(error instanceof Error ? error.message : 'Could not open folder.');
      setScanState('idle');
    }
  }, [startScan]);

  const renderContent = () => {
    switch (scanState) {
      case 'scanning':
        return <ScanningProgress progress={scanProgress} onCancel={resetState} />;
      case 'done':
        return (
          <ResultsView
            duplicateGroups={duplicates}
            selectedFiles={selectedFiles}
            onSelectionChange={setSelectedFiles}
            onNewScan={resetState}
            onFilesRemoved={removed => {
              setDuplicates(groups => groups.map(group => group.filter(file => !removed.has(file.id))).filter(group => group.length > 1));
              setSelectedFiles(new Set());
            }}
          />
        );
      case 'idle':
      default:
        return compareFolders ? <FolderComparisonSetup onScan={files => { void startScan(files); }} onBack={() => setCompareFolders(false)} /> : <WelcomeScreen onSelectFolder={handleSelectFolder} onCompareFolders={() => setCompareFolders(true)} />;
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
        {error && <p role="alert" className="p-4 mb-4 bg-amber-100 text-amber-900 rounded-lg">{error}</p>}
        {warnings.length > 0 && <details className="p-4 mb-4 bg-amber-100 text-amber-900 rounded-lg"><summary>Scan completed with {warnings.length} issues. Some files could not be fully compared.</summary><ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
