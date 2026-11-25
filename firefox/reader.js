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
