-- phase6_backfill.sql — run once, immediately after
-- phase6_relational_issues_approvals.sql and BEFORE deploying the app
-- code that reads from these tables. Preserves each item's own
-- createdAt from the blob -- a real historical timestamp, not
-- invented at backfill time.

insert into issues (
  id, type, reported_by, status, created_at, description, category, remarks,
  student_name, dob, insurance_number, school_year, file_name, page_number,
  correcting_category, correct_info, correction_kind, student_record_link,
  needs_name_correction, needs_dob_correction, needs_insurance_correction,
  needs_other_correction, other_correction_detail, question, fixed_by
)
select
  i->>'id',
  i->>'type',
  i->>'reportedBy',
  coalesce(i->>'status', 'Pending'),
  coalesce((i->>'createdAt')::timestamptz, now()),
  i->>'description',
  i->>'category',
  i->>'remarks',
  i->>'studentName',
  i->>'dob',
  i->>'insuranceNumber',
  i->>'schoolYear',
  i->>'fileName',
  i->>'pageNumber',
  i->>'correctingCategory',
  i->>'correctInfo',
  i->>'correctionKind',
  i->>'studentRecordLink',
  (i->>'needsNameCorrection')::boolean,
  (i->>'needsDobCorrection')::boolean,
  (i->>'needsInsuranceCorrection')::boolean,
  (i->>'needsOtherCorrection')::boolean,
  i->>'otherCorrectionDetail',
  i->>'question',
  coalesce((select array_agg(x) from jsonb_array_elements_text(i->'fixedBy') as x), '{}')
from app_state, jsonb_array_elements(coalesce(data->'issues', '[]'::jsonb)) as i
where id = 1;

insert into access_requests (
  id, record_kind, school_id, target_id, label, reason, requested_by,
  status, resolved_by, resolved_at, created_at
)
select
  r->>'id',
  r->>'recordKind',
  r->>'schoolId',
  r->>'targetId',
  r->>'label',
  r->>'reason',
  r->>'requestedBy',
  coalesce(r->>'status', 'pending'),
  r->>'resolvedBy',
  (r->>'resolvedAt')::timestamptz,
  coalesce((r->>'createdAt')::timestamptz, now())
from app_state, jsonb_array_elements(coalesce(data->'accessRequests', '[]'::jsonb)) as r
where id = 1;
