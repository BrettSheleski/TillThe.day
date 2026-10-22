---
layout: page
title: Privacy
heading: Privacy policy
description: What Till the Day collects (very little) and who else is involved in running it.
permalink: /privacy/
last_updated: 2026-10-21
---
Till the Day is built to collect as little as possible. There are no accounts and no database, and the site sets no cookies.

## Your countdowns

A countdown's date, time, message and theme are stored **only in its link** (the part after `?c=`). They aren't saved anywhere else, so we can't see your countdowns, and we can't recover a lost link.

Two things to know:

- **Anyone with the link can read the message.** It's encoded to keep links short, not encrypted. Don't put anything private in a countdown you share.
- **The link is sent to our host when the page loads.** The site is hosted on [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages#data-collection), which receives every page request, including the full link and your IP address, and may keep logs of them under the [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). We don't have access to those logs.

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

The share and calendar buttons (email, WhatsApp, Facebook, X, Google Calendar and Outlook) open those services with your countdown's link and message filled in. Nothing is sent until you choose one, and from then on that service's privacy policy applies.

## Embedded countdowns

If you see a countdown embedded in another website, that website may have its own tracking. Its privacy policy applies to it; this one covers only the countdown itself.

## Changes and questions

If this policy changes, the date at the top will change too. Questions? Ask on the project's [GitHub issues page](https://github.com/BrettSheleski/TillThe.day/issues).
