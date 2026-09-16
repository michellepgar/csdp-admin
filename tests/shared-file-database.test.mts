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

async function selectiveRules(db:PGlite) {
  await filenameRules(db);
  await db.exec(readFileSync('supabase/phase40_unrestricted_file_names.sql','utf8'));
  const path='supabase/phase41_selective_table_categories.sql';
  assert.equal(requireFile(path),true,'selective-category migration must exist');
  await db.exec(readFileSync(path,'utf8'));
}
function requireFile(path:string) {try {readFileSync(path); return true;} catch {return false;}}

test('selected category attachment preserves table membership and existing assignments atomically',async()=>{
  const db=await database();
  try {
    await selectiveRules(db);
    await db.exec("insert into task_categories(id,name) values('c3','Photos')");
    await db.query("select add_task_file('a','s1','Same',array['c3'])");
    await db.query("select add_task_file('b','s1','Same',array['c3'])");
    const key=(await db.query<{table_id:string}>("select table_id from task_files where id='a'")).rows[0].table_id;
    await db.exec("update task_file_categories set status='Completed',va_assigned=array['Owner'],count='7' where task_file_id='a'");
    await db.query("select add_task_file_category('s1',$1,array['a'],'c2')",[key]);
    await db.query("select add_task_file_category('s1',$1,array['a'],'c2')",[key]);
    assert.deepEqual((await db.query("select category_id,status,va_assigned,count from task_file_categories where task_file_id='a' order by sort_order")).rows,[
      {category_id:'c3',status:'Completed',va_assigned:['Owner'],count:'7'},
      {category_id:'c2',status:'',va_assigned:[],count:null},
    ]);
    assert.equal((await db.query("select * from task_file_categories where task_file_id='b'")).rows.length,1);
    assert.deepEqual((await db.query("select distinct table_id from task_files where id in('a','b')")).rows,[{table_id:key}]);
    await assert.rejects(db.query("select add_task_file_category('s2',$1,array['a'],'c1')",[key]),/selection/i);
    await assert.rejects(db.query("select add_task_file_category('s1','wrong',array['a'],'c1')"),/selection/i);
    await assert.rejects(db.query("select add_task_file_category('s1',$1,array['a','missing'],'c1')",[key]),/selection/i);
    assert.equal((await db.query("select * from task_file_categories where task_file_id='a'")).rows.length,2);
    await assert.rejects(db.query("select add_task_file_category('s1',$1,array['a'],'missing')",[key]),/category/i);
    await assert.rejects(db.query("select add_task_file_category('s1',$1,array[]::text[],'c1')",[key]),/select/i);
    await db.exec("create or replace function auth.uid() returns uuid language sql as $$select null::uuid$$");
    await assert.rejects(db.query("select add_task_file_category('s1',$1,array['a'],'c1')",[key]),/Not authorized/);
  } finally {await db.close();}
});

test('communications migration copies meaningful work once and leaves sources untouched',async()=>{
  const db=await database();
  try {
    await filenameRules(db);
    await db.exec(readFileSync('supabase/phase40_unrestricted_file_names.sql','utf8'));
    await db.exec("insert into task_categories(id,name) values('initial','Initial'),('follow','Follow up')");
    await db.query("select add_task_file('initial-file','s1','Initial file',array['initial'])");
    await db.query("select add_task_file('empty-file','s1','Empty file',array['follow'])");
    await db.exec("update task_file_categories set comms_status='In Progress',comms_va_assigned=array['Owner'] where task_file_id='initial-file'");
    const before=(await db.query("select * from task_file_categories order by id")).rows;
    await selectiveRules(db);
    await db.exec(readFileSync('supabase/phase41_selective_table_categories.sql','utf8'));
    const original=(await db.query("select * from task_file_categories where category_id in('c1','c2','initial','follow') order by id")).rows;
    assert.deepEqual(original,before);
    const copied=(await db.query("select c.name,a.status,a.va_assigned from task_file_categories a join task_categories c on c.id=a.category_id where a.task_file_id='initial-file' and c.name='Initial Communications'")).rows;
    assert.deepEqual(copied,[{name:'Initial Communications',status:'In Progress',va_assigned:['Owner']}]);
    assert.equal((await db.query("select * from task_file_categories where task_file_id='empty-file'")).rows.length,1);
    assert.equal((await db.query("select * from checklist_template where description in('Initial Communications','Recheck Communications')")).rows.length,2);
  } finally {await db.close();}
});

