// Untouch Flow AI Export | (c) 2026 Sufarwee Dunyamat AKA SufarweeDeDev (Full Stack Developer, SEO Expert, SEM Specialist, DevOps) | https://github.com/sufarwee | Apache-2.0
// Click the toolbar icon: snapshot the chat in the current tab, then open the reader.
// Firefox loads grab.js from the manifest; Chrome and Edge service workers import it.
if (typeof importScripts === 'function') importScripts('grab.js');

const busy = new Set();
chrome.action.onClicked.addListener(async tab => {
  if (busy.has(tab.id)) return; // a second run would fight the first one over the scroll position
  busy.add(tab.id);
  chrome.action.setBadgeText({ tabId: tab.id, text: '...' });
  // Reading a long chat can take minutes; an API call now and then keeps Chrome from stopping the worker.
  const alive = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
  let chat;
  try {
    [{ result: chat }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: grab });
  } catch (e) {
    chat = { error: e.message };
  } finally {
    clearInterval(alive);
    busy.delete(tab.id);
    chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  }
  if (tab.url) chat.host = new URL(tab.url).hostname; // readable thanks to activeTab; used for the file name
  // Icons are dropped by the reader anyway and take much of the session-storage quota.
  chat.messages?.forEach(m => { m.html = m.html.replace(/<svg\b[\s\S]*?<\/svg>/gi, ''); });
  try {
    await chrome.storage.session.set({ chat });
  } catch (e) {
    // Never leave the previous chat in place: the reader would show it as if it were this one.
    await chrome.storage.session.set({ chat: { error: `chat too large, select part of it and try again (${e.message})` } });
  }
  chrome.tabs.create({ url: 'reader.html' });
});
