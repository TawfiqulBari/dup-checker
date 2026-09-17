import { describe, expect, it, vi } from 'vitest';
import { calculateFileHash, findDuplicates } from './hashingService';
import { FileWithHandle } from '../types';

const media = (id: string, data: string): FileWithHandle => ({ id, path: id, file: new File([data], id, { type: 'image/png' }), metadata: { size: data.length }, thumbnail: '' });

describe('scan resilience', () => {
  it('hashes content independently of filenames', async () => {
    expect(await calculateFileHash(new File(['abc'], 'a'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('finds exact copies even if they cannot be decoded as media', async () => {
    const files = [media('a', 'same'), media('b', 'same')];
    expect(await findDuplicates(files, vi.fn())).toEqual([files]);
  });
  it('reports a failed file and continues finding other exact copies', async () => {
    const bad = media('bad', 'broken');
    bad.file.arrayBuffer = async () => { throw new Error('Unreadable'); };
    const warn = vi.fn();
    const good = [media('a', 'same'), media('b', 'same')];
    expect(await findDuplicates([bad, ...good], vi.fn(), undefined, warn)).toEqual([good]);
    expect(warn).toHaveBeenCalledWith('Could not read bad');
  });
  it('honors cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(findDuplicates([media('a', 'x')], vi.fn(), controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