test('backup restore preserves selected and unselected files in their stable table',async()=>{
  const db=await database();
  try {
    await selectiveRules(db);
    const backup={vas:[{id:'va',name:'Owner',email:'owner@example.com',role:'owner'}],schools:[{id:'s1',name:'School 1'}],
      taskCategories:[{id:'c1',name:'Transactions'},{id:'c2',name:'Homeroom'}],checklistTemplate:[],checklistProgress:{},schoolData:{s1:{taskFiles:[
        {id:'f1',tableId:'shared-table',fileName:'Same',categories:[{id:'a1',categoryId:'c1',status:'Completed',vaAssigned:['Owner']},{id:'a2',categoryId:'c2',status:'',vaAssigned:[],sortOrder:1}]},
        {id:'f2',tableId:'shared-table',fileName:'Same',categories:[{id:'a3',categoryId:'c1',status:'',vaAssigned:[]}]},
      ]}}};
    await db.query('select restore_school_task_backup($1)',[JSON.stringify(backup)]);
    assert.deepEqual((await db.query('select id,table_id from task_files order by id')).rows,[{id:'f1',table_id:'shared-table'},{id:'f2',table_id:'shared-table'}]);
    assert.equal((await db.query("select status from task_file_categories where id='a1'")).rows[0].status,'Completed');
    await db.exec("create or replace function auth.uid() returns uuid language sql as $$select null::uuid$$");
    await assert.rejects(db.query('select restore_school_task_backup($1)',[JSON.stringify(backup)]),/Not authorized/);
  } finally {await db.close();}
});

test('normalized existing communications category is reused and copied work stays visible',async()=>{
  const db=await database();
  try {
    await filenameRules(db);
    await db.exec(readFileSync('supabase/phase40_unrestricted_file_names.sql','utf8'));
    await db.exec("insert into task_categories(id,name) values('initial','Initial'),('custom-comms',' initial communications ')");
    await db.query("select add_task_file('source','s1','File',array['initial'])");
    await db.exec("update task_file_categories set comms_status='Completed',comms_va_assigned=array['Owner'] where task_file_id='source'");
    await db.exec(readFileSync('supabase/phase41_selective_table_categories.sql','utf8'));
    assert.deepEqual((await db.query("select status,va_assigned from task_file_categories where task_file_id='source' and category_id='custom-comms'")).rows,[{status:'Completed',va_assigned:['Owner']}]);
    assert.equal((await db.query("select * from checklist_template where task_category_id='custom-comms'")).rows.length,1);
  } finally {await db.close();}
});

test('older backups and legacy communications edits convert without overwriting newer independent status',async()=>{
  const db=await database();
  try {
    await selectiveRules(db);
    const backup={vas:[{id:'va',name:'Owner',email:'owner@example.com',role:'owner'}],schools:[{id:'s1',name:'School 1'}],taskCategories:[{id:'initial',name:'Initial'},{id:'follow',name:'Follow up'}],checklistTemplate:[],checklistProgress:{},schoolData:{s1:{tasks:[
      {id:'source',category:'Initial',fileName:'File',status:'In Progress',vaAssigned:[],commsStatus:'Completed',commsVaAssigned:['Owner']},
      {id:'follow-source',category:'Follow up',fileName:'File',status:'',vaAssigned:[],commsStatus:'Paused',commsVaAssigned:['Owner']},
    ]}}};
    await db.query('select restore_school_task_backup($1)',[JSON.stringify(backup)]);
    assert.deepEqual((await db.query("select a.status,a.va_assigned from task_file_categories a join task_categories c on c.id=a.category_id where c.name='Initial Communications'")).rows,[{status:'Completed',va_assigned:['Owner']}]);
    assert.deepEqual((await db.query("select a.status,a.va_assigned from task_file_categories a join task_categories c on c.id=a.category_id where c.name='Recheck Communications'")).rows,[{status:'Paused',va_assigned:['Owner']}]);
    assert.equal((await db.query("select * from checklist_template where description in('Initial Communications','Recheck Communications')")).rows.length,2);
    await db.exec("update task_file_categories set status='Paused' where id='phase41-comms-source'");
    await db.exec("update task_file_categories set status='Completed' where id='source'");
    assert.equal((await db.query("select status from task_file_categories where id='phase41-comms-source'")).rows[0].status,'Paused');
    await db.exec("update task_file_categories set comms_status='In Progress' where id='source'");
    assert.equal((await db.query("select status from task_file_categories where id='phase41-comms-source'")).rows[0].status,'In Progress');
  } finally {await db.close();}
});

