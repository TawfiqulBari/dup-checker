/**
 * WebGPU Compute Shader: Image Resize + Grayscale Conversion
 *
 * Resizes image to 9×8 pixels and converts to grayscale
 * Optimized for perceptual hashing (dHash) preparation
 *
 * Input: RGBA image data (any size)
 * Output: 9×8 grayscale buffer (72 float values, 0.0-1.0 range)
 */

struct ImageMetadata {
  width: u32,
  height: u32,
  target_width: u32,   // 9 for dHash
  target_height: u32,  // 8 for dHash
}

@group(0) @binding(0) var<storage, read> input_image: array<u32>;  // RGBA8 packed
@group(0) @binding(1) var<storage, read_write> output_gray: array<f32>;  // 9×8 grayscale
@group(0) @binding(2) var<uniform> metadata: ImageMetadata;

// Convert packed RGBA8 to separate channels
fn unpack_rgba(packed: u32) -> vec4<f32> {
  let r = f32((packed >> 0u) & 0xFFu) / 255.0;
  let g = f32((packed >> 8u) & 0xFFu) / 255.0;
  let b = f32((packed >> 16u) & 0xFFu) / 255.0;
  let a = f32((packed >> 24u) & 0xFFu) / 255.0;
  return vec4<f32>(r, g, b, a);
}

// Convert RGB to grayscale using luminance formula
fn rgb_to_gray(rgb: vec3<f32>) -> f32 {
  // ITU-R BT.709 luma coefficients
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

// Bilinear interpolation for smooth resizing
fn sample_bilinear(x: f32, y: f32) -> f32 {
  let x0 = u32(floor(x));
  let y0 = u32(floor(y));
  let x1 = min(x0 + 1u, metadata.width - 1u);
  let y1 = min(y0 + 1u, metadata.height - 1u);

  let fx = fract(x);
  let fy = fract(y);

  // Sample four corner pixels
  let p00_packed = input_image[y0 * metadata.width + x0];
  let p10_packed = input_image[y0 * metadata.width + x1];
  let p01_packed = input_image[y1 * metadata.width + x0];
  let p11_packed = input_image[y1 * metadata.width + x1];

  // Unpack and convert to grayscale
  let p00 = rgb_to_gray(unpack_rgba(p00_packed).rgb);
  let p10 = rgb_to_gray(unpack_rgba(p10_packed).rgb);
  let p01 = rgb_to_gray(unpack_rgba(p01_packed).rgb);
  let p11 = rgb_to_gray(unpack_rgba(p11_packed).rgb);

  // Bilinear interpolation
  let top = mix(p00, p10, fx);
  let bottom = mix(p01, p11, fx);
  return mix(top, bottom, fy);
}

@compute @workgroup_size(9, 8)
fn resize_grayscale(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let x = global_id.x;
  let y = global_id.y;

  // Bounds check
  if (x >= metadata.target_width || y >= metadata.target_height) {
    return;
  }

  // Calculate source coordinates with proper scaling
  let scale_x = f32(metadata.width) / f32(metadata.target_width);
  let scale_y = f32(metadata.height) / f32(metadata.target_height);

  let src_x = (f32(x) + 0.5) * scale_x - 0.5;
  let src_y = (f32(y) + 0.5) * scale_y - 0.5;

  // Sample and write grayscale value
  let gray_value = sample_bilinear(src_x, src_y);
  let output_index = y * metadata.target_width + x;
  output_gray[output_index] = gray_value;
}
