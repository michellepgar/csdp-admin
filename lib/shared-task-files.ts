import type { Task, TaskCategory, TaskFile } from "@/lib/app-state";

export function normalizeSelectedCategoryIds(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
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
    const key = JSON.stringify([...ids].sort());
    let group = groups.get(key);
    if (!group) {
      ids.sort((a, b) => categoryOrder.get(a)! - categoryOrder.get(b)!);
      group = { key, categories: ids.map((id) => categoryById.get(id)!), files: [] };
      groups.set(key, group);
    }
    group.files.push(file);
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
