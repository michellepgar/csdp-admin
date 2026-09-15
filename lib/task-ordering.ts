export function hasExactIds(currentIds: string[], submittedIds: string[]): boolean {
  if (currentIds.length !== submittedIds.length) return false;
  return new Set(currentIds).size === currentIds.length
    && new Set(submittedIds).size === submittedIds.length
    && submittedIds.every((id) => currentIds.includes(id));
}

export function getOrderedItems<T extends { id: string }>(items: T[], orderedIds: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return orderedIds.map((id) => byId.get(id)).filter((item): item is T => item !== undefined);
}

export function nextSortOrder(items: Array<{ sortOrder: number }>): number {
  return items.reduce((highest, item) => Math.max(highest, item.sortOrder), -1) + 1;
}

export function normalizedCategoryName(name: string): string {
  return name.trim().toLocaleLowerCase();
}
