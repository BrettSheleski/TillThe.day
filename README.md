# Time Until

A static countdown page you can host on GitHub Pages. Pick a date, add an optional message, and share the link.

Nothing is stored on a server. The date and message are packed into a single `c` parameter in the URL:

```
https://<user>.github.io/<repo>/?c=<when>[<letters>][.<message> | ~<compressed message>]
```

- `<when>` is one of:
  - `<minutes>`: when a time was picked. The exact moment as minutes since 1970 (UTC), in base 36. The creator's time zone is applied when the link is made, so everyone counts down to the same moment, and each viewer sees it converted to their own time zone.
  - `_<days>`: when no time was picked. Days since 1970, in base 36. It counts down to midnight at the start of that date in each viewer's own time zone.
- `<letters>`: uppercase letters, in any order:
  - the theme's one-letter code, from `_data/themes.json`. Left out for the default (generic) theme.
  - `U` for a count-up (time since the date).
  - `Y` for a yearly repeat (birthdays, anniversaries). The link keeps the original date, and the page counts down to its next anniversary, showing which one it is (e.g. "37th"). Feb 29 falls on Feb 28 in other years.
  - `U` and `Y` are reserved and must never be used as theme codes.
- `.<message>`: the optional message as URL-safe base64 of its UTF-8 text.
- `~<compressed message>`: the same, but deflate-compressed first. Used instead of `.` when it's shorter, which is usually true for longer messages.

The message is encoded, not encrypted: anyone with the link can decode it. When the date has passed, the page counts the time since it.

## Project layout

