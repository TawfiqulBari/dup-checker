**Prompt:**

Create a modern, single-page web application that allows users to find and delete duplicate image and video files from a selected folder on their local machine.

**Application Name:** "Dup-Checker"

**Core Functionality:**

1.  **File Selection:** The user should be able to select a folder from their local file system. The application should then scan this folder and all its subfolders for image and video files.
2.  **Duplicate Detection:**
    *   **Images:** Duplicates should be identified based on visual similarity, not just filename or metadata. Use a perceptual hashing algorithm (like pHash or dHash) to find images that look the same, even if they have different resolutions, formats, or filenames.
    *   **Videos:** For a more accurate detection of duplicates that go beyond simple file hash comparison, the application should analyze the video content itself. This can be achieved by:
        1.  Extracting a series of frames from each video at regular intervals (e.g., one frame every 10 seconds).
        2.  For each extracted frame, calculating a perceptual hash (similar to how images are compared).
        3.  Comparing the sequence of these hashes between videos. If a high percentage of the frame hashes match in sequence, the videos are considered duplicates. This method can identify duplicate videos even if they are in different formats, have different resolutions, or have been partially edited.
        4.  As a secondary check, the application can also compare file hashes (e.g., MD5 or SHA-256) to quickly identify bit-for-bit identical files.

3.  **Displaying Duplicates:**
    *   Once the scan is complete, the application should display the results in a clear and organized manner.
    *   Group the duplicate files together, showing the original file and its copies.
    *   For each file, display a thumbnail, the filename, file size, and image dimensions (for images) or video duration (for videos).
4.  **Duplicate Management:**
    *   Allow the user to select which duplicate files they want to delete. Provide a "select all duplicates" option for each group, keeping the original.
    *   Include a "Delete Selected" button that, when clicked, will permanently delete the selected files from the user's file system.
    *   Implement a confirmation dialog before deleting the files to prevent accidental data loss.

**User Interface (UI) and User Experience (UX):**

*   **Frontend:**
    *   Use React with TypeScript for a modern, component-based UI.
    *   Style the application with a clean and minimalist design, using a UI framework like Material-UI or Bootstrap for a professional look and feel.
    *   The main page should feature a prominent "Select Folder" button.
    *   While scanning, display a progress bar and a message indicating the scan is in progress.
    *   The results page should be a gallery view of the duplicate sets.
*   **Backend:**
    *   Use Node.js with Express.js to create a local server that will handle file system operations and the duplicate detection logic.
    *   The backend should expose API endpoints for the frontend to call (e.g., to start a scan, get the results, and delete files).

**User Interaction Flow:**

1.  The user opens the web application and is greeted with a simple interface with a "Select Folder" button.
2.  The user clicks the button, and a native file dialog appears, allowing them to choose a folder.
3.  Once a folder is selected, the application starts scanning for duplicates and displays a progress bar.
4.  When the scan is complete, the results are displayed, grouped by duplicate sets.
5.  The user can then review the duplicates, select the ones they want to delete, and click the "Delete Selected" button.
6.  A confirmation dialog appears. If the user confirms, the selected files are deleted.

**(Optional Advanced Feature)**

*   For even higher accuracy in video duplicate detection, consider incorporating **audio fingerprinting**. This would involve analyzing the audio track of each video and comparing their fingerprints, making it possible to identify duplicates even if the video content is slightly different but the audio is the same.
