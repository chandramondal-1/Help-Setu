#!/usr/bin/env node
/* HelpSetu data builder.
   Merges the curated HelpSetu catalogue with the verified India Helpline
   national + state records into a single offline data file (data.js).
   Run: node tools/build-data.mjs */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');
const SRC = resolve(APP, '..', 'india-helpline-main');
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Official railway guidance says 182 was merged into 139 on 1 April 2021.
// It must not ship as a separate, universally active helpline.
const RETIRED_IDS = new Set(['national-rpf-security-182']);
const VERIFY_MAX_AGE_DAYS = 365;
const addDays = (iso, days) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() + days * 86400000).toISOString().slice(0, 10);
};

const categoriesFile = read(join(APP, 'data/categories.json'));
const bnStates = read(join(APP, 'data/states-bn.json'));
const statesSource = read(join(SRC, 'data/states.json')).jurisdictions;

const newServices = [
  ...read(join(APP, 'data/services-a.json')),
  ...read(join(APP, 'data/services-b.json')),
  ...read(join(APP, 'data/services-c.json')),
];
const overrides = {};
for (const f of ['overrides-a.json', 'overrides-b.json']) {
  for (const o of read(join(APP, 'data', f))) overrides[o.id] = o;
}
const intents = read(join(APP, 'data/intents.json'));

// ---- state list ----
const states = statesSource.map((s) => ({
  code: s.code,
  en: s.name.en,
  hi: s.name.hi,
  bn: bnStates[s.code] || s.name.en,
}));

// ---- load verified records ----
const recordFiles = [];
const recDir = join(SRC, 'data/records');
for (const f of readdirSync(recDir).filter((f) => f.endsWith('.json'))) recordFiles.push(join(recDir, f));
const stateDir = join(recDir, 'states');
if (existsSync(stateDir)) {
  for (const f of readdirSync(stateDir).filter((f) => f.endsWith('.json'))) recordFiles.push(join(stateDir, f));
}
let records = [];
for (const f of recordFiles) {
  records.push(...read(f).filter((r) => r && r.id && !r.coverageNotes));
}
records = records.filter((r) => r.status === 'published' && !RETIRED_IDS.has(r.id));

const CODE_FIX = { UK: 'UT', CG: 'CT' };
const NATIONAL_CATEGORY = {
  'national-erss-112': 'emergency',
  'national-ndma-helpline-1078': 'emergency',
  'national-ndma-control-room': 'emergency',
  'national-ndrf-helpline': 'emergency',
  'national-moefcc-forestfire-1800119334': 'emergency',
  'national-coastguard-sar-1554': 'emergency',
  'national-imd-weather-duty': 'emergency',
  'national-ambulance-108': 'health',
  'national-maternal-102': 'health',
  'national-telemanas-14416': 'health',
  'national-poison-aiims': 'health',
  'national-poison-cmc-vellore': 'health',
  'national-pmjay-14555': 'health',
  'national-vayvandana-1800110770': 'health',
  'national-womenhelpline-181': 'women_child',
  'national-childhelpline-1098': 'women_child',
  'national-women-police-1091': 'women_child',
  'national-ncw-7827170170': 'women_child',
  'national-elderline-14567': 'women_child',
  'national-depwd-14456': 'women_child',
  'national-nalsa-15100': 'government',
  'national-railmadad-139': 'railway',
  'national-nhai-highway-1033': 'highway',
  'in-lpg-emergency-1906': 'gas',
  'national-cybercrime-1930': 'cyber',
  'national-tourist-infoline-1363': 'travel',
  'national-airsewa-grievance': 'travel',
};
const STATE_CATEGORY = {
  emergency: 'emergency',
  health: 'health',
  safety: 'women_child',
  disaster: 'emergency',
  travel: 'travel',
  utilities: 'utilities',
  crime: 'cyber',
  other: 'government',
};

function categoryFor(r) {
  if (r.scope === 'national') return NATIONAL_CATEGORY[r.id] || ({
    emergency: 'emergency', health: 'health', safety: 'women_child',
    disaster: 'emergency', travel: 'travel', utilities: 'utilities',
    crime: 'cyber', other: 'government',
  }[r.category] || 'government');
  return STATE_CATEGORY[r.category] || 'government';
}

