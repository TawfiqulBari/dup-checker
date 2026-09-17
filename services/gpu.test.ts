import { expect, it } from 'vitest';
import { cpuDistances, compareHashes, getAccelerationStatus } from './gpu';

it('compares all 64 bits including zero-valued hashes', () => {
  expect(cpuDistances(['0'.repeat(64)], ['0'.repeat(64), '1'.repeat(64), '01'.repeat(32)])).toEqual([0, 64, 32]);
});
it('aligns video frame hashes with each corresponding frame', () => {
  expect(cpuDistances(['0'.repeat(64), '1'.repeat(64)], ['0'.repeat(64), '1'.repeat(64), '1'.repeat(64), '0'.repeat(64)])).toEqual([0, 0, 64, 64]);
});
it('uses CPU fallback when WebGPU is unavailable', async () => {
  expect(await compareHashes(['0'.repeat(64)], Array(300).fill('1'.repeat(64)))).toEqual(Array(300).fill(64));
  expect(getAccelerationStatus().mode).toBe('cpu');
});
it('rejects invalid hashes and respects cancellation', async () => {
  await expect(compareHashes(['bad'], ['0'.repeat(64)])).rejects.toThrow('Invalid');
  const controller = new AbortController(); controller.abort();
  await expect(compareHashes(['0'.repeat(64)], ['1'.repeat(64)], controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
});
