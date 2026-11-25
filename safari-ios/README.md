# AI Export — iPhone / iPad

| | Method 1: Safari + Userscripts (try this first) | Method 2: Orion |
|---|---|---|
| File | `method-2-safari-userscript/untouch-ai-export.user.js` (or the zip) | `method-1-orion/untouch-ai-export-orion.zip` |
| What it is | Userscript: an **AI Export** button on the chat page opens the reader over it | The Firefox extension build |
| Tested | Simulated only (desktop WebKit with an iPhone profile), not on a real device | **Not tested** |

## Safari + Userscripts
1. Install **Userscripts** (App Store). Settings > Safari > Extensions > Userscripts: on, allow it on the chat sites.
2. Put `untouch-ai-export.user.js` in your Userscripts folder (Files app).
3. Open a chat in Safari (`ᴀA` > Userscripts > script on), refresh, tap **AI Export**.

Works on: ChatGPT, Gemini, Claude, Copilot, DeepSeek, Kimi, Qwen, Grok, Manus, Meta AI.
PDF: tap Export… > PDF, then use the share button in the print preview to save it.

## Orion
Orion > Extensions > `+` > **Install from File** > pick the zip. This build relies on `scripting`, `activeTab` and session storage, which have not been checked in Orion.
