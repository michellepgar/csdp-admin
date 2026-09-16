# Selective table categories

Approved in chat: add a category to selected existing files, only when needed, and deploy.

Keep the category dropdown first and file name second in the add-file form; it selects one initial category. Each existing table has a discreet Add category control opening a category dropdown and unchecked file checkboxes. Submit applies only to checked file IDs, never names. Existing assignments are not reset. Duplicate names remain unrestricted.

Persist table membership independently of assigned categories so selected rows stay beside unselected rows. Preserve existing tables by backfilling membership from their exact category sets. Within a table, original categories precede categories added later. New category cells are blank for unselected rows.

Every table reserves one 72px Count column and a common filename start. Count cells contain only count controls (with labels for multiple independent counts); unused cells are blank. Filename is flexible. Task columns are 240px and right-positioned before the 28px file-remove column. VA precedes status. Edit stays beside filename. No empty category tables.

Replace inline communications sections with optional Initial Communications and Recheck Communications categories, available globally and represented in the yearly checklist. Copy meaningful existing communications status/signatures to independent assignments without altering legacy fields; empty communications are not automatically added. The right collapsible checklist and all unrelated UI remain unchanged.

All database operations authenticate team membership, validate school/table/file ownership, serialize per-school writes, and apply selected assignments atomically. Migration is additive and repeatable. Preserve backup table membership and legacy communications fields.

Verify helper grouping/layout/selection and migration against real PostgreSQL-compatible PGlite. Run the full test suite, lint, TypeScript and production build, get read-only review, apply migration to production, then push main and confirm Vercel Ready. Do not claim a restricted live browser smoke check was performed.
