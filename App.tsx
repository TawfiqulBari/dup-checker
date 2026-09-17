import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DuplicateGroup, FileWithHandle, ScanProgress, ScanState } from './types';
import { findDuplicates } from './services/hashingService';
import WelcomeScreen from './components/WelcomeScreen';
import ScanningProgress from './components/ScanningProgress';
import ResultsView from './components/ResultsView';
import { getDirectoryPicker, readFolder } from './services/folderAccess';
import FolderComparisonSetup from './components/FolderComparisonSetup';
import { spansFolders, sortGroup, groupKey } from './services/selection';
import { nativeUrl, NativeFile, restoreSessionFiles } from './services/desktop';
import AccelerationStatus from './components/AccelerationStatus';
import SavedScans from './components/SavedScans';
import { SavedSession, SessionPatch, ReviewState } from './services/sessionTypes';

const App: React.FC = () => {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [scanProgress, setScanProgress] = useState<ScanProgress>({ status: 'Idle', processed: 0, total: 0 });
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [compareFolders, setCompareFolders] = useState(false);
  const sessionRef = useRef<SavedSession | null>(null);
  const [session, setSession] = useState<SavedSession | null>(null);
  const [initialReview, setInitialReview] = useState<ReviewState>({});
  const [saveStatus, setSaveStatus] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState(false);
  const saveSession = useCallback((patch: SessionPatch) => {
    const id = sessionRef.current?.id;
    if (!id || !window.desktopAPI) return;
    void window.desktopAPI.saveSession(id, patch).then(() => setSaveStatus('Saved on this computer')).catch(() => setSaveStatus('Could not save progress. Keep the app open and check available disk space.'));
  }, []);
  const saveReview = useCallback((review: ReviewState) => saveSession({ review }), [saveSession]);
  const changeSelection = useCallback((selection: Set<string>) => {
    setSelectedFiles(selection);
    saveSession({ selectedFiles: [...selection] });
  }, [saveSession]);
  const controllerRef = useRef<AbortController | null>(null);
  const urlsRef = useRef<string[]>([]);
  const releaseUrls = useCallback(() => {
    urlsRef.current.forEach(url => URL.revokeObjectURL(url));
    urlsRef.current = [];
  }, []);
  useEffect(() => () => { controllerRef.current?.abort(); releaseUrls(); }, [releaseUrls]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    sessionRef.current = null;
    setSession(null);
    setInitialReview({});
    setSavedSnapshot(false);
    void window.desktopAPI?.resetScan();
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

  const startScan = useCallback(async (fileList: FileList | FileWithHandle[], resumed?: SavedSession) => {
    setSavedSnapshot(false);
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
      if (!supportedFiles.length && !resumed) throw new Error('This folder contains no recognized images or videos. Choose another folder.');
      const filesToScan: FileWithHandle[] = Array.isArray(fileList) ? fileList : supportedFiles.map((file, index) => ({
        id: String(index), file, path: file.webkitRelativePath || file.name,
        metadata: { size: file.size }, thumbnail: '',
      }));
      let currentSession = resumed;
      if (window.desktopAPI && filesToScan.every(file => (file.file as NativeFile).nativeId)) {
        currentSession ??= await window.desktopAPI.beginSession(filesToScan.map(file => ({ id: file.id, nativeId: (file.file as NativeFile).nativeId!, path: file.path, folderSide: file.folderSide })));
        controller.signal.throwIfAborted();
        sessionRef.current = currentSession;
        setSession(currentSession);
        setInitialReview(currentSession.review);
      }
      let lastCheckpoint = 0;
      let latestProgress: ScanProgress = { status: 'Starting', processed: 0, total: filesToScan.length };
      const allMatches = await findDuplicates(filesToScan, progress => {
        if (controller.signal.aborted) return;
        latestProgress = progress;
        setScanProgress(progress);
        if (Date.now() - lastCheckpoint > 500 || progress.status === 'Done') {
          saveSession({ status: 'scanning', progress });
          lastCheckpoint = Date.now();
        }
      }, controller.signal, message => scanWarnings.push(message));
      const foundDuplicates = filesToScan.some(file => file.folderSide) ? allMatches.filter(spansFolders) : allMatches;
      controller.signal.throwIfAborted();
      // Only retain previews for files actually displayed in results.
      foundDuplicates.flat().forEach(file => {
        file.thumbnail = nativeUrl(file.file) || URL.createObjectURL(file.file);
        if (!nativeUrl(file.file)) urlsRef.current.push(file.thumbnail);
      });
      setDuplicates(foundDuplicates);
      const keepers = new Set(foundDuplicates.map(group => sortGroup(group, currentSession?.review.keepers?.[groupKey(group)])[0].id));
      const candidates = new Set(foundDuplicates.flat().map(file => file.id));
      const selection = (currentSession?.selectedFiles || []).filter(id => candidates.has(id) && !keepers.has(id));
      setSelectedFiles(new Set(selection));
      saveSession({ status: 'done', groups: foundDuplicates.map(group => group.map(file => file.id)), selectedFiles: selection, warnings: scanWarnings, progress: latestProgress });
      setWarnings(scanWarnings);
      setScanState('done');
    } catch (error) {
      if (controller.signal.aborted) return;
      releaseUrls();
      setError(error instanceof Error ? error.message : 'The scan failed. Please try again.');
      setScanState('idle');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [releaseUrls, saveSession]);

  const openSaved = useCallback(async (id: string, update: boolean) => {
    const operation = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = operation;
    try {
      setError('');
      setScanState('scanning');
      setScanProgress({ status: update ? 'Checking for new, changed, or removed files…' : 'Opening saved results…', processed: 0, total: 0 });
      const restored = update ? await window.desktopAPI!.refreshSession(id) : await window.desktopAPI!.loadSession(id);
      const files = await restoreSessionFiles(restored);
      operation.signal.throwIfAborted();
      sessionRef.current = restored;
      setSession(restored);
      setInitialReview(restored.review);
      if (update && restored.status !== 'done') { await startScan(files, restored); return; }
      const byId = new Map(files.map(file => [file.id, file]));
      setDuplicates(restored.groups.map(group => group.map(id => byId.get(id)).filter((file): file is FileWithHandle => !!file)).filter(group => group.length > 1));
      setSelectedFiles(new Set(restored.selectedFiles));
      setWarnings(restored.warnings);
      setScanProgress(restored.progress);
      setSaveStatus('Opened saved results. Use Update changes to check the folders.');
      setSavedSnapshot(!update);
      setScanState('done');
    } catch (error) {
      if (operation.signal.aborted) return;
      setError(error instanceof Error ? error.message : 'Could not open saved scan.');
      setScanState('idle');
    }
  }, [startScan]);

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
        return <ScanningProgress progress={scanProgress} canPause={!!session} onCancel={() => { controllerRef.current?.abort(); saveSession({ status: 'paused', progress: scanProgress }); resetState(); }} />;
      case 'done':
        return (
          <ResultsView
            key={session?.id || 'browser'}
            duplicateGroups={duplicates}
            selectedFiles={selectedFiles}
            onSelectionChange={changeSelection}
            initialReview={initialReview}
            onReviewChange={saveReview}
            onUpdateChanges={session ? () => { void openSaved(session.id, true); } : undefined}
            onNewScan={resetState}
            onFilesRemoved={removed => {
              const remaining = duplicates.map(group => group.filter(file => !removed.has(file.id))).filter(group => group.length > 1);
              setDuplicates(remaining);
              changeSelection(new Set());
              saveSession({ groups: remaining.map(group => group.map(file => file.id)) });
            }}
          />
        );
      case 'idle':
      default:
        return compareFolders ? <FolderComparisonSetup onScan={files => { void startScan(files); }} onBack={() => setCompareFolders(false)} /> : <><WelcomeScreen onSelectFolder={handleSelectFolder} onCompareFolders={() => setCompareFolders(true)} /><SavedScans onOpen={id => { void openSaved(id, false); }} onUpdate={id => { void openSaved(id, true); }} /></>;
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
        <AccelerationStatus />
      </header>
      <main className="container mx-auto p-4 md:p-8">
        {error && <p role="alert" className="p-4 mb-4 bg-amber-100 text-amber-900 rounded-lg">{error}</p>}
        {savedSnapshot && <p className="text-sm mb-3">Showing saved results. Use Update changes to check for changes on disk. Files are checked again before removal.</p>}
        {session && <div className="text-sm mb-4"><p>{saveStatus}</p>{session.delta && <p>Update: {session.delta.unchanged} unchanged · {session.delta.added} new · {session.delta.changed} changed · {session.delta.removed} removed</p>}{scanState === 'done' && <p>{scanProgress.cachedFiles || 0} file hashes reused from cache.</p>}</div>}
        {warnings.length > 0 && <details className="p-4 mb-4 bg-amber-100 text-amber-900 rounded-lg"><summary>Scan completed with {warnings.length} issues. Some files could not be fully compared.</summary><ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
