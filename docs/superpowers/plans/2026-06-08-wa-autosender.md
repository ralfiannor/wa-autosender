# WA AutoSender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tampermonkey userscript that auto-sends messages on WhatsApp Web via a floating panel UI.

**Architecture:** Single-file userscript using pure DOM manipulation. Resilient selectors target `contenteditable`, `role`, `title`, and `aria-label` attributes to survive WhatsApp Web UI updates. All logic runs client-side in the browser.

**Tech Stack:** JavaScript (ES2020), Tampermonkey/Greasemonkey userscript API, WhatsApp Web DOM

---

## File Structure

| File | Responsibility |
|------|---------------|
| `wa-autosender.user.js` | Complete userscript: Tampermonkey metadata, SelectorConfig, Logger, FloatingPanel (draggable/collapsible UI), ContactFinder, MessageSender, LoopController, init |
| `CLAUDE.md` | Project context for Claude Code |
| `README.md` | Installation & usage documentation |

---

### Task 1: Create the userscript skeleton with Tampermonkey metadata and SelectorConfig

**Files:**
- Create: `wa-autosender.user.js`

- [ ] **Step 1: Write the userscript header, metadata, SelectorConfig, and Logger utility**

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
// @updateURL    https://raw.githubusercontent.com/ralfiannor/wa-autosender/main/wa-autosender.user.js
// @downloadURL  https://raw.githubusercontent.com/ralfiannor/wa-autosender/main/wa-autosender.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ─── SelectorConfig ───────────────────────────────────────────────
  // Centralized selectors — update these when WhatsApp Web changes its DOM.
  // Strategy: use stable attributes first, then fallbacks.

  const SELECTORS = {
    // Search / new chat
    searchButton: '[data-tab="search"] div[role="button"], header div[role="button"]',
    searchInput: 'div[contenteditable="true"][data-tab="3"], div[contenteditable="true"][title="Search input textbox"]',
    searchInputAlt: 'div[contenteditable="true"][role="textbox"]',
    searchResultItem: '[data-animate-status-msg="true"], [role="listitem"]',

    // Chat panel
    chatPanel: '#main',
    messageInput: 'div[contenteditable="true"][data-tab="10"], div[contenteditable="true"][title="Type a message"]',
    messageInputAlt: '#main footer div[contenteditable="true"]',
    sendButton: 'button[data-tab="11"], button[aria-label="Send"], span[data-icon="send"]',

    // Top bar / contact name
    activeContactName: '#main header span[title], #main header span[dir="auto"]',
  };

  function querySelector(selectors) {
    const list = typeof selectors === 'string' ? [selectors] : selectors;
    for (const sel of list) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function querySelectorAll(selectors) {
    const list = typeof selectors === 'string' ? [selectors] : selectors;
    for (const sel of list) {
      const els = document.querySelectorAll(sel);
      if (els.length) return els;
    }
    return [];
  }

  // ─── Logger ────────────────────────────────────────────────────────

  const Logger = {
    _el: null,

    init(container) {
      this._el = container;
    },

    _append(level, msg) {
      if (!this._el) return;
      const entry = document.createElement('div');
      entry.style.cssText = 'padding:2px 0;font-size:12px;border-bottom:1px solid #e0e0e0;word-break:break-word;';
      const ts = new Date().toLocaleTimeString();
      const colors = { info: '#333', success: '#128C7E', warn: '#E67E22', error: '#E74C3C' };
      entry.style.color = colors[level] || '#333';
      entry.textContent = `[${ts}] ${msg}`;
      this._el.prepend(entry);
      // Keep max 100 entries
      while (this._el.children.length > 100) {
        this._el.removeChild(this._el.lastChild);
      }
    },

    info(msg) { this._append('info', msg); },
    success(msg) { this._append('success', msg); },
    warn(msg) { this._append('warn', msg); },
    error(msg) { this._append('error', msg); },
  };
```

- [ ] **Step 2: Commit**

```bash
git add wa-autosender.user.js
git commit -m "feat: add userscript skeleton with metadata, selectors, and logger"
```

---

### Task 2: Add FloatingPanel — draggable, collapsible UI

**Files:**
- Modify: `wa-autosender.user.js`

- [ ] **Step 1: Add the FloatingPanel module after the Logger**

Append after Logger closing `};`:

```javascript
  // ─── FloatingPanel ────────────────────────────────────────────────

  const FloatingPanel = {
    _panel: null,
    _toggle: null,
    _collapsed: false,
    _inputs: {},

    create() {
      // Floating toggle button (visible when collapsed)
      const toggle = document.createElement('div');
      toggle.id = 'was-toggle';
      toggle.innerHTML = '💬';
      toggle.title = 'WA AutoSender';
      toggle.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;width:44px;height:44px;background:#25D366;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:22px;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:transform .2s;';
      toggle.addEventListener('mouseenter', () => { toggle.style.transform = 'scale(1.1)'; });
      toggle.addEventListener('mouseleave', () => { toggle.style.transform = 'scale(1)'; });
      toggle.addEventListener('click', () => this.toggle());
      document.body.appendChild(toggle);
      this._toggle = toggle;

      // Main panel
      const panel = document.createElement('div');
      panel.id = 'was-panel';
      panel.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99998;width:340px;background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.2);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;color:#333;overflow:hidden;';
      panel.innerHTML = `
        <div id="was-header" style="background:#075E54;color:#fff;padding:10px 14px;cursor:move;display:flex;align-items:center;justify-content:space-between;user-select:none;">
          <strong style="font-size:14px;">WA AutoSender</strong>
          <div style="display:flex;gap:6px;">
            <button id="was-minimize" title="Minimize" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;">−</button>
            <button id="was-close" title="Close" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;">×</button>
          </div>
        </div>
        <div id="was-body" style="padding:12px;">
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Contact Name or Number (+62...)</label>
          <input id="was-contact" type="text" placeholder="e.g. John or +62812345678" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #ccc;border-radius:6px;font-size:13px;margin-bottom:10px;outline:none;" />

          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Message</label>
          <textarea id="was-message" rows="3" placeholder="Type your message here..." style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #ccc;border-radius:6px;font-size:13px;margin-bottom:10px;outline:none;resize:vertical;"></textarea>

          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <div style="flex:1;">
              <label style="font-size:11px;font-weight:600;display:block;margin-bottom:2px;">Repeat Count</label>
              <input id="was-repeat" type="number" value="1" min="1" max="1000" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #ccc;border-radius:6px;font-size:13px;outline:none;" />
            </div>
            <div style="flex:1;">
              <label style="font-size:11px;font-weight:600;display:block;margin-bottom:2px;">Delay (sec)</label>
              <input id="was-delay" type="number" value="5" min="1" max="300" step="0.5" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #ccc;border-radius:6px;font-size:13px;outline:none;" />
            </div>
          </div>

          <div style="margin-bottom:10px;">
            <label style="font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <input id="was-random-toggle" type="checkbox" checked style="cursor:pointer;" />
              <span style="font-weight:600;">Random Delay (±sec)</span>
            </label>
            <input id="was-random-range" type="number" value="2" min="0" max="60" step="0.5" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #ccc;border-radius:6px;font-size:13px;outline:none;" />
          </div>

          <button id="was-start" style="width:100%;padding:10px;background:#25D366;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:background .2s;">
            ▶ Start Sending
          </button>

          <div id="was-progress" style="margin-top:10px;font-size:12px;text-align:center;color:#666;display:none;">
            <span id="was-progress-text">0 / 0 sent</span>
          </div>

          <div id="was-log" style="margin-top:10px;max-height:160px;overflow-y:auto;border:1px solid #eee;border-radius:6px;padding:6px;background:#fafafa;display:none;"></div>
        </div>
      `;
      document.body.appendChild(panel);
      this._panel = panel;

      // Cache input references
      this._inputs = {
        contact: panel.querySelector('#was-contact'),
        message: panel.querySelector('#was-message'),
        repeat: panel.querySelector('#was-repeat'),
        delay: panel.querySelector('#was-delay'),
        randomToggle: panel.querySelector('#was-random-toggle'),
        randomRange: panel.querySelector('#was-random-range'),
        startBtn: panel.querySelector('#was-start'),
        progressDiv: panel.querySelector('#was-progress'),
        progressText: panel.querySelector('#was-progress-text'),
        logDiv: panel.querySelector('#was-log'),
      };

      // Init logger
      Logger.init(this._inputs.logDiv);

      // Button events
      this._inputs.startBtn.addEventListener('click', () => {
        if (LoopController.running) {
          LoopController.stop();
        } else {
          LoopController.start(this._getValues());
        }
      });

      panel.querySelector('#was-close').addEventListener('click', () => this.toggle());
      panel.querySelector('#was-minimize').addEventListener('click', () => this.toggle());

      // Draggable
      this._makeDraggable(panel, panel.querySelector('#was-header'));

      // Start visible
      this._collapsed = false;
      this._panel.style.display = 'block';
      this._toggle.style.display = 'none';
    },

    _getValues() {
      return {
        contact: this._inputs.contact.value.trim(),
        message: this._inputs.message.value.trim(),
        repeat: parseInt(this._inputs.repeat.value, 10) || 1,
        delay: parseFloat(this._inputs.delay.value) || 5,
        randomDelay: this._inputs.randomToggle.checked ? (parseFloat(this._inputs.randomRange.value) || 0) : 0,
      };
    },

    toggle() {
      if (this._collapsed) {
        this._panel.style.display = 'block';
        this._toggle.style.display = 'none';
        this._collapsed = false;
      } else {
        this._panel.style.display = 'none';
        this._toggle.style.display = 'flex';
        this._collapsed = true;
      }
    },

    setRunning(running) {
      const btn = this._inputs.startBtn;
      const logDiv = this._inputs.logDiv;
      const progressDiv = this._inputs.progressDiv;
      if (running) {
        btn.textContent = '⏹ Stop Sending';
        btn.style.background = '#E74C3C';
        logDiv.style.display = 'block';
        progressDiv.style.display = 'block';
      } else {
        btn.textContent = '▶ Start Sending';
        btn.style.background = '#25D366';
      }
    },

    updateProgress(sent, total) {
      this._inputs.progressText.textContent = `${sent} / ${total} sent`;
    },

    _makeDraggable(el, handle) {
      let offsetX = 0, offsetY = 0, isDragging = false;
      handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - el.getBoundingClientRect().left;
        offsetY = e.clientY - el.getBoundingClientRect().top;
        el.style.transition = 'none';
      });
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        el.style.left = (e.clientX - offsetX) + 'px';
        el.style.top = (e.clientY - offsetY) + 'px';
        el.style.right = 'auto';
      });
      document.addEventListener('mouseup', () => {
        isDragging = false;
        el.style.transition = '';
      });
    },
  };
