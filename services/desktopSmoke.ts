import { accelerationSelfTest } from './gpu';
import { chooseNativeFolder, nativeUrl, NativeFile, restoreSessionFiles } from './desktop';
import { readFolder } from './folderAccess';
import { findDuplicates } from './hashingService';

export async function runDesktopSmoke() {
  const gpu = await accelerationSelfTest();
  const folder = await chooseNativeFolder();
  const files = await readFolder(folder, new AbortController().signal);
  const groups = await findDuplicates(files, () => {});
  const response = await fetch(nativeUrl(files[0].file)!);
  const bytes = await response.arrayBuffer();
  const ranged = await fetch(nativeUrl(files[0].file)!, { headers: { Range: 'bytes=0-7' } });
  const rangeBytes = await ranged.arrayBuffer();
  const nativeAccess = files.length === 2 && groups.length === 1 && groups[0].length === 2 && bytes.byteLength === files[0].file.size && ranged.status === 206 && rangeBytes.byteLength === 8;
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#336699'; context.fillRect(0, 0, 32, 32);
  const png = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
  const imageFiles = Array.from({ length: 300 }, (_, index) => ({ id: String(index), path: `image-${index}.png`, file: new File([png, String(index)], `${index}.png`, { type: 'image/png' }), metadata: { size: png.size }, thumbnail: '' }));
  const imageGroups = await findDuplicates(imageFiles, () => {});
  const imageScan = imageGroups.length === 1 && imageGroups[0].length === 300;
  const stream = canvas.captureStream(10);
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  recorder.ondataavailable = event => chunks.push(event.data);
  const recorded = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
  recorder.start();
  const interval = setInterval(() => context.fillRect(0, 0, 32, 32), 50);
  await new Promise(resolve => setTimeout(resolve, 500));
  recorder.stop(); await recorded;
  clearInterval(interval); stream.getTracks().forEach(track => track.stop());
  // MediaRecorder streams may omit finite duration metadata; verify playback
  // decoding here without treating a live recording as a seekable video file.
  const videoBlob = new Blob(chunks, { type: 'video/webm' });
  const video = document.createElement('video');
  const videoUrl = URL.createObjectURL(videoBlob);
  const videoDecode = await new Promise<boolean>(resolve => {
    const timeout = setTimeout(() => resolve(false), 5000);
    video.onloadeddata = () => { clearTimeout(timeout); resolve(video.videoWidth === 32); };
    video.onerror = () => { clearTimeout(timeout); resolve(false); };
    video.src = videoUrl;
  });
  video.removeAttribute('src'); video.load(); URL.revokeObjectURL(videoUrl);
  let unauthorizedRejected = false;
  try { await window.desktopAPI!.trashFile('not-authorized'); } catch { unauthorizedRejected = true; }
  const api = window.desktopAPI!;
  const session = await api.beginSession(files.map(file => ({ id: file.id, nativeId: (file.file as NativeFile).nativeId!, path: file.path })));
  const key = files.map(file => file.id).sort().join('\0');
  await api.saveSession(session.id, { status: 'done', groups: [files.map(file => file.id)], selectedFiles: [files[1].id], review: { keepers: { [key]: files[0].id }, reviewed: [key], search: 'saved', scrollY: 300 } });
  await api.resetScan();
  const restored = await api.loadSession(session.id);
  const restoredFiles = await restoreSessionFiles(restored);
  const persistedReview = restored.selectedFiles[0] === files[1].id && restored.review.reviewed?.[0] === key && restored.review.scrollY === 300;
  const cacheReused = restoredFiles.every(file => (file.file as NativeFile).cachedExact);
  const unchanged = await api.refreshSession(session.id);
  await api.mutateSmokeFixtures(Array.from(new Uint8Array(await png.arrayBuffer())));
  const changed = await api.refreshSession(session.id);
  const deltaCorrect = unchanged.delta?.unchanged === 2 && changed.delta?.changed === 1 && changed.delta?.removed === 1 && changed.delta?.added === 1 && changed.review.reviewed?.length === 0;
  const updatedFiles = await restoreSessionFiles(changed);
  const updatedGroups = await findDuplicates(updatedFiles, () => {});
  const cachedVisuals = await Promise.all(updatedFiles.map(file => api.getCachedFile((file.file as NativeFile).nativeId!)));
  const visualCache = cachedVisuals.every(cache => typeof cache.visual === 'string' && cache.visual.length === 64) && updatedGroups.length === 1;
  return { ok: gpu.ok && nativeAccess && unauthorizedRejected && imageScan && videoDecode && persistedReview && cacheReused && deltaCorrect && visualCache, gpu, nativeAccess, imageScan, videoDecode, unauthorizedRejected, persistedReview, cacheReused, deltaCorrect, visualCache, rendererLoaded: !!document.querySelector('h1') };
}
