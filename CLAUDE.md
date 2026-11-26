# Project rules

## Supported AIs (required)
ChatGPT, Claude, Gemini, Perplexity, Copilot, DeepSeek, Kimi, Qwen, Grok, MiniMax, Manus, Meta AI.

- Supported means: user and AI messages are detected separately (`grab.js`), not only the whole `<main>`; the AI is in both export menus (`reader.html`, `userscript-ui.js`) and in `detectAi` / `fileName` (`lib.js`).
- Take selectors from the real site's DOM. Never guess them.
- Do not call a site tested until it has been checked on the real site.