```

- [ ] **Step 2: Commit**

```bash
git add wa-autosender.user.js
git commit -m "feat: add FloatingPanel — draggable, collapsible UI with all inputs"
```

---

### Task 3: Add ContactFinder — search by name or navigate by phone number

**Files:**
- Modify: `wa-autosender.user.js`

- [ ] **Step 1: Add ContactFinder module after FloatingPanel**

```javascript
  // ─── ContactFinder ────────────────────────────────────────────────

  const ContactFinder = {
    TIMEOUT_MS: 8000,

    async findAndOpen(contact) {
      if (!contact) throw new Error('Contact is empty');

      // Phone number detection: starts with + or is all digits
      const isPhoneNumber = /^[\+]?[0-9\s\-]+$/.test(contact);

      if (isPhoneNumber) {
        return this._findByPhone(contact.replace(/[\s\-]/g, ''));
      }
      return this._findByName(contact);
    },

    async _findByName(name) {
      Logger.info(`Searching contact: "${name}"`);

      // Click search button / start new chat
      const searchBtn = querySelector(SELECTORS.searchButton);
      if (!searchBtn) throw new Error('Search button not found. Is WhatsApp Web fully loaded?');
      searchBtn.click();
      await this._sleep(600);

      // Focus and clear search input
      const searchInput = querySelector([SELECTORS.searchInput, SELECTORS.searchInputAlt]);
      if (!searchInput) throw new Error('Search input not found');

      searchInput.focus();
      // Select all + delete to clear previous search
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      await this._sleep(200);

      // Type name character by character for React to pick up
      for (const char of name) {
        document.execCommand('insertText', false, char);
        await this._sleep(50);
      }
      await this._sleep(2000);

      // Click first matching result
      const results = querySelectorAll(SELECTORS.searchResultItem);
      if (!results.length) {
        throw new Error(`No results found for "${name}"`);
      }

      // Click the first result
      results[0].click();
      await this._sleep(1000);

      // Close search panel (press Escape)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      await this._sleep(500);

      Logger.success(`Opened chat with "${name}"`);
    },

    async _findByPhone(number) {
      Logger.info(`Opening chat by phone number: ${number}`);

      // Use WhatsApp's deep link to open chat with phone number
      const cleanNumber = number.replace(/[^0-9]/g, '');
      const url = `https://web.whatsapp.com/send?phone=${cleanNumber}`;

      // Navigate without full page reload if possible
      window.location.href = url;
      await this._sleep(3000);

      // Wait for chat panel to appear
      const chatPanel = await this._waitForElement(SELECTORS.chatPanel, 10000);
      if (!chatPanel) {
        throw new Error(`Could not open chat with number ${number}. Number may not be on WhatsApp.`);
      }

      Logger.success(`Opened chat with ${number}`);
    },

    _waitForElement(selector, timeoutMs) {
      return new Promise((resolve) => {
        const el = querySelector(selector);
        if (el) return resolve(el);

        const start = Date.now();
        const interval = setInterval(() => {
          const el = querySelector(selector);
          if (el) {
            clearInterval(interval);
            resolve(el);
          } else if (Date.now() - start > timeoutMs) {
            clearInterval(interval);
            resolve(null);
          }
        }, 300);
      });
    },

    _sleep(ms) {
      return new Promise((r) => setTimeout(r, ms));
    },
  };
