import { DuplicateGroup } from '../types';

// Use the same deterministic order for display and bulk selection.
export const sortGroup = (group: DuplicateGroup, keeperId?: string): DuplicateGroup => [...group].sort(
  (a, b) => Number(b.id === keeperId) - Number(a.id === keeperId) || b.metadata.size - a.metadata.size || a.path.localeCompare(b.path),
);

export const toggleDuplicates = (group: DuplicateGroup, selected: Set<string>, keeperId?: string): Set<string> => {
  const [keeper, ...copies] = sortGroup(group, keeperId);
  const next = new Set(selected);
  const clear = copies.every(file => next.has(file.id));
  if (keeper) next.delete(keeper.id);
  copies.forEach(file => clear ? next.delete(file.id) : next.add(file.id));
  return next;
};

export const isExactGroup = (group: DuplicateGroup): boolean =>
  group.length > 1 && !!group[0].contentHash && group.every(file => file.contentHash === group[0].contentHash);

export const groupKey = (group: DuplicateGroup): string => group.map(file => file.id).sort().join('\0');

export const spansFolders = (group: DuplicateGroup): boolean =>
  group.some(file => file.folderSide === 'first') && group.some(file => file.folderSide === 'second');
