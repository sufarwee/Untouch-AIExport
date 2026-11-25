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
