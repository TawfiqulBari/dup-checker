import { describe, expect, it } from 'vitest';
import { sortGroup, toggleDuplicates, isExactGroup, spansFolders } from './selection';
import { FileWithHandle } from '../types';

const file = (id: string, size: number): FileWithHandle => ({ id, path: id, file: new File(['x'], id), metadata: { size }, thumbnail: '' });

describe('duplicate selection', () => {
  it('includes only sets shared by both folders', () => {
    const group = [file('a', 1), file('b', 1)];
    group.forEach(file => file.folderSide = 'first');
    expect(spansFolders(group)).toBe(false);
    group[1].folderSide = 'second';
    expect(spansFolders(group)).toBe(true);
  });
  it('protects a chosen keeper even when it is smaller', () => {
    const group = [file('large', 10), file('chosen', 1)];
    expect(sortGroup(group, 'chosen')[0].id).toBe('chosen');
    expect([...toggleDuplicates(group, new Set(['chosen']), 'chosen')]).toEqual(['large']);
  });
  it('labels only groups with identical verified hashes as exact', () => {
    const group = [file('a', 1), file('b', 1)];
    expect(isExactGroup(group)).toBe(false);
    group.forEach(file => file.contentHash = 'same');
    expect(isExactGroup(group)).toBe(true);
    group[1].contentHash = 'different';
    expect(isExactGroup(group)).toBe(false);
  });
  it('keeps the displayed largest file even when input order differs', () => {
    const group = [file('small', 1), file('largest', 10), file('medium', 5)];
    expect(sortGroup(group)[0].id).toBe('largest');
    expect([...toggleDuplicates(group, new Set())].sort()).toEqual(['medium', 'small']);
    expect(group[0].id).toBe('small');
  });
  it('toggles copies without changing another group and clears a selected keeper', () => {
    const group = [file('copy', 1), file('keeper', 10)];
    expect([...toggleDuplicates(group, new Set(['copy', 'keeper', 'elsewhere']))]).toEqual(['elsewhere']);
  });
  it('uses a stable path tie-break for equal sizes', () => {
    expect(sortGroup([file('b', 1), file('a', 1)])[0].id).toBe('a');
  });
});
