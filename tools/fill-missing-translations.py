#!/usr/bin/env python3
"""Fill keys added to source.json after a language was already translated."""
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

import translate as T

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data/translations/source.json')
LANGS = os.path.join(ROOT, 'tools/languages.json')
OUTDIR = os.path.join(ROOT, 'data/translations/auto')


def get(node, path):
    for p in path:
        try:
            node = node[p] if isinstance(node, list) else node.get(p)
        except Exception:
            return None
        if node is None:
            return None
    return node


def main():
    source = json.load(open(SRC, encoding='utf-8'))
    langs = json.load(open(LANGS, encoding='utf-8'))
    only = set(sys.argv[1:])
    for lang in langs:
        code = lang.get('google')
        if not code or (only and lang['code'] not in only and code not in only):
            continue
        path = os.path.join(OUTDIR, code + '.json')
        if not os.path.exists(path):
            print('missing language file', code)
            continue
        data = json.load(open(path, encoding='utf-8'))
        missing = [(kind, p, text) for kind, p, text in T.walk(source) if not get(data[kind], p)]
        if not missing:
            print('up to date', code)
            continue
        print('filling', code, len(missing))
        flat = {}
        for batch in T.batches(missing):
            try:
                parts = T.translate_batch(batch, code)
            except Exception as e:
                print('  batch failed', e)
                parts = [x[2] for x in batch]
            for (kind, p, src), text in zip(batch, parts):
                text = ' '.join(str(text).split()) or src
                if kind == 'ui' and T.placeholders(src) - T.placeholders(text):
                    text = src
                flat[(kind, tuple(p))] = text
        for (kind, p), text in flat.items():
            T.assign(data[kind], list(p), text)
        json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('saved', code, '+', len(flat))


if __name__ == '__main__':
    main()
