/**
 * CPU-based Perceptual Hashing Functions
 * Fallback implementations when GPU is not available
 */

/**
 * Compute dHash (Difference Hash) for an image using CPU
 * @param imageData - Input image data
 * @returns 64-bit perceptual hash as BigInt
 */
export async function computeDHash(imageData: ImageData): Promise<bigint> {
  // Step 1: Resize to 9x8 pixels
  const resized = resizeImage(imageData, 9, 8);

  // Step 2: Convert to grayscale
  const grayscale = convertToGrayscale(resized);

  // Step 3: Compute difference hash
  return computeDifferenceHash(grayscale);
}

/**
 * Resize image using bilinear interpolation
 */
function resizeImage(
  imageData: ImageData,
  targetWidth: number,
  targetHeight: number
): ImageData {
  const { width: srcWidth, height: srcHeight, data: srcData } = imageData;

  const resized = new ImageData(targetWidth, targetHeight);
  const scaleX = srcWidth / targetWidth;
  const scaleY = srcHeight / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      // Calculate source coordinates
      const srcX = (x + 0.5) * scaleX - 0.5;
      const srcY = (y + 0.5) * scaleY - 0.5;

      // Bilinear interpolation
      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = Math.min(x0 + 1, srcWidth - 1);
      const y1 = Math.min(y0 + 1, srcHeight - 1);

      const fx = srcX - x0;
      const fy = srcY - y0;

      // Sample four corner pixels
      const getPixel = (px: number, py: number) => {
        const idx = (py * srcWidth + px) * 4;
        return {
          r: srcData[idx],
          g: srcData[idx + 1],
          b: srcData[idx + 2],
          a: srcData[idx + 3]
        };
      };

      const p00 = getPixel(x0, y0);
      const p10 = getPixel(x1, y0);
      const p01 = getPixel(x0, y1);
      const p11 = getPixel(x1, y1);

      // Interpolate
      const interpolate = (c: keyof typeof p00) => {
        const top = p00[c] * (1 - fx) + p10[c] * fx;
        const bottom = p01[c] * (1 - fx) + p11[c] * fx;
        return top * (1 - fy) + bottom * fy;
      };

      const dstIdx = (y * targetWidth + x) * 4;
      resized.data[dstIdx] = interpolate('r');
      resized.data[dstIdx + 1] = interpolate('g');
      resized.data[dstIdx + 2] = interpolate('b');
      resized.data[dstIdx + 3] = 255;
    }
  }

  return resized;
}

/**
 * Convert image to grayscale using luminance formula
 */
function convertToGrayscale(imageData: ImageData): Float32Array {
  const { width, height, data } = imageData;
  const grayscale = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const r = data[idx] / 255;
    const g = data[idx + 1] / 255;
    const b = data[idx + 2] / 255;

    // ITU-R BT.709 luma coefficients
    grayscale[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  return grayscale;
}

/**
 * Compute difference hash from 9x8 grayscale image
 */
function computeDifferenceHash(grayscale: Float32Array): bigint {
  let hash = 0n;
  let bitIndex = 0n;

  // Compare each pixel with its right neighbor
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const index = row * 9 + col;
      const leftPixel = grayscale[index];
      const rightPixel = grayscale[index + 1];

      // Set bit if left pixel is brighter than right
      if (leftPixel > rightPixel) {
        hash |= 1n << bitIndex;
      }

      bitIndex++;
    }
  }

  return hash;
}

/**
 * Compute Hamming distance between two hashes
 * @param hash1 - First hash
 * @param hash2 - Second hash
 * @returns Number of differing bits (0-64)
 */
export function hammingDistance(hash1: bigint, hash2: bigint): number {
  // XOR to find differing bits
  let xor = hash1 ^ hash2;

  // Count set bits (Brian Kernighan's algorithm)
  let count = 0;
  while (xor !== 0n) {
    xor &= xor - 1n; // Clear the lowest set bit
    count++;
  }

  return count;
}

/**
 * Check if two images are similar based on hash distance
 * @param hash1 - First hash
 * @param hash2 - Second hash
 * @param threshold - Maximum Hamming distance to consider similar (default: 10)
 * @returns true if images are similar
 */
export function areSimilar(
  hash1: bigint,
  hash2: bigint,
  threshold: number = 10
): boolean {
  return hammingDistance(hash1, hash2) <= threshold;
}

/**
 * Find all similar hashes in a database
 * @param targetHash - Hash to compare against
 * @param databaseHashes - Array of hashes to search
 * @param threshold - Maximum Hamming distance
 * @returns Array of indices of similar hashes
 */
export function findSimilarHashes(
  targetHash: bigint,
  databaseHashes: bigint[],
  threshold: number = 10
): number[] {
  const similar: number[] = [];

  for (let i = 0; i < databaseHashes.length; i++) {
    if (areSimilar(targetHash, databaseHashes[i], threshold)) {
      similar.push(i);
    }
  }

  return similar;
}

/**
 * Convert hash to hex string for display/storage
 */
export function hashToHex(hash: bigint): string {
  return hash.toString(16).padStart(16, '0');
}

/**
 * Parse hex string back to hash
 */
export function hexToHash(hex: string): bigint {
  return BigInt('0x' + hex);
}
