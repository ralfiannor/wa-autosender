# CLAUDE.md — WA AutoSender

## Project Overview
Tampermonkey userscript for WhatsApp Web auto-sending messages to a single contact.
Repo: https://github.com/ralfiannor/wa-autosender

## Architecture
- **Single-file userscript:** `wa-autosender.user.js` — everything in one IIFE
- **No build step** — install directly in Tampermonkey
- **Pure DOM manipulation** — no WhatsApp internal API injection
- **Selector strategy:** uses `data-*`, `contenteditable`, `role`, `title`, `aria-label` attributes (see `SELECTORS` object). Update selectors when WhatsApp Web UI changes.

## Key Components (inside wa-autosender.user.js)
1. `SELECTORS` — centralized DOM selector config
2. `Logger` — in-panel log output
3. `FloatingPanel` — draggable/collapsible UI panel
4. `ContactFinder` — find contact by name (search box) or phone number (deep link)
5. `MessageSender` — type text into `contenteditable` input and send via Enter
6. `LoopController` — manages repeat count, delay, random delay, stop signal

## Development Notes
- Test by installing `wa-autosender.user.js` in Tampermonkey and opening https://web.whatsapp.com
- WhatsApp Web must be logged in before the script can function
- WhatsApp Web DOM changes frequently — if selectors break, update the `SELECTORS` object
- The script runs at `document-idle` and waits for `#app` and `#side`/`#main` to appear

## Deployment
- Push to `main` branch — Tampermonkey @updateURL and @downloadURL point to raw.githubusercontent.com
- No CI/CD needed
