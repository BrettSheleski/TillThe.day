// Ways to share a countdown: the device's own share sheet, and links that
// open common apps with the message filled in. The QR code is in ./qr.ts.

export interface ShareInfo {
  title: string;
  text: string;
  url: string;
}

export function shareLinks({ title, text, url }: ShareInfo) {
  const enc = encodeURIComponent;
  return {
    email: `mailto:?subject=${enc(title)}&body=${enc(`${text}\n\n${url}`)}`,
    whatsapp: `https://wa.me/?text=${enc(`${text} ${url}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    x: `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`,
  };
}

/** Whether the browser has a share sheet (most phones, and Windows/macOS Chrome, Edge and Safari). */
export function canShareNatively(info: ShareInfo): boolean {
  return typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(info));
}

/** Open the share sheet; returns quietly if the person closes it. */
export async function shareNatively(info: ShareInfo): Promise<void> {
  try {
    await navigator.share(info);
  } catch (e) {
    if ((e as DOMException).name !== "AbortError") throw e;
  }
}
