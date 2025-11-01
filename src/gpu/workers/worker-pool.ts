/**
 * GPU Worker Pool
 * Manages a pool of GPU worker threads for parallel processing
 */

import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { join } from 'path';
import type { WorkerMessage, WorkerResponse } from './gpu-worker';

interface PooledWorker {
  worker: Worker;
  busy: boolean;
  id: number;
}

interface PendingTask {
  message: WorkerMessage;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

export class GPUWorkerPool {
  private workers: PooledWorker[] = [];
  private taskQueue: PendingTask[] = [];
  private nextWorkerId = 0;
  private initialized = false;
  private workerPath: string;

  constructor(
    private poolSize: number = Math.max(2, Math.floor(cpus().length / 2))
  ) {
    // Resolve worker script path
    this.workerPath = join(__dirname, 'gpu-worker.js');
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log(`Initializing GPU worker pool with ${this.poolSize} workers...`);

    const initPromises: Promise<void>[] = [];

    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerPath);
      const pooledWorker: PooledWorker = {
        worker,
        busy: false,
        id: this.nextWorkerId++
      };

      this.workers.push(pooledWorker);

      // Wait for worker to be ready
      const initPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Worker ${pooledWorker.id} initialization timeout`));
        }, 10000);

        worker.once('message', (response: WorkerResponse) => {
          clearTimeout(timeout);
          if (response.type === 'ready') {
            console.log(`Worker ${pooledWorker.id} ready:`, response.data);
            resolve();
          } else if (response.type === 'error') {
            reject(new Error(response.error));
          }
        });

        worker.on('error', (error) => {
          console.error(`Worker ${pooledWorker.id} error:`, error);
        });

        worker.on('exit', (code) => {
          if (code !== 0) {
            console.error(`Worker ${pooledWorker.id} exited with code ${code}`);
          }
        });
      });

      initPromises.push(initPromise);
    }

    try {
      await Promise.all(initPromises);
      this.initialized = true;
      console.log('GPU worker pool initialized successfully');
    } catch (error) {
      console.error('Failed to initialize GPU worker pool:', error);
      await this.shutdown();
      throw error;
    }
  }

  /**
   * Execute a task on an available worker
   */
  private async executeTask<T>(message: WorkerMessage): Promise<T> {
    if (!this.initialized) {
      throw new Error('Worker pool not initialized');
    }

    return new Promise<T>((resolve, reject) => {
      const task: PendingTask = { message, resolve, reject };

      // Try to assign to an idle worker
      const idleWorker = this.workers.find((w) => !w.busy);

      if (idleWorker) {
        this.assignTask(idleWorker, task);
      } else {
        // Queue the task
        this.taskQueue.push(task);
      }
    });
  }

  /**
   * Assign a task to a specific worker
   */
  private assignTask(pooledWorker: PooledWorker, task: PendingTask): void {
    pooledWorker.busy = true;

    const messageHandler = (response: WorkerResponse) => {
      if (response.id !== task.message.id) {
        return; // Not our response
      }

      // Remove this listener
      pooledWorker.worker.off('message', messageHandler);

      // Mark worker as available
      pooledWorker.busy = false;

      // Process next task in queue
      const nextTask = this.taskQueue.shift();
      if (nextTask) {
        this.assignTask(pooledWorker, nextTask);
      }

      // Handle response
      if (response.type === 'result') {
        task.resolve(response.data);
      } else if (response.type === 'error') {
        task.reject(new Error(response.error));
      }
    };

    pooledWorker.worker.on('message', messageHandler);
    pooledWorker.worker.postMessage(task.message);
  }

  /**
   * Compute hash for an image
   */
  async computeHash(imageData: ImageData): Promise<{
    hash: bigint;
    processingTime: number;
    usedGPU: boolean;
  }> {
    const id = `hash-${Date.now()}-${Math.random()}`;

    // Serialize ImageData for transfer
    const serialized = {
      data: Array.from(imageData.data),
      width: imageData.width,
      height: imageData.height
    };

    const result = await this.executeTask<any>({
      type: 'hash',
      id,
      data: serialized
    });

    return {
      hash: BigInt(result.hash),
      processingTime: result.processingTime,
      usedGPU: result.usedGPU
    };
  }

  /**
   * Compare hash against database
   */
  async compareHash(
    targetHash: bigint,
    databaseHashes: bigint[],
    threshold: number = 10
  ): Promise<{
    distances: Uint32Array;
    processingTime: number;
    comparisonsPerSecond: number;
  }> {
    const id = `compare-${Date.now()}-${Math.random()}`;

    const result = await this.executeTask<any>({
      type: 'compare',
      id,
      data: {
        targetHash: targetHash.toString(),
        databaseHashes: databaseHashes.map((h) => h.toString()),
        threshold
      }
    });

    return {
      distances: new Uint32Array(result.distances),
      processingTime: result.processingTime,
      comparisonsPerSecond: result.comparisonsPerSecond
    };
  }

  /**
   * Process batch of images in parallel
   */
  async computeHashBatch(images: ImageData[]): Promise<Array<{
    hash: bigint;
    processingTime: number;
    usedGPU: boolean;
  }>> {
    const promises = images.map((imageData) => this.computeHash(imageData));
    return Promise.all(promises);
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    poolSize: number;
    busyWorkers: number;
    idleWorkers: number;
    queuedTasks: number;
  } {
    const busyCount = this.workers.filter((w) => w.busy).length;

    return {
      poolSize: this.workers.length,
      busyWorkers: busyCount,
      idleWorkers: this.workers.length - busyCount,
      queuedTasks: this.taskQueue.length
    };
  }

  /**
   * Shutdown all workers
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down GPU worker pool...');

    const shutdownPromises = this.workers.map((pooledWorker) => {
      return new Promise<void>((resolve) => {
        pooledWorker.worker.once('exit', () => resolve());
        pooledWorker.worker.postMessage({ type: 'shutdown', id: 'shutdown' });

        // Force terminate after 2 seconds
        setTimeout(() => {
          pooledWorker.worker.terminate();
          resolve();
        }, 2000);
      });
    });

    await Promise.all(shutdownPromises);
    this.workers = [];
    this.taskQueue = [];
    this.initialized = false;

    console.log('GPU worker pool shutdown complete');
  }

  /**
   * Check if pool is ready
   */
  isReady(): boolean {
    return this.initialized;
  }
}

// Singleton instance
let poolInstance: GPUWorkerPool | null = null;

export async function getGPUWorkerPool(
  poolSize?: number
): Promise<GPUWorkerPool> {
  if (!poolInstance) {
    poolInstance = new GPUWorkerPool(poolSize);
    await poolInstance.initialize();
  }
  return poolInstance;
}

export async function shutdownGPUWorkerPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.shutdown();
    poolInstance = null;
  }
}
