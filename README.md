# Dup-Checker

Find exact copies and visually similar images and videos locally, using the Windows desktop app or your browser. Files are never uploaded, and no API key is required.

## Windows desktop app

Download the **Setup** installer or **Portable** executable from [Releases](https://github.com/TawfiqulBari/dup-checker/releases/latest). Run the installer and open Dup-Checker from your Start menu, or open the portable executable directly. No Node.js, terminal, or browser setup is needed for the packaged app.

Select one folder, or choose **Compare two folders**. Review exact/similar matches, use **Compare** for a larger view, choose which copy to **Keep**, and use **Recycle selected** to move unwanted copies to the Windows Recycle Bin. A native confirmation is required. If recycling fails, the app reports the failure and does not fall back to permanent deletion.

### Adaptive GPU processing

The app requests a high-performance WebGPU adapter, identifies the selected GPU, compiles its comparison kernel, and verifies its output against CPU results before enabling acceleration. The header shows the detected device and processing status. Comparison batches with at least 256 hashes use the GPU; smaller batches stay on CPU to avoid transfer overhead. Video frames use the same comparison kernel. GPU failure or unavailable hardware triggers CPU fallback.

Acceleration applies to perceptual-hash **comparisons**. Media decoding and perceptual hash preparation use Chromium/Canvas; exact SHA-256 hashing streams files from disk on CPU. No fixed speedup is promised. Performance depends on the hardware, collection size, codecs, and disk speed.

The desktop bridge grants access only to files discovered inside folders you selected. Changed files are rejected before cleanup; symlinks are skipped. Media previews stream on demand, so large videos do not need to be retained in memory.

The release is unsigned; Windows may show an unknown-publisher warning. Obtain it only from this repository's release page.

### Build the desktop app

For development, use Node.js 22.12+ and run:

```sh
npm ci
npm run desktop
```

To build the Windows x64 installer and portable executable:

```sh
npm run build:windows
```

Outputs are written to the release directory. After building the renderer, run `npm run test:desktop` for an Electron smoke test or `npm run test:desktop -- --disable-gpu` to check CPU fallback. These tests use generated temporary fixtures, not your personal files.


## Run locally

Use Node.js 20.19+ or 22.12+ (or a newer supported release).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Select a folder to include its subfolders. Use a modern browser with folder selection, Canvas, and Web Crypto support. Hosted installations require HTTPS; localhost also works.

## Review results

- Exact copies are detected using SHA-256. Remaining images are compared using a perceptual hash; videos use ten sampled frames.
- Visual matches are suggestions and can be false positives. The method does not compare video audio, and an exact-copy group is not additionally compared against visually similar files.
- Exact copies and visually similar sets have separate labels. Filter by match type, media type, or file/folder path. Hidden selections remain selected, with an explicit reminder above the results.
- Use Compare for a larger side-by-side view, including video playback and modification dates.
- KEEP defaults to the largest file, with paths breaking size ties. Choose Keep this file on a card or in the comparison view to protect a different copy. Changing the keeper deselects it; the former keeper is not automatically selected.
- Select individual copies or toggle all copies in a set. The KEEP file is excluded from selection.
- In desktop browsers with folder access (such as Chrome and Edge), grant folder permission and use Remove selected. A confirmation is required: browser deletion is permanent and does not use the Recycle Bin or Trash. Changed or replaced files are rejected, and the KEEP file is checked before each removal.
- Browsers without folder access offer Copy Paths for manual cleanup. Paths include the selected folder name and are relative to its parent, not absolute paths.
- Cancel a running scan at any time. Unreadable or unsupported media produces scan issues instead of terminating the whole scan.

The browser scans files recognized as images or videos; the desktop app recognizes common media extensions. Decoding support depends on your browser and installed codecs. Browser exact hashing reads one complete file into memory at a time, so very large videos may exceed available memory. Desktop exact hashing streams files from disk. Cancelling prevents further work; an in-flight file read or image decode may finish in the background.

## Compare two folders

Choose **Compare two folders** on the welcome screen, pick folder 1 and folder 2, then click **Compare folders**. This mode is available in the Windows app and in desktop browsers with folder access, such as Chrome or Edge.

Both folders are scanned recursively. Only matching sets containing files from both folders are shown. Cards and the comparison view label files as Folder 1 or Folder 2, including when the folders share a name. The folders must be separate: selecting the same folder twice or nested folders is rejected. You can keep a file from either folder; the largest is kept by default.

## Check and build

```sh
npm test
npm run build
npm run preview
```

The build includes TypeScript checks and locally compiled Tailwind CSS. Runtime assets do not depend on third-party CDNs. Tests cover keeper selection, content hashing, failure recovery, cancellation, and media timeouts.

## Docker

```sh
docker build -t dup-checker .
docker run --rm -p 8080:8080 dup-checker
```

Open http://localhost:8080. Use HTTPS when serving to other computers.
