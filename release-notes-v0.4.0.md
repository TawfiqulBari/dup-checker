# Dup-Checker 0.4.0 — Saved Scans and Incremental Updates

Work through a large folder over multiple sessions without losing completed scan work or review choices.

## Download

- **Dup-Checker-Setup-0.4.0-x64.exe** — Windows installer.
- **Dup-Checker-Portable-0.4.0-x64.exe** — run without installing.
- **SHA256SUMS.txt** — download checksums.

## New workflow

1. Scan one folder or compare two folders. Completed file hashes are saved automatically.
2. Use **Pause and save**, or close the app. On return, choose **Continue scan** from **Saved scans**.
3. For a finished scan, choose **Open results** to restore results, selections, keeper choices, filters, and review position without rescanning.
4. Mark sets as **Reviewed** and filter to **Not reviewed yet** to continue where you left off.
5. Choose **Update changes** to process new/changed files, remove missing files from results, and reuse unchanged hashes. With no changes and no previous scan issues, complete results are reused without repeating comparisons.

## Persistence and limits

Snapshots and hashes are stored locally in SQLite; media files are not copied or uploaded. File size, timestamps, identity, and algorithm version determine cache validity. Files are independently checked before recycling. Reviews involving changed files are cleared during updates.

Resume is at completed-file granularity: an unfinished file restarts, and the comparison pass is rebuilt. Folder discovery runs again when updating or resuming. Opening saved results shows the previous snapshot until you choose Update changes. Browser scans are not persisted.

Retains adaptive GPU comparison with CPU fallback, native two-folder selection, and Recycle Bin cleanup. The Windows builds are unsigned.

## Validation

36 automated tests cover persistence across database restarts, partial scans, cache invalidation, delta updates, unchanged-result reuse, and restored review controls, alongside the existing regression suite. Electron checks verify native cache reuse, saved-review restoration, changed/added/deleted file detection, visual-hash persistence, and GPU/CPU operation.
