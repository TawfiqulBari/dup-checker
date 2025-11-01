/**
 * WebGPU Image Processor
 * Handles GPU-accelerated image hashing pipeline
 */

import { initWebGPU, GPUCapabilities } from './webgpu-init';
import resizeGrayscaleShader from './shaders/resize-grayscale.wgsl?raw';
import dhashShader from './shaders/dhash.wgsl?raw';
import hammingShader from './shaders/hamming.wgsl?raw';

export interface ProcessingResult {
  hash: bigint;
  processingTime: number;
  usedGPU: boolean;
}

export interface ComparisonResult {
  distances: Uint32Array;
  processingTime: number;
  comparisonsPerSecond: number;
}

export class WebGPUImageProcessor {
  private capabilities: GPUCapabilities | null = null;
  private device: GPUDevice | null = null;

  // Shader modules
  private resizeModule: GPUShaderModule | null = null;
  private dhashModule: GPUShaderModule | null = null;
  private hammingModule: GPUShaderModule | null = null;

  // Pipelines
  private resizePipeline: GPUComputePipeline | null = null;
  private dhashPipeline: GPUComputePipeline | null = null;
  private hammingPipeline: GPUComputePipeline | null = null;

  private initialized = false;

  /**
   * Initialize GPU processor
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      this.capabilities = await initWebGPU();

      if (!this.capabilities.hasWebGPU || !this.capabilities.device) {
        console.warn('WebGPU not available, falling back to CPU');
        return false;
      }

      this.device = this.capabilities.device;

      // Compile shader modules
      this.resizeModule = this.device.createShaderModule({
        label: 'Resize + Grayscale Shader',
        code: resizeGrayscaleShader
      });

      this.dhashModule = this.device.createShaderModule({
        label: 'dHash Shader',
        code: dhashShader
      });

      this.hammingModule = this.device.createShaderModule({
        label: 'Hamming Distance Shader',
        code: hammingShader
      });

      // Create compute pipelines
      this.resizePipeline = this.device.createComputePipeline({
        label: 'Resize Pipeline',
        layout: 'auto',
        compute: {
          module: this.resizeModule,
          entryPoint: 'resize_grayscale'
        }
      });

      this.dhashPipeline = this.device.createComputePipeline({
        label: 'dHash Pipeline',
        layout: 'auto',
        compute: {
          module: this.dhashModule,
          entryPoint: 'compute_dhash_single'
        }
      });

      this.hammingPipeline = this.device.createComputePipeline({
        label: 'Hamming Pipeline',
        layout: 'auto',
        compute: {
          module: this.hammingModule,
          entryPoint: 'compute_hamming_batch'
        }
      });

      this.initialized = true;
      console.log('WebGPU processor initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize WebGPU processor:', error);
      return false;
    }
  }

  /**
   * Compute perceptual hash for an image using GPU
   */
  async computeHash(imageData: ImageData): Promise<ProcessingResult> {
    const startTime = performance.now();

    if (!this.initialized || !this.device) {
      throw new Error('WebGPU processor not initialized');
    }

    try {
      // Convert ImageData to packed RGBA buffer
      const packedPixels = new Uint32Array(imageData.width * imageData.height);
      const srcData = new Uint32Array(imageData.data.buffer);
      packedPixels.set(srcData);

      // Create GPU buffers
      const inputBuffer = this.device.createBuffer({
        label: 'Input Image Buffer',
        size: packedPixels.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });

      const grayscaleBuffer = this.device.createBuffer({
        label: 'Grayscale Buffer',
        size: 9 * 8 * 4, // 72 floats
        usage: GPUBufferUsage.STORAGE
      });

      const hashBuffer = this.device.createBuffer({
        label: 'Hash Output Buffer',
        size: 8, // 2 u32s = 64 bits
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      });

      const hashStagingBuffer = this.device.createBuffer({
        label: 'Hash Staging Buffer',
        size: 8,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });

      // Metadata uniform buffer
      const metadata = new Uint32Array([
        imageData.width,  // width
        imageData.height, // height
        9,               // target_width
        8                // target_height
      ]);

      const metadataBuffer = this.device.createBuffer({
        label: 'Metadata Buffer',
        size: metadata.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });

      // Upload data
      this.device.queue.writeBuffer(inputBuffer, 0, packedPixels);
      this.device.queue.writeBuffer(metadataBuffer, 0, metadata);

      // Clear hash buffer
      this.device.queue.writeBuffer(hashBuffer, 0, new Uint32Array([0, 0]));

      // Create command encoder
      const commandEncoder = this.device.createCommandEncoder();

      // Step 1: Resize + Grayscale
      {
        const bindGroup = this.device.createBindGroup({
          layout: this.resizePipeline!.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: inputBuffer } },
            { binding: 1, resource: { buffer: grayscaleBuffer } },
            { binding: 2, resource: { buffer: metadataBuffer } }
          ]
        });

        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.resizePipeline!);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.dispatchWorkgroups(1, 1); // 9×8 workgroup
        passEncoder.end();
      }

      // Step 2: Compute dHash
      {
        const bindGroup = this.device.createBindGroup({
          layout: this.dhashPipeline!.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: grayscaleBuffer } },
            { binding: 1, resource: { buffer: hashBuffer } }
          ]
        });

        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.dhashPipeline!);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.dispatchWorkgroups(1); // Single workgroup
        passEncoder.end();
      }

      // Copy result to staging buffer
      commandEncoder.copyBufferToBuffer(hashBuffer, 0, hashStagingBuffer, 0, 8);

      // Submit commands
      this.device.queue.submit([commandEncoder.finish()]);

      // Read result
      await hashStagingBuffer.mapAsync(GPUMapMode.READ);
      const hashData = new Uint32Array(hashStagingBuffer.getMappedRange().slice(0));
      hashStagingBuffer.unmap();

      // Convert to BigInt
      const hash = (BigInt(hashData[1]) << 32n) | BigInt(hashData[0]);

      // Cleanup
      inputBuffer.destroy();
      grayscaleBuffer.destroy();
      hashBuffer.destroy();
      hashStagingBuffer.destroy();
      metadataBuffer.destroy();

      const endTime = performance.now();

      return {
        hash,
        processingTime: endTime - startTime,
        usedGPU: true
      };

    } catch (error) {
      console.error('Error computing hash on GPU:', error);
      throw error;
    }
  }

  /**
   * Compare one hash against a batch of hashes
   */
  async compareHash(
    targetHash: bigint,
    databaseHashes: bigint[],
    threshold: number = 10
  ): Promise<ComparisonResult> {
    const startTime = performance.now();

    if (!this.initialized || !this.device) {
      throw new Error('WebGPU processor not initialized');
    }

    try {
      const numHashes = databaseHashes.length;

      // Pack hashes into GPU buffer format
      const packedHashes = new Uint32Array(numHashes * 2);
      for (let i = 0; i < numHashes; i++) {
        const hash = databaseHashes[i];
        packedHashes[i * 2] = Number(hash & 0xFFFFFFFFn);
        packedHashes[i * 2 + 1] = Number(hash >> 32n);
      }

      const targetPacked = new Uint32Array([
        Number(targetHash & 0xFFFFFFFFn),
        Number(targetHash >> 32n)
      ]);

      // Create buffers
      const targetBuffer = this.device.createBuffer({
        size: 8,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });

      const databaseBuffer = this.device.createBuffer({
        size: packedHashes.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });

      const distancesBuffer = this.device.createBuffer({
        size: numHashes * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      });

      const distancesStagingBuffer = this.device.createBuffer({
        size: numHashes * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });

      const paramsBuffer = this.device.createBuffer({
        size: 16, // 4 u32s
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });

      // Upload data
      this.device.queue.writeBuffer(targetBuffer, 0, targetPacked);
      this.device.queue.writeBuffer(databaseBuffer, 0, packedHashes);
      this.device.queue.writeBuffer(
        paramsBuffer,
        0,
        new Uint32Array([numHashes, threshold, 0, 0])
      );

      // Create bind group
      const bindGroup = this.device.createBindGroup({
        layout: this.hammingPipeline!.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: targetBuffer } },
          { binding: 1, resource: { buffer: databaseBuffer } },
          { binding: 2, resource: { buffer: distancesBuffer } },
          { binding: 3, resource: { buffer: paramsBuffer } }
        ]
      });

      // Execute
      const commandEncoder = this.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(this.hammingPipeline!);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.dispatchWorkgroups(Math.ceil(numHashes / 64));
      passEncoder.end();

      commandEncoder.copyBufferToBuffer(
        distancesBuffer,
        0,
        distancesStagingBuffer,
        0,
        numHashes * 4
      );

      this.device.queue.submit([commandEncoder.finish()]);

      // Read results
      await distancesStagingBuffer.mapAsync(GPUMapMode.READ);
      const distances = new Uint32Array(
        distancesStagingBuffer.getMappedRange().slice(0)
      );
      distancesStagingBuffer.unmap();

      // Cleanup
      targetBuffer.destroy();
      databaseBuffer.destroy();
      distancesBuffer.destroy();
      distancesStagingBuffer.destroy();
      paramsBuffer.destroy();

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      return {
        distances,
        processingTime,
        comparisonsPerSecond: (numHashes / processingTime) * 1000
      };

    } catch (error) {
      console.error('Error comparing hashes on GPU:', error);
      throw error;
    }
  }

  /**
   * Check if processor is ready
   */
  isReady(): boolean {
    return this.initialized && this.device !== null;
  }

  /**
   * Get GPU info
   */
  getInfo(): string {
    if (!this.capabilities?.adapter) {
      return 'GPU not available';
    }
    return `WebGPU initialized`;
  }
}

// Singleton instance
let processorInstance: WebGPUImageProcessor | null = null;

export async function getWebGPUProcessor(): Promise<WebGPUImageProcessor> {
  if (!processorInstance) {
    processorInstance = new WebGPUImageProcessor();
    await processorInstance.initialize();
  }
  return processorInstance;
}
