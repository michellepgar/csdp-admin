-- Phase 30: adds address to schools, following the exact same
-- convention as website/phone/fax/hours -- editable from the Contacts
-- page's row edit form, but only ever displayed on the school's own
-- page.
alter table schools
  add column if not exists address text;