```

- [ ] **Step 2: Commit**

```bash
git add wa-autosender.user.js
git commit -m "feat: add ContactFinder — search by name or navigate by phone"
```

---

### Task 4: Add MessageSender — type and send a message

**Files:**
- Modify: `wa-autosender.user.js`

- [ ] **Step 1: Add MessageSender module after ContactFinder**

```javascript
  // ─── MessageSender ────────────────────────────────────────────────

  const MessageSender = {
    async send(message) {
      if (!message) throw new Error('Message is empty');

      // Find the message input box
      const input = querySelector([SELECTORS.messageInput, SELECTORS.messageInputAlt]);
      if (!input) throw new Error('Message input not found. Open a chat first.');

      input.focus();
      await this._sleep(100);

      // Clear any existing text
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      await this._sleep(50);

      // Type message using execCommand (works with React's synthetic events)
      document.execCommand('insertText', false, message);
      await this._sleep(100);

      // Send via Enter key
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
      });
      input.dispatchEvent(enterEvent);

      // Fallback: try clicking the send button if Enter didn't work
      await this._sleep(300);
      const sendBtn = querySelector(SELECTORS.sendButton);
      if (sendBtn) {
        // Check if message is still in the input (wasn't sent by Enter)
        if (input.textContent.trim().length > 0) {
          sendBtn.click();
        }
      }

      await this._sleep(200);
      Logger.success('Message sent');
    },

    _sleep(ms) {
      return new Promise((r) => setTimeout(r, ms));
    },
  };
