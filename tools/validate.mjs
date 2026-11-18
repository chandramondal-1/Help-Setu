/* HelpSetu data validation — run: node tools/validate.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

function load(file, key) {
  const sandbox = { window: {} };
  vm.runInNewContext(read(file), sandbox, { filename: file });
  return sandbox.window[key];
}

const D = load('data.js', 'HELPSETU_DATA');
const I18N = load('i18n.js', 'HELPSETU_I18N');

const ids = new Set();
const categoryIds = new Set(D.categories.map((c) => c.id));
const stateCodes = new Set(D.states.map((s) => s.code));
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(Date.parse(v + 'T00:00:00'));
let trilingualNames = 0;
let trilingualPurpose = 0;

for (const s of D.services) {
  if (!s.id) fail('service without id');
  if (ids.has(s.id)) fail(`duplicate service id: ${s.id}`);
  ids.add(s.id);

  if (['en', 'hi', 'bn'].every((lang) => s.name?.[lang])) trilingualNames++;
  if (['en', 'hi', 'bn'].every((lang) => s.purpose?.[lang])) trilingualPurpose++;

  if (!categoryIds.has(s.category)) fail(`${s.id}: unknown category ${s.category}`);
  if (!['national', 'state'].includes(s.scope)) fail(`${s.id}: bad scope ${s.scope}`);
  if (s.scope === 'state' && !stateCodes.has(s.state)) fail(`${s.id}: bad state ${s.state}`);

  const number = s.number || s.dial;
  if (number) {
    const digits = String(number).replace(/\D/g, '');
    if (digits.length < 3 || digits.length > 15) fail(`${s.id}: implausible number ${number}`);
  } else if (!(s.officialUrl || s.channels?.web)) {
    fail(`${s.id}: no phone number and no official website`);
  }

  if (!s.sourceUrl) fail(`${s.id}: missing sourceUrl`);
  if (!isIso(s.verifiedDate)) fail(`${s.id}: bad verifiedDate ${s.verifiedDate}`);
}

const coreNumbers = ['112', '108', '102', '139', '1033', '1906', '1930', '1915', '181', '1098'];
const allNumbers = new Set(D.services.map((s) => String(s.number || s.dial || '').replace(/\D/g, '')));
for (const n of coreNumbers) {
  if (!allNumbers.has(n)) fail(`core number missing: ${n}`);
}

for (const it of D.intents) {
  if (!it.id) fail('intent without id');
  for (const lang of ['en', 'hi', 'bn']) {
    if (!it.title?.[lang]) warn(`${it.id}: missing ${lang} title`);
    if (!it.steps?.[lang]?.length) warn(`${it.id}: missing ${lang} steps`);
  }
  for (const id of it.serviceIds || []) {
    if (!ids.has(id)) fail(`${it.id}: refers to unknown service ${id}`);
  }
}

function flatten(obj, prefix = '') {
  const out = new Set();
  for (const [key, value] of Object.entries(obj || {})) {
    const k = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const child of flatten(value, k)) out.add(child);
    } else out.add(k);
  }
  return out;
}
const enKeys = flatten(I18N.en);
for (const lang of ['hi', 'bn']) {
  const keys = flatten(I18N[lang]);
  for (const key of enKeys) if (!keys.has(key)) warn(`i18n ${lang}: missing ${key}`);
}

for (const [file, text] of Object.entries({ 'data.js': read('data.js'), 'i18n.js': read('i18n.js') })) {
  if (/শিকayat|제공/.test(text)) fail(`${file}: known corrupted text found`);
}

const counts = {
  services: D.services.length,
  national: D.services.filter((s) => s.scope === 'national').length,
  state: D.services.filter((s) => s.scope === 'state').length,
  intents: D.intents.length,
  states: D.states.length,
  categories: D.categories.length,
  trilingualNames,
  trilingualPurpose,
};

console.log('HelpSetu data check');
console.log(counts);
console.log(`Bengali UI names: ${trilingualNames}/${D.services.length} curated; state records fall back to official English/Hindi names.`);
for (const w of warnings) console.warn('warning:', w);
for (const e of errors) console.error('error:', e);
console.log(errors.length ? `FAILED — ${errors.length} error(s), ${warnings.length} warning(s)` : `OK — ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
