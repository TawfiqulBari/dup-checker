/**
 * GPU-Accelerated Hashing Service
 * Uses GPU when available, falls back to CPU
 */

import { FileWithHandle, DuplicateGroup, ScanProgress } from '../../shared/types';
import { getGPUBatchCoordinator } from '../../gpu/batch-coordinator';
import { computeDHash, hammingDistance } from '../../shared/hashing';
import { isElectron } from '../../shared/platformDetection';

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;
const VIDEO_FRAMES_TO_CAPTURE = 10;
const SIMILARITY_THRESHOLD = 5; // Hamming distance threshold

// Check if GPU acceleration is available (Electron only)
const isGPUAvailable = (): boolean => {
  return isElectron() && 'gpu' in navigator;
};

/**
 * Calculate dHash for an image - GPU accelerated when possible
 */
const calculateDHashGPU = async (file: File): Promise<bigint> => {
  // Load image to canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Load full-resolution image first
  const bitmap = await createImageBitmap(file);
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Try GPU acceleration
  if (isGPUAvailable()) {
    try {
      const coordinator = await getGPUBatchCoordinator();
      if (coordinator.isUsingGPU()) {
        const hash = await coordinator.queueImage(imageData, file.name);
        return hash;
      }
    } catch (error) {
      console.warn('GPU acceleration failed, falling back to CPU:', error);
    }
  }

  // Fallback to CPU
  return computeDHash(imageData);
};

/**
 * Legacy string-based dHash (for compatibility)
 */
const calculateDHashLegacy = async (file: File): Promise<string> => {
  const hash = await calculateDHashGPU(file);
  return hash.toString(2).padStart(64, '0'); // Convert to binary string
};

/**
 * Video frame extraction and hashing - GPU accelerated
 */
export const calculateVideoHashes = async (file: File): Promise<bigint[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) return reject('Could not get canvas context');

    const hashes: bigint[] = [];
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true;

    let framesCaptured = 0;
    let seekInterval: number;

    const captureFrame = async () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      try {
        // Use GPU acceleration for video frames too
        if (isGPUAvailable()) {
          const coordinator = await getGPUBatchCoordinator();
          if (coordinator.isUsingGPU()) {
            const hash = await coordinator.queueImage(imageData, `${file.name}-frame-${framesCaptured}`);
            hashes.push(hash);
          } else {
            // Fallback to CPU
            hashes.push(await computeDHash(imageData));
          }
        } else {
          hashes.push(await computeDHash(imageData));
        }
      } catch (error) {
        console.error('Error hashing video frame:', error);
      }

      framesCaptured++;

      if (framesCaptured >= VIDEO_FRAMES_TO_CAPTURE) {
        video.pause();
        URL.revokeObjectURL(url);
        resolve(hashes);
      } else {
        video.currentTime += seekInterval;
      }
    };

    video.addEventListener('loadedmetadata', () => {
      seekInterval = video.duration / (VIDEO_FRAMES_TO_CAPTURE + 1);
      video.currentTime = seekInterval;
    });

    video.addEventListener('seeked', captureFrame);

    video.addEventListener('error', (e: any) => {
      URL.revokeObjectURL(url);
      reject(`Error loading video: ${e.message}`);
    });

    video.load();
  });
};

/**
 * Exact file hash using SubtleCrypto API
 */
export const calculateFileHash = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Compare two BigInt hashes using Hamming distance
 */
const compareHashes = (hash1: bigint, hash2: bigint): number => {
  return hammingDistance(hash1, hash2);
};

/**
 * Main duplicate detection with GPU acceleration
 */