```

- [ ] **Step 2: Commit**

```bash
git add wa-autosender.user.js
git commit -m "feat: add MessageSender — type and send via Enter or send button"
```

---

### Task 5: Add LoopController — orchestrate repeat, delay, random delay

**Files:**
- Modify: `wa-autosender.user.js`

- [ ] **Step 1: Add LoopController and init logic after MessageSender**

```javascript
  // ─── LoopController ───────────────────────────────────────────────

  const LoopController = {
    running: false,
    _stopped: false,

    async start({ contact, message, repeat, delay, randomDelay }) {
      if (this.running) return;

      // Validate inputs
      if (!contact) { Logger.error('Contact is required'); return; }
      if (!message) { Logger.error('Message is required'); return; }
      if (repeat < 1) { Logger.error('Repeat count must be ≥ 1'); return; }

      this.running = true;
      this._stopped = false;
      FloatingPanel.setRunning(true);
      FloatingPanel.updateProgress(0, repeat);
      Logger.info(`Starting: ${repeat}x to "${contact}"`);

      try {
        // Find and open the contact chat
        await ContactFinder.findAndOpen(contact);
      } catch (err) {
        Logger.error(`Contact error: ${err.message}`);
        this._finish();
        return;
      }

      // Send loop
      let sent = 0;
      for (let i = 0; i < repeat; i++) {
        if (this._stopped) break;

        try {
          await MessageSender.send(message);
          sent++;
          FloatingPanel.updateProgress(sent, repeat);
          Logger.info(`[${sent}/${repeat}] Sent`);
        } catch (err) {
          Logger.error(`Send error: ${err.message}`);
          break;
        }

        // Wait before next iteration (skip after last message)
        if (i < repeat - 1 && !this._stopped) {
          const actualDelay = this._calcDelay(delay, randomDelay);
          Logger.info(`Waiting ${actualDelay.toFixed(1)}s...`);
          await this._sleepInterruptible(actualDelay * 1000);
        }
      }

      Logger.info(`Done. ${sent}/${repeat} messages sent.`);
      this._finish();
    },

    stop() {
      Logger.warn('Stopping...');
      this._stopped = true;
    },

    _finish() {
      this.running = false;
      this._stopped = false;
      FloatingPanel.setRunning(false);
    },

    _calcDelay(base, randomRange) {
      if (randomRange <= 0) return Math.max(1, base);
      const offset = (Math.random() * 2 - 1) * randomRange;
      return Math.max(1, base + offset);
    },

    _sleepInterruptible(ms) {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this._stopped) {
            clearInterval(check);
            resolve();
          }
        }, 200);
        setTimeout(() => {
          clearInterval(check);
          resolve();
        }, ms);
      });
    },
  };

  // ─── Init ─────────────────────────────────────────────────────────

  function waitForWhatsAppReady() {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        // Check if WhatsApp Web main app has rendered
        const app = document.querySelector('#app');
        const main = document.querySelector('#main') || document.querySelector('#side');
        if (app && main) {
          clearInterval(check);
          resolve();
        }
      }, 500);
      // Timeout after 30s
      setTimeout(() => {
        clearInterval(check);
        resolve();
      }, 30000);
    });
  }

  async function init() {
    console.log('[WA AutoSender] Waiting for WhatsApp Web to load...');
    await waitForWhatsAppReady();
    console.log('[WA AutoSender] WhatsApp Web ready. Initializing panel...');
    FloatingPanel.create();
    Logger.info('WA AutoSender loaded. Ready to send.');
  }

  init();

})(); // end IIFE
```

- [ ] **Step 2: Commit**

```bash
git add wa-autosender.user.js
git commit -m "feat: add LoopController and init — complete userscript"
```

---

### Task 6: Create CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Write CLAUDE.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md project context"
```

