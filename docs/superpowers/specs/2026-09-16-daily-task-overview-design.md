# Daily Task Overview Design

## Goal

Show a live Today view on Overview: tasks still In Progress and tasks completed today, without making legacy work marked complete during the tracker rollout appear as newly completed today.

## Data model

Add a nullable `tasks.completed_on date` column. It stores the Asia/Manila calendar date only when a task is completed through the normal ongoing workflow.

Selecting **Completed** for new work sets `completed_on` to the current Asia/Manila date. Reopening a task clears it. A separate **Previously completed** action sets status to Completed while leaving `completed_on` null. Existing completed rows are backfilled with null so they never appear in the live Today list.

## User interface

Overview retains **Currently Working On**, which lists every task whose status is In Progress. It naturally remains accurate on a new day: a task still in progress continues to appear until it is completed.

A new **Completed Today** section lists only tasks whose `completed_on` is today in Asia/Manila, grouped by assigned VA and linked to its school. Tasks without a VA still appear in an Unassigned group.

On school task rows, the normal Completed status remains the daily completion path. Add a discreet **Previously completed** control for rollout backfill; it is hidden for rows already completed.

## Constraints

- Overview is live Today only; it has no date picker or historical reports.
- Backfilled and reopened work must not appear in Completed Today.
- Demo mode follows the same semantics in cookie-backed state.
- General Tasks are out of scope for this first version; the request applies to school task files.
