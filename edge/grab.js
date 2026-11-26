// Untouch Flow AI Export | (c) 2026 Sufarwee Dunyamat AKA SufarweeDeDev (Full Stack Developer, SEO Expert, SEM Specialist, DevOps) | https://github.com/sufarwee | Apache-2.0
// Runs inside the page. live=true returns DOM nodes (userscript); otherwise HTML strings (extension).
// Changes nothing on the page; it only scrolls the chat to load messages, then scrolls back.
// executeScript sends this one function to the page, so every helper has to live inside it.
async function grab(live) {
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
  // shortcut: per-site selectors for ChatGPT, Claude, Gemini, Perplexity, Copilot, Meta AI, Grok, Kimi, DeepSeek, Qwen, Manus and MiniMax only; other sites export the whole <main>. Add a selector when a site needs it.
  const user = '[data-message-author-role="user"], [data-testid="user-message"], user-query, [data-user-message-bubble], [data-message-bubble="right"], .fai-UserMessage__message, [data-message-role="user"], .segment-user, .ds-message:not(:has(.ds-markdown)), .user-message-content, .user-message-bubble-new';
  const ai = '[data-message-author-role="assistant"], .font-claude-response, model-response, [data-markdown-text-style="assistant-message"], [data-renderer="lm"], [data-testid="markdown-reply"], [data-testid="assistant-message"], .segment-assistant .markdown-container, .ds-assistant-message-main-content, .response-message-content.phase-answer, .manus-markdown.chat-message-body, .matrix-markdown.message-content';
  // Chat sites keep only the messages near the view in the page, so collect them while scrolling and merge in order.
  const ID = ['data-index', 'data-message-id', 'data-turn-key', 'data-turn-id', 'data-virtual-list-item-key'];
  const list = [], byKey = new Map(), blank = new Set(), filled = new Set();
  const current = () => {
    const found = [...document.querySelectorAll(`${user}, ${ai}`)];
    return found.filter(el => !found.some(o => o !== el && o.contains(el)));
  };
  const snap = () => {
    const seen = new Map(), owner = new Map();
    const items = [];
    for (const el of current()) {
      const role = el.matches(user) ? 'You' : 'AI';
      // Kimi: a question that is only a file has no .user-content.
      const kimi = el.matches('.segment-user');
      const part = el.querySelector(role === 'You' ? '.query-text, [data-testid="user-message-text"], .user-content' : 'message-content');
      const body = part || el;
      const holder = el.closest(ID.map(n => `[${n}]`).join());
      const id = holder ? `${role}|${ID.map(n => holder.getAttribute(n)).join('|')}` : '';
      const text = kimi && !part ? '' : body.textContent.trim();
      if (!text) { blank.add(id || `${role}|${items.length}`); continue; } // not rendered yet, or only an attachment
      if (id) filled.add(id);
      // shortcut: without a site id, two messages with the same opening text count as one unless both are on screen together.
      const base = `${id || role}|${text.slice(0, 80)}`, nth = seen.get(base) || 0;
      // The same site id in a second place is a hidden copy of one message (Meta AI).
      const place = holder?.closest('[data-message-id]');
      if (place && nth && owner.get(base) !== place) continue;
      owner.set(base, place);
      seen.set(base, nth + 1);
      items.push({ key: `${base}|${nth}`, role, size: text.length, body });
    }
    let after = null;
    items.forEach((item, i) => {
      let known = byKey.get(item.key);
      if (!known) {
        known = { key: item.key, role: item.role, size: -1 };
        byKey.set(item.key, known);
        const next = items.slice(i + 1).map(x => byKey.get(x.key)).find(Boolean);
        list.splice(after ? list.indexOf(after) + 1 : next ? list.indexOf(next) : list.length, 0, known);
      }
      // Copy now: the site may remove or reuse this node on the next scroll.
      if (item.size > known.size) { known.size = item.size; known.html = live ? item.body.cloneNode(true) : item.body.innerHTML; }
      after = known;
    });
  };

  let partial = false;
  const first = current()[0];
  let box = first?.parentElement;
  while (box && !(box.scrollHeight > box.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
  if (first && !box) box = document.scrollingElement;
  if (!box || box.scrollHeight <= box.clientHeight + 50) snap();
  else {
    const wait = ms => new Promise(done => setTimeout(done, ms));
    const start = box.scrollTop;
    const jump = y => box.scrollTo({ top: y, behavior: 'instant' });
    const top = () => (getComputedStyle(box).flexDirection === 'column-reverse' ? box.clientHeight - box.scrollHeight : 0);
    try {
      // Go to the top until the page stops growing: older messages load on the way.
      let height = -1, tries = 0;
      for (; tries < 40 && box.scrollHeight !== height; tries++) { height = box.scrollHeight; jump(top()); await wait(500); }
      // Collect from the top down only, so the order stays right wherever the reader was.
      snap();
      partial = tries === 40;
      let steps = 0;
      for (; steps < 500; steps++) {
        const before = box.scrollTop;
        jump(before + box.clientHeight * 0.6);
        await wait(250);
        snap();
        if (Math.abs(box.scrollTop - before) < 2) break;
      }
      partial ||= steps === 500;
    } finally {
      jump(start);
    }
  }
  const messages = list.map(({ role, html }) => ({ role, html }));
  const skipped = [...blank].filter(k => !filled.has(k)).length;
  if (!messages.length) messages.push({ role: '', html: pick(document.querySelector('main') || document.body), whole: true });
  return { title, messages, skipped, partial };
}
