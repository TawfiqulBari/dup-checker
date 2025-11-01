/**
 * WebGPU initialization and device detection
 * Handles GPU adapter selection and device setup
 */

export interface GPUCapabilities {
  hasWebGPU: boolean;
  adapter: GPUAdapter | null;
  device: GPUDevice | null;
  maxBufferSize: number;
  maxComputeWorkgroupsPerDimension: number;
  supportsTimestampQuery: boolean;
}

let cachedCapabilities: GPUCapabilities | null = null;

/**
 * Initialize WebGPU and detect capabilities
 * Falls back gracefully if WebGPU is not available
 */
export async function initWebGPU(): Promise<GPUCapabilities> {
  // Return cached capabilities if already initialized
  if (cachedCapabilities) {
    return cachedCapabilities;
  }

  const capabilities: GPUCapabilities = {
    hasWebGPU: false,
    adapter: null,
    device: null,
    maxBufferSize: 0,
    maxComputeWorkgroupsPerDimension: 0,
    supportsTimestampQuery: false
  };

  try {
    // Check if WebGPU is available
    if (!navigator.gpu) {
      console.warn('WebGPU is not supported in this environment');
      cachedCapabilities = capabilities;
      return capabilities;
    }

    // Request GPU adapter (prefer high-performance GPU)
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });

    if (!adapter) {
      console.warn('Failed to get WebGPU adapter');
      cachedCapabilities = capabilities;
      return capabilities;
    }

    // Log adapter info
    const adapterInfo = await adapter.requestAdapterInfo();
    console.log('WebGPU Adapter:', {
      vendor: adapterInfo.vendor,
      architecture: adapterInfo.architecture,
      device: adapterInfo.device,
      description: adapterInfo.description
    });

    // Request device with required features
    const requiredFeatures: GPUFeatureName[] = [];
    if (adapter.features.has('timestamp-query')) {
      requiredFeatures.push('timestamp-query');
    }

    const device = await adapter.requestDevice({
      requiredFeatures,
      requiredLimits: {
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxBufferSize: adapter.limits.maxBufferSize,
        maxComputeWorkgroupsPerDimension: adapter.limits.maxComputeWorkgroupsPerDimension
      }
    });

    // Handle device loss
    device.lost.then((info) => {
      console.error('WebGPU device was lost:', info.message);
      cachedCapabilities = null; // Reset cache to allow reinitialization
    });

    // Populate capabilities
    capabilities.hasWebGPU = true;
    capabilities.adapter = adapter;
    capabilities.device = device;
    capabilities.maxBufferSize = device.limits.maxBufferSize;
    capabilities.maxComputeWorkgroupsPerDimension = device.limits.maxComputeWorkgroupsPerDimension;
    capabilities.supportsTimestampQuery = device.features.has('timestamp-query');

    console.log('WebGPU initialized successfully', {
      maxBufferSize: capabilities.maxBufferSize,
      maxComputeWorkgroups: capabilities.maxComputeWorkgroupsPerDimension,
      supportsTimestampQuery: capabilities.supportsTimestampQuery
    });

    cachedCapabilities = capabilities;
    return capabilities;

  } catch (error) {
    console.error('Error initializing WebGPU:', error);
    cachedCapabilities = capabilities;
    return capabilities;
  }
}

/**
 * Get cached GPU capabilities without re-initializing
 */
export function getGPUCapabilities(): GPUCapabilities | null {
  return cachedCapabilities;
}

/**
 * Reset GPU capabilities (useful for testing or after device loss)
 */
export function resetGPUCapabilities(): void {
  cachedCapabilities = null;
}

/**
 * Check if GPU acceleration is available
 */
export function isGPUAvailable(): boolean {
  return cachedCapabilities?.hasWebGPU ?? false;
}
