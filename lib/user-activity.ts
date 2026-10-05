/* Browser-only. Whether the person at this tab is actually using it.

   The background checks (page refresh, notification bell, chat unread
   counts) each wake a server function on Vercel, whose CPU time is limited
   on the plan. A tab left open on a screen nobody is touching doesn't need
   them, so they pause after a while without any mouse, keyboard or touch
   input, and catch up the moment the person is back. */

export const IDLE_AFTER_MS = 10 * 60 * 1000;

let lastActive = Date.now();
let started = false;
const backListeners = new Set<() => void>();

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  const mark = () => {
    const wasIdle = Date.now() - lastActive > IDLE_AFTER_MS;
    lastActive = Date.now();
    if (wasIdle) for (const listener of backListeners) listener();
  };
  for (const type of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "focus"]) window.addEventListener(type, mark, { passive: true, capture: true });
  // Coming back to the tab counts too, so the page catches up the moment it's shown again.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") mark();
  }, { capture: true });
}

/** True when nobody has used this tab for a while. */
export function isUserIdle(): boolean {
  start();
  return Date.now() - lastActive > IDLE_AFTER_MS;
}

/** True when a background check is worth running: the tab is on screen and someone is using it. */
export function tabInUse(): boolean {
  return document.visibilityState === "visible" && !isUserIdle();
}

/** Calls `listener` when someone uses the tab again after it went idle. Returns the unsubscribe function. */
export function onUserBack(listener: () => void): () => void {
  start();
  backListeners.add(listener);
  return () => {
    backListeners.delete(listener);
  };
}
