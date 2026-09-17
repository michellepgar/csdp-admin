"use client";

import { useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { visibleSchoolItems } from "@/lib/app-state";
import type { TaskCategory } from "@/lib/app-state";
import type { SchoolTables } from "@/components/general-tasks-list";

const ADD_NEW_CATEGORY_OPTION = "__add_new__";

export function GeneralTaskMoveForm({ taskId, defaultFileName, schools, taskCategories, schoolTables, moveGeneralTaskToSchool, addTaskCategory, onClose }: {
  taskId: string;
  defaultFileName: string;
  schools: { id: string; name: string }[];
  taskCategories: TaskCategory[];
  schoolTables: SchoolTables;
  moveGeneralTaskToSchool: (formData: FormData) => Promise<{ error: string | null }>;
  addTaskCategory: (formData: FormData) => void;
  onClose: () => void;
}) {
  const [schoolId, setSchoolId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [existingTable, setExistingTable] = useState(false);
  const [tableKey, setTableKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const categories = schoolId ? visibleSchoolItems(taskCategories, schoolId) : [];
  const tables = schoolTables[schoolId] || [];
  const selectedTable = tables.find((t) => t.key === tableKey);

  return (
    <div className="mt-2 max-w-md rounded-md border bg-card p-3">
      <p className="mb-2 text-sm font-semibold">Move to which school?</p>
      <form
        action={async (formData) => {
          setError(null);
          const result = await moveGeneralTaskToSchool(formData);
          if (result.error) setError(result.error);
          else onClose();
        }}
        className="space-y-2"
      >
        <input type="hidden" name="taskId" value={taskId} />
        <Dropdown name="schoolId" value={schoolId} onChange={(v) => { setSchoolId(v); setCategoryId(""); setTableKey(""); }} placeholder="Choose a school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />

        {schoolId && tables.length > 0 && (
          <div className="flex gap-1">
            <Button type="button" size="xs" variant={existingTable ? "outline" : "default"} onClick={() => { setExistingTable(false); setCategoryId(""); setTableKey(""); }}>New file</Button>
            <Button type="button" size="xs" variant={existingTable ? "default" : "outline"} onClick={() => { setExistingTable(true); setCategoryId(""); }}>Add to existing table</Button>
          </div>
        )}

        {existingTable ? (
          <>
            <input type="hidden" name="tableCategoryIds" value={selectedTable ? selectedTable.categoryIds.join(",") : ""} />
            <Dropdown
              name="tableKey"
              value={tableKey}
              onChange={(v) => { setTableKey(v); setCategoryId(""); }}
              placeholder="Choose a table"
              options={tables.map((t) => ({ value: t.key, label: `${t.categoryNames.join(" + ")} (${t.fileCount} file${t.fileCount === 1 ? "" : "s"})` }))}
            />
            {selectedTable && (
              <Dropdown
                name="categoryId"
                value={categoryId}
                onChange={setCategoryId}
                placeholder="Which category is this task?"
                options={selectedTable.categoryIds.map((id, i) => ({ value: id, label: selectedTable.categoryNames[i] }))}
              />
            )}
          </>
        ) : (
          <Dropdown
            name="categoryId"
            value={categoryId}
            onChange={(v) => {
              if (v === ADD_NEW_CATEGORY_OPTION) { setAddingCategory(true); return; }
              setCategoryId(v);
            }}
            placeholder="Choose a category"
            options={[...categories.map((c) => ({ value: c.id, label: c.name })), { value: ADD_NEW_CATEGORY_OPTION, label: "+ Add new category" }]}
          />
        )}
        {addingCategory && (
          <div className="flex gap-2">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              autoFocus
              className="h-8 flex-1 rounded-md border px-2 text-sm"
            />
            <Button
              type="button"
              size="xs"
              onClick={() => {
                if (!newCategoryName.trim()) return;
                const fd = new FormData();
                fd.set("name", newCategoryName.trim());
                addTaskCategory(fd);
                setAddingCategory(false);
                setNewCategoryName("");
              }}
            >
              Add
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={() => { setAddingCategory(false); setNewCategoryName(""); }}>Cancel</Button>
          </div>
        )}
        {addingCategory && <p className="text-xs text-muted-foreground">Added categories show up in the list above once you close and reopen this picker.</p>}

        <input name="fileName" defaultValue={defaultFileName} required placeholder="File name" className="h-8 w-full rounded-md border px-2 text-sm" />
        <div className="flex gap-2">
          <SubmitButton size="sm" pendingLabel="Moving…" disabled={!schoolId || !categoryId}>Move</SubmitButton>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>
    </div>
  );
}