test('older backup with one manually created communications category still converts recheck work',async()=>{
  const db=await database();
  try {
    await selectiveRules(db);
    const backup={vas:[{id:'va',name:'Owner',email:'owner@example.com',role:'owner'}],schools:[{id:'s1',name:'School 1'}],taskCategories:[{id:'follow',name:'Follow up'},{id:'manual',name:'Initial Communications'}],checklistTemplate:[],checklistProgress:{},schoolData:{s1:{tasks:[
      {id:'source',category:'Follow up',fileName:'File',status:'',vaAssigned:[],commsStatus:'Completed',commsVaAssigned:['Owner']},
    ]}}};
    await db.query('select restore_school_task_backup($1)',[JSON.stringify(backup)]);
    assert.deepEqual((await db.query("select a.status,a.va_assigned from task_file_categories a join task_categories c on c.id=a.category_id where c.name='Recheck Communications'")).rows,[{status:'Completed',va_assigned:['Owner']}]);
  } finally {await db.close();}
});

test('ambiguous communications sources or conflicting existing target abort rather than hide work',async()=>{
  const db=await database();
  try {
    await filenameRules(db);
    await db.exec(readFileSync('supabase/phase40_unrestricted_file_names.sql','utf8'));
    await db.exec("insert into task_categories(id,name) values('follow','Follow up'),('recheck','Recheck'),('comms','Recheck Communications')");
    await db.query("select add_task_file('source','s1','File',array['follow','recheck'])");
    await db.exec("update task_file_categories set comms_status='Completed',comms_va_assigned=array['Owner'] where task_file_id='source'");
    const before=(await db.query('select * from task_file_categories order by id')).rows;
    await assert.rejects(db.exec(readFileSync('supabase/phase41_selective_table_categories.sql','utf8')),/Ambiguous communications/);
    await db.exec('rollback');
    assert.deepEqual((await db.query('select * from task_file_categories order by id')).rows,before);
    await db.exec("update task_file_categories set comms_status='',comms_va_assigned='{}' where category_id='recheck'");
    await db.exec("insert into task_file_categories(id,task_file_id,category_id,status) values('target','source','comms','Paused')");
    await assert.rejects(db.exec(readFileSync('supabase/phase41_selective_table_categories.sql','utf8')),/Conflicting communications/);
    await db.exec('rollback');
    assert.equal((await db.query("select status from task_file_categories where id='target'")).rows[0].status,'Paused');
  } finally {await db.close();}
});

test('legacy cutover rejects a second meaningful recheck source without overwriting copied work',async()=>{
  const db=await database();
  try {
    await filenameRules(db);
    await db.exec(readFileSync('supabase/phase40_unrestricted_file_names.sql','utf8'));
    await db.exec("insert into task_categories(id,name) values('follow','Follow up'),('recheck','Recheck')");
    await db.query("select add_task_file('file','s1','File',array['follow','recheck'])");
    await db.exec("update task_file_categories set comms_status='Completed',comms_va_assigned=array['Owner'] where category_id='follow'");
    await db.exec(readFileSync('supabase/phase41_selective_table_categories.sql','utf8'));
    await assert.rejects(db.exec("update task_file_categories set comms_status='Paused' where category_id='recheck'"),/Ambiguous communications/);
    assert.equal((await db.query("select comms_status from task_file_categories where category_id='recheck'")).rows[0].comms_status,null);
    assert.equal((await db.query("select a.status from task_file_categories a join task_categories c on c.id=a.category_id where c.name='Recheck Communications'")).rows[0].status,'Completed');
  } finally {await db.close();}
});

async function filenameRules(db: PGlite) {
  await db.exec(migration());
  const path = "supabase/phase39_category_filename_rules.sql";
  await db.exec(readFileSync(path, "utf8"));
}