export const findDuplicates = async (
  files: FileWithHandle[],
  setProgress: (progress: ScanProgress) => void
): Promise<DuplicateGroup[]> => {
  const allDuplicates: DuplicateGroup[] = [];
  const processedFiles = new Set<string>();
  const totalFiles = files.length;
  let processedCount = 0;

  // Store hashes
  const fileHashes = new Map<string, string>();
  const perceptualHashes = new Map<string, bigint | bigint[]>();

  const updateProgress = (status: string) => {
    processedCount++;
    setProgress({ status, processed: processedCount, total: totalFiles });
  };

  // Initialize GPU coordinator if available
  if (isGPUAvailable()) {
    try {
      const coordinator = await getGPUBatchCoordinator();
      const stats = coordinator.getStats();
      console.log('GPU acceleration initialized', stats);
    } catch (error) {
      console.warn('Failed to initialize GPU acceleration:', error);
    }
  }

  // Step 1: Find exact duplicates with file hashing
  setProgress({ status: 'Calculating file hashes...', processed: 0, total: totalFiles });
  for (const file of files) {
    const hash = await calculateFileHash(file.file);
    fileHashes.set(file.id, hash);
    updateProgress('Calculating file hashes...');
  }

  const filesByHash = new Map<string, FileWithHandle[]>();
  for (const file of files) {
    const hash = fileHashes.get(file.id)!;
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

  // Step 2: Perceptual hash for remaining images (GPU accelerated)
  setProgress({ status: 'Hashing images...', processed: 0, total: imageFiles.length });
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    try {
      perceptualHashes.set(file.id, await calculateDHashGPU(file.file));
    } catch (error) {
      console.error(`Error hashing image ${file.path}:`, error);
    }
    setProgress({ status: 'Hashing images...', processed: i + 1, total: imageFiles.length });
  }

  // Step 3: Perceptual hash for remaining videos (GPU accelerated)
  setProgress({ status: 'Hashing videos...', processed: 0, total: videoFiles.length });
  for (let i = 0; i < videoFiles.length; i++) {
    const file = videoFiles[i];
    try {
      perceptualHashes.set(file.id, await calculateVideoHashes(file.file));
    } catch (e) {
      console.error(`Could not process video ${file.path}:`, e);
    }
    setProgress({ status: 'Hashing videos...', processed: i + 1, total: videoFiles.length });
  }

  // Step 4: Compare image hashes
  setProgress({ status: 'Comparing images...', processed: 0, total: imageFiles.length });
  for (let i = 0; i < imageFiles.length; i++) {
    const file1 = imageFiles[i];
    if (processedFiles.has(file1.id)) continue;

    const group: DuplicateGroup = [file1];
    const hash1 = perceptualHashes.get(file1.id) as bigint;
    if (!hash1) continue;

    for (let j = i + 1; j < imageFiles.length; j++) {
      const file2 = imageFiles[j];
      if (processedFiles.has(file2.id)) continue;
      const hash2 = perceptualHashes.get(file2.id) as bigint;
      if (!hash2) continue;

      if (compareHashes(hash1, hash2) <= SIMILARITY_THRESHOLD) {
        group.push(file2);
      }
    }

    if (group.length > 1) {
      allDuplicates.push(group);
      group.forEach(f => processedFiles.add(f.id));
    }
    setProgress({ status: 'Comparing images...', processed: i + 1, total: imageFiles.length });
  }

  // Step 5: Compare video hashes
  setProgress({ status: 'Comparing videos...', processed: 0, total: videoFiles.length });
  for (let i = 0; i < videoFiles.length; i++) {
    const file1 = videoFiles[i];
    if (processedFiles.has(file1.id)) continue;

    const group: DuplicateGroup = [file1];
    const hashes1 = perceptualHashes.get(file1.id) as bigint[];
    if (!hashes1) continue;

    for (let j = i + 1; j < videoFiles.length; j++) {
      const file2 = videoFiles[j];
      if (processedFiles.has(file2.id)) continue;

      const hashes2 = perceptualHashes.get(file2.id) as bigint[];
      if (!hashes2) continue;

      let matchingFrames = 0;
      for (let k = 0; k < Math.min(hashes1.length, hashes2.length); k++) {
        if (compareHashes(hashes1[k], hashes2[k]) <= SIMILARITY_THRESHOLD) {
          matchingFrames++;
        }
      }

      if (matchingFrames / VIDEO_FRAMES_TO_CAPTURE >= 0.8) { // 80% similarity
        group.push(file2);
      }
    }

    if (group.length > 1) {
      allDuplicates.push(group);
      group.forEach(f => processedFiles.add(f.id));
    }
    setProgress({ status: 'Comparing videos...', processed: i + 1, total: videoFiles.length });
  }

  // Log GPU statistics if available
  if (isGPUAvailable()) {
    try {
      const coordinator = await getGPUBatchCoordinator();
      const stats = coordinator.getStats();
      console.log('GPU Processing Statistics:', stats);
    } catch (error) {
      // Ignore
    }
  }

  setProgress({ status: 'Done', processed: totalFiles, total: totalFiles });
  return allDuplicates;
};
