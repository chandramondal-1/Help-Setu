/* HelpSetu data validation — run: node tools/validate.mjs [--online] */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);
const online = process.argv.includes('--online') || process.env.VERIFY_URLS === '1';

function load(file, key) {
  const sandbox = { window: {} };
  vm.runInNewContext(read(file), sandbox, { filename: file });
  return sandbox.window[key];
}

const D = load('data.js', 'HELPSETU_DATA');
const I18N = load('i18n.js', 'HELPSETU_I18N');
const POLICY = JSON.parse(read('data/verification.json'));

const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));
const digits = (v) => String(v ?? '').replace(/\D/g, '');
const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } };
const matchesSuffix = (host, suffix) => {
  const bare = String(suffix || '').replace(/^\./, '').toLowerCase();
  return !!bare && (host === bare || host.endsWith('.' + bare));
};
const matchesAny = (host, suffixes = []) => suffixes.some((s) => matchesSuffix(host, s));
const isOfficialHost = (host) => matchesAny(host, (POLICY.officialHosts || []).map((x) => x.suffix));
const expired = (iso) => !isIso(iso) || Date.parse(iso + 'T23:59:59Z') < Date.now();
const addDays = (iso, days) => {
  if (!isIso(iso)) return null;
  return new Date(Date.parse(iso + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
};
const numberInSnippet = (number, snippet) => {
  const d = digits(number);
  const candidate = d.length > 10 ? d.slice(-10) : d;
  return !!candidate && digits(snippet).includes(candidate);
};

const officialHosts = new Set((POLICY.officialHosts || []).map((x) => x.suffix));
if (!officialHosts.size) fail('verification policy has no officialHosts');
if (!Array.isArray(POLICY.approvals) || !POLICY.approvals.length) fail('verification policy has no emergency-number approvals');
if (!Array.isArray(POLICY.retiredNumbers)) fail('verification policy has no retiredNumbers list');

const ids = new Set();
const categoryIds = new Set(D.categories.map((c) => c.id));
const stateCodes = new Set(D.states.map((s) => s.code));
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

  const number = digits(s.number || s.dial);
  if (number) {
    if (number.length < 3 || number.length > 15) fail(`${s.id}: implausible number ${s.number || s.dial}`);
  } else if (!(s.officialUrl || s.channels?.web)) {
    fail(`${s.id}: no phone number and no official website`);
  }

  // Source quality: only official domains, with explicit per-service exceptions.
  if (!s.sourceUrl) fail(`${s.id}: missing sourceUrl`);
  const host = hostOf(s.sourceUrl);
  if (!host) fail(`${s.id}: invalid sourceUrl ${s.sourceUrl}`);
  else if (!isOfficialHost(host) && !matchesAny(host, s.sourceHostApproved)) {
    fail(`${s.id}: unapproved source domain ${host} (add it to data/verification.json or set sourceHostApproved)`);
  }

  // Freshness: every service carries an expiry date derived from its check date.
  if (!isIso(s.verifiedDate)) fail(`${s.id}: bad verifiedDate ${s.verifiedDate}`);
  if (!isIso(s.verifiedUntil)) fail(`${s.id}: missing/invalid verifiedUntil ${s.verifiedUntil}`);
  else if (expired(s.verifiedUntil)) fail(`${s.id}: verification expired on ${s.verifiedUntil}`);
  const expectedUntil = addDays(s.verifiedDate, POLICY.maxAgeDays || 365);
  if (expectedUntil && s.verifiedUntil !== expectedUntil) {
    fail(`${s.id}: verifiedUntil ${s.verifiedUntil} does not match ${POLICY.maxAgeDays}-day policy (${expectedUntil})`);
  }

  // Retired numbers must not be published as active dial options.
  const publishedNumbers = [s.number, s.dial, ...(s.altNumbers || [])].map(digits).filter(Boolean);
  for (const retired of POLICY.retiredNumbers) {
    if (publishedNumbers.includes(digits(retired.number))) {
      fail(`${s.id}: retired number ${retired.number} is still published`);
    }
  }

  // Emergency numbers are frozen to a manually maintained approval ledger.
  if (s.emergency && number) {
    const approval = POLICY.approvals.find((a) => digits(a.number) === number);
    if (!approval) {
      fail(`${s.id}: emergency number ${number} has no approval record`);
    } else {
      if (!approval.serviceIds?.includes(s.id)) {
        fail(`${s.id}: emergency number ${number} changed without updating its approval record`);
      }
      if (!String(approval.approvedBy || '').trim()) fail(`${approval.number}: approval has no reviewer`);
      if (!isIso(approval.approvedOn)) fail(`${approval.number}: bad approval date ${approval.approvedOn}`);
      if (expired(approval.expiresOn)) fail(`${approval.number}: approval expired on ${approval.expiresOn}`);
      if (!matchesAny(hostOf(approval.sourceUrl), approval.sourceSuffixes)) {
        fail(`${approval.number}: approved source domain(s) do not match ${approval.sourceUrl}`);
      }
      if (!numberInSnippet(number, approval.sourceSnippet)) {
        fail(`${approval.number}: approval snippet does not contain the number`);
      }
    }
  }
}

const coreNumbers = ['112', '108', '102', '139', '1033', '1906', '1930', '1915', '181', '1098'];
const allNumbers = new Set(D.services.map((s) => digits(s.number || s.dial)));
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
for (const file of ['data.js', 'data-i18n.js', 'i18n.js', 'i18n-extra.js', 'core.js', 'views.js', 'views2.js']) {
  const text = read(file);
  for (const retired of POLICY.retiredNumbers) {
    if (new RegExp(`\\b${digits(retired.number)}\\b`).test(text)) {
      fail(`${file}: retired number ${retired.number} is still advertised`);
    }
  }
}

async function readLimited(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  try {
    while (size < maxBytes) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
      size += value.length;
    }
  } finally {
    try { await reader.cancel(); } catch { /* already closed */ }
  }
  return Buffer.concat(chunks).toString('utf8').slice(0, maxBytes);
}

