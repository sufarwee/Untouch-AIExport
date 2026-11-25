const reader = startReader({ $: id => document.getElementById(id), scroller: document.scrollingElement });
chrome.storage.session.get('chat').then(({ chat }) => reader.load(chat));
