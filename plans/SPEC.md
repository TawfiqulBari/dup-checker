# Technical Specifications: Dup-Checker

## 1. System Architecture

The application will consist of two main components:

*   **Frontend:** A single-page application (SPA) built with React and TypeScript, running in the user's web browser. It will provide the user interface for selecting folders, viewing duplicates, and deleting files.
*   **Backend:** A local Node.js server built with Express.js. It will handle file system access, run the duplicate detection algorithms, and expose a REST API for the frontend.
*   **Communication:** The frontend and backend will communicate via a REST API over HTTP.

## 2. Technology Stack

### Frontend

*   **Framework:** React with TypeScript (using Vite for project setup).
*   **UI Library:** Material-UI for a comprehensive set of UI components and a modern look.
*   **Styling:** Emotion, which is the default styling engine for Material-UI v5.
*   **State Management:** React Context or a lightweight library like Zustand for managing application state.

### Backend

*   **Runtime:** Node.js
*   **Framework:** Express.js
*   **Image Processing:** `sharp` for efficient image resizing and processing to generate thumbnails.
*   **Image Hashing:** `imghash` (or a similar library) for generating perceptual hashes of images.
*   **Video Processing:** `fluent-ffmpeg` for extracting frames from video files.

## 3. API Endpoints

The backend will expose the following REST API endpoints:

*   `POST /api/scan/start`
    *   **Description:** Starts a new scan for duplicate files in a given directory.
    *   **Request Body:** `{ "path": "/path/to/user/folder" }`
    *   **Response:** `{ "scanId": "unique-scan-id" }`

*   `GET /api/scan/status/:scanId`
    *   **Description:** Retrieves the status of an ongoing or completed scan.
    *   **Response (In Progress):** `{ "status": "in-progress", "progress": 0.45, "duplicates": [] }`
    *   **Response (Completed):** `{ "status": "completed", "duplicates": [ ... ] }`

*   `DELETE /api/files`
    *   **Description:** Deletes a list of specified files from the file system.
    *   **Request Body:** `{ "files": ["/path/to/file1.jpg", "/path/to/file2.png"] }`
    *   **Response:** `{ "success": true, "deletedFiles": ["/path/to/file1.jpg"], "errors": [{"file": "/path/to/file2.png", "error": "Permission denied"}] }`

## 4. Data Models

*   **`DuplicateSet`**
    ```json
    {
      "id": "string",
      "files": [
        {
          "path": "string",
          "name": "string",
          "size": "number",
          "thumbnail": "string (base64 encoded)",
          "dimensions": { "width": "number", "height": "number" }, // for images
          "duration": "number" // for videos
        }
      ]
    }
    ```

## 5. Duplicate Detection Logic

### Image Duplicates

1.  Recursively find all image files (e.g., `.jpg`, `.jpeg`, `.png`, `.gif`).
2.  For each image, generate a perceptual hash (pHash) using a library like `imghash`.
3.  Group images that have the same pHash into duplicate sets.

### Video Duplicates

1.  Recursively find all video files (e.g., `.mp4`, `.mov`, `.avi`).
2.  For each video, use `fluent-ffmpeg` to extract a predefined number of frames (e.g., 10) at evenly spaced intervals.
3.  For each extracted frame, generate a pHash.
4.  Create a sequence of hashes for each video.
5.  Compare the hash sequences of all videos. If the similarity between two sequences is above a certain threshold (e.g., 90% of frames match), they are considered duplicates.
