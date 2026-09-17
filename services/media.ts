export const checkCancelled = (signal?: AbortSignal) => signal?.throwIfAborted();

export function waitForMedia(element: HTMLMediaElement, event: 'loadedmetadata' | 'seeked', signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      element.removeEventListener(event, ready);
      element.removeEventListener('error', failed);
      signal?.removeEventListener('abort', aborted);
    };
    const ready = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('Media could not be decoded.')); };
    const aborted = () => { cleanup(); reject(new DOMException('Scan cancelled', 'AbortError')); };
    const timer = setTimeout(failed, 15000);
    element.addEventListener(event, ready, { once: true });
    element.addEventListener('error', failed, { once: true });
    signal?.addEventListener('abort', aborted, { once: true });
    if (signal?.aborted) aborted();
  });
}
