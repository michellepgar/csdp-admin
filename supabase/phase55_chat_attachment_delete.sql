-- phase55_chat_attachment_delete.sql — run once in Supabase's SQL Editor
-- for project jqsqstjmfsqqrnoxpuvn. Requires phase54_chat_attachments.sql.
--
-- Lets the person who SENT an attachment delete it early (before the
-- 30-day expiry), for everyone in the chat. Only the sender can; the
-- message itself stays, showing that the file was deleted. It reuses the
-- expiry flag, so the storage policy that lets the app remove expired
-- files covers this too.

alter table chat_messages add column if not exists attachment_removed boolean not null default false;

create or replace function chat_remove_attachment(p_message_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  if auth.uid() is null or not is_team_member() then
    raise exception 'Not authorized';
  end if;

  update chat_messages
     set attachment_expired = true,
         attachment_removed = true
   where id = p_message_id
     and sender_name = chat_my_name()
     and chat_can_access(room)
     and attachment_path is not null
     and not attachment_expired
  returning attachment_path into v_path;

  return v_path;
end;
$$;

revoke all on function chat_remove_attachment(text) from public;
grant execute on function chat_remove_attachment(text) to authenticated;
