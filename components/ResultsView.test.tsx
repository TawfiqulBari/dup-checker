// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResultsView from './ResultsView';
import { DuplicateGroup, FileWithHandle } from '../types';
import { removeFile, validateFile } from '../services/folderAccess';

vi.mock('../services/folderAccess', () => ({ removeFile: vi.fn().mockResolvedValue(undefined), validateFile: vi.fn().mockResolvedValue(undefined) }));
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

function file(id: string, size: number, hash?: string): FileWithHandle {
  return { id, path: `photos/${id}`, file: new File(['x'], id, { type: 'image/png' }), metadata: { size }, contentHash: hash, thumbnail: 'test.png', handle: {} as FileSystemFileHandle, parentHandle: {} as FileSystemDirectoryHandle };
}
function Harness() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([[file('a', 10, 'same'), file('b', 10, 'same')], [file('c', 5), file('d', 2)]]);
  const [selected, setSelected] = useState(new Set<string>());
  return <ResultsView duplicateGroups={groups} selectedFiles={selected} onSelectionChange={setSelected} onNewScan={() => {}} onFilesRemoved={removed => {
    setGroups(current => current.map(group => group.filter(file => !removed.has(file.id))).filter(group => group.length > 1));
    setSelected(new Set());
  }} />;
}

it('filters exact matches and warns about hidden selections', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('checkbox', { name: 'Select photos/b' }));
  await user.selectOptions(screen.getByLabelText('Match type'), 'similar');
  expect(screen.queryByRole('checkbox', { name: 'Select photos/b' })).toBeNull();
  expect(screen.getByText(/1 selected file\(s\) are hidden/)).toBeTruthy();
  await user.type(screen.getByRole('searchbox'), 'missing');
  expect(screen.getByText(/No matches for these filters/)).toBeTruthy();
});

it('changes the keeper in comparison and protects it during removal', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('checkbox', { name: 'Select photos/d' }));
  await user.click(screen.getAllByRole('button', { name: 'Compare' })[1]);
  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'Keep this file instead' }));
  await user.click(within(dialog).getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('checkbox', { name: 'Select photos/d' })).toBeNull();
  await user.click(screen.getByRole('checkbox', { name: 'Select photos/c' }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await user.click(screen.getByRole('button', { name: 'Remove selected (1)' }));
  expect(validateFile).toHaveBeenCalledWith(expect.objectContaining({ id: 'd' }));
  expect(removeFile).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'c' }));
});

it('does not remove files when confirmation is cancelled', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('checkbox', { name: 'Select photos/b' }));
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  await user.click(screen.getByRole('button', { name: 'Remove selected (1)' }));
  expect(removeFile).not.toHaveBeenCalled();
});
