/**
 * TypeScript type definitions for GPU acceleration
 */

export interface GPUConfig {
  enabled: boolean;
  preferredDevice: 'discrete' | 'integrated' | 'auto';
  maxMemoryMB: number;
  batchSize: number;
  workerThreads: number;
}

export interface GPUPerformanceMetrics {
  totalImagesProcessed: number;
  averageHashTimeMs: number;
  gpuUtilizationPercent: number;
  throughputImagesPerSecond: number;
  memoryUsedMB: number;
  fallbackToCPUCount: number;
}

export interface HashResult {
  hash: bigint;
  processingTime: number;
  usedGPU: boolean;
  filePath: string;
}

export interface ComparisonResult {
  file1Index: number;
  file2Index: number;
  distance: number;
  isSimilar: boolean;
  comparisonTimeMs: number;
}

export interface BatchProcessingOptions {
  maxConcurrent: number;
  prioritizeGPU: boolean;
  enableCPUFallback: boolean;
  similarityThreshold: number;
}

export interface VideoFrameExtractionOptions {
  numFrames: number;
  useHardwareDecoding: boolean;
  frameIntervalMs: number;
}

export interface GPUDeviceInfo {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
  maxBufferSize: number;
  maxComputeWorkgroups: number;
  supportsTimestamps: boolean;
}
