import type { Task, TaskCategory, TaskFile } from "@/lib/app-state";

export type TaskFileActionResult = { error: string | null };

export async function submitTaskFileForm(
  action: (formData: FormData) => Promise<TaskFileActionResult>, formData: FormData,
  onError: (error: string | null) => void, onSuccess: () => void,
): Promise<void> {
  onError(null);
  try {
    const result = await action(formData);
    onError(result.error);
    if (!result.error) onSuccess();
  } catch {
    onError("The file could not be saved. Please refresh and try again.");
  }
}

export function taskTableColumns(categories: TaskCategory[]): (
  {kind: "file"} | {kind: "remove"} | {kind: "count"; categories: TaskCategory[]} | {kind: "task"; category: TaskCategory}
)[] {
  return [
    {kind: "count", categories: categories.filter((category) => category.hasCount)},
    {kind: "file"},
    ...categories.map((category) => ({kind: "task" as const, category})),
    {kind: "remove"},
  ];
}

export function taskTableLayout(columns: ReturnType<typeof taskTableColumns>): {
  columnWidths: (number | undefined)[]; minWidth: number;
} {
  const columnWidths = columns.map((column) => column.kind === "count" ? 72 : column.kind === "task" ? 240 : column.kind === "remove" ? 28 : undefined);
  return {columnWidths, minWidth: columnWidths.reduce<number>((total, width) => total + (width ?? 256), 0)};
}

// Only return safe, actionable messages; raw database errors stay on the server.
export async function saveTaskFile(operation: () => Promise<void>): Promise<TaskFileActionResult> {
  try {
    await operation();
    return { error: null };
  } catch (error) {
    console.error("Task file save failed", error);
    return { error: "The file could not be saved. Please try again." };
  }
}

export function normalizeSelectedCategoryIds(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function selectedCategoryFiles(files: TaskFile[], selectedIds: string[], categoryId: string): TaskFile[] {
  const ids = new Set(normalizeSelectedCategoryIds(selectedIds));
  if ([...ids].some((id) => !files.some((file) => file.id === id))) throw new Error("File selection has changed. Please try again.");
  return files.filter((file) => ids.has(file.id) && !file.categories.some((assignment) => assignment.categoryId === categoryId));
}

export function visibleTaskCategories(categories: TaskCategory[], files: TaskFile[]): TaskCategory[] {
  const used = new Set(files.flatMap((file) => file.categories.map((assignment) => assignment.categoryId)));
  return categories.filter((category) => used.has(category.id));
}

export function groupTaskTables(categories: TaskCategory[], files: TaskFile[]): {
  key: string; categories: TaskCategory[]; files: TaskFile[];
}[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  for (const file of files) for (const assignment of file.categories) {
    if (!categoryById.has(assignment.categoryId)) categoryById.set(assignment.categoryId, { id: assignment.categoryId, name: assignment.category });
  }
  const categoryOrder = new Map([...categoryById.keys()].map((id, index) => [id, index]));
  const groups = new Map<string, { key: string; categories: TaskCategory[]; files: TaskFile[] }>();
  for (const file of files) {
    const ids = [...new Set(file.categories.map((assignment) => assignment.categoryId))];
    if (ids.length === 0) continue;
    const key = file.tableId || JSON.stringify([...ids].sort());
    let group = groups.get(key);
    if (!group) {
      ids.sort((a, b) => categoryOrder.get(a)! - categoryOrder.get(b)!);
      group = { key, categories: ids.map((id) => categoryById.get(id)!), files: [] };
      groups.set(key, group);
    }
    group.files.push(file);
    for (const id of ids) if (!group.categories.some((category) => category.id === id)) group.categories.push(categoryById.get(id)!);
  }
  for (const group of groups.values()) if (group.files.some((file) => !!file.tableId)) {
    const positions = new Map<string, number>();
    for (const file of group.files) for (const assignment of file.categories) positions.set(assignment.categoryId, Math.min(positions.get(assignment.categoryId) ?? Infinity, assignment.sortOrder));
    group.categories.sort((a,b) => positions.get(a.id)! - positions.get(b.id)! || categoryOrder.get(a.id)! - categoryOrder.get(b.id)!);
  }
  return [...groups.values()].sort((a, b) => {
    for (let i = 0; i < Math.min(a.categories.length, b.categories.length); i++) {
      const difference = categoryOrder.get(a.categories[i].id)! - categoryOrder.get(b.categories[i].id)!;
      if (difference) return difference;
    }
    return a.categories.length - b.categories.length;
  });
}

export function legacyTasksToTaskFiles(tasks: Task[], categories: TaskCategory[]): TaskFile[] {
  const categoryByName = new Map(categories.map((category) => [category.name.trim().toLowerCase(), category.id]));
  const byName = new Map<string, TaskFile>();
  for (const task of [...tasks].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const key = task.fileName.trim().toLowerCase();
    let file = byName.get(key);
    if (!file) {
      file = { id: `legacy-file-${task.id}`, fileName: task.fileName, sortOrder: task.sortOrder, createdAt: task.createdAt, categories: [] };
      byName.set(key, file);
    }
    file.categories.push({
      id: task.id,
      createdAt: task.createdAt,
      taskFileId: file.id,
      categoryId: categoryByName.get(task.category.trim().toLowerCase()) || `legacy-category-${task.category.trim().toLowerCase()}`,
      category: task.category,
      status: task.status,
      vaAssigned: task.vaAssigned,
      sortOrder: task.sortOrder,
      count: task.count,
      commsStatus: task.commsStatus,
      commsVaAssigned: task.commsVaAssigned,
    });
  }
  return Array.from(byName.values());
}
