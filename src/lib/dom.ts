/** Get an element by id, failing loudly if the page markup is missing it. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

/** Copy text to the clipboard and briefly show the result on the button. */
export async function copyToClipboard(text: string, button: HTMLElement): Promise<void> {
  const original = button.textContent;
  let ok: boolean;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    ok = legacyCopy(text);
  }
  button.textContent = ok ? "Copied!" : "Copy failed";
  setTimeout(() => (button.textContent = original), 1500);
}

/** Fallback for browsers or contexts where the async Clipboard API is unavailable. */
function legacyCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/** The name an iPhone suggests when the page is added to its home screen (see _includes/head.html). */
export function setHomeScreenName(name: string): void {
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute("content", name);
}
