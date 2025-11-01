/**
 * GPU Batch Coordinator
 * Intelligently batches and schedules GPU operations for optimal throughput
 * Handles memory management and fallback strategies
 */

import { getGPUWorkerPool, GPUWorkerPool } from './workers/worker-pool';
import { isGPUAvailable } from './webgpu-init';

export interface BatchConfig {
  maxBatchSize: number;
  maxMemoryMB: number;
  enableParallelProcessing: boolean;
  gpuMemoryThresholdMB: number;
}

export interface ProcessingStats {
  totalImages: number;
  processedImages: number;
  failedImages: number;
  averageHashTime: number;
  totalProcessingTime: number;
  gpuUtilization: number;
  throughputImagesPerSecond: number;
}

interface QueuedImage {
  imageData: ImageData;
  filePath: string;
  resolve: (hash: bigint) => void;
  reject: (error: Error) => void;
}

export class GPUBatchCoordinator {
  private config: BatchConfig;
  private workerPool: GPUWorkerPool | null = null;
  private processingQueue: QueuedImage[] = [];
  private stats: ProcessingStats;
  private processing = false;
  private useGPU = false;

  constructor(config?: Partial<BatchConfig>) {
    this.config = {
      maxBatchSize: 100,
      maxMemoryMB: 2048,
      enableParallelProcessing: true,
      gpuMemoryThresholdMB: 512,
      ...config
    };

    this.stats = {
      totalImages: 0,
      processedImages: 0,
      failedImages: 0,
      averageHashTime: 0,
      totalProcessingTime: 0,
      gpuUtilization: 0,
      throughputImagesPerSecond: 0
    };
  }

  /**
   * Initialize GPU acceleration
   */
  async initialize(): Promise<void> {
    try {
      // Check if GPU is available
      this.useGPU = isGPUAvailable();

      if (this.useGPU) {
        console.log('Initializing GPU acceleration...');
        this.workerPool = await getGPUWorkerPool();
        console.log('GPU acceleration enabled');
      } else {
        console.log('GPU not available, using CPU fallback');
      }
    } catch (error) {
      console.error('Failed to initialize GPU:', error);
      this.useGPU = false;
    }
  }

