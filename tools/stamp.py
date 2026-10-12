#!/usr/bin/env python3
"""Fingerprint the site's CSS and JS links so browsers never mix old files with new pages.

GitHub Pages lets browsers keep a file for 10 minutes. After an update, a visitor could get
the new page with last version's stylesheet. Each link gets ?v=<hash of the file's
contents>, so a changed file has a new address and is fetched straight away.

Run before committing whenever css/ or js/ changed:  python3 tools/stamp.py
"""
import hashlib
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
link = re.compile(r'(href|src)="((?:css|js)/[^"?#]+)(?:\?v=[0-9a-f]+)?"')


def stamp(match):
    attr, path = match.group(1), match.group(2)
    digest = hashlib.sha1((root / path).read_bytes()).hexdigest()[:10]
    return f'{attr}="{path}?v={digest}"'


changed = 0
for page in sorted(root.glob('*.html')):
    text = page.read_text()
    new = link.sub(stamp, text)
    if new != text:
        page.write_text(new)
        changed += 1
print(f'stamped {changed} page(s)')
