/**
 * GPU Worker Thread
 * Handles GPU-accelerated image hashing in a separate thread
 * Prevents blocking the main UI thread during intensive computations
 */

import { parentPort } from 'worker_threads';
import { getWebGPUProcessor } from '../webgpu-processor';

export interface WorkerMessage {
  type: 'init' | 'hash' | 'compare' | 'shutdown';
  id: string;
  data?: any;
}

export interface WorkerResponse {
  type: 'ready' | 'result' | 'error';
  id: string;
  data?: any;
  error?: string;
}

let processor: any = null;
let initialized = false;

/**
 * Initialize the GPU processor
 */
async function initializeProcessor(): Promise<void> {
  try {
    processor = await getWebGPUProcessor();
    initialized = processor.isReady();

    if (!initialized) {
      throw new Error('GPU processor failed to initialize');
    }

    sendResponse({
      type: 'ready',
      id: 'init',
      data: { gpuAvailable: true, info: processor.getInfo() }
    });
  } catch (error: any) {
    sendResponse({
      type: 'error',
      id: 'init',
      error: error.message
    });
  }
}

/**
 * Compute hash for an image
 */
async function computeHash(id: string, imageData: any): Promise<void> {
  try {
    if (!initialized || !processor) {
      throw new Error('GPU processor not initialized');
    }

    // Reconstruct ImageData from serialized format
    const { data, width, height } = imageData;
    const reconstructed = new ImageData(
      new Uint8ClampedArray(data),
      width,
      height
    );

    const result = await processor.computeHash(reconstructed);

    sendResponse({
      type: 'result',
      id,
      data: {
        hash: result.hash.toString(),
        processingTime: result.processingTime,
        usedGPU: result.usedGPU
      }
    });
  } catch (error: any) {
    sendResponse({
      type: 'error',
      id,
      error: error.message
    });
  }
}

/**
 * Compare hash against database
 */
async function compareHash(id: string, data: any): Promise<void> {
  try {
    if (!initialized || !processor) {
      throw new Error('GPU processor not initialized');
    }

    const { targetHash, databaseHashes, threshold } = data;

    // Convert string hashes back to BigInt
    const target = BigInt(targetHash);
    const database = databaseHashes.map((h: string) => BigInt(h));

    const result = await processor.compareHash(target, database, threshold);

    sendResponse({
      type: 'result',
      id,
      data: {
        distances: Array.from(result.distances),
        processingTime: result.processingTime,
        comparisonsPerSecond: result.comparisonsPerSecond
      }
    });
  } catch (error: any) {
    sendResponse({
      type: 'error',
      id,
      error: error.message
    });
  }
}

/**
 * Send response to parent thread
 */
function sendResponse(response: WorkerResponse): void {
  if (parentPort) {
    parentPort.postMessage(response);
  }
}

/**
 * Handle messages from parent thread
 */
if (parentPort) {
  parentPort.on('message', async (message: WorkerMessage) => {
    switch (message.type) {
      case 'init':
        await initializeProcessor();
        break;

      case 'hash':
        await computeHash(message.id, message.data);
        break;

      case 'compare':
        await compareHash(message.id, message.data);
        break;

      case 'shutdown':
        process.exit(0);
        break;

      default:
        sendResponse({
          type: 'error',
          id: message.id,
          error: `Unknown message type: ${message.type}`
        });
    }
  });
}

// Initialize on startup
initializeProcessor();
