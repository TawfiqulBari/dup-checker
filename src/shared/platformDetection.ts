/**
 * Platform detection utilities
 * Used to determine if the app is running in Electron (desktop) or web browser
 */

/**
 * Check if the app is running in Electron
 */
export const isElectron = (): boolean => {
  // Check if electronAPI is available (set by preload script)
  if (typeof window !== 'undefined' && window.electronAPI) {
    return true;
  }

  // Fallback: Check user agent (less reliable)
  if (
    typeof navigator === 'object' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.indexOf('Electron') >= 0
  ) {
    return true;
  }

  return false;
};

/**
 * Check if native file operations are available
 * Only available in Electron with proper IPC setup
 */
export const hasNativeFileOperations = (): boolean => {
  return (
    isElectron() &&
    typeof window !== 'undefined' &&
    typeof window.electronAPI?.deleteFiles === 'function'
  );
};

/**
 * Get the current platform (web or electron)
 */
export const getPlatform = (): 'web' | 'electron' => {
  return isElectron() ? 'electron' : 'web';
};
