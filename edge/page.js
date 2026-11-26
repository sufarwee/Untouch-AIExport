// Untouch Flow AI Export | (c) 2026 Sufarwee Dunyamat AKA SufarweeDeDev (Full Stack Developer, SEO Expert, SEM Specialist, DevOps) | https://github.com/sufarwee | Apache-2.0
const reader = startReader({ $: id => document.getElementById(id), scroller: document.scrollingElement });
chrome.storage.session.get('chat').then(({ chat }) => reader.load(chat));
