---
layout: page
title: Privacy
heading: Privacy policy
description: What Till the Day collects (very little) and who else is involved in running it.
permalink: /privacy/
last_updated: 2026-10-23
---
Till the Day is built to collect as little as possible. There are no accounts and no database, and the site sets no cookies.

## Your countdowns

A countdown's date, time, message, location, notes and theme are stored **only in its link** (the part after `?c=`). They aren't saved on any server, so we can't see your countdowns, and we can't recover a lost link (but you can keep them in your own browser, below).

Two things to know:

- **Anyone with the link can read the message, location and notes.** They're encoded to keep links short, not encrypted. Don't put anything private in a countdown you share, such as a home address you wouldn't want forwarded.
- **The link is sent to our host when the page loads.** The site is hosted on [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages#data-collection), which receives every page request, including the full link and your IP address, and may keep logs of them under the [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). We don't have access to those logs.

## My Days (saved countdowns)

If you save a countdown or holiday (the bookmark icon on its page), its link or the holiday's name is kept in your browser's local storage so you can find it again on the My Days page. It stays on your device and is never sent to us or anyone else. Nothing is saved unless you choose to save it. Remove countdowns on the My Days page, or clear this site's data in your browser settings to remove them all. Browsers may also clear it on their own: Safari does after about a week without a visit, unless the site is on your home screen.

QR codes and calendar files are created in your browser and never leave your device. Fonts and everything else the pages need are served from this site too, so loading a countdown doesn't contact any other service except the visit counter below.

{% if site.cloudflare_analytics_token != "" and site.cloudflare_analytics_token %}
## Visit counts

We count visits with [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) to see which pages and features people use. It's designed for privacy:

- It uses **no cookies** and doesn't store anything on your device.
- It **doesn't record the part of a link after `?`**, so your countdowns are never included.
- We only see totals, like page views and the countries and kinds of devices visits come from, never who you are.

See [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/) for how Cloudflare handles this data.
{% endif %}

## Sharing and calendars

The share and calendar buttons (email, WhatsApp, Facebook, X, Google Calendar and Outlook) open those services with your countdown's link, message, location and notes filled in. A countdown's location links to a maps service (Apple Maps on iPhone and iPad, your phone's maps app on Android, Google Maps elsewhere), which receives the location if you click it. Nothing is sent until you choose one, and from then on that service's privacy policy applies.

## Embedded countdowns

If you see a countdown embedded in another website, that website may have its own tracking. Its privacy policy applies to it; this one covers only the countdown itself.

## Changes and questions

If this policy changes, the date at the top will change too. Questions? Ask on the project's [GitHub issues page](https://github.com/BrettSheleski/TillThe.day/issues).
