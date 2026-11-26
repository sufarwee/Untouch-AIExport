// Untouch Flow AI Export | (c) 2026 Sufarwee Dunyamat AKA SufarweeDeDev (Full Stack Developer, SEO Expert, SEM Specialist, DevOps) | https://github.com/sufarwee | Apache-2.0
// iOS Safari (Userscripts app): a floating button opens the same reader as an overlay on the chat page.
// Built with createElement only, so pages with Trusted Types (Gemini) do not block it. CSS is injected by build.sh.
const mk = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  e.append(...kids);
  return e;
};
const host = mk('div', { id: 'uf-ai-export' });
const root = host.attachShadow({ mode: 'open' });
const button = (id, text, extra = {}) => mk('button', { id, type: 'button', ...extra }, text);
const check = (id, text) => { const i = mk('input', { type: 'checkbox', id }); i.checked = true; return mk('label', {}, i, ` ${text}`); };
const choice = (value, text, cls = '') => mk('button', { value, class: cls }, text);
const ai = mk('select', { id: 'ai' }, ...[['chatgpt', 'ChatGPT'], ['gemini', 'Gemini'], ['claude', 'Claude'], ['copilot', 'Copilot'], ['deepseek', 'DeepSeek'], ['kimi', 'Kimi'], ['qwen', 'Qwen'], ['grok', 'Grok'], ['minimax', 'MiniMax'], ['manus', 'Manus'], ['meta', 'Meta AI'], ['muse', 'Muse'], ['perplexity', 'Perplexity'], ['ai', 'Other']].map(([v, t]) => new Option(t, v)));

const open = button('open', 'AI Export', { class: 'fab' });
const box = mk('div', { class: 'box', hidden: '' },
  mk('header', {},
    button('close', '✕ Close'), check('icons', 'Remove icons / emoji'), check('boldHeadings', 'Bold headings'),
    mk('label', {}, mk('input', { type: 'checkbox', id: 'outline' }), ' Outline (# H1, H2…)'),
    button('scroll', '▶ Auto Scroll', { 'aria-pressed': 'false' }),
    mk('label', {}, 'Speed ', mk('input', { type: 'range', id: 'speed', min: '10', max: '400', step: '10', value: '60' }), ' ', mk('output', { id: 'speedNum' }, '60'), ' px/s'),
    button('export', 'Export…'), button('copyMd', 'Copy for Notion (MD)'), button('copyRich', 'Copy for Notes / Docs')),
  mk('p', { id: 'status', role: 'status' }),
  mk('main', { id: 'chat' }),
  mk('dialog', { id: 'exportBox', 'aria-label': 'Export' },
    mk('form', { method: 'dialog' },
      mk('h2', {}, 'Export'), mk('label', {}, 'Which AI is this chat from?', ai), mk('p', { id: 'nameShow' }),
      choice('md', 'Markdown (.md)'), choice('pdf', 'PDF'), choice('', 'Cancel', 'cancel'),
      mk('small', {}, 'PDF opens the print window.'))));
root.append(mk('style', {}, CSS), open, box);
document.documentElement.append(host);
// Printing: hide the chat site itself and let the overlay flow across pages.
(document.head || document.documentElement).append(mk('style', {}, '@media print { html { height: auto !important; overflow: visible !important; } body { display: none !important; } }'));

const reader = startReader({ $: id => root.getElementById(id), scroller: box, active: () => !box.hidden });
const $ = id => root.getElementById(id);
open.onclick = async () => {
  const label = open.textContent;
  open.disabled = true;
  open.textContent = 'Reading…';
  let chat;
  try {
    chat = await grab(true); // reads any text selection before the overlay opens
  } catch (e) {
    chat = { error: e.message };
  }
  open.disabled = false;
  open.textContent = label;
  chat.host = location.hostname;
  box.hidden = false;
  open.hidden = true;
  reader.load(chat);
  box.scrollTop = 0;
};
$('close').onclick = () => { reader.stop(); box.hidden = true; open.hidden = false; };
