-- phase70_carry_over_needs_type_question.sql — run once in Supabase's SQL
-- Editor for project jqsqstjmfsqqrnoxpuvn, AFTER phase69_issue_school_field.sql.
--
-- Review Patient Information and Charting Questions no longer show their
-- old "Type" (correction_kind), "Needs" (needs_*_correction/
-- other_correction_detail) or "Question" fields -- those columns still
-- exist on already-saved rows but nothing displays them anymore. This
-- copies that old information into the Note field (remarks) for existing
-- rows only, so nothing already on the page gets silently hidden. New
-- rows never set those old columns, so this only ever needs to run once.

-- Review Patient Information (type = 'correction'): "Type: <kind> - <needs list>"
update issues
set remarks = concat_ws(' | ',
  nullif(remarks, ''),
  concat_ws(' - ',
    case when correction_kind is not null then 'Type: ' || correction_kind end,
    nullif(concat_ws(', ',
      case when needs_name_correction then 'Name' end,
      case when needs_dob_correction then 'DOB' end,
      case when needs_insurance_correction then 'Insurance' end,
      case when needs_other_correction then coalesce(nullif(other_correction_detail, ''), 'Other') end
    ), '')
  )
)
where type = 'correction'
  and (
    correction_kind is not null
    or needs_name_correction
    or needs_dob_correction
    or needs_insurance_correction
    or needs_other_correction
  );

-- Charting Questions (type = 'charting'): the old free-text question
update issues
set remarks = concat_ws(' | ', nullif(remarks, ''), nullif(question, ''))
where type = 'charting' and question is not null and question <> '';
