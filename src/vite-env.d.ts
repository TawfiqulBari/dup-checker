/// <reference types="vite/client" />
/// <reference types="@webgpu/types" />

// WGSL shader file imports
declare module '*.wgsl' {
  const content: string;
  export default content;
}

declare module '*.wgsl?raw' {
  const content: string;
  export default content;
}

// Electron API type extensions
declare global {
  interface Navigator {
    gpu?: GPU;
  }
}

export {};
