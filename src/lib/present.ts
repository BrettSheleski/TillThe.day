// Full-screen presentation mode, for TVs, parties and classrooms: hides
// everything but the countdown, makes it as big as the screen, and keeps the
// screen awake. The layout comes from the "presenting" class on <html>
// (see _sass/_present.scss).
//
// Where the browser won't go truly full screen (iPhone), the big layout
// still applies inside the normal browser window.

const IDLE_MS = 3000;

export function setUpPresenting(button: HTMLElement, exitButton: HTMLElement): void {
  const root = document.documentElement;
  let wakeLock: WakeLockSentinel | null = null;
  let idleTimer = 0;

  const presenting = () => root.classList.contains("presenting");

  async function enter(): Promise<void> {
    root.classList.add("presenting");
    exitButton.hidden = false;
    noteActivity();
    try {
      if (document.fullscreenEnabled) await root.requestFullscreen({ navigationUI: "hide" });
    } catch {
      // Not allowed (e.g. no user gesture): the big layout still applies
    }
    await keepAwake();
  }

  async function exit(): Promise<void> {
    root.classList.remove("presenting", "idle");
    exitButton.hidden = true;
    clearTimeout(idleTimer);
    await wakeLock?.release().catch(() => {});
    wakeLock = null;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  }

  /** Stop the screen dimming or sleeping, where the browser supports it. */
  async function keepAwake(): Promise<void> {
    if (!("wakeLock" in navigator) || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => (wakeLock = null));
    } catch {
      // Denied, e.g. battery saver; the countdown still works
    }
  }

  /** Show the cursor and Exit button, then hide them again after a pause. */
  function noteActivity(): void {
    root.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => presenting() && root.classList.add("idle"), IDLE_MS);
  }

  button.hidden = false;
  button.addEventListener("click", () => enter());
  exitButton.addEventListener("click", () => exit());

  document.addEventListener("keydown", (e) => {
    // Key presses can come from the document itself, which isn't an Element
    const typing = e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]");
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "f" || e.key === "F") presenting() ? exit() : enter();
    else if (e.key === "Escape" && presenting()) exit();
  });

  // Leaving true full screen another way (e.g. Esc, which the browser
  // handles itself) ends presenting too
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && presenting()) exit();
  });

  // The browser drops the wake lock when the page is hidden; take it back
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && presenting()) keepAwake();
  });

  for (const type of ["mousemove", "pointerdown", "touchstart"]) {
    document.addEventListener(type, () => presenting() && noteActivity(), { passive: true });
  }
}
