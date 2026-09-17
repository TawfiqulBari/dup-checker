import { expect, it, vi } from 'vitest';
import { removeFile } from './folderAccess';
import { FileWithHandle } from '../types';

function fixture(changed = false, replaced = false) {
  const original = new File(['data'], 'copy.png', { lastModified: 1 });
  const removeEntry = vi.fn();
  const handle = { getFile: async () => changed ? new File(['changed'], 'copy.png', { lastModified: 2 }) : original, isSameEntry: async () => !replaced };
  const file = { file: original, handle, parentHandle: { getFileHandle: async () => handle, removeEntry } } as unknown as FileWithHandle;
  return { file, removeEntry };
}

it('removes only the selected entry without recursive deletion', async () => {
  const { file, removeEntry } = fixture();
  await removeFile(file);
  expect(removeEntry).toHaveBeenCalledExactlyOnceWith('copy.png');
});
it('refuses to delete a changed file', async () => {
  const { file, removeEntry } = fixture(true);
  await expect(removeFile(file)).rejects.toThrow('File changed');
  expect(removeEntry).not.toHaveBeenCalled();
});
it('refuses to delete a replaced file', async () => {
  const { file, removeEntry } = fixture(false, true);
  await expect(removeFile(file)).rejects.toThrow('File was replaced');
  expect(removeEntry).not.toHaveBeenCalled();
});
