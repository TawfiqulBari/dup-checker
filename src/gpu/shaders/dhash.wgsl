/**
 * WebGPU Compute Shader: dHash (Difference Hash) Computation
 *
 * Computes 64-bit perceptual hash from 9×8 grayscale image
 * Each bit represents whether a pixel is brighter than its right neighbor
 *
 * Input: 9×8 grayscale buffer (72 floats)
 * Output: 2×u32 (64-bit hash as two 32-bit integers)
 */

@group(0) @binding(0) var<storage, read> grayscale: array<f32>;  // 9×8 = 72 pixels
@group(0) @binding(1) var<storage, read_write> hash_output: array<u32>;  // 2 elements (64-bit)

// Each thread computes one row of the hash (8 bits)
@compute @workgroup_size(8, 1)
fn compute_dhash(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;

  if (row >= 8u) {
    return;
  }

  var row_bits: u32 = 0u;

  // Compare 8 adjacent pixel pairs in this row
  for (var col: u32 = 0u; col < 8u; col = col + 1u) {
    let index = row * 9u + col;
    let left_pixel = grayscale[index];
    let right_pixel = grayscale[index + 1u];

    // Set bit if left pixel is brighter than right pixel
    if (left_pixel > right_pixel) {
      row_bits = row_bits | (1u << col);
    }
  }

  // Write 8 bits to appropriate position in 64-bit hash
  // First 4 rows go to hash_output[0], last 4 rows go to hash_output[1]
  if (row < 4u) {
    // Atomic OR to safely combine bits from multiple threads
    atomicOr(&hash_output[0], row_bits << (row * 8u));
  } else {
    atomicOr(&hash_output[1], row_bits << ((row - 4u) * 8u));
  }
}

/**
 * Alternative single-threaded version (simpler, slightly slower)
 * Use this if atomic operations cause issues
 */
@compute @workgroup_size(1)
fn compute_dhash_single(@builtin(global_invocation_id) global_id: vec3<u32>) {
  var hash_low: u32 = 0u;   // Bits 0-31
  var hash_high: u32 = 0u;  // Bits 32-63

  var bit_index: u32 = 0u;

  // Process all 8 rows
  for (var row: u32 = 0u; row < 8u; row = row + 1u) {
    // Compare 8 adjacent pixel pairs
    for (var col: u32 = 0u; col < 8u; col = col + 1u) {
      let index = row * 9u + col;
      let left_pixel = grayscale[index];
      let right_pixel = grayscale[index + 1u];

      // Set bit if left > right
      if (left_pixel > right_pixel) {
        if (bit_index < 32u) {
          hash_low = hash_low | (1u << bit_index);
        } else {
          hash_high = hash_high | (1u << (bit_index - 32u));
        }
      }

      bit_index = bit_index + 1u;
    }
  }

  // Write final hash
  hash_output[0] = hash_low;
  hash_output[1] = hash_high;
}
