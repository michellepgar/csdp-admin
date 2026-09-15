# React Maintenance Design

## Goal

Restore a useful lint check and remove the current source warnings without changing user-visible screens, task data, authentication behavior, or navigation outcomes.

## Scope

The work has two parts. First, ESLint must ignore the repository's `.worktrees` directory and generated artifacts, so `npm run lint` reports only real source findings. Second, the real findings in app and component source are addressed while preserving their current public interfaces and displayed behavior.

## Lint configuration

Keep the existing Next.js ESLint presets. Extend the global ignore list to exclude `.worktrees/**` as well as generated dependency/build folders. Do not weaken React or TypeScript lint rules to hide source findings.

## Behavior-preserving component changes

Tooltip and flyout components will measure their anchor when it opens, storing the resulting rectangle in state rather than reading a ref during render. They retain the same mouse, keyboard-focus, and tap interactions, labels, positions, and visual appearance.

Components currently mirroring props into state in effects will use a reset/keyed-state or event-driven pattern suited to their existing role. This includes task/category ordering, checklists, dropdown values, private-note board dimensions/order, and editor drafts. The rendered values, drag/drop sequence, save actions, and current reset behavior must remain unchanged.

Login and password-reset pages will derive URL error messages before render or initialize them without synchronous effect updates. Existing reset links, expired-link guidance, sign-in, sign-up, resend, forgot-password, and redirect behavior remain unchanged.

Navigation warnings will be resolved through the existing client router only where it preserves the necessary full page/session behavior. If a full reload is intentional for sign-out, demo-mode setup, or Supabase session transitions, that behavior remains explicit and covered by tests.

## Verification

Add or extend focused tests for tooltip positioning inputs, URL-error derivation, and the current task-order/file-edit and password-reset behaviors. Run the full Node test suite, `npm run lint`, and a production build. Manually check collapsed sidebar tooltips, task reorder/edit, login/recovery, and notes before release.

## Constraints

- No database migrations or Supabase policy changes.
- No design, copy, workflow, or navigation changes for users.
- No broad rule suppression or disabling ESLint rules.
- Preserve existing worktree and generated-file ignores.
