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