async function checkSourceUrls() {
  const cfg = POLICY.urlCheck || {};
  const settings = {
    timeoutMs: Number(cfg.timeoutMs) || 12000,
    concurrency: Number(cfg.concurrency) || 8,
    maxBytes: Number(cfg.maxBytes) || 262144,
    fail: new Set(cfg.failStatuses || [404, 410]),
    review: new Set(cfg.reviewStatuses || [401, 403, 405, 429, 500, 502, 503, 504]),
  };
  const urls = [...new Set(D.services.map((s) => s.sourceUrl).filter(Boolean))];
  const queue = [...urls];
  const counts = { ok: 0, review: 0, failed: 0 };

  async function worker() {
    while (queue.length) {
      const url = queue.shift();
      try {
        const response = await fetch(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(settings.timeoutMs),
          headers: {
            'User-Agent': 'HelpSetu-Verifier/1.0 (+https://github.com/chandramondal-1/Help-Setu)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        if (settings.fail.has(response.status)) {
          fail(`URL check HTTP ${response.status}: ${url}`);
          counts.failed++;
        } else if (settings.review.has(response.status) || response.status >= 400) {
          warn(`URL check HTTP ${response.status} needs review: ${url}`);
          counts.review++;
        } else {
          await readLimited(response, settings.maxBytes);
          counts.ok++;
        }
      } catch (e) {
        const msg = String(e?.message || e);
        if (/ENOTFOUND|EAI_AGAIN|certificate/i.test(msg)) {
          fail(`URL check unreachable (${msg}): ${url}`);
          counts.failed++;
        } else {
          warn(`URL check needs review (${msg}): ${url}`);
          counts.review++;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: settings.concurrency }, worker));
  console.log(`URL checks: ${counts.ok} reachable, ${counts.review} need review, ${counts.failed} failed`);
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

if (online) await checkSourceUrls();

console.log('HelpSetu data check');
console.log(counts);
console.log(`Bengali UI names: ${trilingualNames}/${D.services.length} curated; state records fall back to official English/Hindi names.`);
for (const w of warnings) console.warn('warning:', w);
for (const e of errors) console.error('error:', e);
console.log(errors.length ? `FAILED — ${errors.length} error(s), ${warnings.length} warning(s)` : `OK — ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
