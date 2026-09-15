# Team Presence Design

## Goal

Show which signed-in team members currently have CSDP Tracker open. Make active members easy to identify, make inactive members visually subdued after five minutes, and keep the information compact in both the expanded and collapsed sidebar.

## Scope

This is a live, session-only indicator. It does not create a history of logins, activity, or pages viewed, and it does not affect task assignments, task status, or access permissions.

## Presence model

The browser joins a private Supabase Realtime Presence channel named `team-presence` once the signed-in app shell has the authenticated team-member record.

Each tab creates and stores a random tab key in `sessionStorage`. Its tracked payload contains only the team-member ID, display name, avatar color, active/idle state, and the timestamp of the most recent meaningful activity. It never sends an email address or task data.

The browser tracks on initial join, active-to-idle and idle-to-active changes, document visibility changes, and connection recovery. Local activity events reset the five-minute idle timer, but they do not each send a network message. A tab becomes idle after five minutes without pointer, keyboard, scroll, touch, or focused-window activity. Closing a tab or losing the Realtime connection removes its presence automatically.

The roster groups tab entries by team-member ID. A member is active when any of their open tabs is active, idle when every remaining tab is idle, and absent when no tabs remain. This prevents one person from appearing more than once when they have multiple tabs open.

## Authorization

Realtime Presence is enabled only for the private `team-presence` channel. A Supabase migration grants authenticated users who satisfy the existing `is_team_member()` check permission to send and receive Presence messages for that exact topic. Other users cannot join or observe the roster.

## Sidebar experience

The top of the sidebar retains only **CSDP Tracker**; it no longer duplicates the current account name.

The bottom area contains an **Online now** section immediately above **Account**. In the expanded sidebar it shows overlapping initials avatars, a green dot for active members, and a faded avatar with muted dot for idle members. It displays up to five members and a `+N` avatar for additional members. Hovering or focusing an avatar reveals the person’s name and status.

In the collapsed sidebar, the same section displays up to three initials avatars plus `+N`; dots remain visible and names remain available through accessible labels/tooltips. The Account section shows the signed-in member as `<name> · Signed in`, followed by the Sign out button.

If realtime data is still connecting or is unavailable, the app keeps the sidebar usable and displays no remote roster rather than an error. The current signed-in member is still shown in Account.

## Components and data flow

`app/(app)/layout.tsx` continues to obtain the authenticated member. `SidebarShell` supplies the minimum current-member identity needed by a new client-side `TeamPresence` component mounted within `Sidebar`.

`TeamPresence` owns the Realtime subscription, idle timer, browser event listeners, aggregation of Presence state, and cleanup. A small pure helper aggregates tab payloads into one presentation record per member. `Sidebar` remains responsible for layout and passes the collapsed state into the presence view.

## Testing and verification

Add unit tests for tab aggregation, active/idle precedence, stale/invalid payload handling, and the five-avatar/three-avatar overflow rules. Add static component tests for the relocated account name and collapsed avatar rendering.

After deployment, verify with two signed-in accounts that: both appear; one fades after five inactive minutes; activity restores green immediately; a second tab does not duplicate the person; closing the last tab removes the person; and unauthorized users cannot subscribe to the private channel.

## Constraints

- Use throttled state transitions rather than frequent activity reporting.
- Do not persist user activity or expose email addresses.
- Keep the existing sidebar navigation, account controls, and sign-out behavior intact.
- Do not include the planned daily task overview in this feature.
