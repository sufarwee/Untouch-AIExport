# Untouch Flow AI Export

Read an AI chat in a clean view and export it as Markdown or PDF. Code blocks and tables stay intact. No data leaves your browser.

## Install
| Browser | How |
|---|---|
| Chrome / Brave | `chrome://extensions` → Developer mode → Load unpacked → `chrome/` |
| Edge | `edge://extensions` → Developer mode → Load unpacked → `edge/` |
| Firefox | `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `firefox/manifest.json` |
| iPhone / iPad | see [safari-ios/README.md](safari-ios/README.md) |

## Use
1. Open a chat. Scroll to the top first so older messages are loaded.
2. Click the extension icon. A reader tab opens. (To export only part of a chat, select that text first.)
3. Read by scrolling, or press Auto Scroll (Space = play/pause, Esc = stop).
4. Export:
   - **Export…**: confirm which AI the chat is from (the detected one is preselected), then choose Markdown or PDF (print window → Save as PDF).
     The file is named `<ai>-<first 20 characters of the chat title>-<DDMMYYYY>.md`, e.g. `gemini-การconfigserver-28102026.md`.
   - **Copy for Notes / Docs** (also Word and TextEdit): tables stay tables, code goes into a grey one-cell box (these apps have no pasteable code block). A plain-text editor gets tab-separated tables and no Markdown marks.
   - **Copy for Notion (MD)**: Notion turns it into code blocks and tables.

## Export rules
- Headings never use `#`; they become bold lines (or plain lines).
- Code blocks are copied exactly, including `#` comments and emoji.
- "Remove icons / emoji" applies to normal text; ✅ ❌ become ✓ ✗.
- Images are not exported.

## Limits
- Message detection covers ChatGPT, Claude and Gemini. Other sites export the page's main area.
- Only messages the page has loaded are exported.
- PDF: a table is never split unless it is taller than a page; then it breaks between rows and repeats the header. Copyable Thai text relies on the Thonburi font (Apple only; not tested elsewhere). Copy commands from the .md, not the PDF, where long lines are wrapped.

## Build and test
```bash
sh build.sh            # chrome/ edge/ firefox/ safari-ios/ and dist/*.zip
npx web-ext lint -s firefox
```
Edit the files in the repo root only; `build.sh` overwrites the browser folders.
Open `test.html` in Chrome (headless needs `--allow-file-access-from-files`); the tab title must be `PASS`.

## Store upload
Run `sh build.sh`, then upload from `dist/`:
- **Firefox (AMO):** `untouch-ai-export-firefox.zip`. The code is not minified or bundled.
- **Edge (Partner Center):** `untouch-ai-export-edge.zip`
- **Chrome Web Store:** `untouch-ai-export-chrome.zip`

Raise `version` in both manifest files before each new upload.

**Privacy text:** The extension reads the current tab only when you click its icon. The chat is kept in the browser's temporary session storage to show the reader. Nothing is sent to any server.

**Reviewer notes:** Open an AI chat (or any page), click the toolbar icon, and a reader tab opens with the page content and export buttons. No account or server is needed.

## License

Source code: [Apache License 2.0](LICENSE). If you redistribute it, keep the license and the credit in [NOTICE](NOTICE).
The name and logo are not covered: see [TRADEMARKS.md](TRADEMARKS.md).

Copyright 2026 Sufarwee Dunyamat (sufarweededev)