test("filenames may repeat within one category without merging entries or status", async () => {
  const db=await database();
  try {
    await filenameRules(db);
    const path='supabase/phase40_unrestricted_file_names.sql';
    const originalFiles=(await db.query("select * from task_files order by id")).rows;
    const originalAssignments=(await db.query("select * from task_file_categories order by id")).rows;
    await db.exec(readFileSync(path,'utf8'));
    await db.exec(readFileSync(path,'utf8'));
    assert.deepEqual((await db.query("select * from task_files order by id")).rows,originalFiles);
    assert.deepEqual((await db.query("select * from task_file_categories order by id")).rows,originalAssignments);
    await db.query("select add_task_file('repeat','s1','Grade 1',array['c1'])");
    assert.equal((await db.query("select * from task_files")).rows.length,2);
    assert.equal((await db.query("select status from task_file_categories where id='t1'")).rows[0].status,'Done');
    assert.deepEqual((await db.query("select category_id,status from task_file_categories where task_file_id='repeat'")).rows,[{category_id:'c1',status:''}]);
    await db.query("select add_task_file('rename','s1','Grade 2',array['c1','c2'])");
    await db.exec("update task_files set file_name='Grade 1' where id='rename'");
    assert.equal((await db.query("select * from task_files where file_name='Grade 1'")).rows.length,3);
    await db.query("select remove_task_file('s1','repeat')");
    assert.equal((await db.query("select * from task_files")).rows.length,2);
    assert.equal((await db.query("select status from task_file_categories where id='t1'")).rows[0].status,'Done');
    await db.exec("create or replace function auth.uid() returns uuid language sql as $$select null::uuid$$");
    await assert.rejects(db.query("select add_task_file('unauthorized','s1','Grade 1',array['c1'])"), /Not authorized/);
  } finally {await db.close();}
});

test("same filename in different categories creates independent files and statuses", async () => {
  const db = await database();
  try {
    await filenameRules(db);
    await db.exec("insert into task_categories(id,name) values ('c3','Photos'),('c4','Initial')");
    await db.query("select add_task_file('new','s1',' grade 1 ',array['c3'])");
    await db.query("select add_task_file('shared','s1','Grade 2',array['c3','c4'])");
    assert.equal((await db.query("select * from task_files where school_id='s1' and lower(btrim(file_name))='grade 1'")).rows.length, 2);
    assert.deepEqual((await db.query("select category_id,status from task_file_categories where task_file_id='new'")).rows, [{category_id:'c3',status:''}]);
    assert.equal((await db.query("select status from task_file_categories where id='t1'")).rows[0].status, 'Done');
    assert.equal((await db.query("select * from task_file_categories where task_file_id='shared'")).rows.length, 2);
  } finally { await db.close(); }
});

test("overlapping selected categories reject duplicate filenames atomically", async () => {
  const db = await database();
  try {
    await filenameRules(db);
    await db.exec("insert into task_categories(id,name) values ('c3','Photos')");
    await assert.rejects(db.query("select add_task_file('bad','s1',' GRADE 1 ',array['c1','c3'])"), /selected category/i);
    assert.equal((await db.query("select * from task_files where id='bad'")).rows.length, 0);
    await db.query("select add_task_file('other-school','s2','Grade 1',array['c1'])");
  } finally { await db.close(); }
});

test("filename rename permits different categories but rejects an overlapping category", async () => {
  const db = await database();
  try {
    await filenameRules(db);
    await db.exec("insert into task_categories(id,name) values ('c3','Photos')");
    await db.query("select add_task_file('photos','s1','Photo file',array['c3'])");
    await db.exec("update task_files set file_name='Grade 1' where id='photos'");
    await db.query("select add_task_file('transactions','s1','Grade 2',array['c1'])");
    await assert.rejects(db.exec("update task_files set file_name=' grade 1 ' where id='transactions'"), /selected category/i);
    assert.equal((await db.query("select file_name from task_files where id='transactions'")).rows[0].file_name, 'Grade 2');
    await assert.rejects(db.exec("insert into task_file_categories(id,task_file_id,category_id) values ('overlap','photos','c1')"), /selected category/i);
  } finally { await db.close(); }
});

