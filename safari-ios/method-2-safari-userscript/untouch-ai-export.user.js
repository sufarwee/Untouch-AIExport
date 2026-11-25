// ==UserScript==
// @name         Untouch Flow AI Export
// @version      1.0.0
// @description  Read an AI chat and export it as Markdown or PDF with code blocks and tables intact
// @author       Sufarwee Dunyamat (sufarweededev)
// @license      Apache-2.0
// @copyright    2026, Sufarwee Dunyamat (https://github.com/sufarwee)
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://gemini.google.com/*
// @match        https://claude.ai/*
// @match        https://copilot.microsoft.com/*
// @match        https://chat.deepseek.com/*
// @match        https://kimi.com/*
// @match        https://www.kimi.com/*
// @match        https://chat.qwen.ai/*
// @match        https://grok.com/*
// @match        https://manus.im/*
// @match        https://meta.ai/*
// @match        https://www.meta.ai/*
// @noframes
// @grant        none
// @run-at       document-end
// ==/UserScript==

(() => {
'use strict';
// Page HTML -> safe, clean DOM -> Markdown. Headings never use "#"; code blocks are copied verbatim.
const KEEP = new Set('H1 H2 H3 H4 H5 H6 P PRE CODE TABLE THEAD TBODY TR TH TD UL OL LI BLOCKQUOTE STRONG B EM I DEL S A BR HR DIV'.split(' '));
const DROP = 'script,style,template,noscript,iframe,button,svg,img,video,audio,canvas,input,textarea,select,nav,form,.sr-only,.cdk-visually-hidden,.code-block-decoration';
const BLOCK = /^(H[1-6]|P|PRE|TABLE|UL|OL|BLOCKQUOTE|HR|DIV|LI)$/;

function stripIcons(t) {
  // Check/cross marks carry meaning in tables, so they become plain text symbols instead of vanishing.
  return t.replace(/[✅✔]️?/g, '✓').replace(/[❌❎]️?/g, '✗')
    .replace(/(?![©®™↔↕])\p{Extended_Pictographic}[️‍\u{1F3FB}-\u{1F3FF}]*|[\u{1F1E6}-\u{1F1FF}⃣️]/gu, '')
    .replace(/(\S) {2,}/g, '$1 ');
}

function codeText(n) {
  if (n.nodeType === 3) return n.data;
  if (n.nodeName === 'BR') return '\n';
  return [...n.childNodes].map(codeText).join('');
}

function cleanPre(src, doc) {
  const code = src.querySelector('.cm-content') || src.querySelector('code') || src;
  const label = src.closest('code-block')?.querySelector('.code-block-decoration span')?.textContent;
  const lang = (code.className.match?.(/language-([\w+#-]+)/)?.[1] || label || '').trim().toLowerCase();
  const pre = doc.createElement('pre'), c = doc.createElement('code');
  if (/^[\w+#-]+$/.test(lang)) pre.dataset.lang = lang;
  c.textContent = codeText(code).replace(/\n+$/, '');
  pre.append(c);
  return pre;
}

// Rebuilds from a whitelist: no page attributes survive except http(s) links.
const parse = source => typeof source === 'string' ? new DOMParser().parseFromString(source, 'text/html').body : source;

function clean(source, opts, doc = document) {
  const src = parse(source);
  const walk = (from, to) => {
    for (const n of from.childNodes) {
      if (n.nodeType === 3) { to.append(opts.icons ? stripIcons(n.data) : n.data); continue; }
      if (n.nodeType !== 1) continue;
      if (n.nodeName === 'PRE') { to.append(cleanPre(n, doc)); continue; }
      if (n.matches(DROP)) continue;
      if (n.matches('.katex, .katex-display')) {
        const tex = n.querySelector('annotation')?.textContent;
        if (tex) { to.append(`$${tex}$`); continue; }
      }
      if (!KEEP.has(n.nodeName)) { walk(n, to); continue; }
      const el = doc.createElement(n.nodeName);
      if (n.nodeName === 'A' && /^https?:/i.test(n.getAttribute('href') || '')) { el.href = n.getAttribute('href'); el.rel = 'noreferrer'; el.target = '_blank'; }
      if (n.nodeName === 'OL' && n.start > 1) el.start = n.start;
      walk(n, el);
      to.append(el);
    }
  };
  const out = doc.createElement('div');
  walk(src, out);
  // A header row needs <thead> to repeat when a very long table runs onto another page.
  out.querySelectorAll('table').forEach(t => {
    const first = t.rows[0];
    if (!t.tHead && first && [...first.cells].every(c => c.nodeName === 'TH')) t.createTHead().append(first);
  });
  // Literal "## Title" left in prose (never inside code).
  const it = doc.createTreeWalker(out, NodeFilter.SHOW_TEXT);
  for (let t; (t = it.nextNode());) if (!t.parentElement.closest('pre, code')) t.data = t.data.replace(/^([ \t]*)#{1,6}[ \t]+/gm, '$1');
  return out;
}

// User messages are plain text: keep line breaks and turn ``` fences into real code blocks.
// Takes a string or a live node, never changes it, and builds nodes (no HTML strings).
function plainToHtml(source) {
  const src = parse(source);
  if (src.querySelector('pre')) return src;
  const read = n => {
    if (n.nodeType === 3) return n.data;
    if (n.nodeName === 'BR') return '\n';
    const t = [...n.childNodes].map(read).join('');
    return /^(P|DIV)$/.test(n.nodeName) ? `${t}\n` : t;
  };
  const parts = [...src.childNodes].map(read).join('').trim().split(/^```([\w+#-]*)[ \t]*\n([\s\S]*?)^```[ \t]*$/m);
  const out = document.createElement('div');
  for (let i = 0; i < parts.length; i += 3) {
    const text = parts[i].trim();
    if (text) {
      const p = document.createElement('p');
      text.split('\n').forEach((line, k) => { if (k) p.append(document.createElement('br')); p.append(line); });
      out.append(p);
    }
    if (i + 2 < parts.length) {
      const pre = document.createElement('pre'), code = document.createElement('code');
      code.className = `language-${parts[i + 1]}`;
      code.textContent = parts[i + 2];
      pre.append(code);
      out.append(pre);
    }
  }
  return out;
}

function toMarkdown(root, opts) {
  const kids = n => [...n.childNodes].map(md).join('');
  const bold = s => s.trim() ? `**${s.trim()}**` : '';
  function md(n) {
    if (n.nodeType === 3) return n.data.replace(/\s+/g, ' ');
    const tag = n.nodeName;
    if (tag === 'PRE') {
      const t = n.textContent;
      const fence = '`'.repeat(Math.max(3, ...(t.match(/`+/g) || []).map(m => m.length + 1)));
      return `\n\n${fence}${n.dataset.lang || ''}\n${t}\n${fence}\n\n`;
    }
    if (tag === 'CODE') { const q = n.textContent.includes('`') ? '`` ' : '`'; return q + n.textContent + [...q].reverse().join(''); }
    if (tag === 'TABLE') {
      const rows = [...n.querySelectorAll('tr')].map(r => [...r.children].map(c => block(c).replace(/\n+/g, ' ').replace(/\|/g, '\\|')));
      if (!rows.length) return '';
      const w = Math.max(...rows.map(r => r.length));
      const line = r => `| ${Array.from({ length: w }, (_, i) => r[i] || '').join(' | ')} |`;
      return `\n\n${[line(rows[0]), line(Array(w).fill('---')), ...rows.slice(1).map(line)].join('\n')}\n\n`;
    }
    if (tag === 'UL' || tag === 'OL') {
      const items = [...n.children].filter(c => c.nodeName === 'LI').map((li, i) => {
        const mark = tag === 'OL' ? `${(n.start || 1) + i}. ` : '- ';
        return mark + block(li).replace(/\n{2,}(?=\s*(- |\d+\. ))/g, '\n').replace(/\n(?=.)/g, '\n' + ' '.repeat(mark.length));
      });
      return `\n\n${items.join('\n')}\n\n`;
    }
    if (tag === 'BLOCKQUOTE') return `\n\n${block(n).replace(/^/gm, '> ')}\n\n`;
    if (tag === 'BR') return '\n';
    if (tag === 'HR') return '\n\n---\n\n';
    const s = kids(n);
    if (/^H[1-6]$/.test(tag)) return `\n\n${opts.boldHeadings ? bold(s) : s.trim()}\n\n`;
    if (tag === 'STRONG' || tag === 'B') return bold(s);
    if (tag === 'EM' || tag === 'I') return s.trim() ? `*${s.trim()}*` : '';
    if (tag === 'DEL' || tag === 'S') return `~~${s}~~`;
    if (tag === 'A') return n.href ? `[${s}](${n.href})` : s;
    return BLOCK.test(tag) ? `\n\n${s}\n\n` : s;
  }
  // Tidy blank lines and stray indentation outside fenced code only.
  function block(n) { return tidy(kids(n)); }
  function tidy(s) {
    return s.split(/(\n(`{3,})[\w+#-]*\n[\s\S]*?\n\2(?=\n))/).map((p, i, a) =>
      i % 3 === 1 ? p : i % 3 === 2 ? '' : p.replace(/[ \t]+\n/g, '\n').replace(/\n (?! )/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/\n{2,}$/, i + 1 < a.length ? '\n' : '')).join('').trim();
  }
  return tidy(`\n${md(root)}\n`);
}

// Clipboard HTML. Mac Notes/TextEdit and Word drop the box around <pre>, but keep table cells, so each code block travels as a one-cell table.
function toRichHtml(root) {
  const box = root.cloneNode(true);
  const style = (sel, css) => box.querySelectorAll(sel).forEach(e => e.setAttribute('style', css));
  style('table', 'border-collapse:collapse;margin:8px 0');
  style('th,td', 'border:1px solid #bbb;padding:6px 10px;text-align:left;vertical-align:top');
  style('th', 'border:1px solid #bbb;padding:6px 10px;text-align:left;background-color:#e8e8ec');
  style(':not(pre) > code', 'font-family:Menlo,Courier,monospace');
  box.querySelectorAll('pre').forEach(pre => {
    const doc = pre.ownerDocument, table = doc.createElement('table'), td = table.createTBody().insertRow().insertCell();
    table.setAttribute('style', 'border-collapse:collapse;width:100%;margin:8px 0');
    td.setAttribute('style', 'border:1px solid #bbb;background-color:#f4f4f5;padding:10px');
    td.setAttribute('bgcolor', '#f4f4f5');
    pre.replaceWith(table);
    // Real spaces and newlines (no &nbsp;), so commands still run after copying them back out.
    pre.setAttribute('style', 'margin:0;font-family:Menlo,Courier,monospace;font-size:12px;color:#111;white-space:pre-wrap');
    td.append(pre);
  });
  return box.innerHTML;
}

// For plain-text editors: no Markdown marks; table cells are tab-separated and code is untouched.
function toPlainText(root) {
  const blocks = [], keep = s => `\u0000${blocks.push(s) - 1}\u0000`;
  function txt(n) {
    if (n.nodeType === 3) return n.data.replace(/\s+/g, ' ');
    const tag = n.nodeName, kids = () => [...n.childNodes].map(txt).join('');
    if (tag === 'PRE') return `\n\n${keep(n.textContent)}\n\n`;
    if (tag === 'TABLE') return `\n\n${keep([...n.querySelectorAll('tr')].map(r => [...r.children].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join('\t')).join('\n'))}\n\n`;
    if (tag === 'BR') return '\n';
    if (tag === 'LI') {
      const p = n.parentElement, mark = p?.nodeName === 'OL' ? `${(p.start || 1) + [...p.children].indexOf(n)}. ` : '• ';
      return `\n${mark}${kids().trim().replace(/\n+/g, '\n   ')}`;
    }
    return BLOCK.test(tag) ? `\n\n${kids()}\n\n` : kids();
  }
  return txt(root).replace(/[ \t]+\n/g, '\n').replace(/\n (?! )/g, '\n').replace(/\n{3,}/g, '\n\n').trim().replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[i]);
}

// <ai>-<topic, 20 characters>-<DDMMYYYY>.md
const AI_HOSTS = ['chatgpt', 'openai', 'gemini', 'claude', 'copilot', 'deepseek', 'kimi', 'qwen', 'grok', 'minimax', 'manus', 'muse', 'meta'];
function detectAi(host = '') {
  const labels = host.split('.');
  const found = AI_HOSTS.find(n => labels.includes(n));
  return found === 'openai' ? 'chatgpt' : found || labels.at(-2) || 'ai';
}

function fileName(chat, date = new Date(), ai = detectAi(chat.host)) {
  const squash = s => s.replace(/[\\/:*?"<>|#.\-\s\u0000-\u001f]+/g, '').replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, '');
  // Drop the site name from the tab title; some sites show nothing else, so then use the first question.
  const site = /^(google gemini|gemini|chatgpt|claude|microsoft copilot|copilot|deepseek|kimi|qwen( chat)?|grok|minimax|manus|meta ai)$/i;
  let topic = (chat.title || '').split(/\s+[-|–—]\s+/).filter(p => !site.test(p.trim())).join(' ');
  if (!squash(topic)) {
    const first = (chat.messages || []).find(m => m.role === 'You') || chat.messages?.[0];
    topic = first?.html ? parse(first.html).textContent : '';
  }
  const two = n => String(n).padStart(2, '0');
  return `${ai}-${[...squash(topic)].slice(0, 20).join('') || 'chat'}-${two(date.getDate())}${two(date.getMonth() + 1)}${date.getFullYear()}.md`;
}

// Runs inside the page. live=true returns DOM nodes (userscript); otherwise HTML strings (extension). Reads only.
function grab(live) {
  const title = document.title;
  const pick = el => live ? el : el.innerHTML;
  const sel = getSelection();
  if (sel && sel.toString().trim().length > 20) {
    const box = document.createElement('div');
    for (let i = 0; i < sel.rangeCount; i++) {
      const range = sel.getRangeAt(i);
      let part = range.cloneContents();
      // A selection inside a code block or table loses that wrapper, so put it back.
      for (let el = range.commonAncestorContainer; el; el = el.parentElement) {
        if (!/^(CODE|PRE|TBODY|THEAD|TR|TABLE|UL|OL)$/.test(el.nodeName) || (el.nodeName === 'CODE' && !el.closest('pre'))) continue;
        const wrap = el.cloneNode(false);
        wrap.append(part);
        part = wrap;
      }
      box.append(part);
    }
    return { title, messages: [{ role: '', html: pick(box) }] };
  }
  // shortcut: per-site selectors for ChatGPT, Claude and Gemini only; other sites export the whole <main>. Add a selector when a site needs it.
  const user = '[data-message-author-role="user"], [data-testid="user-message"], user-query';
  const ai = '[data-message-author-role="assistant"], .font-claude-response, model-response';
  const found = [...document.querySelectorAll(`${user}, ${ai}`)];
  const top = found.filter(el => !found.some(o => o !== el && o.contains(el)));
  const messages = top.map(el => el.matches(user)
    ? { role: 'You', html: pick(el.querySelector('.query-text') || el) }
    : { role: 'AI', html: pick(el.querySelector('message-content') || el) });
  if (!messages.length) messages.push({ role: '', html: pick(document.querySelector('main') || document.body), whole: true });
  return { title, messages };
}

// Reader logic shared by the extension page and the iOS userscript overlay.
// $: element by id. scroller: the scrolling element. active: whether keyboard shortcuts apply.
function startReader({ $, scroller, active = () => true }) {
const opts = () => ({ icons: $('icons').checked, boldHeadings: $('boldHeadings').checked });
let chat, parts = [];

function render() {
  const o = opts();
  parts = chat.messages.map(m => ({ role: m.role, el: clean(m.role === 'You' ? plainToHtml(m.html) : m.html, o) }));
  $('chat').replaceChildren(...parts.map(p => {
    const s = document.createElement('section');
    s.className = p.role === 'You' ? 'you' : 'ai';
    if (p.role) { const r = document.createElement('div'); r.className = 'role'; r.textContent = p.role; s.append(r); }
    s.append(p.el);
    return s;
  }));
}

const markdown = () => parts.map(p => (p.role ? `**${p.role}**\n\n` : '') + toMarkdown(p.el, opts())).join('\n\n---\n\n') + '\n';

async function copy(items, done) {
  try { await items(); $('status').textContent = done; } catch (e) { $('status').textContent = `Copy failed: ${e.message}`; }
}

// Export asks the reader to confirm the detected AI before anything is saved.
const exportName = () => fileName(chat, new Date(), $('ai').value);
const showName = () => { $('nameShow').textContent = exportName().replace(/\.md$/, ''); };
$('export').onclick = () => {
  if (!chat) return;
  setScrolling(false);
  const ai = detectAi(chat.host);
  $('ai').value = [...$('ai').options].some(o => o.value === ai) ? ai : 'ai';
  $('exportBox').returnValue = '';
  showName();
  $('exportBox').showModal();
};
$('ai').onchange = showName;
$('exportBox').onclose = () => {
  const type = $('exportBox').returnValue;
  if (type === 'md') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown' }));
    a.download = exportName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  } else if (type === 'pdf') {
    // The browser's own PDF writer keeps Thai text, tables and code; it takes the file name from the page title.
    const title = document.title;
    document.title = exportName().replace(/\.md$/, '');
    addEventListener('afterprint', () => { document.title = title; }, { once: true });
    print();
  }
};

$('copyMd').onclick = () => copy(() => navigator.clipboard.writeText(markdown()), 'Markdown copied. Paste into Notion or a Markdown editor');
$('copyRich').onclick = () => copy(() => {
  const box = $('chat').cloneNode(true);
  return navigator.clipboard.write([new ClipboardItem({
    'text/html': new Blob([toRichHtml(box)], { type: 'text/html' }),
    'text/plain': new Blob([toPlainText(box) + '\n'], { type: 'text/plain' }),
  })]);
}, 'Copied. Paste into Notes, Docs, Word or TextEdit');
$('icons').onchange = $('boldHeadings').onchange = () => render();

// Auto scroll for reading. Position is kept as a float because scrollTo rounds slow speeds down to nothing.
let raf = 0, last = 0, pos = 0;
function setScrolling(on) {
  cancelAnimationFrame(raf);
  raf = 0;
  $('scroll').textContent = on ? '⏸ Pause' : '▶ Auto Scroll';
  $('scroll').setAttribute('aria-pressed', String(on));
  if (!on) return;
  last = performance.now();
  pos = scroller.scrollTop;
  raf = requestAnimationFrame(step);
}
function step(now) {
  if (Math.abs(scroller.scrollTop - pos) > 2) pos = scroller.scrollTop; // the reader scrolled by hand: carry on from there
  pos += $('speed').value * Math.min(now - last, 100) / 1000;
  last = now;
  scroller.scrollTop = pos;
  if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) return setScrolling(false);
  raf = requestAnimationFrame(step);
}
$('scroll').onclick = () => setScrolling(!raf);
$('speed').oninput = () => { $('speedNum').value = $('speed').value; };
addEventListener('keydown', e => {
  if (!active()) return;
  const from = e.composedPath()[0];
  if (e.code === 'Space' && !from.closest?.('button, input, select, dialog')) { e.preventDefault(); setScrolling(!raf); }
  if (e.code === 'Escape') setScrolling(false);
});

return {
  load(c) {
    if (!c || c.error) { chat = null; $('chat').replaceChildren(); $('status').textContent = `Could not read that page${c ? `: ${c.error}` : ''}`; return; }
    chat = c;
    render();
    $('status').textContent = c.messages.some(m => m.whole)
      ? 'Chat messages were not recognised, so the whole page is shown. Tip: select text first, then export.'
      : `${c.messages.length} messages. If older ones are missing, scroll to the top of the chat and export again.`;
  },
  stop: () => setScrolling(false),
};
}

const CSS = ".box { --bg: #fff; --fg: #18181b; --soft: #f4f4f5; --line: #e4e4e7; --mut: #71717a; }\n@media (prefers-color-scheme: dark) { .box { --bg: #18181b; --fg: #f4f4f5; --soft: #27272a; --line: #3f3f46; --mut: #a1a1aa; } }\n.box { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.7 -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif; }\nheader { position: sticky; top: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 10px 16px; background: var(--bg); border-bottom: 1px solid var(--line); font-size: 14px; }\n.grow { flex: 1; }\nbutton { padding: 7px 14px; border: 0; border-radius: 7px; background: #4f46e5; color: #fff; font-weight: 600; cursor: pointer; }\n#status, main { max-width: 800px; margin: 16px auto; padding: 0 16px; }\n#status { color: var(--mut); font-size: 13px; }\nsection { margin-bottom: 28px; overflow-wrap: break-word; }\nsection.you { background: var(--soft); border-radius: 12px; padding: 4px 16px; }\n.role { margin-top: 8px; font-size: 12px; font-weight: 700; color: var(--mut); }\npre { position: relative; overflow-x: auto; background: #0f172a; color: #e2e8f0; border-radius: 10px; padding: 14px 16px; font: 13.5px/1.6 Menlo, Consolas, monospace; }\npre[data-lang] { padding-top: 32px; }\npre[data-lang]::before { content: attr(data-lang); position: absolute; top: 7px; left: 16px; color: #94a3b8; font-size: 11px; }\n:not(pre) > code { background: var(--soft); border-radius: 4px; padding: 1px 5px; font-size: .88em; }\ntable { display: block; overflow-x: auto; border-collapse: collapse; margin: 14px 0; }\nth, td { border: 1px solid var(--line); padding: 8px 12px; text-align: left; vertical-align: top; }\nth, tr:nth-child(even) td { background: var(--soft); }\nblockquote { margin: 0; padding-left: 14px; border-left: 3px solid var(--line); color: var(--mut); }\ndialog { width: min(360px, 90vw); border: 1px solid var(--line); border-radius: 12px; background: var(--bg); color: var(--fg); }\ndialog form { display: flex; flex-direction: column; gap: 10px; }\ndialog h2, dialog p { margin: 0; }\ndialog p { overflow-wrap: anywhere; font: 13px Menlo, Consolas, monospace; }\ndialog select { width: 100%; padding: 7px; font: inherit; }\ndialog .cancel { background: var(--soft); color: var(--fg); }\n/* Phones: keep the sticky toolbar small so the chat stays readable. */\n@media (max-width: 600px) {\n  header { gap: 6px; padding: max(6px, env(safe-area-inset-top)) 8px 6px; font-size: 12px; }\n  header button { padding: 5px 9px; min-height: 32px; font-size: 12px; }\n  header img, header strong, .grow { display: none; }\n  header input[type=range] { width: 90px; }\n}\n@media print {\n  .box { --bg: #fff; --fg: #111; --soft: #f4f4f5; --line: #bbb; --mut: #555; }\n  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n  header, #status, dialog { display: none !important; }\n  main { max-width: none; margin: 0; padding: 0; font-size: 12px; }\n  pre { white-space: pre-wrap; overflow-wrap: anywhere; overflow: visible; background: #f4f4f5; color: #111; border: 1px solid #bbb; }\n  table { display: table; width: 100%; overflow: visible; }\n  /* Thonburi keeps Thai text copyable and searchable in the PDF; the system default scrambles it. */\n  .box { font-family: Thonburi, sans-serif; }\n  pre, code { font-family: Menlo, Consolas, Thonburi, monospace; }\n  /* A table moves whole to the next page. One taller than a page can only break between rows, repeating its header. */\n  table, tr, .role { break-inside: avoid; }\n  thead { display: table-header-group; }\n}\n.box { position: fixed; inset: 0; z-index: 2147483647; overflow: auto; -webkit-overflow-scrolling: touch; text-align: left; }\n.box[hidden], .fab[hidden] { display: none; }\n.fab { position: fixed; right: 10px; top: 38%; z-index: 2147483647; box-shadow: 0 4px 14px rgba(0,0,0,.4); }\nbutton { min-height: 36px; }\n@media print { .box { position: static; overflow: visible; } .fab { display: none; } }\n";
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
const ai = mk('select', { id: 'ai' }, ...[['chatgpt', 'ChatGPT'], ['gemini', 'Gemini'], ['claude', 'Claude'], ['copilot', 'Copilot'], ['deepseek', 'DeepSeek'], ['kimi', 'Kimi'], ['qwen', 'Qwen'], ['grok', 'Grok'], ['minimax', 'MiniMax'], ['manus', 'Manus'], ['meta', 'Meta AI'], ['muse', 'Muse'], ['ai', 'Other']].map(([v, t]) => new Option(t, v)));

const open = button('open', 'AI Export', { class: 'fab' });
const box = mk('div', { class: 'box', hidden: '' },
  mk('header', {},
    button('close', '✕ Close'), check('icons', 'Remove icons / emoji'), check('boldHeadings', 'Bold headings'),
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
open.onclick = () => {
  const chat = grab(true); // read before the overlay opens, while any text selection is still there
  chat.host = location.hostname;
  box.hidden = false;
  open.hidden = true;
  reader.load(chat);
  box.scrollTop = 0;
};
$('close').onclick = () => { reader.stop(); box.hidden = true; open.hidden = false; };
})();
