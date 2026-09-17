
import { checkCancelled, waitForMedia } from './media';
import { FileWithHandle, DuplicateGroup, ScanProgress } from '../types';
import { imageBlob, nativeUrl, NativeFile } from './desktop';
import { compareHashes } from './gpu';

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;
const VIDEO_FRAMES_TO_CAPTURE = 10;

async function cachedVisual(file: File, calculate: () => Promise<string | string[]>): Promise<string | string[]> {
  const nativeId = (file as NativeFile).nativeId;
  const api = typeof window !== 'undefined' ? window.desktopAPI : undefined;
  if (!nativeId || !api) return calculate();
  const cached = await api.getCachedFile(nativeId);
  if (cached.visual !== undefined) return cached.visual;
  const visual = await calculate();
  await api.cacheVisual(nativeId, visual);
  return visual;
}

// dHash implementation for images
const calculateDHash = async (file: File): Promise<string> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  canvas.width = HASH_WIDTH;
  canvas.height = HASH_HEIGHT;

  const bitmap = await createImageBitmap(await imageBlob(file), { resizeWidth: HASH_WIDTH, resizeHeight: HASH_HEIGHT });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, HASH_WIDTH, HASH_HEIGHT);
  return hashPixels(imageData.data);
};

const hashPixels = (pixels: Uint8ClampedArray): string => {
  const grayscale = new Uint8Array(HASH_WIDTH * HASH_HEIGHT);

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    grayscale[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  let hash = '';
  for (let y = 0; y < HASH_HEIGHT; y++) {
    for (let x = 0; x < HASH_WIDTH - 1; x++) {
      const left = grayscale[y * HASH_WIDTH + x];
      const right = grayscale[y * HASH_WIDTH + x + 1];
      hash += left < right ? '1' : '0';
    }
  }
  return hash;
};

// Frame capture and hashing for videos
export const calculateVideoHashes = async (file: File, signal?: AbortSignal): Promise<string[]> => {
  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  canvas.width = HASH_WIDTH;
  canvas.height = HASH_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  const url = nativeUrl(file) || URL.createObjectURL(file);
  video.muted = true;
  video.preload = 'auto';
  try {
    const loaded = waitForMedia(video, 'loadedmetadata', signal);
    video.src = url;
    await loaded;
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('Invalid video duration');
    const hashes: string[] = [];
    for (let i = 1; i <= VIDEO_FRAMES_TO_CAPTURE; i++) {
      checkCancelled(signal);
      const sought = waitForMedia(video, 'seeked', signal);
      video.currentTime = video.duration * i / (VIDEO_FRAMES_TO_CAPTURE + 1);
      await sought;
      ctx.drawImage(video, 0, 0, HASH_WIDTH, HASH_HEIGHT);
      hashes.push(hashPixels(ctx.getImageData(0, 0, HASH_WIDTH, HASH_HEIGHT).data));
    }
    return hashes;
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (!nativeUrl(file)) URL.revokeObjectURL(url);
  }
};

// Exact file hash using SubtleCrypto API
export const calculateFileHash = async (file: File): Promise<string> => {
  if ((file as NativeFile).nativeId && typeof window !== 'undefined' && window.desktopAPI) return window.desktopAPI.hashFile((file as NativeFile).nativeId!);
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Main duplicate detection logic
export const findDuplicates = async (
  files: FileWithHandle[],
  setProgress: (progress: ScanProgress) => void,
  signal?: AbortSignal,
  onWarning: (message: string) => void = () => {},
): Promise<DuplicateGroup[]> => {
  const allDuplicates: DuplicateGroup[] = [];
  const processedFiles = new Set<string>();
  const totalFiles = files.length;
  let processedCount = 0;
  const cachedFiles = files.filter(file => (file.file as NativeFile).cachedExact).length;

  // Store hashes to avoid recalculating
  const fileHashes = new Map<string, string>();
  const perceptualHashes = new Map<string, string | string[]>();

  const updateProgress = (status: string) => {
    processedCount++;
    setProgress({ status, processed: processedCount, total: totalFiles, cachedFiles });
  };

  // Step 1: Find exact duplicates with file hashing
  setProgress({ status: 'Calculating file hashes...', processed: 0, total: totalFiles });
  for (const file of files) {
      checkCancelled(signal);
      try {
        const hash = await calculateFileHash(file.file);
        checkCancelled(signal);
        fileHashes.set(file.id, hash);
        file.contentHash = hash;
      } catch (error) {
        checkCancelled(signal);
        onWarning('Could not read ' + file.path);
      }
      updateProgress('Calculating file hashes...');
  }
  
  const filesByHash = new Map<string, FileWithHandle[]>();
  for (const file of files) {
      const hash = fileHashes.get(file.id);
      if (!hash) continue;
      if (!filesByHash.has(hash)) filesByHash.set(hash, []);
      filesByHash.get(hash)!.push(file);
  }

  for (const group of filesByHash.values()) {
      if (group.length > 1) {
          allDuplicates.push(group);
          group.forEach(f => processedFiles.add(f.id));
      }
  }

  const remainingFiles = files.filter(f => !processedFiles.has(f.id));
  const imageFiles = remainingFiles.filter(f => f.file.type.startsWith('image/'));
  const videoFiles = remainingFiles.filter(f => f.file.type.startsWith('video/'));
  
  // Step 2: Perceptual hash for remaining images
  setProgress({ status: 'Hashing images...', processed: 0, total: imageFiles.length });
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    checkCancelled(signal);
    try {
      perceptualHashes.set(file.id, await cachedVisual(file.file, () => calculateDHash(file.file)));
    } catch (error) {
      checkCancelled(signal);
      onWarning('Visual comparison unavailable for ' + file.path);
    }
    setProgress({ status: 'Hashing images...', processed: i + 1, total: imageFiles.length });
  }

  // Step 3: Perceptual hash for remaining videos
  setProgress({ status: 'Hashing videos...', processed: 0, total: videoFiles.length });
  for (let i = 0; i < videoFiles.length; i++) {
    checkCancelled(signal);
    const file = videoFiles[i];
    try {
      perceptualHashes.set(file.id, await cachedVisual(file.file, () => calculateVideoHashes(file.file, signal)));
    } catch (e) {
      checkCancelled(signal);
      onWarning('Visual comparison unavailable for ' + file.path);
    }
    setProgress({ status: 'Hashing videos...', processed: i + 1, total: videoFiles.length });
  }

  // Step 4: Compare image hashes
  setProgress({ status: 'Comparing images...', processed: 0, total: imageFiles.length });
  for (let i = 0; i < imageFiles.length; i++) {
      checkCancelled(signal);
      if (i % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      const file1 = imageFiles[i];
      if (processedFiles.has(file1.id)) continue;
      
      const group: DuplicateGroup = [file1];
      const hash1 = perceptualHashes.get(file1.id) as string;
      if (!hash1) continue;

      const candidates = imageFiles.slice(i + 1).filter(file => !processedFiles.has(file.id) && perceptualHashes.has(file.id));
      const distances = await compareHashes([hash1], candidates.map(file => perceptualHashes.get(file.id) as string), signal);
      candidates.forEach((file, index) => { if (distances[index] <= 5) group.push(file); });

      if (group.length > 1) {
          allDuplicates.push(group);
          group.forEach(f => processedFiles.add(f.id));
      }
      setProgress({ status: 'Comparing images...', processed: i + 1, total: imageFiles.length });
  }

  // Step 5: Compare video hashes
  setProgress({ status: 'Comparing videos...', processed: 0, total: videoFiles.length });
   for (let i = 0; i < videoFiles.length; i++) {
      checkCancelled(signal);
      if (i % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      const file1 = videoFiles[i];
      if (processedFiles.has(file1.id)) continue;
      
      const group: DuplicateGroup = [file1];
      const hashes1 = perceptualHashes.get(file1.id) as string[];
      if (!hashes1) continue;

      const candidates = videoFiles.slice(i + 1).filter(file => !processedFiles.has(file.id) && (perceptualHashes.get(file.id) as string[] | undefined)?.length === VIDEO_FRAMES_TO_CAPTURE);
      const distances = await compareHashes(hashes1, candidates.flatMap(file => perceptualHashes.get(file.id) as string[]), signal);
      candidates.forEach((file, index) => {
        const matching = distances.slice(index * VIDEO_FRAMES_TO_CAPTURE, (index + 1) * VIDEO_FRAMES_TO_CAPTURE).filter(distance => distance <= 5).length;
        if (matching >= 8) group.push(file);
      });

      if (group.length > 1) {
          allDuplicates.push(group);
          group.forEach(f => processedFiles.add(f.id));
      }
       setProgress({ status: 'Comparing videos...', processed: i + 1, total: videoFiles.length });
  }

  checkCancelled(signal);
  setProgress({ status: 'Done', processed: totalFiles, total: totalFiles, cachedFiles });
  return allDuplicates;
};
