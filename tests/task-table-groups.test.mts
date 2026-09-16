import assert from "node:assert/strict";
import test from "node:test";
import * as taskFiles from "../lib/shared-task-files.ts";
import type { TaskFile } from "../lib/app-state.ts";

const categories = [
  {id:"encoding",name:"Encoding & Uploading (Consent & SDF)"},
  {id:"treatment",name:"Treatment Recommendation"},
  {id:"teacher",name:"Adding Teacher & Homeroom"},
  {id:"unused",name:"Insurance"},
];
function file(id:string, fileName:string, categoryIds:string[]):TaskFile {
  return {id,fileName,sortOrder:0,createdAt:"2026-09-16",categories:categoryIds.map((categoryId,index)=>({
    id:`${id}-${categoryId}`,taskFileId:id,categoryId,category:categories.find((c)=>c.id===categoryId)!.name,
    status:"",vaAssigned:[],sortOrder:index,
  }))};
}
function groups(files:TaskFile[]) {
  assert.equal(typeof taskFiles.groupTaskTables,"function","table grouping must be available");
  return taskFiles.groupTaskTables(categories,files);
}

test("unrelated encoding and treatment files render in separate category tables",()=>{
  const result=groups([file("e","Consent batch.pdf",["encoding"]),file("t","Treatment.xlsx",["treatment"])]);
  assert.deepEqual(result.map((group)=>({categories:group.categories.map((c)=>c.id),files:group.files.map((f)=>f.fileName)})),[
    {categories:["encoding"],files:["Consent batch.pdf"]},
    {categories:["treatment"],files:["Treatment.xlsx"]},
  ]);
});

test("deliberately shared files stay in one table with only their selected categories",()=>{
  const result=groups([
    file("single","Treatment only.xlsx",["treatment"]),
    file("shared1","Grade 1.xlsx",["treatment","teacher"]),
    file("shared2","Grade 2.xlsx",["teacher","treatment"]),
  ]);
  assert.deepEqual(result.map((group)=>({categories:group.categories.map((c)=>c.id),files:group.files.map((f)=>f.id)})),[
    {categories:["treatment"],files:["single"]},
    {categories:["treatment","teacher"],files:["shared1","shared2"]},
  ]);
});

test("table order follows category order and empty categories never appear",()=>{
  const result=groups([file("t","Treatment.xlsx",["treatment"]),file("e1","First.pdf",["encoding"]),file("e2","Second.pdf",["encoding"])]);
  assert.deepEqual(result.map((group)=>group.categories.map((c)=>c.id)),[["encoding"],["treatment"]]);
  assert.deepEqual(result[0].files.map((f)=>f.id),["e1","e2"]);
  assert.deepEqual(groups([]),[]);
});