  /**
   * Add image to processing queue
   */
  async queueImage(imageData: ImageData, filePath: string): Promise<bigint> {
    return new Promise<bigint>((resolve, reject) => {
      this.processingQueue.push({
        imageData,
        filePath,
        resolve,
        reject
      });

      this.stats.totalImages++;

      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued images in batches
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.processingQueue.length === 0) {
      return;
    }

    this.processing = true;
    const startTime = performance.now();

    try {
      while (this.processingQueue.length > 0) {
        // Determine batch size based on available memory
        const batchSize = this.calculateOptimalBatchSize();
        const batch = this.processingQueue.splice(0, batchSize);

        if (this.useGPU && this.workerPool) {
          await this.processBatchGPU(batch);
        } else {
          await this.processBatchCPU(batch);
        }

        // Update statistics
        const currentTime = performance.now();
        this.stats.totalProcessingTime = currentTime - startTime;
        this.stats.throughputImagesPerSecond =
          (this.stats.processedImages / this.stats.totalProcessingTime) * 1000;

        // Log progress
        if (this.stats.processedImages % 10 === 0) {
          console.log(
            `Processed ${this.stats.processedImages}/${this.stats.totalImages} images ` +
            `(${this.stats.throughputImagesPerSecond.toFixed(1)} img/s)`
          );
        }
      }
    } catch (error) {
      console.error('Error processing queue:', error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process batch using GPU acceleration
   */
  private async processBatchGPU(batch: QueuedImage[]): Promise<void> {
    if (!this.workerPool) {
      throw new Error('GPU worker pool not initialized');
    }

    const batchStartTime = performance.now();

    try {
      // Process all images in parallel
      const promises = batch.map(async (item) => {
        try {
          const result = await this.workerPool!.computeHash(item.imageData);

          this.stats.processedImages++;
          this.stats.averageHashTime =
            (this.stats.averageHashTime * (this.stats.processedImages - 1) +
              result.processingTime) /
            this.stats.processedImages;

          item.resolve(result.hash);
        } catch (error: any) {
          this.stats.failedImages++;
          item.reject(error);
        }
      });

      await Promise.all(promises);

      const batchTime = performance.now() - batchStartTime;
      this.stats.gpuUtilization = (batchTime / 1000) * 100; // Simplified calculation

    } catch (error) {
      console.error('GPU batch processing error:', error);
      // Reject all items in batch
      batch.forEach((item) => item.reject(error as Error));
      this.stats.failedImages += batch.length;
    }
  }

  /**
   * Process batch using CPU fallback
   */
  private async processBatchCPU(batch: QueuedImage[]): Promise<void> {
    // Import CPU-based hashing service
    const { computeDHash } = await import('../shared/hashing');

    for (const item of batch) {
      try {
        const startTime = performance.now();

        // Use CPU-based dHash computation
        const hash = await computeDHash(item.imageData);

        const processingTime = performance.now() - startTime;

        this.stats.processedImages++;
        this.stats.averageHashTime =
          (this.stats.averageHashTime * (this.stats.processedImages - 1) +
            processingTime) /
          this.stats.processedImages;

        item.resolve(hash);
      } catch (error: any) {
        this.stats.failedImages++;
        item.reject(error);
      }
    }
  }

  /**
   * Calculate optimal batch size based on available memory
   */
  private calculateOptimalBatchSize(): number {
    const queueSize = this.processingQueue.length;

    if (queueSize === 0) {
      return 0;
    }

    // Estimate memory per image based on actual image sizes in queue
    let totalEstimatedMB = 0;
    const sampleSize = Math.min(10, queueSize);

    for (let i = 0; i < sampleSize; i++) {
      const imageData = this.processingQueue[i].imageData;
      const imageSizeMB = (imageData.width * imageData.height * 4) / (1024 * 1024);
      totalEstimatedMB += imageSizeMB;
    }

    const avgImageSizeMB = totalEstimatedMB / sampleSize || 5;

    // Calculate max images that fit in memory budget
    const maxImagesInMemory = Math.floor(
      this.config.maxMemoryMB / avgImageSizeMB
    );

    // GPU batch limits based on VRAM
    let gpuBatchLimit = this.config.maxBatchSize;
    if (this.useGPU) {
      // More conservative batch size for GPU
      // Assume GPU has less memory available than system RAM
      const gpuMemoryFactor = 0.5;
      gpuBatchLimit = Math.floor(
        (this.config.gpuMemoryThresholdMB * gpuMemoryFactor) / avgImageSizeMB
      );
      gpuBatchLimit = Math.max(10, Math.min(gpuBatchLimit, 100));
    }

    return Math.min(queueSize, gpuBatchLimit, maxImagesInMemory);
  }

  /**
   * Get current processing statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.processingQueue.length;
  }

  /**
   * Check if GPU acceleration is being used
   */
  isUsingGPU(): boolean {
    return this.useGPU;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalImages: 0,
      processedImages: 0,
      failedImages: 0,
      averageHashTime: 0,
      totalProcessingTime: 0,
      gpuUtilization: 0,
      throughputImagesPerSecond: 0
    };
  }

  /**
   * Clear processing queue
   */
  clearQueue(): void {
    // Reject all pending items
    this.processingQueue.forEach((item) => {
      item.reject(new Error('Queue cleared'));
    });

    this.processingQueue = [];
  }

  /**
   * Shutdown coordinator
   */
  async shutdown(): Promise<void> {
    this.clearQueue();

    if (this.workerPool) {
      await this.workerPool.shutdown();
      this.workerPool = null;
    }

    this.useGPU = false;
  }
}

// Singleton instance
let coordinatorInstance: GPUBatchCoordinator | null = null;

export async function getGPUBatchCoordinator(
  config?: Partial<BatchConfig>
): Promise<GPUBatchCoordinator> {
  if (!coordinatorInstance) {
    coordinatorInstance = new GPUBatchCoordinator(config);
    await coordinatorInstance.initialize();
  }
  return coordinatorInstance;
}

export async function shutdownGPUBatchCoordinator(): Promise<void> {
  if (coordinatorInstance) {
    await coordinatorInstance.shutdown();
    coordinatorInstance = null;
  }
}