This is a [Jekyll](https://jekyllrb.com/) site with TypeScript for page scripts. A GitHub Actions workflow compiles the TypeScript, builds the site and deploys it on every push to `main`.

```
_config.yml              Site settings (title, description, excluded files)
_layouts/default.html    Page shell: head, header, content, footer, page script
_includes/head.html      <head> contents: meta tags, title, stylesheet
_includes/header.html    Site header / nav
_includes/footer.html    Site footer
index.html               Home page: create a countdown, or view one from a link
holidays.html            Holiday list page, soonest first (/holidays/)
_holidays/<name>.md      One holiday countdown page each (/<name>/), laid out by _layouts/holiday.html
_includes/countdown.html The countdown and its buttons, shared by the home and holiday pages
assets/images/og-image.png  Link-preview image (1200x630); its source is src/images/og-image.svg
assets/images/favicon.svg   Site icon; favicon-32.png and apple-touch-icon.png are exported from it
assets/css/style.scss    Stylesheet entry: imports the _sass partials (Jekyll compiles it to style.css)
_data/themes.json        Theme list: id, name shown in the picker, link code
_sass/themes/<id>/       One folder per theme: _theme.scss (look) and _elapsed.scss (end animation)
_sass/themes/_index.scss Imports the themes; documents the settings each theme defines
_sass/_variables.scss    Layout sizes and the base font stack
_sass/_mixins.scss       theme-vars mixin: turns a map into CSS custom properties
_sass/_base.scss         Element defaults and shared text styles
_sass/_layout.scss       Header, footer and content card
_sass/_forms.scss        Inputs and buttons
_sass/_countdown.scss    Countdown display and create-page preview
src/pages/<page>.ts      One script per page (entry points)
src/lib/*.ts             Shared code, imported by page scripts: link format (token.ts), countdown display
                         and buttons (countdown-view.ts), holiday dates (holidays.ts), sharing (share.ts,
                         qr.ts), calendar (calendar.ts), themes (themes.ts)
assets/js/               Build output (git-ignored): one bundled <page>.js per page
.github/workflows/pages.yml  Build and deploy workflow
```

### Adding a page

1. Create the content file in the root, e.g. `about.html` or `about.md`:

   ```
   ---
   layout: default
   title: About
   script: about
   ---
   Your content here.
   ```

2. If the page needs JavaScript, create `src/pages/about.ts`. `script: about` loads its compiled `assets/js/about.js`. Leave `script` out for pages with no JavaScript.
3. Add a nav link in `_includes/header.html` if wanted.

Keep JavaScript out of the HTML files: put it in the page's `.ts` file, and put code shared between pages in `src/lib/`. Each page script is bundled with whatever it imports. Code used by several pages is split into shared chunk files, and code only needed on demand (like the QR code) can be loaded with `await import(...)` so it's fetched only when used.

Styles go in Sass partials under `_sass/`: add a new `_name.scss` there and `@import "name";` it in `assets/css/style.scss`. Use `@import`, not `@use`: GitHub Pages' Jekyll uses LibSass, which doesn't support `@use`.

Use `{{ '/path' | relative_url }}` for internal links so they work under the repo's subpath on GitHub Pages.

### Adding a theme

1. Create `_sass/themes/<id>/_theme.scss`. Set the theme settings listed in `_sass/themes/_index.scss` under `html[data-theme="<id>"]`, plus any extra rules the theme needs. Put its end animation, which plays once a viewed countdown reaches zero, in `_elapsed.scss` beside it, imported at the end of `_theme.scss`. Style it under `html[data-theme="<id>"].elapsed`, and use the `.fx i` particles if needed. Keep any movement inside `@media (prefers-reduced-motion: no-preference)`.
2. Import it in `_sass/themes/_index.scss`.
3. Add `{ "id": "<id>", "name": "<Name>", "code": "<X>" }` to `_data/themes.json`. The code is a single uppercase letter used in share links. It must be unique and must never change, or existing links will show the wrong theme.

The theme then shows up in the picker automatically. If it uses a new web font, add the font to the Google Fonts link in `_includes/head.html`.

### Adding a holiday

Create `_holidays/<name>.md`. It's published at `/<name>/`:

```
---
name: Christmas
title: How many days until Christmas?
description: Live countdown to Christmas Day, December 25. (Shown in search results.)
theme: holiday
order: 1225          # typical date as MMDD, for sorting
featured: true       # show in the quick links (optional)
rule: { type: fixed, month: 12, day: 25 }
---
A paragraph or two about the holiday, in Markdown.
```

The `rule` sets the date each year:

- `{ type: fixed, month: 12, day: 25 }`: the same date every year.
- `{ type: nth-weekday, month: 11, weekday: 4, n: 4 }`: the 4th Thursday of November. Weekdays run from 0 (Sunday) to 6 (Saturday). Use `n: -1` for the last one in the month.
- `{ type: easter }`: Western Easter Sunday.
- `{ type: season, season: summer }`: the exact moment of the equinox or solstice that starts `spring`, `summer`, `fall` or `winter` (Northern Hemisphere), calculated astronomically. These count down to the moment, not just the day.
- `{ type: dates, dates: ["2026-12-05", "2027-12-25"] }`: a list of dates, for holidays on lunar calendars. Quote each date. Take them from a reliable published source, and note it in the commit. A test fails a year before the list runs out, as a reminder to add more.
- Any rule can add `offset: <days>` to move it, e.g. `{ type: easter, offset: -47 }` for Mardi Gras, or Thanksgiving with `offset: 1` for Black Friday.

Add `featured: true` to show a holiday in the quick links on the home and holiday pages; every holiday appears on `/holidays/`. `order` is the holiday's typical date as MMDD (e.g. `1225`), used to sort the quick links.

The page counts down to the next date, celebrates on the day itself, and rolls over to next year the day after. It also appears in the holiday links and on `/holidays/` automatically.

### Link previews

`{% seo %}` in `_includes/head.html` (the jekyll-seo-tag plugin) adds the tags that chat and social apps read for link previews, using each page's `title`, `description` and `image`. Pages without an `image` use `assets/images/og-image.png`. Shared countdown links (`?c=…`) all get the home page's preview, because preview apps don't run the script that reads the link.

### Cache busting

Link to CSS, JavaScript and icon files with `{% include asset-url.html path='/assets/...' %}` instead of `relative_url`. It adds `?v=<build time>`, so every deploy gives browsers new URLs and they fetch the new files instead of cached ones. Script chunks (`assets/js/chunks/`) don't need it: esbuild puts a content hash in their file names.

### Full screen

Countdown and holiday pages have a **Full screen** button (or press **F**) for TVs and parties: it hides everything but the countdown, sizes it to the screen, keeps the screen awake where the browser allows it, and hides the cursor when the mouse is idle. Esc, F or the Exit button leaves. The layout is in `_sass/_present.scss`; themes can adjust it under `html[data-theme="<id>"].presenting` (Arcade does, for its wide font). Where the browser won't go truly full screen (iPhone), the big layout still applies.

### Fonts

Theme fonts are self-hosted (`assets/fonts/`), not loaded from Google Fonts, so visitors' browsers don't contact Google. They come from the [Fontsource](https://fontsource.org/) npm packages. To add a font or weight, add it to `FONTS` in `scripts/self-host-fonts.mjs`, run `npm run fonts`, and commit the results (the font files, their licenses and `_sass/_fonts.scss`). A test fails if a theme uses a font that isn't self-hosted.

### Privacy policy

`privacy.md` (at `/privacy/`, linked from every footer) explains what the site and the services it uses collect. Keep it accurate: a test fails if the page templates load a service from another domain that the policy doesn't mention. Update `last_updated` in its front matter when it changes. Other plain text pages can use `layout: page` the same way.

### Analytics

Visits are counted with [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/): free, no cookies, and it doesn't record query strings, so the messages in shared links never reach it. To turn it on, add a site in the Cloudflare dashboard under **Analytics & Logs > Web Analytics** (the hostname must match the live site), choose the manual JavaScript setup, and put the token from its snippet in `cloudflare_analytics_token` in `_config.yml`. Leave it empty to turn analytics off. The footer mentions analytics only while it's on.

## Tests

```
npm test
```

The tests in `tests/` cover the parts where a silent break would hurt most:

- `token.test.ts`: the link format. It includes real links that were already shared, which must always open the same countdown. **Never change those expectations to make a test pass:** fix the code instead, or old links break.
- `holidays.test.ts`: holiday date rules, against known dates.
- `calendar.test.ts`: the .ics file (checked with a real iCalendar parser) and the Google/Outlook links.
- `site-data.test.ts`: that themes, Sass and holiday pages agree, e.g. unique theme letters, no theme using `U`, every holiday using a real theme.

The deploy workflow runs the tests first, so a failing test stops the deploy.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository with `main` as the default branch.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Each push to `main` runs the workflow. When it finishes, the site is live at `https://<user>.github.io/<repo>/`.

## Run locally

Requires [Node.js](https://nodejs.org/) and [Ruby](https://www.ruby-lang.org/en/documentation/installation/) (on Windows, use RubyInstaller with Devkit).

```
npm install
bundle install
```

Then run these in two terminals:

```
npm run watch
bundle exec jekyll serve --livereload
```

and open http://localhost:4000. `npm run build` does a one-off type check and minified build.
