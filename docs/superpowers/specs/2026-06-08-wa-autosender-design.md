# WA AutoSender — Design Spec

**Date:** 2026-06-08
**Repo:** https://github.com/ralfiannor/wa-autosender
**Type:** Tampermonkey Userscript (single-file)

## Overview

A WhatsApp Web auto-sender userscript that runs via Tampermonkey. The user must have WhatsApp Web open and logged in. The script provides a floating panel UI to configure and execute automated message sending to a single contact.

## Requirements

### Core
- Single-contact message sending (repeat N times)
- Contact lookup by name OR phone number
- Configurable delay between messages
- Random delay variation to avoid spam detection
- Floating panel UI embedded in WhatsApp Web

### UI (Floating Panel)
- **Contact input** — text field for contact name or phone number (prefix `+` for number)
- **Message input** — textarea for message content
- **Repeat count** — number input (default: 1)
- **Base delay** — number input in seconds (default: 5)
- **Random delay** — checkbox + range input (±N seconds from base, minimum 1s total)
- **Start/Stop button** — toggle to control sending
- **Progress indicator** — counter showing `sent/total`
- **Log area** — scrollable log of recent activity
- **Draggable** — panel can be moved
- **Collapsible** — minimize to small icon

### Contact Finding
- **By name:** Type in WhatsApp search box → wait for results → click first match
- **By number:** Detect `+` prefix → navigate to chat via WhatsApp Web's send endpoint or search

### Message Sending
- Find `contenteditable` message input via resilient selectors
- Set text via `document.execCommand('insertText')` or `InputEvent`
- Trigger send via Enter key event or click send button
- Verify message appears in chat

## Architecture

### Approach: DOM Manipulation (Pure)
Direct interaction with WhatsApp Web DOM elements. No internal API injection.

**Why:** Simpler, more maintainable, sufficient for single-contact auto-sending. Internal APIs change frequently and add complexity.

### Selector Strategy
WhatsApp Web uses hashed CSS classes that change with updates. The script uses:
1. `data-*` attributes (primary)
2. `contenteditable`, `role`, `title` attributes (fallback)
3. `aria-label` based selectors (fallback)
4. Selectors stored in a config object for easy updates

### Components (within single file)
1. **FloatingPanel** — creates and manages the UI panel
2. **ContactFinder** — locates and opens a chat
3. **MessageSender** — types and sends a message
4. **LoopController** — manages repeat count, delays, and random variation
5. **Logger** — in-panel activity log
6. **SelectorConfig** — centralized selector definitions

### Loop Logic
```
for each repeat (1..count):
  send message to active chat
  wait: baseDelay + random(-randomDelay, +randomDelay), min 1s
  update progress counter
  if stopped: break
```

### Error Handling
- Contact not found after timeout → log error, stop
- Message input not found → log error, stop
- WhatsApp Web not fully loaded → wait with timeout
- Rate-limit/block detection → alert user, stop

## File Structure

```
wa-autosender/
├── wa-autosender.user.js    # Main userscript (install via Tampermonkey)
├── CLAUDE.md                # Project context for Claude Code
├── README.md                # Installation & usage documentation
└── LICENSE                  # MIT (already exists)
```

## Tampermonkey Metadata
```javascript
// ==UserScript==
// @name         WA AutoSender
// @namespace    https://github.com/ralfiannor/wa-autosender
// @version      1.0.0
// @description  WhatsApp Web auto-sender — send repeated messages to a contact
// @author       ralfiannor
// @match        https://web.whatsapp.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
```

## Constraints
- Requires WhatsApp Web logged in
- Only works on `web.whatsapp.com`
- DOM selectors may break on WhatsApp Web updates (mitigated by resilient selector strategy)
- Single-contact mode only
