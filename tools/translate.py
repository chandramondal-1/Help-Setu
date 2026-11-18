#!/usr/bin/env python3
"""Build automatic beta translations for HelpSetu's UI and catalogue.

Source:  data/translations/source.json
Output:  data/translations/auto/<lang>.json

Uses Google's public translate endpoint in small batches. Translations are
cached, so re-running only fills missing languages. Use --force to redo one.

This is a developer tool. The shipped app reads the generated JS files; it
never calls the network for translation.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data/translations/source.json')
LANGS = os.path.join(ROOT, 'tools/languages.json')
OUTDIR = os.path.join(ROOT, 'data/translations/auto')
SEP = '\n<<<HS>>>\n'
URL = 'https://translate.googleapis.com/translate_a/single'
UA = 'Mozilla/5.0 (HelpSetu translation builder)'


def walk(source):
    """Yield (kind, key, text) for every translatable string."""
    for k, v in source['ui'].items():
        yield ('ui', [k], v)
    for k, v in source['categories'].items():
        yield ('categories', [k], v)
    for k, v in source['states'].items():
        yield ('states', [k], v)
    for k, v in source['intents'].items():
        yield ('intents', [k, 'title'], v['title'])
        for i, p in enumerate(v['phrases']):
            yield ('intents', [k, 'phrases', i], p)
        for i, p in enumerate(v['steps']):
            yield ('intents', [k, 'steps', i], p)
    for sid, v in source['services'].items():
        yield ('services', [sid, 'name'], v['name'])
        yield ('services', [sid, 'purpose'], v['purpose'])
        if 'when' in v:
            yield ('services', [sid, 'when'], v['when'])
            for i, p in enumerate(v['steps']):
                yield ('services', [sid, 'steps', i], p)


def translate(text, code):
    params = urllib.parse.urlencode({'client': 'gtx', 'sl': 'en', 'tl': code, 'dt': 't', 'q': text})
    req = urllib.request.Request(URL + '?' + params, headers={'User-Agent': UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.load(r)
            return ''.join(part[0] for part in data[0])
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(1.5 * (attempt + 1))


def batches(items, max_chars=2400):
    cur, size = [], 0
    for it in items:
        n = len(it[2]) + len(SEP)
        if cur and size + n > max_chars:
            yield cur
            cur, size = [], 0
        cur.append(it)
        size += n
    if cur:
        yield cur


def translate_batch(batch, code):
    joined = SEP.join(x[2] for x in batch)
    out = translate(joined, code)
    parts = out.split('<<<HS>>>')
    if len(parts) != len(batch):
        # Some scripts may alter the marker. Fall back to one request per string.
        parts = [translate(x[2], code) for x in batch]
    return parts


def assign(node, path, value):
    """Set a nested dict/list path, creating containers as needed."""
    p = path[0]
    if isinstance(node, list):
        while len(node) <= p:
            node.append(None)
    if len(path) == 1:
        node[p] = value
        return
    nxt = path[1]
    want_list = isinstance(nxt, int)
    if isinstance(node, list):
        child = node[p]
    else:
        child = node.get(p)
    if want_list:
        if not isinstance(child, list):
            child = []
            if isinstance(node, list):
                node[p] = child
            else:
                node[p] = child
    else:
        if not isinstance(child, dict):
            child = {}
            if isinstance(node, list):
                node[p] = child
            else:
                node[p] = child
    assign(child, path[1:], value)


def placeholders(s):
    return set(re.findall(r'\{(\w+)\}', s or ''))


def run_language(lang, source, force=False):
    code = lang['google']
    out_path = os.path.join(OUTDIR, code + '.json')
    if os.path.exists(out_path) and not force:
        print('skip', code, '(cached)')
        return
    items = list(walk(source))
    flat = {}
    batches_list = list(batches(items))
    done = [0]
    lock = __import__('threading').Lock()

    def work(batch):
        try:
            parts = translate_batch(batch, code)
        except Exception as e:
            print('  retry failed batch:', e)
            parts = [x[2] for x in batch]
        local = {}
        for (kind, path, src_text), text in zip(batch, parts):
            text = ' '.join(str(text).split())
            if kind == 'ui' and placeholders(src_text) - placeholders(text):
                text = src_text
            if not text:
                text = src_text
            local[(kind, tuple(path))] = text
        with lock:
            flat.update(local)
            done[0] += len(batch)
            print(f'  {code}: {done[0]}/{len(items)}')

    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(work, batches_list))

    result = {'ui': {}, 'categories': {}, 'states': {}, 'intents': {}, 'services': {}}
    for (kind, path), text in flat.items():
        assign(result[kind], list(path), text)

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print('wrote', out_path)


def main():
    with open(SRC, encoding='utf-8') as f:
        source = json.load(f)
    with open(LANGS, encoding='utf-8') as f:
        langs = json.load(f)
    os.makedirs(OUTDIR, exist_ok=True)
    force_codes = set(a for a in sys.argv[1:] if not a.startswith('-'))
    force = '--force' in sys.argv
    for lang in langs:
        if not lang.get('google'):
            continue
        if force_codes and lang['code'] not in force_codes and lang['google'] not in force_codes:
            continue
        print('language', lang['code'], lang['english'])
        run_language(lang, source, force=force)
    print('done')


if __name__ == '__main__':
    main()
