#!/bin/sh
# Untouch Flow AI Export | (c) 2026 Sufarwee Dunyamat AKA SufarweeDeDev (Full Stack Developer, SEO Expert, SEM Specialist, DevOps) | https://github.com/sufarwee | Apache-2.0
# Builds chrome/, firefox/, edge/, the store zips (dist/, git-ignored) and the iOS packages from the root source.
# Run: sh build.sh
set -e
cd "$(dirname "$0")"
SRC="LICENSE NOTICE bg.js grab.js lib.js reader.js page.js reader.html reader.css"
rm -rf chrome edge firefox dist; mkdir -p dist
for t in chrome edge firefox; do
  mkdir "$t"; cp $SRC "$t"/; cp -r icons "$t"/
  if [ "$t" = firefox ]; then cp manifest.firefox.json firefox/manifest.json; else cp manifest.json "$t"/manifest.json; fi
  (cd "$t" && zip -qr "../dist/untouch-ai-export-$t.zip" . -x '.DS_Store')
done
M1=safari-ios/method-1-orion; M2=safari-ios/method-2-safari-userscript
mkdir -p $M1 $M2
cp dist/untouch-ai-export-firefox.zip $M1/untouch-ai-export-orion.zip
python3 - <<'PY'
import json, re
read = lambda f: open(f, encoding='utf-8').read()
version = json.loads(read('manifest.json'))['version']
hosts = 'chatgpt.com chat.openai.com gemini.google.com claude.ai copilot.microsoft.com chat.deepseek.com kimi.com www.kimi.com kimi.ai www.kimi.ai copilot.com www.copilot.com chat.qwen.ai grok.com manus.im meta.ai www.meta.ai perplexity.ai www.perplexity.ai agent.minimax.io'.split()
# The page's :root and body become the overlay box.
css = re.sub(r'(?m)^(\s*)body \{', r'\1.box {', read('reader.css').replace(':root', '.box')) + read('userscript.css')
head = ['// ==UserScript==', '// @name         Untouch Flow AI Export', f'// @version      {version}',
        '// @description  Read an AI chat and export it as Markdown or PDF with code blocks and tables intact',
        '// @author       Sufarwee Dunyamat (SufarweeDeDev)',
        '// @license      Apache-2.0', '// @copyright    2026, Sufarwee Dunyamat (https://github.com/sufarwee)'] + [f'// @match        https://{h}/*' for h in hosts] + [
        '// @noframes', '// @grant        none', '// @run-at       document-end', '// ==/UserScript==']
body = '\n'.join(read(f) for f in ['lib.js', 'grab.js', 'reader.js'])
out = '\n'.join(head) + "\n\n(() => {\n'use strict';\n" + body + f'\nconst CSS = {json.dumps(css)};\n' + read('userscript-ui.js') + '})();\n'
open('safari-ios/method-2-safari-userscript/untouch-ai-export.user.js', 'w', encoding='utf-8').write(out)
PY
(cd $M2 && rm -f untouch-ai-export-safari-userscript.zip && zip -q untouch-ai-export-safari-userscript.zip untouch-ai-export.user.js)
echo "built: chrome/ edge/ firefox/ + dist/*.zip, safari-ios/"
