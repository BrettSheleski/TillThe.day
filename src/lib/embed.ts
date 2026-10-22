// The embed widget: a countdown shown inside other websites with an <iframe>
// pointing at embed.html. These build the widget's address and the HTML
// snippet people paste into their site.

/** Fixed size that fits the widget's content at any width from about 300px up. */
export const EMBED_HEIGHT = 250;

/** What the widget shows: a countdown link's token, or a holiday (in a given year, or the next). */
export type EmbedSource = { token: string } | { holiday: string; year?: number };

/** The widget's address. `embedPage` is the embed page's absolute URL. */
export function embedUrl(embedPage: string, source: EmbedSource): string {
  const url = new URL(embedPage);
  if ("token" in source) url.searchParams.set("c", source.token);
  else {
    url.searchParams.set("holiday", source.holiday);
    if (source.year) url.searchParams.set("year", String(source.year));
  }
  return url.toString();
}

/**
 * The <iframe> to paste into a web page. The title (read by screen readers)
 * comes from the countdown's message, so it's escaped: whatever the message
 * says, it can't break out of the attribute or add markup to someone's site.
 */
export function embedSnippet(src: string, title: string): string {
  return (
    `<iframe src="${escapeAttribute(src)}" title="${escapeAttribute(title)}" ` +
    `width="100%" height="${EMBED_HEIGHT}" loading="lazy" ` +
    `style="border:0;max-width:600px;border-radius:16px"></iframe>`
  );
}

function escapeAttribute(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
