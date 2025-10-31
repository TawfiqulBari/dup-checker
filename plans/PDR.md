# Product Design Document: Dup-Checker

## 1. Introduction

Dup-Checker is a user-friendly web application designed to help users find and remove duplicate image and video files from their local machine. It provides a simple and effective way to reclaim disk space by identifying visually similar images and identical or similar video files.

## 2. Problem Statement

Many users accumulate a large number of digital photos and videos over time. This often leads to the creation of multiple copies of the same files, which can consume a significant amount of disk space. Manually finding and deleting these duplicates is a tedious and time-consuming process. Existing solutions are often desktop-based, and a web-based tool that can be run locally provides a modern and accessible alternative.

## 3. Target Audience

*   **General Computer Users:** Anyone who wants to clean up their personal files and free up disk space.
*   **Photographers and Videographers:** Professionals and hobbyists who often have multiple versions and copies of their work.
*   **Data Hoarders:** Users who store large volumes of files and need a tool to manage their collections.

## 4. Core Features

*   **Local Folder Selection:** Users can select a folder on their computer to scan for duplicates.
*   **Visual Image Duplicate Detection:** The application will use perceptual hashing to find images that are visually similar, even if they have different resolutions, file sizes, or formats.
*   **Video Content-Based Duplicate Detection:** The application will analyze video frames to identify duplicate videos, even if they have been re-encoded or are in different formats.
*   **Duplicate Results Display:** Duplicates will be presented in an intuitive and grouped manner, with thumbnails and file information.
*   **Duplicate Management:** Users can select which files to delete, with safeguards to prevent accidental deletion of original files.
*   **Secure Deletion:** Selected files are permanently deleted from the user's file system after a confirmation.

## 5. User Flow

1.  The user launches the application and is presented with a simple interface.
2.  The user clicks a "Select Folder" button to choose a directory to scan.
3.  The application scans the selected folder and its subdirectories, showing a progress bar.
4.  Once the scan is complete, the application displays a list of duplicate sets.
5.  The user reviews the duplicate sets, selects the files to be deleted, and clicks a "Delete" button.
6.  A confirmation dialog appears. Upon confirmation, the files are deleted.

## 6. Non-Goals

*   **Cloud Storage Integration:** The application will only work with local files and will not connect to any cloud storage services in its initial version.
*   **Automatic Deletion:** The application will not automatically delete any files without explicit user confirmation.
*   **File Organization:** The application is focused on duplicate deletion and will not offer features for organizing or tagging files.
