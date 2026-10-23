// The Save icon on countdown and holiday pages (_includes/countdown.html):
// keeps the countdown or holiday on the My Days page, or takes it off again.
import { byId } from "./dom";
import { canSave, isSaved, removeSaved, saveCountdown, savedCountdowns, type SavedSource } from "./my-days";

export function setUpSaveButton(source: SavedSource): void {
  if (!canSave()) return; // e.g. private browsing: it wouldn't be kept
  const button = byId<HTMLButtonElement>("save-countdown");
  button.hidden = false;

  function show(): void {
    const saved = isSaved(source);
    button.setAttribute("aria-pressed", String(saved));
    // The icon fills in when saved (aria-pressed); the tooltip says what a click does
    button.title = saved ? "Saved to My Days. Click to remove it" : "Save to My Days, in this browser";
    // The header's "My Days" link (see src/head/early.ts)
    if (savedCountdowns().length) document.documentElement.dataset.saved = "";
    else delete document.documentElement.dataset.saved;
  }

  button.addEventListener("click", () => {
    if (isSaved(source)) removeSaved(source);
    else saveCountdown({ ...source, savedAt: Date.now() });
    show();
  });
  // Saved or removed in another tab
  addEventListener("storage", show);
  show();
}
