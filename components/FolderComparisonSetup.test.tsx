// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FolderComparisonSetup from './FolderComparisonSetup';
import { getDirectoryPicker, readFolder } from '../services/folderAccess';

vi.mock('../services/folderAccess', () => ({ getDirectoryPicker: vi.fn(), readFolder: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function folder(name: string, same = false) {
  return { name, isSameEntry: async () => same, resolve: async () => null } as unknown as FileSystemDirectoryHandle;
}
it('compares two folders with distinct file identities even when names match', async () => {
  const user = userEvent.setup();
  const pick = vi.fn().mockResolvedValueOnce(folder('photos')).mockResolvedValueOnce(folder('photos'));
  vi.mocked(getDirectoryPicker).mockReturnValue(pick);
  vi.mocked(readFolder).mockResolvedValue([{ id: 'photos/a.png', path: 'photos/a.png', file: new File(['x'], 'a.png'), metadata: { size: 1 }, thumbnail: '' }]);
  const onScan = vi.fn();
  render(<FolderComparisonSetup onScan={onScan} onBack={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: /Choose folder 1/ }));
  await user.click(screen.getByRole('button', { name: /Choose folder 2/ }));
  await user.click(screen.getByRole('button', { name: 'Compare folders' }));
  expect(onScan).toHaveBeenCalledWith([
    expect.objectContaining({ id: 'first:photos/a.png', folderSide: 'first' }),
    expect.objectContaining({ id: 'second:photos/a.png', folderSide: 'second' }),
  ]);
});
it('rejects selecting the same folder twice', async () => {
  const user = userEvent.setup();
  vi.mocked(getDirectoryPicker).mockReturnValue(vi.fn().mockResolvedValue(folder('photos', true)));
  render(<FolderComparisonSetup onScan={vi.fn()} onBack={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: /Choose folder 1/ }));
  await user.click(screen.getByRole('button', { name: /Choose folder 2/ }));
  expect(screen.getByRole('alert').textContent).toContain('Choose two separate folders');
  expect((screen.getByRole('button', { name: 'Compare folders' }) as HTMLButtonElement).disabled).toBe(true);
});
