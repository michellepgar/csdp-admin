/* The notification chime + mute preference, shared by the notification
   bell and the Messages nav (components/mentions-bell.tsx,
   components/messages-nav.tsx) so both sound the same and one mute
   toggle covers both. */

export const SOUND_KEY = "notification-sound";

/* A short two-note chime made with the Web Audio API (no audio file to
   ship or load). Browsers keep audio locked until the person has
   interacted with the page at least once, so a chime before any click
   just silently doesn't play -- caught, never surfaced as an error. */
export function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    void ctx.resume();
    const start = ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start + i * 0.14);
      gain.gain.linearRampToValueAtTime(0.18, start + i * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + i * 0.14 + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start + i * 0.14);
      osc.stop(start + i * 0.14 + 0.55);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // Audio blocked or unsupported -- nothing to do.
  }
}

export function readSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}
