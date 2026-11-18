/* Extract every translatable string into data/translations/source.json.
   Run: node tools/extract-translations.mjs */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {} };
createContext(ctx);
runInContext(readFileSync(resolve(root, 'i18n.js'), 'utf8'), ctx);
runInContext(readFileSync(resolve(root, 'data.js'), 'utf8'), ctx);
const I18N = ctx.window.HELPSETU_I18N;
const DATA = ctx.window.HELPSETU_DATA;

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const source = {
  ui: flatten(I18N.en),
  categories: {},
  states: {},
  intents: {},
  services: {},
};

for (const c of DATA.categories) source.categories[c.id] = c.name.en;
for (const s of DATA.states) source.states[s.code] = s.en;
for (const it of DATA.intents) {
  source.intents[it.id] = {
    title: it.title?.en || '',
    phrases: it.phrases?.en || [],
    steps: it.steps?.en || [],
  };
}
for (const s of DATA.services) {
  const curated = !!(s.name?.hi && s.name?.bn);
  source.services[s.id] = {
    name: s.name?.en || '',
    purpose: s.purpose?.en || '',
    ...(curated ? { when: s.when?.en || '', steps: s.steps?.en || [] } : {}),
  };
}

const outDir = resolve(root, 'data/translations');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'source.json'), JSON.stringify(source, null, 2));
const counts = {
  ui: Object.keys(source.ui).length,
  categories: Object.keys(source.categories).length,
  states: Object.keys(source.states).length,
  intents: Object.keys(source.intents).length,
  services: Object.keys(source.services).length,
};
console.log('Wrote data/translations/source.json', counts);
