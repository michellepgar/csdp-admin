"use server";

import { requireTeamMember } from "@/lib/require-team-member";
import { isDemoMode } from "@/lib/demo-session";
import { fetchAppState } from "@/lib/fetch-app-state";
import { searchWords } from "@/lib/private-note-search";

/** A school file or General Task whose name matches a search, with where it opens. */
export type WorkHit = { key: string; label: string; hint: string; href: string; kind: "file" | "general" };

const MAX_HITS = 8;

const matchesAll = (text: string, words: string[]) => {
  const lower = text.toLowerCase();
  return words.every((w) => lower.includes(w));
};

/* The top bar's search: files on every school's Tasks card and General Tasks,
   by name (every word typed has to be in it). Each hit opens its page with
   that file highlighted. */
export async function searchWork(query: string): Promise<WorkHit[]> {
  const words = searchWords(query);
  if (words.length === 0 || query.length > 200) return [];
  try {
    if (await isDemoMode()) {
      const state = await fetchAppState();
      if (!state) return [];
      const hits: WorkHit[] = [];
      for (const school of state.schools) {
        for (const file of state.schoolData[school.id]?.taskFiles || []) {
          if (!matchesAll(file.fileName, words)) continue;
          const first = file.categories[0];
          hits.push({ key: `f-${file.id}`, label: file.fileName, hint: school.name, kind: "file", href: `/schools/${school.id}${first ? `?highlightTask=${first.id}` : ""}` });
        }
      }
      for (const task of state.generalTasks || []) {
        if (matchesAll(task.description, words)) hits.push({ key: `g-${task.id}`, label: task.description, hint: "General Tasks", kind: "general", href: `/general-tasks?highlightTask=${task.id}` });
      }
      return hits.slice(0, MAX_HITS);
    }

    const { supabase } = await requireTeamMember();
    // The database narrows by the longest word; every word is checked below.
    const longest = [...words].sort((a, b) => b.length - a.length)[0];
    const pattern = `%${longest.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const [filesResult, generalResult] = await Promise.all([
      supabase.from("task_files").select("id, school_id, file_name").ilike("file_name", pattern).limit(50),
      supabase.from("general_tasks").select("id, description").ilike("description", pattern).limit(50),
    ]);
    const files = (filesResult.data ?? []).filter((f) => matchesAll(f.file_name ?? "", words)).slice(0, MAX_HITS);
    const general = (generalResult.data ?? []).filter((t) => matchesAll(t.description ?? "", words));

    const fileIds = files.map((f) => f.id as string);
    const schoolIds = [...new Set(files.map((f) => f.school_id as string))];
    const [categoriesResult, schoolsResult] = await Promise.all([
      fileIds.length ? supabase.from("task_file_categories").select("id, task_file_id, sort_order").in("task_file_id", fileIds).order("sort_order") : Promise.resolve({ data: [] }),
      schoolIds.length ? supabase.from("schools").select("id, name").in("id", schoolIds) : Promise.resolve({ data: [] }),
    ]);
    const firstCategory = new Map<string, string>();
    for (const c of (categoriesResult.data ?? []) as { id: string; task_file_id: string }[]) {
      if (!firstCategory.has(c.task_file_id)) firstCategory.set(c.task_file_id, c.id);
    }
    const schoolName = new Map(((schoolsResult.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));

    const hits: WorkHit[] = files.map((f) => {
      const highlight = firstCategory.get(f.id as string);
      return {
        key: `f-${f.id}`,
        label: f.file_name as string,
        hint: schoolName.get(f.school_id as string) || "School",
        kind: "file",
        href: `/schools/${f.school_id}${highlight ? `?highlightTask=${highlight}` : ""}`,
      };
    });
    for (const t of general) hits.push({ key: `g-${t.id}`, label: t.description as string, hint: "General Tasks", kind: "general", href: `/general-tasks?highlightTask=${t.id}` });
    return hits.slice(0, MAX_HITS);
  } catch (error) {
    console.error("Work search failed", error);
    return [];
  }
}
