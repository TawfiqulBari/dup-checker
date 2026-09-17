import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import safety from './fileSafety.cjs';

let directory;
afterEach(async () => {
  if (directory) {
    await fs.unlink(path.join(directory, 'fixture.png')).catch(() => {});
    await fs.rmdir(directory);
    directory = undefined;
  }
});
async function fixture() {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dup-safety-test-'));
  const absolute = path.join(await fs.realpath(directory), 'fixture.png');
  await fs.writeFile(absolute, 'original');
  const stat = await fs.stat(absolute);
  return new Map([['registered', { absolute, size: stat.size, mtime: stat.mtimeMs, ino: stat.ino }]]);
}
it('accepts only a registered unchanged file', async () => {
  const files = await fixture();
  expect(await safety.validateRegisteredFile(files, 'registered')).toBe(files.get('registered'));
  await expect(safety.validateRegisteredFile(files, '../fixture.png')).rejects.toThrow('not part');
});
it('rejects modified files before any recycle operation', async () => {
  const files = await fixture();
  await fs.writeFile(files.get('registered').absolute, 'changed contents');
  await expect(safety.validateRegisteredFile(files, 'registered')).rejects.toThrow('changed or was replaced');
});
it('rejects files removed since the scan', async () => {
  const files = await fixture();
  await fs.unlink(files.get('registered').absolute);
  await expect(safety.validateRegisteredFile(files, 'registered')).rejects.toThrow();
});
