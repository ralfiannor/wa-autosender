// ==UserScript==
// @name         WA AutoSender
// @namespace    https://github.com/ralfiannor/wa-autosender
// @version      1.0.1
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
    // Sidebar search — WhatsApp Web left panel search bar
    searchInput: [
      '#side div[contenteditable="true"]',
      'div[contenteditable="true"][data-tab="3"]',
      'div[contenteditable="true"][title="Search input textbox"]',
      '#side [role="textbox"]',
      'header div[contenteditable="true"]',
    ].join(', '),

    // Search result items in the sidebar
    searchResultItem: [
      '#side [role="listitem"]',
      '#pane-side [role="listitem"]',
      '#side div[style*="height"][role="listitem"]',
      'div[data-animate-status-msg="true"]',
    ].join(', '),

    // Chat panel
    chatPanel: '#main',

    // Message input box in the active chat
    messageInput: [
      '#main footer div[contenteditable="true"]',
      'div[contenteditable="true"][data-tab="10"]',
      'div[contenteditable="true"][title="Type a message"]',
      '#main div[contenteditable="true"][role="textbox"]',
    ].join(', '),

    // Send button
    sendButton: [
      '#main footer button[data-tab="11"]',
      '#main footer button[aria-label="Send"]',
      '#main footer span[data-icon="send"]',
      '#main footer button span[data-icon="send"]',
    ].join(', '),

    // Top bar / contact name
    activeContactName: '#main header span[title], #main header span[dir="auto"]',
  };

  // Try a single CSS selector string (may contain commas for fallbacks).
  // Returns the first matching element, or null.
  function querySelector(selectorStr) {
    return document.querySelector(selectorStr);
  }

  // Returns all matching elements, or empty array.
  function querySelectorAll(selectorStr) {
    const els = document.querySelectorAll(selectorStr);
    return els.length ? Array.from(els) : [];
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
      toggle.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;width:44px;height:44px;background:#25D366;border-radius:50%;display:none;align-items:center;justify-content:center;cursor:pointer;font-size:22px;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:transform .2s;';
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

  // ─── ContactFinder ────────────────────────────────────────────────

  const ContactFinder = {

    async findAndOpen(contact) {
      if (!contact) throw new Error('Contact is empty');

      // Normalize: strip whitespace
      const query = contact.trim();

      // Step 1: Find the sidebar search input
      const searchInput = querySelector(SELECTORS.searchInput);
      if (!searchInput) throw new Error('Search input not found. Is WhatsApp Web fully loaded?');

      Logger.info(`Searching: "${query}"`);

      // Step 2: Click to focus the search input
      searchInput.focus();
      await this._sleep(300);

      // Step 3: Clear any existing text (select all → delete)
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      await this._sleep(200);

      // Step 4: Type the query character by character so React picks it up
      for (const char of query) {
        document.execCommand('insertText', false, char);
        await this._sleep(30);
      }
      await this._sleep(2500);

      // Step 5: Find and click the first search result
      const results = querySelectorAll(SELECTORS.searchResultItem);
      if (!results.length) {
        throw new Error(`No results found for "${query}"`);
      }

      const firstResult = results[0];
      firstResult.click();
      await this._sleep(1500);

      // Step 6: Verify chat panel opened
      const chatPanel = querySelector(SELECTORS.chatPanel);
      if (!chatPanel) {
        throw new Error('Chat panel did not open. Contact may not exist.');
      }

      // Step 7: Clear the search box (press Escape to close search overlay)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
      await this._sleep(500);

      Logger.success(`Opened chat for "${query}"`);
    },

    _sleep(ms) {
      return new Promise((r) => setTimeout(r, ms));
    },
  };

  // ─── MessageSender ────────────────────────────────────────────────

  const MessageSender = {
    async send(message) {
      if (!message) throw new Error('Message is empty');

      // Find the message input box
      const input = querySelector(SELECTORS.messageInput);
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
