# Development and Deployment Plan: Dup-Checker

This plan is divided into several phases, allowing for iterative development and testing.

## Phase 1: Project Setup and Basic UI (1-2 days)

*   **Goal:** Establish the foundational structure for both the frontend and backend.
*   **Frontend Tasks:**
    *   Initialize a new React project using Vite with the TypeScript template.
    *   Install and configure Material-UI.
    *   Create a basic application layout with a header and a main content area.
    *   Implement a placeholder "Select Folder" button on the main page.
*   **Backend Tasks:**
    *   Initialize a new Node.js project (`npm init`).
    *   Install Express.js and set up a basic server.
    *   Create a simple test endpoint to ensure the server is running correctly.

## Phase 2: Core Scanning and Image Duplicate Detection (3-4 days)

*   **Goal:** Implement the core functionality for finding and displaying duplicate images.
*   **Backend Tasks:**
    *   Implement the `/api/scan/start` endpoint to accept a folder path.
    *   Create a service to recursively scan the given directory for image files.
    *   Integrate an image hashing library (e.g., `imghash`) to generate perceptual hashes.
    *   Implement the logic to compare hashes and group duplicate images.
    *   Implement the `/api/scan/status` endpoint to return the scan progress and results.
*   **Frontend Tasks:**
    *   Connect the "Select Folder" button to the `/api/scan/start` endpoint.
    *   Create a results component to display the sets of duplicate images returned by the API.
    *   Display thumbnails, file names, and other relevant information for each duplicate file.

## Phase 3: Video Duplicate Detection and Deletion (3-4 days)

*   **Goal:** Extend the functionality to include video duplicates and file deletion.
*   **Backend Tasks:**
    *   Integrate `fluent-ffmpeg` for video processing.
    *   Implement the logic for extracting frames from videos and generating perceptual hashes for them.
    *   Incorporate video duplicate detection into the main scanning process.
    *   Implement the `DELETE /api/files` endpoint to securely delete files from the file system.
*   **Frontend Tasks:**
    *   Add support for displaying video duplicates in the results view.
    *   Add checkboxes to each file to allow for selection.
    *   Implement a "Delete Selected" button and a confirmation dialog.
    *   Call the `DELETE /api/files` endpoint and update the UI upon successful deletion.

## Phase 4: Polishing and Refinements (2-3 days)

*   **Goal:** Enhance the user experience and improve the application's robustness.
*   **Frontend Tasks:**
    *   Implement a real-time progress bar for the scanning process by polling the `/api/scan/status` endpoint.
    *   Refine the styling and layout of the results page for better readability.
    *   Add comprehensive error handling and user feedback for API interactions.
*   **Backend Tasks:**
    *   Improve error handling for file system operations and API requests.
    *   Optimize the performance of the scanning and hashing algorithms.

## Phase 5: Packaging and Documentation (1 day)

*   **Goal:** Prepare the application for users to run on their own machines.
*   **Tasks:**
    *   Create a comprehensive `README.md` file with detailed instructions on:
        *   Prerequisites (Node.js, npm).
        *   Installation of dependencies.
        *   How to run the backend server.
        *   How to start the frontend application.
    *   Clean up the codebase and add comments where necessary.
