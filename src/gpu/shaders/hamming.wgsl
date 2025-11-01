/**
 * WebGPU Compute Shader: Parallel Hamming Distance Computation
 *
 * Computes Hamming distances between one target hash and a batch of hashes
 * Optimized for comparing one new image against thousands of existing images
 *
 * Input:
 *   - target_hash: 2×u32 (64-bit hash to compare)
 *   - hash_database: array of 2×u32 pairs (many 64-bit hashes)
 * Output:
 *   - distances: array of u32 (Hamming distance for each comparison)
 */

struct ComparisonParams {
  num_hashes: u32,
  similarity_threshold: u32,  // Max Hamming distance to consider similar
  padding0: u32,
  padding1: u32,
}

@group(0) @binding(0) var<storage, read> target_hash: array<u32>;  // 2 elements
@group(0) @binding(1) var<storage, read> hash_database: array<u32>;  // num_hashes * 2 elements
@group(0) @binding(2) var<storage, read_write> distances: array<u32>;  // num_hashes elements
@group(0) @binding(3) var<uniform> params: ComparisonParams;

// Count number of 1-bits in a 32-bit integer (population count)
fn popcount(x: u32) -> u32 {
  var n = x;
  n = n - ((n >> 1u) & 0x55555555u);
  n = (n & 0x33333333u) + ((n >> 2u) & 0x33333333u);
  n = (n + (n >> 4u)) & 0x0F0F0F0Fu;
  n = n + (n >> 8u);
  n = n + (n >> 16u);
  return n & 0x3Fu;
}

// Compute Hamming distance between two 64-bit hashes
fn hamming_distance_64(hash_a_low: u32, hash_a_high: u32, hash_b_low: u32, hash_b_high: u32) -> u32 {
  let xor_low = hash_a_low ^ hash_b_low;
  let xor_high = hash_a_high ^ hash_b_high;
  return popcount(xor_low) + popcount(xor_high);
}

@compute @workgroup_size(64)
fn compute_hamming_batch(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;

  if (index >= params.num_hashes) {
    return;
  }

  // Load target hash (same for all threads)
  let target_low = target_hash[0];
  let target_high = target_hash[1];

  // Load database hash for this thread
  let db_offset = index * 2u;
  let db_low = hash_database[db_offset];
  let db_high = hash_database[db_offset + 1u];

  // Compute Hamming distance
  let distance = hamming_distance_64(target_low, target_high, db_low, db_high);

  // Write result
  distances[index] = distance;
}

/**
 * Alternative version that also filters by threshold
 * Only writes match indices for hashes within similarity threshold
 */

@group(1) @binding(0) var<storage, read_write> match_indices: array<atomic<u32>>;  // Matched hash indices
@group(1) @binding(1) var<storage, read_write> match_count: atomic<u32>;  // Total matches found

@compute @workgroup_size(64)
fn compute_hamming_filter(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;

  if (index >= params.num_hashes) {
    return;
  }

  // Load target hash
  let target_low = target_hash[0];
  let target_high = target_hash[1];

  // Load database hash
  let db_offset = index * 2u;
  let db_low = hash_database[db_offset];
  let db_high = hash_database[db_offset + 1u];

  // Compute Hamming distance
  let distance = hamming_distance_64(target_low, target_high, db_low, db_high);

  // Write distance
  distances[index] = distance;

  // If below threshold, add to match list
  if (distance <= params.similarity_threshold) {
    let match_idx = atomicAdd(&match_count, 1u);
    match_indices[match_idx] = index;
  }
}

/**
 * Matrix comparison version: compares all pairs in a batch
 * Useful for finding duplicates within a newly scanned set
 *
 * Output: distances[i * num_hashes + j] = distance between hash[i] and hash[j]
 */

@compute @workgroup_size(8, 8)
fn compute_hamming_matrix(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  let j = global_id.y;

  if (i >= params.num_hashes || j >= params.num_hashes) {
    return;
  }

  // Skip diagonal and upper triangle (symmetric matrix)
  if (i >= j) {
    return;
  }

  // Load both hashes
  let hash_i_offset = i * 2u;
  let hash_i_low = hash_database[hash_i_offset];
  let hash_i_high = hash_database[hash_i_offset + 1u];

  let hash_j_offset = j * 2u;
  let hash_j_low = hash_database[hash_j_offset];
  let hash_j_high = hash_database[hash_j_offset + 1u];

  // Compute distance
  let distance = hamming_distance_64(hash_i_low, hash_i_high, hash_j_low, hash_j_high);

  // Write to matrix (lower triangle only)
  let matrix_index = i * params.num_hashes + j;
  distances[matrix_index] = distance;
}
