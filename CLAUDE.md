# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dup-Checker is a duplicate file detection application available in two deployment modes:

1. **Web Application**: Pure frontend SPA running in the browser
2. **Desktop Application**: Electron-based native app for Windows, macOS, and Linux

All file hashing, duplicate detection, and processing happens client-side (browser or Electron renderer process) using perceptual hashing (dHash).

**Key Architectural Note:** The project uses a **dual deployment strategy** with shared codebase. The web version runs in browsers, while the desktop version adds native file deletion capabilities via Electron IPC.

## Development Commands

### Web Development
```bash
# Install dependencies
npm install

# Run web dev server (default: http://localhost:5173)
npm run dev

# Build web version for production (outputs to dist/)
npm run build

# Preview web production build
npm run preview
```

### Desktop (Electron) Development
```bash
# Run Electron app in development mode with hot reload
npm run dev:electron

# Build and package desktop app (outputs to dist-electron/packaged/)
npm run build:electron

# Preview Electron build
npm run preview:electron
```

## Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# The app uses:
# - Multi-stage Dockerfile (Node.js build → nginx serve)
# - Port 8080 exposed
# - Traefik-proxy network for reverse proxy integration
```

## Architecture

### Project Structure (Dual Deployment)

```
dup-checker/
├── src/
│   ├── main/                    # Electron main process (Node.js)
│   │   ├── index.ts            # Electron app entry point
│   │   └── fileOperations.ts   # IPC handlers for file deletion
│   ├── preload/                 # Preload scripts (security bridge)
│   │   └── index.ts            # contextBridge API exposure
│   ├── renderer/                # React application (runs in both)
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── services/
│   │   │   └── hashingService.ts
│   │   ├── index.tsx
│   │   ├── index.html
│   │   └── index.css
│   └── shared/                  # Shared types and utilities
│       ├── types.ts            # Shared between all contexts
│       └── platformDetection.ts # Environment detection
├── electron.vite.config.ts      # Electron build configuration
├── vite.config.ts               # Web-only build configuration
├── package.json
├── Dockerfile                   # Web deployment
└── docker-compose.yml          # Web deployment
```

### Electron Process Architecture

**Main Process (src/main/)**
- Runs in Node.js environment
- Creates and manages BrowserWindows
- Handles IPC requests from renderer
- Accesses native file system APIs
- Implements file deletion with confirmation dialogs

**Preload Script (src/preload/)**
- Runs before renderer with access to both Node.js and DOM
- Uses `contextBridge` to safely expose APIs
- Security layer between main and renderer processes
- Exposes `window.electronAPI` object

**Renderer Process (src/renderer/)**
- React application running in Chromium
- Same code used for both web and desktop
- Detects platform via `platformDetection.ts`
- Conditionally uses native features when available

### State Management Flow
- **App.tsx**: Root component managing three states: `idle` → `scanning` → `done`
- **State machine**:
  - `idle`: Shows WelcomeScreen, user selects folder
  - `scanning`: Shows ScanningProgress with real-time updates
  - `done`: Shows ResultsView with duplicate groups

### Duplicate Detection Pipeline (services/hashingService.ts)

1. **Exact Duplicates** (SHA-256 file hash)
   - Groups files with identical byte content
   - Uses Web Crypto API's SubtleCrypto

2. **Perceptual Duplicates** (dHash algorithm)
   - **Images**: 9×8 grayscale comparison, Hamming distance ≤ 5
   - **Videos**: 10 frame samples, 80% frame similarity threshold
   - Uses `createImageBitmap` API for efficient processing

3. **Key Constants**:
   - `HASH_WIDTH = 9`, `HASH_HEIGHT = 8`
   - `VIDEO_FRAMES_TO_CAPTURE = 10`
   - Hamming distance threshold: 5 bits
   - Video similarity threshold: 80%

### File Processing
- Uses `webkitRelativePath` for folder scanning (non-standard API)
- Generates blob URLs for thumbnails via `URL.createObjectURL`
- Extracts metadata (dimensions for images, duration for videos)
- All processing is async with progress callbacks

### Component Structure

```
App.tsx (state machine)
├── WelcomeScreen.tsx (idle state)
├── ScanningProgress.tsx (scanning state)
└── ResultsView.tsx (done state)
    ├── DuplicateGroupCard.tsx (each duplicate set)
    │   └── FileCard.tsx (individual file display)
    └── InstructionsModal.tsx (deletion instructions)
