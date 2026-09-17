/// <reference types="@webgpu/types" />

export interface AccelerationStatus { mode: 'detecting' | 'gpu' | 'cpu'; device: string; detail: string; batches: number }
let status: AccelerationStatus = { mode: 'detecting', device: '', detail: 'Detecting graphics hardware…', batches: 0 };
const listeners = new Set<() => void>();
export const getAccelerationStatus = () => status;
export const subscribeAcceleration = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function update(change: Partial<AccelerationStatus>) { status = { ...status, ...change }; listeners.forEach(listener => listener()); }

// One invocation compares one 64-bit hash; video frames use the same kernel.
const shader = `
@group(0) @binding(0) var<storage, read> targets: array<vec2<u32>>;
@group(0) @binding(1) var<storage, read> candidates: array<vec2<u32>>;
@group(0) @binding(2) var<storage, read_write> distances: array<u32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= arrayLength(&candidates)) { return; }
  let bits = targets[id.x % arrayLength(&targets)] ^ candidates[id.x];
  distances[id.x] = countOneBits(bits.x) + countOneBits(bits.y);
}`;
let device: GPUDevice | undefined;
let pipeline: GPUComputePipeline | undefined;
let initialization: Promise<void> | undefined;

export function cpuDistances(targets: string[], candidates: string[]): number[] {
  return candidates.map((hash, index) => {
    const target = targets[index % targets.length];
    let distance = 0;
    for (let bit = 0; bit < 64; bit++) if (hash[bit] !== target[bit]) distance++;
    return distance;
  });
}
function pack(hashes: string[]): Uint32Array<ArrayBuffer> {
  const packed = new Uint32Array(hashes.length * 2);
  hashes.forEach((hash, index) => { packed[index * 2] = parseInt(hash.slice(0, 32), 2); packed[index * 2 + 1] = parseInt(hash.slice(32), 2); });
  return packed;
}
async function gpuDistances(targets: string[], candidates: string[]): Promise<number[]> {
  const active = device!;
  const buffers: GPUBuffer[] = [];
  const buffer = (size: number, usage: GPUBufferUsageFlags) => { const result = active.createBuffer({ size, usage }); buffers.push(result); return result; };
  active.pushErrorScope('validation');
  try {
    const targetBuffer = buffer(targets.length * 8, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    const candidateBuffer = buffer(candidates.length * 8, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    const output = buffer(candidates.length * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    const staging = buffer(candidates.length * 4, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ);
    active.queue.writeBuffer(targetBuffer, 0, pack(targets));
    active.queue.writeBuffer(candidateBuffer, 0, pack(candidates));
    const encoder = active.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline!);
    pass.setBindGroup(0, active.createBindGroup({ layout: pipeline!.getBindGroupLayout(0), entries: [targetBuffer, candidateBuffer, output].map((value, binding) => ({ binding, resource: { buffer: value } })) }));
    pass.dispatchWorkgroups(Math.ceil(candidates.length / 64));
    pass.end();
    encoder.copyBufferToBuffer(output, 0, staging, 0, candidates.length * 4);
    active.queue.submit([encoder.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const result = Array.from(new Uint32Array(staging.getMappedRange()));
    staging.unmap();
    return result;
  } finally {
    const error = await active.popErrorScope();
    buffers.forEach(buffer => buffer.destroy());
    if (error) throw new Error(error.message);
  }
}

export function initializeAcceleration(): Promise<void> {
  initialization ??= (async () => {
    try {
      if (typeof window === 'undefined' || !window.desktopAPI || !navigator.gpu) throw new Error('WebGPU is unavailable; using CPU.');
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter || adapter.info.isFallbackAdapter) throw new Error('No supported hardware GPU found; using CPU.');
      device = await adapter.requestDevice();
      device.lost.then(() => { device = undefined; pipeline = undefined; update({ mode: 'cpu', detail: 'GPU disconnected or reset. Continuing on CPU.' }); });
      pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module: device.createShaderModule({ code: shader }), entryPoint: 'main' } });
      const targets = ['0'.repeat(64), '1'.repeat(64)];
      const candidates = ['1'.repeat(64), '1'.repeat(64), '01'.repeat(32), '0'.repeat(64)];
      if (JSON.stringify(await gpuDistances(targets, candidates)) !== JSON.stringify(cpuDistances(targets, candidates))) throw new Error('GPU self-check failed; using CPU.');
      const info = adapter.info;
      const hardware = await window.desktopAPI.gpuInfo();
      const nativeDevice = hardware.find(item => item.deviceId === Number(info.device)) || hardware.find(item => item.active);
      update({ mode: 'gpu', device: info.description || nativeDevice?.deviceString || `${info.vendor} ${info.architecture}`.trim() || 'WebGPU graphics adapter', detail: 'GPU verified. Large comparison batches use GPU; small batches use CPU.' });
    } catch (error) {
      device?.destroy(); device = undefined; pipeline = undefined;
      update({ mode: 'cpu', detail: error instanceof Error ? error.message : 'GPU unavailable; using CPU.' });
    }
  })();
  return initialization;
}

export async function compareHashes(targets: string[], candidates: string[], signal?: AbortSignal): Promise<number[]> {
  if (!candidates.length) return [];
  if (!targets.length || targets.length > 16384 || [...targets, ...candidates].some(hash => !/^[01]{64}$/.test(hash))) throw new Error('Invalid perceptual hash');
  await initializeAcceleration();
  const output: number[] = [];
  // Keep buffers bounded, aligned with the video frame count.
  const chunkSize = Math.floor(16384 / targets.length) * targets.length;
  for (let start = 0; start < candidates.length; start += chunkSize) {
    signal?.throwIfAborted();
    const chunk = candidates.slice(start, start + chunkSize);
    if (device && pipeline && chunk.length >= 256) {
      try {
        output.push(...await gpuDistances(targets, chunk));
        update({ batches: status.batches + 1 });
        continue;
      } catch {
        device?.destroy(); device = undefined; pipeline = undefined;
        update({ mode: 'cpu', detail: 'GPU processing failed. Continuing on CPU.' });
      }
    }
    output.push(...cpuDistances(targets, chunk));
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return output;
}

export async function accelerationSelfTest() {
  await initializeAcceleration();
  const targets = ['0'.repeat(64), '1'.repeat(64)];
  const candidates = Array.from({ length: 1024 }, (_, index) => index % 3 ? '01'.repeat(32) : '1'.repeat(64));
  const actual = await compareHashes(targets, candidates);
  return { ok: JSON.stringify(actual) === JSON.stringify(cpuDistances(targets, candidates)), ...getAccelerationStatus(), comparisons: actual.length };
}
