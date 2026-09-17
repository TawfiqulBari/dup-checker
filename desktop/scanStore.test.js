import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import storage from './scanStore.cjs';
const { ScanStore, applyDelta, ALGORITHM } = storage;
let store, directory;
afterEach(async () => {
  store?.close(); store = undefined;
  if (directory) {
    for (const suffix of ['', '-wal', '-shm']) await fs.unlink(path.join(directory, 'scans.sqlite' + suffix)).catch(() => {});
    await fs.rmdir(directory); directory = undefined;
  }
});
async function open() {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dup-cache-test-'));
  store = new ScanStore(path.join(directory, 'scans.sqlite'));
}
const entry = (id, overrides = {}) => ({ absolute: `C:\\photos\\${id}.png`, size: 10, mtime: 20, ctime: 30, ino: 40, ...overrides });
const item = (id, overrides) => ({ id, nativeId: id, entry: entry(id, overrides) });

it('retains completed hashes and review choices across a database restart', async () => {
  await open();
  const file = entry('a');
  store.cache(file, { exact: 'abc', visual: '0'.repeat(64) });
  const session = store.create([item('a'), item('b')], [{ absolute: 'C:\\photos' }]);
  store.patch(session.id, { status: 'done', groups: [['a', 'b']], selectedFiles: ['b'], review: { keepers: { 'a\0b': 'a' }, reviewed: ['a\0b'], search: 'photos', scrollY: 400 } });
  store.close(); store = new ScanStore(path.join(directory, 'scans.sqlite'));
  expect(store.cached(file)).toEqual({ exact: 'abc', visual: '0'.repeat(64) });
  expect(store.get(session.id)).toMatchObject({ groups: [['a', 'b']], selectedFiles: ['b'], review: { reviewed: ['a\0b'], scrollY: 400 } });
});

it('invalidates all hashes after size, timestamps, identity, or algorithm changes', async () => {
  await open();
  const file = entry('a'); store.cache(file, { exact: 'abc', visual: '0'.repeat(64) });
  for (const key of ['size', 'mtime', 'ctime', 'ino']) expect(store.cached({ ...file, [key]: file[key] + 1 })).toEqual({});
  store.db.prepare('UPDATE hashes SET algorithm = ?').run('old');
  expect(store.cached(file)).toEqual({});
});

it('preserves unchanged reviews but clears decisions involving changed or removed files', () => {
  const session = { algorithm: ALGORITHM, manifest: [item('a'), item('b'), item('c'), item('d')], selectedFiles: ['b', 'c', 'd'], review: { reviewed: ['a\0b', 'c\0d'], keepers: { 'a\0b': 'a', 'c\0d': 'd' } } };
  applyDelta(session, [item('a'), item('b'), item('c', { size: 11 }), item('e')]);
  expect(session.delta).toEqual({ unchanged: 2, added: 1, changed: 1, removed: 1 });
  expect(session.review.reviewed).toEqual(['a\0b']);
  expect(session.review.keepers).toEqual({ 'a\0b': 'a' });
  expect(session.selectedFiles).toEqual(['b']);
});

it('lists an interrupted scan as resumable and keeps hashes after forgetting results', async () => {
  await open();
  store.cache(entry('a'), { exact: 'abc' });
  const session = store.create([item('a'), item('b')], [{ absolute: 'C:\\photos' }]);
  store.patch(session.id, { progress: { status: 'Hashing', processed: 1, total: 2 } });
  store.close(); store = new ScanStore(path.join(directory, 'scans.sqlite'));
  expect(store.cached(entry('b'))).toEqual({});
  expect(store.list()[0]).toMatchObject({ status: 'paused', progress: { processed: 1, total: 2 } });
  store.forget(session.id);
  expect(store.list()).toEqual([]);
  expect(store.cached(entry('a'))).toEqual({ exact: 'abc' });
});

it('keeps complete results for a no-change refresh, but resumes an interrupted scan', () => {
  const session = { algorithm: ALGORITHM, manifest: [item('a'), item('b')], status: 'done', selectedFiles: ['b'], groups: [['a', 'b']], review: { scrollY: 400 } };
  applyDelta(session, [item('a'), item('b')]);
  expect(session.status).toBe('done');
  expect(session.review.scrollY).toBe(400);
  session.status = 'paused';
  applyDelta(session, [item('a'), item('b')]);
  expect(session.status).toBe('scanning');
  session.status = 'done'; session.algorithm = 'old';
  applyDelta(session, [item('a'), item('b')]);
  expect(session.status).toBe('scanning');
  expect(session.selectedFiles).toEqual([]);
});
