import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

/* Runs supabase/phase80_security_lockdown.sql on a small stand-in for the real
   database (same table shapes and helper functions), then acts as different
   signed-in people to prove the new rules hold. */
async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;

    create table vas (id text primary key, name text not null, email text, admin boolean, role text, color text);
    alter table vas enable row level security;
    create function is_team_member() returns boolean language sql security definer set search_path = public stable as $$
      select exists (select 1 from vas where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
    $$;
    create policy "team members can access vas" on vas for all
      using (auth.uid() is not null and is_team_member()) with check (auth.uid() is not null and is_team_member());

    create function chat_my_name() returns text language sql security definer set search_path = public stable as $$
      select name from vas where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1;
    $$;
    create function chat_can_access(p_room text) returns boolean language sql security definer set search_path = public stable as $$
      select case when chat_my_name() is null then false when p_room = 'team' then true
        when p_room like 'dm:%' then chat_my_name() = any(string_to_array(substr(p_room, 4), '|')) else false end;
    $$;

    create function restore_vas_and_schools(new_vas jsonb, new_schools jsonb) returns void language plpgsql security definer set search_path = public as $$
    begin delete from vas where true; end; $$;
    grant execute on function restore_vas_and_schools(jsonb, jsonb) to authenticated;

    create table private_notes (id text primary key, text text not null, author text not null, shared_with text[] not null default '{}', ack_by text[] not null default '{}', comment_ack_by text[] not null default '{}', board_z integer);
    alter table private_notes enable row level security;
    create policy "team members can access private_notes" on private_notes for all
      using (auth.uid() is not null and is_team_member()) with check (auth.uid() is not null and is_team_member());

    create table private_note_comments (id text primary key, note_id text not null references private_notes(id) on delete cascade, author text not null, text text not null);
    alter table private_note_comments enable row level security;
    create policy "team members can access private_note_comments" on private_note_comments for all
      using (auth.uid() is not null and is_team_member()) with check (auth.uid() is not null and is_team_member());

    create table chat_messages (id text primary key default gen_random_uuid()::text, room text not null, sender_name text not null, body text not null default '',
      attachment_path text, attachment_expired boolean, attachment_removed boolean);
    alter table chat_messages enable row level security;
    create policy "read rooms you are in" on chat_messages for select using (chat_can_access(room));
    create policy "send as yourself in rooms you are in" on chat_messages for insert with check (chat_can_access(room) and sender_name = chat_my_name());

    grant usage on schema public to anon, authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant usage on schema auth to anon, authenticated;
    grant execute on all functions in schema auth to anon, authenticated;
    grant execute on all functions in schema public to anon;

    insert into vas values
      ('m', 'Michelle', 'michelle@example.com', true, 'owner', null),
      ('j', 'Jane', 'jane@example.com', false, null, null),
      ('k', 'John', 'john@example.com', false, null, null);
    insert into private_notes (id, text, author, shared_with) values
      ('n-jane', 'Jane only', 'Jane', '{}'),
      ('n-shared', 'Jane shares with John', 'Jane', '{John}'),
      ('n-michelle', 'Michelle only', 'Michelle', '{}');
    insert into private_note_comments values ('c1', 'n-jane', 'Jane', 'on my own note'), ('c2', 'n-shared', 'Jane', 'on shared note');
  `);
  await db.exec(readFileSync("supabase/phase80_security_lockdown.sql", "utf8"));
  return db;
}

const USERS = {
  michelle: { sub: "00000000-0000-0000-0000-00000000000a", email: "michelle@example.com" },
  jane: { sub: "00000000-0000-0000-0000-00000000000b", email: "jane@example.com" },
  john: { sub: "00000000-0000-0000-0000-00000000000c", email: "john@example.com" },
  stranger: { sub: "00000000-0000-0000-0000-00000000000d", email: "stranger@example.com" },
};

/* Runs `sql` as a signed-in person (or signed out) and returns the rows, or the error message. */
async function as(db: PGlite, who: keyof typeof USERS | "anon", sql: string): Promise<{ rows: Record<string, unknown>[]; error?: string }> {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', $1, false)", [who === "anon" ? "" : JSON.stringify(USERS[who])]);
  await db.exec(who === "anon" ? "set role anon" : "set role authenticated");
  try {
    const result = await db.query<Record<string, unknown>>(sql);
    return { rows: result.rows };
  } catch (error) {
    return { rows: [], error: (error as Error).message };
  } finally {
    await db.exec("reset role");
  }
}

test("nobody can call the old team-wipe function directly, signed in or not", async () => {
  const db = await database();
  for (const who of ["stranger", "jane", "michelle", "anon"] as const) {
    const result = await as(db, who, "select restore_vas_and_schools('[]'::jsonb, '[]'::jsonb)");
    assert.match(result.error ?? "", /permission denied/, `${who} could run it`);
  }
  const count = await db.query<{ n: number }>("select count(*)::int as n from vas");
  assert.equal(count.rows[0].n, 3);
});

test("only admins can change the team list; nobody can make themselves admin or rename people", async () => {
  const db = await database();
  await as(db, "jane", "update vas set admin = true where name = 'Jane'");
  await as(db, "jane", "update vas set name = 'Michelle' where name = 'Jane'");
  await as(db, "jane", "delete from vas where name = 'John'");
  const insert = await as(db, "jane", "insert into vas (id, name, email) values ('x', 'Hacker', 'h@example.com')");
  assert.match(insert.error ?? "", /row-level security/);
  const jane = await db.query<{ name: string; admin: boolean | null }>("select name, admin from vas where id = 'j'");
  assert.deepEqual(jane.rows[0], { name: "Jane", admin: false });
  assert.equal((await db.query("select 1 from vas where id = 'k'")).rows.length, 1, "John must still exist");

  // Everyone on the team can still read the list, and an admin can still change it.
  assert.equal((await as(db, "jane", "select name from vas")).rows.length, 3);
  await as(db, "michelle", "update vas set color = '#123456' where id = 'k'");
  assert.equal((await db.query<{ color: string }>("select color from vas where id = 'k'")).rows[0].color, "#123456");
  // Someone not on the team sees nothing.
  assert.equal((await as(db, "stranger", "select name from vas")).rows.length, 0);
});

test("private notes are visible only to their author and the people they're shared with", async () => {
  const db = await database();
  const ids = async (who: keyof typeof USERS) => (await as(db, who, "select id from private_notes order by id")).rows.map((r) => r.id);
  assert.deepEqual(await ids("jane"), ["n-jane", "n-shared"]);
  assert.deepEqual(await ids("john"), ["n-shared"]);
  assert.deepEqual(await ids("michelle"), ["n-michelle"], "an admin can't read other people's private notes");
  assert.deepEqual(await ids("stranger"), []);

  // John can't edit or delete Jane's private note; he can mark the shared one as seen.
  await as(db, "john", "update private_notes set text = 'hacked' where id = 'n-jane'");
  await as(db, "john", "delete from private_notes where id = 'n-shared'");
  await as(db, "john", "update private_notes set ack_by = '{John}' where id = 'n-shared'");
  const notes = await db.query<{ id: string; text: string; ack_by: string[] }>("select id, text, ack_by from private_notes order by id");
  assert.equal(notes.rows.find((n) => n.id === "n-jane")?.text, "Jane only");
  assert.deepEqual(notes.rows.find((n) => n.id === "n-shared")?.ack_by, ["John"]);

  // Nobody can create a note in someone else's name.
  const forged = await as(db, "john", "insert into private_notes (id, text, author) values ('f', 'x', 'Jane')");
  assert.match(forged.error ?? "", /row-level security/);
  assert.equal((await as(db, "john", "insert into private_notes (id, text, author) values ('own', 'mine', 'John') returning id")).rows.length, 1);

  // Comments follow their note.
  const comments = async (who: keyof typeof USERS) => (await as(db, who, "select id from private_note_comments order by id")).rows.map((r) => r.id);
  assert.deepEqual(await comments("john"), ["c2"]);
  assert.deepEqual(await comments("michelle"), []);
  const sneaky = await as(db, "john", "insert into private_note_comments values ('c3', 'n-jane', 'John', 'hi')");
  assert.match(sneaky.error ?? "", /row-level security/);
});

test("an admin removing a teammate can delete that person's private notes, and only an admin", async () => {
  const db = await database();
  const denied = await as(db, "john", "select admin_delete_private_notes_by_author('Jane')");
  assert.match(denied.error ?? "", /Only an admin/);
  assert.equal((await db.query("select 1 from private_notes where author = 'Jane'")).rows.length, 2);
  const ok = await as(db, "michelle", "select admin_delete_private_notes_by_author('Jane')");
  assert.equal(ok.error, undefined);
  assert.equal((await db.query("select 1 from private_notes where author = 'Jane'")).rows.length, 0);
  assert.equal((await db.query("select 1 from private_note_comments")).rows.length, 0, "their comments go with them");
});

test("a chat message can only carry a file from the sender's own folder", async () => {
  const db = await database();
  const own = await as(db, "jane", `insert into chat_messages (room, sender_name, attachment_path) values ('team', 'Jane', '${USERS.jane.sub}/photo.png') returning id`);
  assert.equal(own.rows.length, 1);
  const theirs = await as(db, "jane", `insert into chat_messages (room, sender_name, attachment_path) values ('team', 'Jane', '${USERS.john.sub}/photo.png')`);
  assert.match(theirs.error ?? "", /row-level security/);
  const expired = await as(db, "jane", `insert into chat_messages (room, sender_name, attachment_path, attachment_expired) values ('team', 'Jane', '${USERS.jane.sub}/a.png', true)`);
  assert.match(expired.error ?? "", /row-level security/);
  const plain = await as(db, "jane", "insert into chat_messages (room, sender_name, body) values ('team', 'Jane', 'hello') returning id");
  assert.equal(plain.rows.length, 1);
});

test("the update can be run twice without errors", async () => {
  const db = await database();
  await db.exec(readFileSync("supabase/phase80_security_lockdown.sql", "utf8"));
});
