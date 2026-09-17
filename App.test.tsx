// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { findDuplicates } from './services/hashingService';
import { restoreSessionFiles } from './services/desktop';
import { FileWithHandle } from './types';
import { SavedSession } from './services/sessionTypes';

vi.mock('./components/AccelerationStatus', () => ({ default: () => null }));
vi.mock('./services/hashingService', () => ({ findDuplicates: vi.fn() }));
vi.mock('./services/desktop', async importOriginal => ({ ...await importOriginal<typeof import('./services/desktop')>(), restoreSessionFiles: vi.fn() }));
const files: FileWithHandle[] = ['a', 'b'].map(id => ({ id, file: Object.assign(new File(['x'], `${id}.png`, { type: 'image/png' }), { nativeId: id }), path: `photos/${id}.png`, metadata: { size: 1 }, thumbnail: 'test.png', contentHash: 'same' }));
const session = { id: 'saved', status: 'done', label: 'photos', updated: Date.now(), manifest: [], roots: [], groups: [['a', 'b']], selectedFiles: ['a'], review: { keepers: { 'a\0b': 'b' }, reviewed: ['a\0b'] }, warnings: [], progress: { status: 'Done', processed: 2, total: 2 } } as SavedSession;
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  window.desktopAPI = { listSessions: vi.fn().mockResolvedValue([{ ...session, count: 2, groups: 1, reviewed: 1 }]), loadSession: vi.fn().mockResolvedValue(session), refreshSession: vi.fn().mockResolvedValue({ ...session, delta: { unchanged: 2, added: 0, changed: 0, removed: 0 } }), saveSession: vi.fn().mockResolvedValue(undefined), resetScan: vi.fn().mockResolvedValue(undefined) } as unknown as NonNullable<Window['desktopAPI']>;
  vi.mocked(restoreSessionFiles).mockResolvedValue(files);
  vi.mocked(findDuplicates).mockResolvedValue([files]);
});
afterEach(() => { cleanup(); delete window.desktopAPI; vi.clearAllMocks(); vi.restoreAllMocks(); });

it('opens saved results and keeper choices without scanning the folder again', async () => {
  const user = userEvent.setup(); render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Open results' }));
  expect(await screen.findByRole('checkbox', { name: 'Select photos/a.png' })).toBeTruthy();
  expect(screen.queryByRole('checkbox', { name: 'Select photos/b.png' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Reviewed ✓' })).toBeTruthy();
  expect(findDuplicates).not.toHaveBeenCalled();
});

it('updates an existing session rather than creating a new scan', async () => {
  vi.mocked(window.desktopAPI!.refreshSession).mockResolvedValue({ ...session, status: 'scanning', delta: { unchanged: 1, added: 0, changed: 1, removed: 0 } });
  const user = userEvent.setup(); render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Update changes' }));
  await waitFor(() => expect(findDuplicates).toHaveBeenCalledOnce());
  expect(window.desktopAPI!.refreshSession).toHaveBeenCalledWith('saved');
  expect(await screen.findByText(/Update: 1 unchanged/)).toBeTruthy();
  await waitFor(() => expect(window.desktopAPI!.saveSession).toHaveBeenCalledWith('saved', expect.objectContaining({ status: 'done' })));
});

it('reuses complete results without comparisons when the folders have not changed', async () => {
  const user = userEvent.setup(); render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Update changes' }));
  expect(await screen.findByRole('button', { name: 'Reviewed ✓' })).toBeTruthy();
  expect(findDuplicates).not.toHaveBeenCalled();
});
