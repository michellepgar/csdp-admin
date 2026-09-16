import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

async function database() {
  const db = new PGlite();
  await db.exec(`
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
    create function auth.jwt() returns jsonb language sql as $$select '{"email":"owner@example.com"}'::jsonb$$;
  `);
  await db.exec(readFileSync("supabase/phase1_relational_team_schools.sql", "utf8"));
  await db.exec(readFileSync("supabase/phase2_relational_tasks_checklist.sql", "utf8"));
  await db.exec(`
    alter table task_categories add column school_id text references schools(id), add column sort_order integer not null default 0;
    alter table checklist_template add column school_id text references schools(id), add column task_category_id text references task_categories(id) on delete cascade, add column sort_order integer not null default 0;
    alter table checklist_progress add column checked_by text;
    alter table tasks add column sort_order integer not null default 0, add column comms_status text, add column comms_va_assigned text[];
    insert into vas(id,name,email,role) values ('va','Owner','owner@example.com','owner');
    insert into schools(id,name) values ('s1','School 1'),('s2','School 2');
    insert into task_categories(id,name) values ('c1','Transactions'),('c2','Homeroom');
    insert into checklist_template(id,description,task_category_id) values ('ch1','Transactions','c1');
    insert into tasks(id,school_id,category,file_name,status,created_at) values
      ('t1','s1','Transactions','Grade 1','Done','2025-01-01'),
      ('t2','s1','Homeroom','Grade 1','In Progress','2025-02-01');
  `);
  await db.exec(readFileSync("supabase/phase35_task_integrity.sql", "utf8"));
  return db;
}
const migration = () => readFileSync("supabase/phase38_shared_file_multi_category.sql", "utf8");

test("migration groups files, preserves task dates, and can run twice", async () => {
  const db = await database();
  try {
    await db.exec(migration());
    await db.exec(migration());
    assert.equal((await db.query("select * from task_files")).rows.length, 1);
    const tasks = await db.query<{id:string;day:string}>("select id,to_char(created_at,'YYYY-MM-DD') as \"day\" from task_file_categories order by id");
    assert.deepEqual(tasks.rows, [{id:"t1",day:"2025-01-01"},{id:"t2",day:"2025-02-01"}]);
  } finally { await db.close(); }
});

test("duplicate legacy assignments abort without changing legacy data", async () => {
  const db = await database();
  try {
    await db.exec("insert into tasks(id,school_id,category,file_name,status) values ('dup','s1',' transactions ',' grade 1 ','Open')");
    await assert.rejects(db.exec(migration()), /Ambiguous legacy tasks/);
    await db.exec("rollback");
    assert.equal((await db.query("select * from tasks")).rows.length, 3);
    assert.equal((await db.query("select to_regclass('task_files') name")).rows[0].name, null);
  } finally { await db.close(); }
});

test("old app writes during rollout stay visible in new tables", async () => {
  const db = await database();
  try {
    await db.exec(migration());
    await db.exec("update tasks set status='Open' where id='t1'");
    assert.equal((await db.query("select status from task_file_categories where id='t1'")).rows[0].status, "Open");
    await db.exec("delete from tasks where id='t1'");
    assert.equal((await db.query("select * from task_file_categories where id='t1'")).rows.length, 0);
  } finally { await db.close(); }
});

test("assignment deletion is school-scoped and removes the last empty file", async () => {
  const db = await database();
  try {
    await db.exec(migration());
    await assert.rejects(db.query("select remove_task_assignment('s2','t1')"), /school/i);
    assert.equal((await db.query("select * from task_file_categories")).rows.length, 2);
    await db.query("select remove_task_assignment('s1','t1')");
    await db.query("select remove_task_assignment('s1','t2')");
    assert.equal((await db.query("select * from task_files")).rows.length, 0);
    await db.exec(migration());
    assert.equal((await db.query("select * from task_files")).rows.length, 0);
  } finally { await db.close(); }
});

test("reset clears displayed files and checklist progress atomically", async () => {
  const db = await database();
  try {
    await db.exec(migration());
    await db.exec("insert into checklist_progress(school_id,template_item_id,status,not_needed) values ('s1','ch1','Open',true)");
    await db.query("select reset_school_task_data()");
    assert.equal((await db.query("select * from task_files")).rows.length, 0);
    assert.equal((await db.query("select * from checklist_progress")).rows.length, 0);
  } finally { await db.close(); }
});

test("updates reject another school's assignment", async () => {
  const db = await database();
  try {
    await db.exec(migration());
    await assert.rejects(db.query("select update_task_assignment('s2','t1','{\"status\":\"Open\"}')"), /school/i);
    assert.equal((await db.query("select status from task_file_categories where id='t1'")).rows[0].status,"Done");
    await db.query("select update_task_assignment('s1','t1','{\"status\":\"Open\"}')");
    assert.equal((await db.query("select status from task_file_categories where id='t1'")).rows[0].status,"Open");
  } finally { await db.close(); }
});

