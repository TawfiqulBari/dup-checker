# GPU Acceleration Implementation Guide

This document provides a complete guide for implementing GPU acceleration in Dup-Checker.

## 🎯 Performance Goals

- **7-10x faster** end-to-end duplicate detection
- **40x faster** image hashing (batches of 100+)
- **10x faster** video frame extraction
- **25x faster** hash comparison

## 📦 Status

**Current**: Foundation created, @webgpu/types installed
**Next Steps**: See [Implementation Roadmap](#implementation-roadmap) below

## 🏗️ Architecture Overview

```
Main Process
    ↓
Batch Coordinator
    ↓
├─ Worker Thread 1 (WebGPU) → Image Hashing
├─ Worker Thread 2 (WebGPU) → Image Hashing
├─ Worker Thread 3 (WebGPU) → Image Hashing
└─ Worker Thread 4 (Video)  → Hardware Decode + WebGPU Hashing
    ↓
WebGPU Compute Shaders:
1. Resize + Grayscale (9×8)
2. dHash Computation
3. Parallel Hamming Distance
```

## 📋 Implementation Roadmap

### Phase 1: WebGPU Foundation (Week 1-2)
- [ ] Create WebGPU device initialization
- [ ] Implement basic compute shader test
- [ ] Set up worker thread architecture
- [ ] Create batch coordinator

### Phase 2: Image Processing Shaders (Week 3-4)
- [ ] Resize + grayscale compute shader
- [ ] dHash computation shader
- [ ] Hamming distance comparison shader
- [ ] Integration with existing hashingService

### Phase 3: Video Acceleration (Week 5)
- [ ] Research hardware decode options
- [ ] Implement frame extraction pipeline
- [ ] Connect to GPU hashing pipeline

### Phase 4: Optimization & Fallback (Week 6-8)
- [ ] Batch size tuning
- [ ] Memory management
- [ ] GPU.js fallback for older GPUs
- [ ] CPU fallback

### Phase 5: Testing & Documentation (Week 9-10)
- [ ] Cross-platform testing
- [ ] Performance benchmarking
- [ ] User documentation
- [ ] Troubleshooting guide

## 🔧 Dependencies to Install

```bash
# TypeScript types (already installed)
npm install --save-dev @webgpu/types

# For WebGL fallback (requires native compilation)
npm install gpu.js

# For hardware video decode (requires FFmpeg)
npm install @ffmpeg/ffmpeg @ffmpeg/util

# Alternative video library
npm install fluent-ffmpeg
```

**Note**: gpu.js requires native OpenGL bindings which need build tools. See [BUILD_REQUIREMENTS.md] for details.

## 📝 Code Examples

### 1. WebGPU Initialization

```typescript
// src/gpu/webgpu-init.ts
export async function initializeWebGPU(): Promise<GPUDevice | null> {
  if (!navigator.gpu) {
    console.warn('WebGPU not supported');
    return null;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });

    if (!adapter) {
      console.warn('No WebGPU adapter found');
      return null;
    }

    const device = await adapter.requestDevice({
      requiredLimits: {
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxComputeWorkgroupSizeX: 256,
      }
    });

    console.log('WebGPU initialized successfully');
    console.log('Adapter:', await adapter.requestAdapterInfo());
    console.log('Limits:', device.limits);

    return device;
  } catch (error) {
    console.error('WebGPU initialization failed:', error);
    return null;
  }
}
```

### 2. Compute Shaders (WGSL)

```wgsl
// src/gpu/shaders/image-processing.wgsl

// Shader 1: Resize + Grayscale Conversion
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;
@group(0) @binding(2) var<uniform> dims: vec2<u32>;

@compute @workgroup_size(8, 8)
fn resize_grayscale(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let out_x = global_id.x;
    let out_y = global_id.y;

    if (out_x >= 9u || out_y >= 8u) {
        return;
    }

    let scale_x = f32(dims.x) / 9.0;
    let scale_y = f32(dims.y) / 8.0;

    let src_x = u32(f32(out_x) * scale_x);
    let src_y = u32(f32(out_y) * scale_y);

    let color = textureLoad(inputTexture, vec2<u32>(src_x, src_y), 0);

    // ITU-R BT.709 perceptual luminance
    let gray = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;

    let idx = out_y * 9u + out_x;
    output[idx] = u32(gray * 255.0);
}

// Shader 2: dHash Computation
@group(0) @binding(0) var<storage, read> grayscale: array<u32>;
@group(0) @binding(1) var<storage, read_write> hash: array<u32>;

@compute @workgroup_size(64)
fn compute_dhash(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let thread_id = global_id.x;

    if (thread_id >= 64u) {
        return;
    }

    // Each thread computes 1 bit of the 64-bit hash
    let y = thread_id / 8u;
    let x = thread_id % 8u;

    let left_idx = y * 9u + x;
    let right_idx = y * 9u + x + 1u;

    let left = grayscale[left_idx];
    let right = grayscale[right_idx];

    // Set bit if left < right
    if (left < right) {
        let word_idx = thread_id / 32u;
        let bit_pos = thread_id % 32u;
        atomicOr(&hash[word_idx], 1u << bit_pos);
    }
}

// Shader 3: Parallel Hamming Distance
@group(0) @binding(0) var<storage, read> hashes: array<vec2<u32>>;
@group(0) @binding(1) var<storage, read_write> distances: array<u32>;
@group(0) @binding(2) var<uniform> numHashes: u32;

@compute @workgroup_size(64)
fn hamming_distance_matrix(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let thread_id = global_id.x;

    // Compute upper triangle of distance matrix
    let total_comparisons = (numHashes * (numHashes - 1u)) / 2u;

    if (thread_id >= total_comparisons) {
        return;
    }

    // Convert linear index to (i, j) pair
    var i: u32 = 0u;
    var j: u32 = 0u;
    var count: u32 = 0u;

    for (var row: u32 = 0u; row < numHashes - 1u; row = row + 1u) {
        let row_items = numHashes - row - 1u;
        if (count + row_items > thread_id) {
            i = row;
            j = row + 1u + (thread_id - count);
            break;
        }
        count = count + row_items;
    }

    let hash1 = hashes[i];
    let hash2 = hashes[j];

    // XOR and count bits
    let diff_low = hash1.x ^ hash2.x;
    let diff_high = hash1.y ^ hash2.y;

    let dist = countOneBits(diff_low) + countOneBits(diff_high);

    distances[thread_id] = dist;
}
```

### 3. WebGPU Image Processor

```typescript
// src/gpu/webgpu-processor.ts
import type { GPUDevice } from '@webgpu/types';

export class WebGPUImageProcessor {
  private device: GPUDevice;
  private pipelines: {
    resizeGrayscale: GPUComputePipeline;
    dhash: GPUComputePipeline;
  };

  private constructor(device: GPUDevice, pipelines: any) {
    this.device = device;
    this.pipelines = pipelines;
  }

  static async create(): Promise<WebGPUImageProcessor> {
    const adapter = await navigator.gpu?.requestAdapter({
      powerPreference: 'high-performance'
    });

    if (!adapter) {
      throw new Error('WebGPU not supported');
    }

    const device = await adapter.requestDevice();
    const pipelines = await WebGPUImageProcessor.createPipelines(device);

    return new WebGPUImageProcessor(device, pipelines);
  }

  private static async createPipelines(device: GPUDevice) {
    // Load shader code from file
    const shaderCode = await fetch('/shaders/image-processing.wgsl').then(r => r.text());
    const shaderModule = device.createShaderModule({ code: shaderCode });

    const resizeGrayscale = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'resize_grayscale'
      }
    });

    const dhash = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'compute_dhash'
      }
    });

    return { resizeGrayscale, dhash };
  }

  async processImage(imageBitmap: ImageBitmap): Promise<bigint> {
    // Create GPU texture
    const texture = this.device.createTexture({
      size: [imageBitmap.width, imageBitmap.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING |
             GPUTextureUsage.COPY_DST |
             GPUTextureUsage.RENDER_ATTACHMENT
    });

    // Upload image to GPU
    this.device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture },
      [imageBitmap.width, imageBitmap.height]
    );

    // Create output buffers
    const grayscaleBuffer = this.device.createBuffer({
      size: 9 * 8 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    const hashBuffer = this.device.createBuffer({
      size: 8, // 64 bits
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    const dimsBuffer = this.device.createBuffer({
      size: 8,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Write dimensions
    this.device.queue.writeBuffer(
      dimsBuffer,
      0,
      new Uint32Array([imageBitmap.width, imageBitmap.height])
    );

    // Create bind groups
    const resizeBindGroup = this.device.createBindGroup({
      layout: this.pipelines.resizeGrayscale.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: { buffer: grayscaleBuffer } },
        { binding: 2, resource: { buffer: dimsBuffer } }
      ]
    });

    const hashBindGroup = this.device.createBindGroup({
      layout: this.pipelines.dhash.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: grayscaleBuffer } },
        { binding: 1, resource: { buffer: hashBuffer } }
      ]
    });

    // Execute compute passes
    const commandEncoder = this.device.createCommandEncoder();

    // Pass 1: Resize + Grayscale
    const resizePass = commandEncoder.beginComputePass();
    resizePass.setPipeline(this.pipelines.resizeGrayscale);
    resizePass.setBindGroup(0, resizeBindGroup);
    resizePass.dispatchWorkgroups(2, 1); // Ceil(9/8), ceil(8/8)
    resizePass.end();

    // Pass 2: dHash
    const hashPass = commandEncoder.beginComputePass();
    hashPass.setPipeline(this.pipelines.dhash);
    hashPass.setBindGroup(0, hashBindGroup);
    hashPass.dispatchWorkgroups(1); // 64 threads
    hashPass.end();

    // Read result
    const stagingBuffer = this.device.createBuffer({
      size: 8,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });

    commandEncoder.copyBufferToBuffer(hashBuffer, 0, stagingBuffer, 0, 8);
    this.device.queue.submit([commandEncoder.finish()]);

    // Map and read
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const hashData = new Uint32Array(stagingBuffer.getMappedRange());
    const hash = BigInt(hashData[0]) | (BigInt(hashData[1]) << 32n);

    // Cleanup
    stagingBuffer.unmap();
    texture.destroy();
    grayscaleBuffer.destroy();
    hashBuffer.destroy();
    dimsBuffer.destroy();
    stagingBuffer.destroy();

    return hash;
  }

  destroy() {
    this.device.destroy();
  }
}
```

### 4. Worker Thread Integration

```typescript
// src/gpu/workers/gpu-worker.ts
import { parentPort } from 'worker_threads';
import { WebGPUImageProcessor } from '../webgpu-processor';

let processor: WebGPUImageProcessor | null = null;

async function initialize() {
  try {
    processor = await WebGPUImageProcessor.create();
    parentPort?.postMessage({ type: 'READY' });
  } catch (error) {
    parentPort?.postMessage({
      type: 'ERROR',
      error: error.message
    });
  }
}

parentPort?.on('message', async (message) => {
  if (message.type === 'INIT') {
    await initialize();
    return;
  }

  if (message.type === 'PROCESS_IMAGES') {
    if (!processor) {
      parentPort?.postMessage({
        type: 'ERROR',
        error: 'Processor not initialized'
      });
      return;
    }

    const { imageBuffers } = message;
    const hashes: bigint[] = [];

    for (const buffer of imageBuffers) {
      const blob = new Blob([buffer]);
      const imageBitmap = await createImageBitmap(blob);
      const hash = await processor.processImage(imageBitmap);
      hashes.push(hash);
      imageBitmap.close();
    }

    parentPort?.postMessage({
      type: 'HASHES',
      hashes: hashes.map(h => h.toString())
    });
  }
});
```

### 5. Batch Coordinator

```typescript
// src/gpu/batch-coordinator.ts
import { Worker } from 'worker_threads';
import path from 'path';

export class GPUBatchCoordinator {
  private workers: Worker[] = [];
  private numWorkers: number;
  private workerReady: boolean[] = [];

  constructor(numWorkers: number = 4) {
    this.numWorkers = numWorkers;
  }

  async initialize() {
    for (let i = 0; i < this.numWorkers; i++) {
      const worker = new Worker(
        path.join(__dirname, 'workers/gpu-worker.js')
      );

      this.workers.push(worker);

      await new Promise<void>((resolve, reject) => {
        worker.once('message', (msg) => {
          if (msg.type === 'READY') {
            this.workerReady[i] = true;
            resolve();
          } else if (msg.type === 'ERROR') {
            reject(new Error(msg.error));
          }
        });

        worker.postMessage({ type: 'INIT' });
      });
    }

    console.log(`Initialized ${this.numWorkers} GPU workers`);
  }

  async processImageBatch(
    files: Array<{ id: string; path: string }>
  ): Promise<Map<string, bigint>> {
    const BATCH_SIZE = 32;
    const batches = this.chunkArray(files, BATCH_SIZE);

    const results = await Promise.all(
      batches.map((batch, idx) => {
        const worker = this.workers[idx % this.numWorkers];
        return this.processBatchOnWorker(worker, batch);
      })
    );

    // Merge results
    const hashMap = new Map<string, bigint>();
    for (const result of results) {
      for (const [id, hash] of result) {
        hashMap.set(id, hash);
      }
    }

    return hashMap;
  }

  private async processBatchOnWorker(
    worker: Worker,
    files: Array<{ id: string; path: string }>
  ): Promise<Map<string, bigint>> {
    const fs = await import('fs/promises');

    // Read files
    const buffers = await Promise.all(
      files.map(f => fs.readFile(f.path))
    );

    return new Promise((resolve, reject) => {
      worker.once('message', (msg) => {
        if (msg.type === 'HASHES') {
          const hashMap = new Map<string, bigint>();
          files.forEach((file, idx) => {
            hashMap.set(file.id, BigInt(msg.hashes[idx]));
          });
          resolve(hashMap);
        } else if (msg.type === 'ERROR') {
          reject(new Error(msg.error));
        }
      });

      worker.postMessage({
        type: 'PROCESS_IMAGES',
        imageBuffers: buffers.map(b => b.buffer)
      });
    });
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async shutdown() {
    await Promise.all(this.workers.map(w => w.terminate()));
  }
}
```

## 🔄 Integration with Existing Code

```typescript
// src/renderer/services/hashingService.ts - Updated

import { GPUBatchCoordinator } from '../../gpu/batch-coordinator';

// Add GPU detection
let gpuCoordinator: GPUBatchCoordinator | null = null;
let gpuAvailable = false;

async function initializeGPU() {
  try {
    gpuCoordinator = new GPUBatchCoordinator(4);
    await gpuCoordinator.initialize();
    gpuAvailable = true;
    console.log('GPU acceleration enabled');
  } catch (error) {
    console.warn('GPU acceleration unavailable, using CPU:', error);
    gpuAvailable = false;
  }
}

// Modified findDuplicates function
export const findDuplicates = async (
  files: FileWithHandle[],
  setProgress: (progress: ScanProgress) => void
): Promise<DuplicateGroup[]> => {
  // Initialize GPU on first run
  if (gpuCoordinator === null) {
    await initializeGPU();
  }

  if (gpuAvailable && gpuCoordinator) {
    return findDuplicatesGPU(files, setProgress, gpuCoordinator);
  } else {
    return findDuplicatesCPU(files, setProgress);
  }
};

async function findDuplicatesGPU(
  files: FileWithHandle[],
  setProgress: (progress: ScanProgress) => void,
  coordinator: GPUBatchCoordinator
): Promise<DuplicateGroup[]> {
  setProgress({ status: 'Initializing GPU...', processed: 0, total: files.length });

  // Use GPU for image hashing
  const imageFiles = files.filter(f => f.file.type.startsWith('image/'));
  const imageHashes = await coordinator.processImageBatch(
    imageFiles.map(f => ({ id: f.id, path: f.path }))
  );

  // Continue with comparison logic...
  // (Use existing comparison code but with GPU-generated hashes)

  return []; // Placeholder
}

// Keep existing CPU implementation as fallback
async function findDuplicatesCPU(
  files: FileWithHandle[],
  setProgress: (progress: ScanProgress) => void
): Promise<DuplicateGroup[]> {
  // Existing CPU implementation
  return [];
}
```

## 🚀 Next Steps

1. **Review this documentation** and the comprehensive research in the planning session
2. **Set up build environment** for native modules (if using gpu.js or node-av)
3. **Start with Phase 1**: Basic WebGPU initialization and testing
4. **Incremental implementation**: Test each phase thoroughly before moving to the next
5. **Benchmark regularly**: Compare GPU vs CPU performance at each stage

## 📚 Additional Resources

- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [WGSL Language Specification](https://www.w3.org/TR/WGSL/)
- [WebGPU Best Practices](https://toji.dev/webgpu-best-practices/)
- [GPU.js Documentation](https://gpu.rocks/)
- [Electron Worker Threads](https://www.electronjs.org/docs/latest/tutorial/multithreading)

## ⚠️ Important Notes

1. **WebGPU is bleeding edge** - Ensure target systems have updated GPU drivers
2. **Always implement fallbacks** - CPU path must work when GPU unavailable
3. **Test on real hardware** - Emulators/VMs may not support GPU acceleration
4. **Monitor memory** - GPU memory is limited, batch sizes must be adaptive
5. **Cross-platform testing** - WebGPU behavior varies across Windows/Linux/macOS

---

**Status**: Foundation created. Full implementation requires ~10 weeks of development.
**Expected Result**: 7-10x performance improvement for duplicate detection.
