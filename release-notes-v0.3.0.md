# Dup-Checker 0.3.0 — Adaptive GPU Desktop

A new Windows desktop build based on the updated app, with a fresh GPU comparison implementation and native folder access.

## Download and use

- **Dup-Checker-Setup-0.3.0-x64.exe**: Windows installer with Start menu/desktop shortcuts.
- **Dup-Checker-Portable-0.3.0-x64.exe**: Run without installing.
- **SHA256SUMS.txt**: Checksums for both downloads.

Open the app, select one folder or choose **Compare two folders**, review matches, choose which file to **Keep**, and click **Recycle selected**. No terminal, Node.js, or browser setup is needed.

## What changed

- Automatically detects a hardware WebGPU adapter and displays the selected GPU.
- Verifies GPU output against CPU results before enabling acceleration; falls back to CPU if unavailable or if processing fails.
- Uses bounded GPU batches for large image/video perceptual-hash comparisons. Small batches remain on CPU to avoid transfer overhead.
- Streams desktop SHA-256 hashing and media previews from disk.
- Adds two-folder comparison, exact/similar badges, filters, path search, side-by-side viewing, and keeper selection.
- Moves selected copies to the Recycle Bin after native confirmation. No fallback to permanent deletion.
- Adds cancellation, per-file error reporting, and checks for changed files before removal.

## Validation and limits

The build and 27 automated tests passed. Electron checks passed on an NVIDIA GeForce RTX 3060 and with GPU disabled, including GPU/CPU comparison parity, a 300-image scan, native file access, ranged media reads, video playback, and rejection of unconfirmed removal.

GPU acceleration applies to hash comparisons, not the entire scan. Exact hashing uses CPU; decoding depends on Chromium's supported codecs. Video similarity compares ten sampled frames and does not compare audio. Visual matches need review. No fixed performance multiplier is claimed, and other GPU models have not been tested here.

This release is unsigned. Windows may show an unknown-publisher warning. Download only from this repository's release page.
