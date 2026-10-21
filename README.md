# Time Until

A static countdown page you can host on GitHub Pages. Pick a date, add an optional message, and share the link.

Nothing is stored on a server. The date and message are packed into a single `c` parameter in the URL:

```
https://<user>.github.io/<repo>/?c=<when>[<theme>][.<message> | ~<compressed message>]
```

- `<when>` is one of:
  - `<minutes>`: when a time was picked. The exact moment as minutes since 1970 (UTC), in base 36. The creator's time zone is applied when the link is made, so everyone counts down to the same moment, and each viewer sees it converted to their own time zone.
  - `_<days>`: when no time was picked. Days since 1970, in base 36. It counts down to midnight at the start of that date in each viewer's own time zone.
- `<theme>`: one uppercase letter for the theme, from `_data/themes.json`. Left out for the default (generic) theme.
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
index.html               Countdown page content
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
src/lib/*.ts             Shared code, imported by page scripts (token.ts, themes.ts, dom.ts)
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

Keep JavaScript out of the HTML files: put it in the page's `.ts` file, and put code shared between pages in `src/lib/`. Each page script is bundled with whatever it imports, so every page loads exactly one file.

Styles go in Sass partials under `_sass/`: add a new `_name.scss` there and `@import "name";` it in `assets/css/style.scss`. Use `@import`, not `@use`: GitHub Pages' Jekyll uses LibSass, which doesn't support `@use`.

Use `{{ '/path' | relative_url }}` for internal links so they work under the repo's subpath on GitHub Pages.

### Adding a theme

1. Create `_sass/themes/<id>/_theme.scss`. Set the theme settings listed in `_sass/themes/_index.scss` under `html[data-theme="<id>"]`, plus any extra rules the theme needs. Put its end animation, which plays once a viewed countdown reaches zero, in `_elapsed.scss` beside it, imported at the end of `_theme.scss`. Style it under `html[data-theme="<id>"].elapsed`, and use the `.fx i` particles if needed. Keep any movement inside `@media (prefers-reduced-motion: no-preference)`.
2. Import it in `_sass/themes/_index.scss`.
3. Add `{ "id": "<id>", "name": "<Name>", "code": "<X>" }` to `_data/themes.json`. The code is a single uppercase letter used in share links. It must be unique and must never change, or existing links will show the wrong theme.

The theme then shows up in the picker automatically. If it uses a new web font, add the font to the Google Fonts link in `_includes/head.html`.

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
