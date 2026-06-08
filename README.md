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
