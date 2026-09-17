# Dup-Checker

Find exact copies and visually similar images and videos in a folder, entirely in your browser. Files are never uploaded, and no API key is required.

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

Only files recognized by the browser as images or videos are scanned. Decoding support depends on your browser and installed codecs. Exact hashing reads one complete file into memory at a time, so very large videos may exceed available memory. Cancelling prevents further work; an in-flight file read or image decode may finish in the background.

## Compare two folders

Choose **Compare two folders** on the welcome screen, pick folder 1 and folder 2, then click **Compare folders**. This mode requires folder access in a supported desktop browser such as Chrome or Edge.

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
