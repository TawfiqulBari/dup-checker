import { afterEach, expect, it, vi } from 'vitest';
import { waitForMedia } from './media';

afterEach(() => vi.useRealTimers());
it('times out stalled media instead of hanging a scan', async () => {
  vi.useFakeTimers();
  const waiting = waitForMedia(new EventTarget() as HTMLMediaElement, 'seeked');
  const assertion = expect(waiting).rejects.toThrow('Media could not be decoded');
  await vi.advanceTimersByTimeAsync(15000);
  await assertion;
});
it('aborts a pending media load', async () => {
  const controller = new AbortController();
  const waiting = waitForMedia(new EventTarget() as HTMLMediaElement, 'loadedmetadata', controller.signal);
  controller.abort();
  await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
});
