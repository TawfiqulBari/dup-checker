# Detailed Task Breakdown: Dup-Checker

This document breaks down the development work into specific tasks for both the backend and frontend, based on the phases outlined in the PLAN.

## Phase 1: Project Setup and Basic UI

### Backend

- [ ] **B-1.1:** Initialize the Node.js project with `npm init`.
- [ ] **B-1.2:** Install dependencies: `express`, `cors`, `typescript`, `ts-node`, `@types/node`, `@types/express`, `@types/cors`.
- [ ] **B-1.3:** Create a `src/index.ts` file with a basic Express server setup.
- [ ] **B-1.4:** Add a `dev` script to `package.json` to run the server using `ts-node`.

### Frontend

- [ ] **F-1.1:** Create the React project using `npm create vite@latest dup-checker-ui -- --template react-ts`.
- [ ] **F-1.2:** Install Material-UI dependencies: `@mui/material`, `@emotion/react`, `@emotion/styled`.
- [ ] **F-1.3:** Create a `components/Layout.tsx` component with a header and main content area.
- [ ] **F-1.4:** Create a `pages/HomePage.tsx` component that includes a prominent "Select Folder" button.

## Phase 2: Core Scanning and Image Duplicate Detection

### Backend

- [ ] **B-2.1:** Implement the `POST /api/scan/start` endpoint that accepts a directory path.
- [ ] **B-2.2:** Create a file system scanning service to recursively find all image files.
- [ ] **B-2.3:** Install and configure `sharp` for image processing and `imghash` for perceptual hashing.
- [ ] **B-2.4:** Implement the image hashing logic and the comparison algorithm to find duplicates.
- [ ] **B-2.5:** Implement the `GET /api/scan/status/:scanId` endpoint to provide scan progress and results.

### Frontend

- [ ] **F-2.1:** Implement the API call to `POST /api/scan/start` when the "Select Folder" button is clicked.
- [ ] **F-2.2:** Create a `pages/ResultsPage.tsx` component to display the scan results.
- [ ] **F-2.3:** Create a `components/DuplicateSet.tsx` component to render a single group of duplicate files.
- [ ] **F-2.4:** Implement the logic to fetch and display the results from the `/api/scan/status/:scanId` endpoint.

## Phase 3: Video Duplicate Detection and Deletion

### Backend

- [ ] **B-3.1:** Install `fluent-ffmpeg` and its dependencies.
- [ ] **B-3.2:** Implement the logic to extract frames from video files.
- [ ] **B-3.3:** Integrate the video frame hashing and sequence comparison into the scanning service.
- [ ] **B-3.4:** Create the `DELETE /api/files` endpoint to handle file deletion requests.

### Frontend

- [ ] **F-3.1:** Add logic to handle and display video thumbnails in the `DuplicateSet.tsx` component.
- [ ] **F-3.2:** Add checkboxes to each file in the `DuplicateSet.tsx` component to allow for selection.
- [ ] **F-3.3:** Implement a "Delete Selected" button and a confirmation dialog.
- [ ] **F-3.4:** Implement the API call to `DELETE /api/files` and update the UI after deletion.

## Phase 4: Polishing and Refinements

### Backend

- [ ] **B-4.1:** Implement a global error handling middleware in the Express application.
- [ ] **B-4.2:** Review and optimize the performance of the file scanning and hashing algorithms.

### Frontend

- [ ] **F-4.1:** Create a `components/ProgressBar.tsx` component.
- [ ] **F-4.2:** Implement polling on the `ResultsPage.tsx` to update the progress bar based on the scan status.
- [ ] **F-4.3:** Add user-friendly error notifications for API failures (e.g., using snackbars from Material-UI).

## Phase 5: Packaging and Documentation

### Documentation

- [ ] **D-5.1:** Create a comprehensive `README.md` file with detailed setup, installation, and usage instructions.
- [ ] **D-5.2:** Add JSDoc or TSDoc comments to complex functions and components in the codebase.
- [ ] **D-5.3:** Perform a final review of all documentation and code for clarity and correctness.