function normalize(rec) {
  const isState = String(rec.scope).startsWith('state:');
  let state = null;
  if (isState) {
    state = rec.scope.split(':')[1];
    if (CODE_FIX[state]) state = CODE_FIX[state];
  }
  const svc = {
    id: rec.id,
    category: categoryFor(rec),
    scope: isState ? 'state' : 'national',
    state,
    name: { en: rec.name?.en || rec.id, hi: rec.name?.hi || null, bn: null },
    purpose: { en: rec.purpose?.en || '', hi: rec.purpose?.hi || null, bn: null },
    when: null,
    steps: null,
    number: rec.displayNumber || null,
    dial: rec.dial || null,
    altNumbers: [],
    hours: rec.hours || null,
    officialUrl: rec.channels?.web || null,
    sourceName: rec.operator || '',
    sourceUrl: rec.sourceUrl || '',
    verifiedDate: rec.checkedDate || null,
    verifiedUntil: addDays(rec.checkedDate, VERIFY_MAX_AGE_DAYS),
    emergency: rec.category === 'emergency' || rec.serviceType === 'dispatch' && rec.category === 'health',
    featured: false,
    keywords: Array.isArray(rec.aliases) ? rec.aliases.slice() : [],
    channels: {
      sms: rec.channels?.sms || null,
      whatsapp: rec.channels?.whatsapp || null,
      web: rec.channels?.web || null,
    },
    operator: rec.operator || '',
    languages: Array.isArray(rec.languages) ? rec.languages : [],
  };
  if (rec.notes) svc.notes = typeof rec.notes === 'string' ? rec.notes : rec.notes.en;
  return svc;
}

const byId = new Map();
for (const r of records) byId.set(r.id, normalize(r));

// curated new services win over same-id source records
for (const s of newServices) byId.set(s.id, { ...s });

// apply overrides (deep for objects, replace for arrays)
function deepMerge(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
for (const [id, patch] of Object.entries(overrides)) {
  const base = byId.get(id);
  if (!base) {
    console.warn(`! override for unknown id: ${id}`);
    continue;
  }
  byId.set(id, deepMerge(base, patch));
}

// defaults / clean
const services = [...byId.values()].map((s) => {
  const st = s.state ? states.find((x) => x.code === s.state) : null;
  return {
    ...s,
    scope: s.scope === 'state' ? 'state' : 'national',
    stateName: st ? { en: st.en, hi: st.hi, bn: st.bn } : null,
    number: s.number || null,
    dial: s.dial || (s.number ? String(s.number).replace(/[^\d+]/g, '') : null),
    altNumbers: s.altNumbers || [],
    keywords: s.keywords || [],
    emergency: !!s.emergency,
    featured: !!s.featured,
    verifiedDate: s.verifiedDate || null,
    verifiedUntil: s.verifiedUntil || addDays(s.verifiedDate, VERIFY_MAX_AGE_DAYS),
    officialUrl: s.officialUrl || s.channels?.web || null,
  };
});

// validated intent service references
const ids = new Set(services.map((s) => s.id));
for (const it of intents) {
  for (const sid of it.serviceIds || []) {
    if (!ids.has(sid)) console.warn(`! intent ${it.id} points to missing service ${sid}`);
  }
}

// featured fallback: top national numbers
const featuredFallback = ['national-erss-112', 'national-ambulance-108', 'national-womenhelpline-181', 'national-childhelpline-1098', 'national-railmadad-139', 'national-nhai-highway-1033', 'in-lpg-emergency-1906', 'national-cybercrime-1930', 'consumer-1915'];
for (const id of featuredFallback) {
  const s = services.find((x) => x.id === id);
  if (s) s.featured = true;
}

services.sort((a, b) => {
  if (a.scope !== b.scope) return a.scope === 'national' ? -1 : 1;
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return (a.name.en || '').localeCompare(b.name.en || '');
});

const data = {
  meta: categoriesFile.meta,
  categories: categoriesFile.categories,
  states,
  services,
  intents,
  built: new Date().toISOString().slice(0, 10),
  source: 'HelpSetu curated catalogue + India Helpline verified records',
};

writeFileSync(join(APP, 'data.js'), '/* Generated by tools/build-data.mjs — do not edit by hand. */\nwindow.HELPSETU_DATA = ' + JSON.stringify(data) + ';\n');
const bytes = readFileSync(join(APP, 'data.js')).length;
console.log(`built data.js — ${services.length} services, ${intents.length} problem guides, ${states.length} states, ${(bytes / 1024).toFixed(1)} KB`);