---

### Task 7: Create README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

```markdown
# 💬 WA AutoSender

A Tampermonkey userscript that automates sending repeated messages to a contact on WhatsApp Web.

> **⚠️ Disclaimer:** This tool is for personal/educational use only. Automated messaging may violate WhatsApp's Terms of Service. Use responsibly.

## Features

- ✉️ Send repeated messages to a single contact
- 🔍 Find contacts by **name** or **phone number**
- ⏱️ Configurable delay between messages
- 🎲 Random delay variation to avoid spam detection
- 📊 Progress indicator and activity log
- 🖱️ Draggable, collapsible floating panel UI

## Prerequisites

- A desktop browser (Chrome, Firefox, Edge, etc.)
- [Tampermonkey](https://www.tampermonkey.net/) extension installed
- WhatsApp Web logged in at [web.whatsapp.com](https://web.whatsapp.com)

## Installation

### Option 1: Direct install from URL

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Click this link: [wa-autosender.user.js](https://raw.githubusercontent.com/ralfiannor/wa-autosender/main/wa-autosender.user.js)
3. Tampermonkey will prompt you to install — click **Install**

### Option 2: Manual install

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Open Tampermonkey Dashboard → **Utilities** tab
3. Paste the URL:
   ```
   https://raw.githubusercontent.com/ralfiannor/wa-autosender/main/wa-autosender.user.js
   ```
4. Click **Import**

### Option 3: Copy-paste

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Open Tampermonkey Dashboard → **+** (new script)
3. Delete the default template
4. Copy the entire contents of [`wa-autosender.user.js`](wa-autosender.user.js) and paste it
5. Click **File → Save** (or Ctrl+S)

## Usage

1. Open [WhatsApp Web](https://web.whatsapp.com) and make sure you're logged in
2. The WA AutoSender panel appears in the top-right corner
3. Fill in the fields:
   - **Contact Name or Number** — type a contact name (e.g., "John") or phone number with country code (e.g., "+62812345678")
   - **Message** — the text to send
   - **Repeat Count** — how many times to send (default: 1)
   - **Delay (sec)** — base delay between messages (default: 5)
   - **Random Delay (±sec)** — adds random variation to the delay
4. Click **▶ Start Sending**
5. To stop, click **⏹ Stop Sending**
6. The activity log shows send progress and any errors

## How It Works

The script uses **DOM manipulation** to interact with WhatsApp Web's UI:

1. **Contact search** — types in WhatsApp's search box or navigates via `send?phone=` deep link
2. **Message input** — uses `document.execCommand('insertText')` to type into the `contenteditable` message box
3. **Send** — triggers the Enter key event or clicks the send button
4. **Loop** — repeats with configurable delays

## Updating Selectors

WhatsApp Web updates may change DOM structure. If the script stops working:

1. Open browser DevTools (F12) on WhatsApp Web
2. Inspect the relevant elements (search box, message input, send button)
3. Update the `SELECTORS` object at the top of `wa-autosender.user.js`

## License

MIT — see [LICENSE](LICENSE)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with installation and usage guide"
```

---

### Task 8: Push everything to GitHub

**Files:** none (git push)

- [ ] **Step 1: Push all commits to remote**

```bash
git push origin main
```

Expected: all files pushed to `https://github.com/ralfiannor/wa-autosender`

---

## Self-Review Checklist

- **Spec coverage:** ✅ All requirements from design spec have corresponding tasks:
  - Single-contact sending → Task 4 + Task 5
  - Contact by name/number → Task 3
  - Floating panel UI (draggable, collapsible, all inputs) → Task 2
  - Repeat count, delay, random delay → Task 5
  - Progress indicator, log → Task 2
  - SelectorConfig → Task 1
  - CLAUDE.md → Task 6
  - README.md → Task 7
- **Placeholder scan:** ✅ No TBD/TODO/vague steps — all code blocks are complete
- **Type consistency:** ✅ All modules use consistent method names and parameter shapes