```

### File Deletion Model

**Web Version** (Browser Security Restrictions):
1. Users select duplicate files
2. Click "Copy Paths" to copy file paths to clipboard
3. Instructions modal shows how to delete via terminal (`xargs rm` on Unix)

**Desktop Version** (Native File Operations):
1. Users select duplicate files
2. Click "Delete Selected" button
3. Electron shows native confirmation dialog
4. Main process deletes files using Node.js `fs.unlink`
5. Files are permanently deleted from disk

The UI automatically detects the platform and shows the appropriate button.

## Platform Detection

The app uses `src/shared/platformDetection.ts` to determine the runtime environment:

```typescript
isElectron(): boolean          // Checks if running in Electron
hasNativeFileOperations(): boolean // Checks if native file deletion is available
getPlatform(): 'web' | 'electron'  // Returns current platform
```

**Detection Strategy:**
1. Check for `window.electronAPI` (set by preload script)
2. Fallback to user agent string check
3. Components conditionally render features based on platform

## IPC Communication (Electron Only)

**Exposed APIs (window.electronAPI):**
```typescript
electronAPI.deleteFiles(paths: string[]): Promise<DeleteFilesResult>
electronAPI.platform: string
electronAPI.isElectron: boolean
```

**Security Measures:**
- Context isolation enabled
- `contextBridge` used for safe API exposure
- Path validation to prevent traversal attacks
- User confirmation dialogs before destructive operations
- No direct Node.js API access from renderer

## TypeScript Types (src/shared/types.ts)

```typescript
FileWithHandle: {
  id: string              // Unique identifier
  file: File              // Browser File object
  path: string            // Relative path from selected folder
  metadata: {
    size: number
    dimensions?: { width, height }  // Images only
    duration?: number               // Videos only
  }
  thumbnail: string       // Blob URL
}

DuplicateGroup: FileWithHandle[]  // Array of duplicates
ScanState: 'idle' | 'scanning' | 'done'
```

## Styling
- Tailwind CSS via inline classes (configured in index.css)
- Dark mode support via `dark:` variants
- Uses slate, indigo, and sky color palettes

## Browser APIs Used
- **File System Access API**: Folder selection via `webkitdirectory` attribute
- **Web Crypto API**: SHA-256 hashing (`crypto.subtle.digest`)
- **Canvas API**: Image processing and video frame capture
- **HTMLImageElement/HTMLVideoElement**: Metadata extraction
- **Clipboard API**: Copy file paths (`navigator.clipboard.writeText`)

## Common Development Patterns

### Adding Progress Updates
Always use the `setProgress` callback in hashingService.ts with:
```typescript
setProgress({
  status: "Description...",
  processed: currentCount,
  total: totalCount
})
```

### Adding New Hash Algorithms
1. Implement hash function returning `string` or `string[]`
2. Add to `perceptualHashes` Map in `findDuplicates`
3. Add comparison logic in comparison phase (steps 4-5)
4. Update progress tracking for new phase

### Memory Management
- Always revoke blob URLs when done: `URL.revokeObjectURL(thumbnail)`
- Close bitmaps after use: `bitmap.close()`
- Set `willReadFrequently: true` on video canvas contexts

## Build Outputs

### Web Build (`npm run build`)
- Output directory: `dist/`
- Used by Docker deployment
- Configuration: `vite.config.ts`
- Contains: `index.html`, `assets/*.js`, `assets/*.css`

### Electron Build (`npm run build:electron`)
- Output directory: `dist-electron/packaged/`
- Configuration: `electron.vite.config.ts` + electron-builder
- Generates platform-specific installers:
  - **Windows**: `.exe` (NSIS installer), portable exe
  - **macOS**: `.dmg`, `.zip`
  - **Linux**: `.AppImage`, `.deb`, `.rpm`

## Common Development Tasks

### Adding a New Component
1. Create component in `src/renderer/components/`
2. Import types from `../../shared/types`
3. Follow existing patterns for styling (Tailwind classes)

### Adding Platform-Specific Features
1. Check platform using `hasNativeFileOperations()` from `platformDetection.ts`
2. Render conditionally in components
3. For Electron-only features:
   - Add IPC handler in `src/main/fileOperations.ts`
   - Expose via `src/preload/index.ts` using `contextBridge`
   - Call from renderer using `window.electronAPI`

### Testing Both Platforms
```bash
# Test web version
npm run dev          # Development
npm run build        # Production build

# Test desktop version
npm run dev:electron     # Development (hot reload)
npm run build:electron   # Production build
```

## Known Limitations

### Web Version
- Folder selection uses non-standard `webkitdirectory` attribute
- Cannot delete files directly (browser security model)
- Limited to browser-supported file formats

### Desktop Version
- Requires Electron installation (~150MB app size)
- File deletion is permanent (no recycle bin/trash)
- Platform-specific builds needed for distribution

### Both Versions
- All processing is client-side; large folders (>10k files) may be slow
- Video processing requires full file download to memory
- No GEMINI_API_KEY usage (despite README.md mention - leftover from template)
