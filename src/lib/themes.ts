// The theme list is shared with the Jekyll templates (the theme picker),
// so it lives in _data/themes.json. Styles are in _sass/themes/<id>/.
import themeList from "../../_data/themes.json";

export interface Theme {
  id: string;
  name: string;
  /** One uppercase letter used in share links; empty for the default theme. */
  code: string;
  /** Font files (in assets/fonts/, without .woff2) to fetch early; see src/head/early.ts */
  preload: string[];
}

export const THEMES: readonly Theme[] = themeList;
export const DEFAULT_THEME = THEMES[0];

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}

/** Unknown codes fall back to the default, so links from newer versions still open. */
export function themeByCode(code: string): Theme {
  return THEMES.find((t) => t.code === code) ?? DEFAULT_THEME;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme.id;
}
