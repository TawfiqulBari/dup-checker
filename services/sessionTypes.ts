import { ScanProgress } from '../types';

export interface ReviewState {
  keepers?: Record<string, string>;
  matchFilter?: string;
  mediaFilter?: string;
  search?: string;
  reviewFilter?: string;
  reviewed?: string[];
  scrollY?: number;
}
export interface NativeFolder { id: string; name: string; absolute: string }
export interface NativeEntry { id: string; rootId: string; absolute: string; name: string; path: string; size: number; mtime: number; ctime: number; ino: number; type: string; cached?: { exact?: string; visual?: string | string[] } }
export interface SessionFile { id: string; nativeId: string; path: string; folderSide?: 'first' | 'second'; entry: NativeEntry }
export interface SavedSession {
  id: string; label: string; updated: number; status: 'scanning' | 'paused' | 'done';
  roots: NativeFolder[]; manifest: SessionFile[]; groups: string[][]; selectedFiles: string[];
  review: ReviewState; warnings: string[]; progress: ScanProgress;
  delta?: { unchanged: number; added: number; changed: number; removed: number };
}
export type SessionPatch = Partial<Pick<SavedSession, 'status' | 'groups' | 'selectedFiles' | 'review' | 'warnings' | 'progress'>>;
export interface SessionSummary { id: string; label: string; updated: number; status: string; count: number; progress: ScanProgress; groups: number; reviewed: number }