test("filename migration is repeatable and leaves all existing task data unchanged", async () => {
  const db = await database();
  try {
    await db.exec(migration());
    const files = (await db.query("select * from task_files order by id")).rows;
    const assignments = (await db.query("select * from task_file_categories order by id")).rows;
    const revised = readFileSync("supabase/phase39_category_filename_rules.sql", "utf8");
    await db.exec(revised);
    await db.exec(revised);
    assert.deepEqual((await db.query("select * from task_files order by id")).rows, files);
    assert.deepEqual((await db.query("select * from task_file_categories order by id")).rows, assignments);
  } finally { await db.close(); }
});

test("legacy inserts no longer merge matching names and rename keeps newer assignment values", async () => {
  const db = await database();
  try {
    await filenameRules(db);
    await db.exec("insert into task_categories(id,name) values ('c3','Photos')");
    await db.exec("insert into tasks(id,school_id,category,file_name,status) values ('legacy-new','s1','Photos','Grade 1','Open')");
    assert.equal((await db.query("select * from task_files")).rows.length,2);
    await db.query("select update_task_assignment('s1','t1','{\"status\":\"Open\",\"va_assigned\":[\"Owner\"]}')");
    await db.exec("update task_files set file_name='Updated' where id=(select task_file_id from task_file_categories where id='t1')");
    await db.query("select rename_task_category('c1','Renamed')");
    assert.deepEqual((await db.query("select a.status,a.va_assigned,f.file_name from task_file_categories a join task_files f on f.id=a.task_file_id where a.id='t1'")).rows,
      [{status:'Open',va_assigned:['Owner'],file_name:'Updated'}]);
  } finally { await db.close(); }
});

test("backup restore preserves independent same-named files and rolls back category duplicates", async () => {
  const db = await database();
  const backup = {
    vas:[{id:'va',name:'Owner',email:'owner@example.com',role:'owner'}],schools:[{id:'s1',name:'School 1'}],
    taskCategories:[{id:'c1',name:'Transactions'},{id:'c2',name:'Homeroom'}],checklistTemplate:[],checklistProgress:{},
    schoolData:{s1:{taskFiles:[
      {id:'f1',fileName:'Grade 1',categories:[{id:'a1',categoryId:'c1',status:'Done',vaAssigned:['Owner']}]},
      {id:'f2',fileName:'Grade 1',categories:[{id:'a2',categoryId:'c2',status:'Open',vaAssigned:[]}]},
    ]}},
  };
  try {
    await filenameRules(db);
    await db.query("select restore_school_task_backup($1)",[JSON.stringify(backup)]);
    assert.deepEqual((await db.query("select id,file_name from task_files order by id")).rows,[{id:'f1',file_name:'Grade 1'},{id:'f2',file_name:'Grade 1'}]);
    assert.deepEqual((await db.query("select id,status,va_assigned from task_file_categories order by id")).rows,[{id:'a1',status:'Done',va_assigned:['Owner']},{id:'a2',status:'Open',va_assigned:[]}]);
    backup.schoolData.s1.taskFiles[1].categories[0].categoryId='c1';
    await assert.rejects(db.query("select restore_school_task_backup($1)",[JSON.stringify(backup)]),/selected category/i);
    assert.equal((await db.query("select category_id from task_file_categories where id='a2'")).rows[0].category_id,'c2');
  } finally { await db.close(); }
});

test("legacy backup matching names restore independently without the retired unique index", async () => {
  const db = await database();
  const backup = {
    vas:[{id:'va',name:'Owner',email:'owner@example.com',role:'owner'}],schools:[{id:'s1',name:'School 1'}],
    taskCategories:[{id:'c1',name:'Transactions'},{id:'c2',name:'Homeroom'}],checklistTemplate:[],checklistProgress:{},
    schoolData:{s1:{tasks:[{id:'l1',category:'Transactions',fileName:'Grade 1',status:'Done',vaAssigned:['Owner']},{id:'l2',category:'Homeroom',fileName:'Grade 1',status:'Open',vaAssigned:[]}]}},
  };
  try {
    await filenameRules(db);
    await db.query("select restore_school_task_backup($1)",[JSON.stringify(backup)]);
    assert.equal((await db.query("select * from task_files")).rows.length,2);
    assert.deepEqual((await db.query("select id,status from task_file_categories order by id")).rows,[{id:'l1',status:'Done'},{id:'l2',status:'Open'}]);
  } finally { await db.close(); }
});

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
