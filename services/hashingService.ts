
// FIX: Import missing types 'DuplicateGroup' and 'ScanProgress'.
import { FileWithHandle, DuplicateGroup, ScanProgress } from '../types';

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;
const VIDEO_FRAMES_TO_CAPTURE = 10;

// dHash implementation for images
const calculateDHash = async (file: File): Promise<string> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  canvas.width = HASH_WIDTH;
  canvas.height = HASH_HEIGHT;

  const bitmap = await createImageBitmap(file, { resizeWidth: HASH_WIDTH, resizeHeight: HASH_HEIGHT });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, HASH_WIDTH, HASH_HEIGHT);
  const grayscale = new Uint8Array(HASH_WIDTH * HASH_HEIGHT);

  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
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
export const calculateVideoHashes = async (file: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) return reject('Could not get canvas context');

    const hashes: string[] = [];
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true;
    
    let framesCaptured = 0;
    let seekInterval: number;

    const captureFrame = async () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg'));
      if (blob) {
        hashes.push(await calculateDHash(new File([blob], 'frame.jpg', { type: 'image/jpeg' })));
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

    video.addEventListener('error', (e) => {
      URL.revokeObjectURL(url);
      reject(`Error loading video: ${e.message}`);
    });

    video.load();
  });
};

// Exact file hash using SubtleCrypto API
export const calculateFileHash = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Compare two perceptual hashes using Hamming distance
const compareDHashes = (hash1: string, hash2: string): number => {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  return distance;
};

// Main duplicate detection logic
export const findDuplicates = async (
  files: FileWithHandle[],
  setProgress: (progress: ScanProgress) => void
): Promise<DuplicateGroup[]> => {
  const allDuplicates: DuplicateGroup[] = [];
  const processedFiles = new Set<string>();
  const totalFiles = files.length;
  let processedCount = 0;

  // Store hashes to avoid recalculating
  const fileHashes = new Map<string, string>();
  const perceptualHashes = new Map<string, string | string[]>();

  const updateProgress = (status: string) => {
    processedCount++;
    setProgress({ status, processed: processedCount, total: totalFiles });
  };

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
  
  // Step 2: Perceptual hash for remaining images
  setProgress({ status: 'Hashing images...', processed: 0, total: imageFiles.length });
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    perceptualHashes.set(file.id, await calculateDHash(file.file));
    setProgress({ status: 'Hashing images...', processed: i + 1, total: imageFiles.length });
  }

  // Step 3: Perceptual hash for remaining videos
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
      const hash1 = perceptualHashes.get(file1.id) as string;
      if (!hash1) continue;

      for (let j = i + 1; j < imageFiles.length; j++) {
          const file2 = imageFiles[j];
          if (processedFiles.has(file2.id)) continue;
          const hash2 = perceptualHashes.get(file2.id) as string;
          if (!hash2) continue;

          if (compareDHashes(hash1, hash2) <= 5) { // Threshold for similarity
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
      const hashes1 = perceptualHashes.get(file1.id) as string[];
      if (!hashes1) continue;

      for (let j = i + 1; j < videoFiles.length; j++) {
          const file2 = videoFiles[j];
          if (processedFiles.has(file2.id)) continue;
          
          const hashes2 = perceptualHashes.get(file2.id) as string[];
          if (!hashes2) continue;

          let matchingFrames = 0;
          for(let k = 0; k < Math.min(hashes1.length, hashes2.length); k++) {
              if (compareDHashes(hashes1[k], hashes2[k]) <= 5) {
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

  setProgress({ status: 'Done', processed: totalFiles, total: totalFiles });
  return allDuplicates;
};