test("restore preserves shared assignments and checklist signatures; invalid restore rolls back", async () => {
  const db = await database();
  const backup = {
    vas:[{id:"va",name:"Owner",email:"owner@example.com",role:"owner"}],schools:[{id:"s1",name:"School 1"}],
    taskCategories:[{id:"c1",name:"Transactions"}],checklistTemplate:[{id:"ch1",description:"Transactions",taskCategoryId:"c1"}],
    schoolData:{s1:{taskFiles:[{id:"f1",fileName:"Restored",sortOrder:0,createdAt:"2025-01-01",categories:[{id:"a1",categoryId:"c1",status:"Done",vaAssigned:["Owner"],sortOrder:0,createdAt:"2025-02-01"}]}]}},
    checklistProgress:{"s1:ch1":{status:"Open",checkedBy:"Owner",notNeeded:true}},
  };
  try {
    await db.exec(migration());
    await db.query("select restore_school_task_backup($1)",[JSON.stringify(backup)]);
    assert.equal((await db.query("select file_name from task_files")).rows[0].file_name,"Restored");
    assert.deepEqual((await db.query("select status,checked_by,not_needed from checklist_progress")).rows,[{status:"Open",checked_by:"Owner",not_needed:true}]);
    assert.deepEqual((await db.query("select va_assigned,to_char(created_at,'YYYY-MM-DD') as date from task_file_categories")).rows,[{va_assigned:["Owner"],date:"2025-02-01"}]);
    backup.schoolData.s1.taskFiles[0].categories[0].categoryId="missing";
    await assert.rejects(db.query("select restore_school_task_backup($1)",[JSON.stringify(backup)]),/foreign key/);
    assert.equal((await db.query("select file_name from task_files")).rows[0].file_name,"Restored");
  } finally { await db.close(); }
});

test("category rename from old app cannot overwrite newer status or file name", async () => {
  const db = await database();
  try {
    await db.exec(migration());
    await db.query("select update_task_assignment('s1','t1','{\"status\":\"Open\",\"va_assigned\":[\"Owner\"]}')");
    await db.exec("update task_files set file_name='New name'");
    await db.query("select rename_task_category('c1','Renamed')");
    assert.deepEqual((await db.query("select a.status,a.va_assigned,f.file_name from task_file_categories a join task_files f on f.id=a.task_file_id where a.id='t1'")).rows,
      [{status:"Open",va_assigned:["Owner"],file_name:"New name"}]);
  } finally { await db.close(); }
});

test("blank legacy categories fail safely rather than lose tasks", async () => {
  const db = await database();
  try {
    await db.exec("update tasks set category='' where id='t1'");
    await assert.rejects(db.exec(migration()),/Blank legacy categor/);
    await db.exec("rollback");
    assert.equal((await db.query("select * from tasks")).rows.length,2);
  } finally { await db.close(); }
});

test("Phase 37 collision backups merge categories and preserve school checklist progress", async () => {
  const db = await database();
  const backup = {
    vas:[{id:"va",name:"Owner",email:"owner@example.com",role:"owner"}],schools:[{id:"s1",name:"School 1"}],
    taskCategories:[{id:"c1",name:"Transactions"},{id:"scoped",name:" transactions ",schoolId:"s1"}],
    checklistTemplate:[{id:"ch1",description:"Transactions",taskCategoryId:"c1"},{id:"scoped-check",description:" transactions ",taskCategoryId:"scoped",schoolId:"s1"}],
    schoolData:{s1:{tasks:[{id:"old",category:" transactions ",fileName:"Old backup",status:"Done",vaAssigned:["Owner"],createdAt:"2025-01-01"}]}},
    checklistProgress:{"s1:scoped-check":{status:"Done",checkedBy:"Owner"}},
  };
  try {
    await db.exec(migration());
    await db.query("select restore_school_task_backup($1)",[JSON.stringify(backup)]);
    assert.deepEqual((await db.query("select id from task_categories")).rows,[{id:"c1"}]);
    assert.deepEqual((await db.query("select category_id from task_file_categories")).rows,[{category_id:"c1"}]);
    assert.deepEqual((await db.query("select template_item_id,status,checked_by from checklist_progress")).rows,[{template_item_id:"ch1",status:"Done",checked_by:"Owner"}]);
  } finally { await db.close(); }
});

test("removing a file also removes legacy rows so a later category rename cannot resurrect it", async () => {
  const db = await database();
  try {
    await db.exec(migration());
    const fileId = (await db.query<{id:string}>("select id from task_files")).rows[0].id;
    await db.query("select remove_task_file('s1',$1)",[fileId]);
    await db.query("select rename_task_category('c1','Renamed')");
    assert.equal((await db.query("select * from task_files")).rows.length,0);
    assert.equal((await db.query("select * from tasks")).rows.length,0);
  } finally { await db.close(); }
});
