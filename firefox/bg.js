// Click the toolbar icon: snapshot the chat in the current tab, then open the reader.
// Firefox loads grab.js from the manifest; Chrome and Edge service workers import it.
if (typeof importScripts === 'function') importScripts('grab.js');

chrome.action.onClicked.addListener(async tab => {
  let chat;
  try {
    [{ result: chat }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: grab });
  } catch (e) {
    chat = { error: e.message };
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
