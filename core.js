/* ============================================================
   HelpSetu — core: data, i18n, routing, search, preferences.
   Views live in views.js and register themselves on HS.views.
   ============================================================ */
(() => {
  'use strict';

  const D = window.HELPSETU_DATA;
  const I18N = window.HELPSETU_I18N;
  if (!D) {
    document.body.innerHTML = '<p style="padding:2rem;font:18px system-ui">HelpSetu data did not load. In an emergency call <a href="tel:112">112</a>.</p>';
    return;
  }

  const DEFAULT_LANGS = [
    { code: 'en', native: 'English', english: 'English', locale: 'en-IN', dir: 'ltr', curated: true },
    { code: 'hi', native: 'हिंदी', english: 'Hindi', locale: 'hi-IN', dir: 'ltr', curated: true },
    { code: 'bn', native: 'বাংলা', english: 'Bengali', locale: 'bn-IN', dir: 'ltr', curated: true },
  ];
  const LANG_LIST = Array.isArray(window.HELPSETU_LANGS) && window.HELPSETU_LANGS.length
    ? window.HELPSETU_LANGS : DEFAULT_LANGS;
  const LANGS = LANG_LIST.map((l) => l.code);
  const LANG_META = Object.fromEntries(LANG_LIST.map((l) => [l.code, {
    native: l.native,
    english: l.english || l.native,
    code: (l.code === 'en' ? 'EN' : l.code.toUpperCase()),
    locale: l.locale || `${l.code}-IN`,
    dir: l.dir || 'ltr',
    curated: !!l.curated,
    beta: !!l.beta,
  }]));
  const SERVICES = D.services;
  const INTENTS = D.intents;
  const CATEGORIES = D.categories;
  const STATES = D.states;
  const SERVICE_BY_ID = new Map(SERVICES.map((s) => [s.id, s]));
  const CAT_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));
  const STATE_BY_CODE = new Map(STATES.map((s) => [s.code, s]));
  const LS_KEY = 'helpsetu.v1';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ---------------- preferences ---------------- */
  function detectLang() {
    const tags = [...(navigator.languages || []), navigator.language || 'en'];
    for (const raw of tags) {
      const l = String(raw || '').toLowerCase();
      const base = l.split('-')[0];
      if (LANGS.includes(base)) return base;
      const byLocale = LANGS.find((code) => LANG_META[code].locale.toLowerCase() === l);
      if (byLocale) return byLocale;
    }
    return 'en';
  }

  function loadPrefs() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (_) { /* ignore */ }
    return {
      lang: LANGS.includes(saved.lang) ? saved.lang : detectLang(),
      theme: ['system', 'light', 'dark'].includes(saved.theme) ? saved.theme : 'system',
      scale: [1, 1.14, 1.28].includes(Number(saved.scale)) ? Number(saved.scale) : 1,
      state: typeof saved.state === 'string' && STATE_BY_CODE.has(saved.state) ? saved.state : '',
      favourites: Array.isArray(saved.favourites) ? saved.favourites.filter((id) => SERVICE_BY_ID.has(id)) : [],
      recent: Array.isArray(saved.recent) ? saved.recent.filter((id) => SERVICE_BY_ID.has(id)).slice(0, 8) : [],
      seen: !!saved.seen,
    };
  }

  const APP_VERSION = '1.2.1';
  const prefs = loadPrefs();
  const state = {
    ...prefs, sheet: null, installEvent: null, speaking: false, query: '',
    swReg: null, updateReady: false,
    isApk: /HelpSetuAndroid/.test(navigator.userAgent || '') || new URLSearchParams(location.search).get('app') === 'android',
  };

  function savePrefs() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        lang: state.lang, theme: state.theme, scale: state.scale,
        state: state.state, favourites: state.favourites, recent: state.recent, seen: true,
      }));
    } catch (_) { /* private mode */ }
  }

  /* ---------------- text ---------------- */
  function t(key, vars) {
    let v;
    for (const pack of [I18N[state.lang], I18N.en]) {
      v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), pack);
      if (v !== undefined) break;
    }
    if (v === undefined) return key;
    if (typeof v !== 'string') return v;
    return v.replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] !== undefined ? vars[k] : ''));
  }

  const L = (val) => {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    return val[state.lang] || val.en || '';
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SUPPORT_PHONE = '918371998257';
  const SUPPORT_DISPLAY = '+91 83719 98257';
  const telHref = (num) => 'tel:' + String(num || '').replace(/[^\d+]/g, '');
  const waHref = (num) => 'https://wa.me/' + String(num || '').replace(/\D/g, '');
  const supportHref = (message = '') => `https://wa.me/${SUPPORT_PHONE}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  const digits = (num) => String(num || '').replace(/\D/g, '');

  function fmtDate(iso) {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat(LANG_META[state.lang].locale, { day: 'numeric', month: 'short', year: 'numeric' })
        .format(new Date(iso + 'T00:00:00'));
    } catch (_) { return iso; }
  }

  const categoryName = (id) => {
    const c = CAT_BY_ID.get(id);
    return c ? L(c.name) : id;
  };
  const serviceName = (s) => L(s.name) || s.name?.en || s.id;
  const servicePurpose = (s) => L(s.purpose);
  const scopeText = (s) => (s.stateName ? L(s.stateName) : t('common.allIndia'));

  /* ---------------- icons ---------------- */
  const ICON_PATHS = {
    bridge: '<path d="M3 18c0-5.2 4-9.5 9-9.5s9 4.3 9 9.5"/><path d="M12 8.5V4"/><path d="M7 4h10"/><circle cx="7.6" cy="18" r="1.7"/><circle cx="16.4" cy="18" r="1.7"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
    bookmark: '<path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.5a1 1 0 0 1 1-1z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 4 5.8 4 9s-1.4 6.3-4 9c-2.6-2.7-4-5.8-4-9s1.4-6.3 4-9z"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.5 3.1 8.3 7.5 9.5 4.4-1.2 7.5-5 7.5-9.5V6L12 3z"/><path d="m9 12 2 2 4-4"/>',
    train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14"/><path d="m9 17-2 4M15 17l2 4"/><path d="M9 14h.01M15 14h.01"/>',
    road: '<path d="M4 21 8 3M20 21 16 3"/><path d="M12 5v3M12 12v3M12 19v2"/>',
    flame: '<path d="M12 22c4.2 0 7-2.8 7-6.6 0-3-2-5.6-4.4-7.6C13.1 6.4 12 4 12 2c0 4-3 6-4.5 8.5A7.4 7.4 0 0 0 5 15.4C5 19.2 7.8 22 12 22z"/><path d="M12 22c2.1 0 3.6-1.5 3.6-3.5 0-2-1.5-3.2-2.6-4.5-.8 1.5-4.5 2-4.5 4.5 0 2 1.5 3.5 3.5 3.5z"/>',
    bag: '<path d="M6 7h12l1 14H5L6 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>',
    heart: '<path d="M20.8 5.6a5.3 5.3 0 0 0-7.5 0L12 6.9l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5L12 21l8.8-7.9a5.3 5.3 0 0 0 0-7.5z"/>',
    gov: '<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/><path d="M9 11h.01M15 11h.01"/>',
    bank: '<path d="M3 10 12 4l9 6"/><path d="M5 10v9M9 10v9M15 10v9M19 10v9"/><path d="M3 21h18"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
    cross: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    plane: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/>',
    sos: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    ambulance: '<path d="M3 17h18"/><path d="M5 17V7h10v10"/><path d="M15 10h4l2 3v4h-6"/><circle cx="7.5" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M10 10v4M8 12h4"/>',
    child: '<circle cx="12" cy="7.5" r="3.2"/><path d="M6 21v-2.5a6 6 0 0 1 12 0V21"/><path d="M9.5 15v2M14.5 15v2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    car: '<path d="M5 17h14l-1-6-2-4H8L6 11l-1 6z"/><path d="M3 17h18"/><circle cx="7" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>',
    accident: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    seat: '<path d="M7 3v10a2 2 0 0 0 2 2h6"/><path d="M17 21v-6a2 2 0 0 0-2-2H9"/><path d="M5 21h4M15 3h4"/>',
    ticket: '<path d="M3 9V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a3 3 0 0 0 0 6v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a3 3 0 0 0 0-6z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
    scale: '<path d="M12 3v18M8 21h8"/><path d="M5 7h14"/><path d="M5 7 2 14h6L5 7zM19 7l-3 7h6l-3-7z"/>',
    mind: '<path d="M9.5 3A4.5 4.5 0 0 0 5 7.5c0 .6.1 1.2.4 1.7A4 4 0 0 0 3 13a4 4 0 0 0 2 3.5A4 4 0 0 0 9 21h1V3H9.5z"/><path d="M14.5 3A4.5 4.5 0 0 1 19 7.5c0 .6-.1 1.2-.4 1.7A4 4 0 0 1 21 13a4 4 0 0 1-2 3.5A4 4 0 0 1 15 21h-1V3h.5z"/>',
    elder: '<circle cx="12" cy="6" r="3"/><path d="M12 9v6"/><path d="m12 15-3 7M12 15l3 7"/><path d="M8 12h8"/>',
    passport: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 17h6"/>',
    play: '<path d="m8 5 11 7-11 7V5z"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    wifiOff: '<path d="M3 3l18 18"/><path d="M8.5 8.5A10 10 0 0 1 21 9"/><path d="M5 12.5a10 10 0 0 1 2.5-1.6"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M12 20h.01"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4M8 21h8"/>',
    star: '<path d="m12 2.5 2.9 6 6.6.9-4.8 4.7 1.2 6.6-5.9-3.1-5.9 3.1 1.2-6.6L2.5 9.4l6.6-.9 2.9-6z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M5 6l1 15h12l1-15"/><path d="M10 11v6M14 11v6"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    install: '<rect x="4" y="2" width="16" height="20" rx="3"/><path d="M12 6v7"/><path d="m9 10 3 3 3-3"/><path d="M9 18h6"/>',
    whatsapp: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.5L3 21l2-5.4A8.5 8.5 0 1 1 21 11.5z"/><path d="M8.5 8.5c0 3.5 3 6.5 6.5 6.5l1.5-1.5-2-1.5-1 1c-1-.5-2-1.5-2.5-2.5l1-1L10 6.5 8.5 8z"/>',
    sync: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/>',
    source: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
    type: '<path d="M4 7V5h10v2M9 5v14M6 19h6"/><path d="M14 13v-1h7v1M17.5 12v7M15 19h5"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="9" r="1.3"/><circle cx="15.5" cy="8.5" r="1.3"/><circle cx="17" cy="14" r="1.3"/><circle cx="10" cy="16.5" r="1.3"/>',
    translate: '<path d="M4 5h8M8 3v2c0 5-3 8-5 9"/><path d="M5 9c1 2 4 4 7 4"/><path d="m13 21 4-10 4 10"/><path d="M14.5 17h5"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"/>',
    offline: '<path d="M3 3l18 18"/><path d="M8.5 8.5A10 10 0 0 1 21 9"/><path d="M5 12.5a10 10 0 0 1 2.5-1.6"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M12 20h.01"/>',
  };

  function icon(name, cls = '') {
    const p = ICON_PATHS[name] || ICON_PATHS.info;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${p}</svg>`;
  }

  /* ---------------- store actions ---------------- */
  const isFav = (id) => state.favourites.includes(id);
  function toggleFav(id) {
    if (!SERVICE_BY_ID.has(id)) return;
    if (isFav(id)) {
      state.favourites = state.favourites.filter((x) => x !== id);
      toast(t('toast.removed'));
    } else {
      state.favourites = [id, ...state.favourites];
      toast(t('toast.saved'));
    }
    savePrefs();
  }
  function addRecent(id) {
    if (!SERVICE_BY_ID.has(id)) return;
    state.recent = [id, ...state.recent.filter((x) => x !== id)].slice(0, 8);
    savePrefs();
  }
  function removeRecent() {
    state.recent = [];
    savePrefs();
  }

  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------------- theme / language ---------------- */
  function resolvedTheme() {
    if (state.theme === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return state.theme;
  }
  function applyTheme() {
    const theme = resolvedTheme();
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0A0F1E' : '#F8FAFC');
  }
  function applyScale() {
    document.documentElement.style.setProperty('--fs', state.scale);
  }
  function setLang(lang) {
    if (!LANGS.includes(lang)) return;
    state.lang = lang;
    document.documentElement.lang = lang;
    savePrefs();
    render();
  }
  function setTheme(theme) {
    if (!['system', 'light', 'dark'].includes(theme)) return;
    state.theme = theme;
    savePrefs();
    applyTheme();
    render();
  }
  function toggleTheme() {
    setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
  }
  function setScale(scale) {
    state.scale = Number(scale);
    savePrefs();
    applyScale();
    render();
    toast(t('settings.text') + ': ' + t(scale >= 1.28 ? 'settings.xlarge' : scale > 1 ? 'settings.large' : 'settings.normal'));
  }
  function setStateCode(code) {
    state.state = code && STATE_BY_CODE.has(code) ? code : '';
    savePrefs();
    render();
    toast(t('toast.state'));
  }

  /* ---------------- sheets ---------------- */
  function closeSheet() {
    const root = $('#sheet-root');
    if (root) root.innerHTML = '';
    state.sheet = null;
    document.body.style.overflow = '';
  }
  function openSheet({ title, html, mount, className = '' }) {
    const root = $('#sheet-root');
    if (!root) return;
    root.innerHTML = `
      <div class="sheet-backdrop" data-action="close-sheet">
        <div class="sheet ${className}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="sheet-grab" aria-hidden="true"></div>
          <div class="sheet-head">
            <h2 class="sheet-title">${esc(title)}</h2>
            <button class="sheet-close" type="button" data-action="close-sheet" aria-label="${esc(t('a11y.close'))}">${icon('close')}</button>
          </div>
          <div class="sheet-body">${html}</div>
        </div>
      </div>`;
    document.body.style.overflow = 'hidden';
    const panel = $('.sheet', root);
    panel?.addEventListener('click', (e) => {
      e.stopPropagation();
      const actionEl = e.target.closest('[data-action]');
      if (actionEl && panel.contains(actionEl)) handleAction(actionEl.dataset.action, actionEl, e);
    });
    const first = panel?.querySelector('button, a, input');
    if (first) setTimeout(() => first.focus(), 40);
    if (mount) mount(panel);
    state.sheet = title;
  }
  function openLanguage() {
    const html = `<p class="lang-help">${esc(t('lang.choose'))}</p>
      <div class="lang-list lang-list-all">${LANGS.map((lang) => {
        const meta = LANG_META[lang];
        return `<button type="button" class="lang-option${lang === state.lang ? ' active' : ''}" data-action="set-lang" data-lang="${lang}" dir="${meta.dir}">
        <span><span class="lang-native" lang="${lang}">${esc(meta.native)}</span><br><span class="lang-english">${esc(meta.english)}${meta.beta ? ` · ${esc(t('lang.auto'))}` : ''}</span></span>
        ${lang === state.lang ? icon('check', 'check') : ''}
      </button>`;
      }).join('')}</div>
      <p class="sheet-note">${esc(t('lang.note'))}</p>
      <a class="lang-report" href="${supportHref(t('support.reportMessage'))}" target="_blank" rel="noopener">${icon('whatsapp')} ${esc(t('support.report'))}</a>`;
    openSheet({ title: t('settings.language'), html, className: 'lang-sheet' });
  }
  function openTheme() {
    const opts = [
      ['system', t('settings.system')],
      ['light', t('settings.light')],
      ['dark', t('settings.dark')],
    ];
    const html = `<div class="lang-list">${opts.map(([key, label]) => `
      <button type="button" class="lang-option${state.theme === key ? ' active' : ''}" data-action="set-theme" data-theme="${key}">
        ${icon(key === 'system' ? 'settings' : key === 'dark' ? 'moon' : 'sun')}
        <span class="lang-native">${esc(label)}</span>
        ${state.theme === key ? icon('check', 'check') : ''}
      </button>`).join('')}</div>`;
    openSheet({ title: t('settings.theme'), html });
  }

  /* ---------------- normalise + search ---------------- */
  const DEV = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
    'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l', 'क़': 'q', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh',
    'फ़': 'f', 'ऱ': 'r', 'ऩ': 'n', 'ऱ': 'r', 'ऴ': 'l',
    'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'ou',
    'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'ou',
    'ं': 'n', 'ँ': 'n', 'ः': 'h', '्': '', '़': '', 'ॐ': 'om',
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  };
  const BN = {
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng', 'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n', 'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'ph', 'ব': 'b', 'ভ': 'bh', 'ম': 'm', 'য': 'y', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh',
    'স': 's', 'হ': 'h', 'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't', 'ঙ': 'ng', 'ৰ': 'r', 'ৱ': 'w',
    'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
    'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
    'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n', '্': '', '়': '',
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  const TRANSLIT = { ...DEV, ...BN };

  function translit(str) {
    let out = '';
    for (const ch of str) out += TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch;
    return out;
  }
  function norm(value) {
    return translit(String(value || '').toLowerCase())
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[’'`´]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  const STOP = new Set(('a an the is are am be been being my me mine i we you your it this that these those of to in on at for with from by and or if not no yes do does did can could will would should have has had need want want help please some any very just got get got about near new old use using used what where when who how why'.split(' ')));
  const STOP_LOCAL = new Set(('hai hain ha ka ki ke ko se par aur ya kya mera meri mujhe chahiye karna karo kare kaise kahan kyun nahi ho gaya gayi raha rahi rahe kar de dena deni diya liye sahab shri'.split(' ')));
  const STOP_BN = new Set(('ami amar amay apni apnar ki kemon kothay kivabe kore korte hobe hoy hoye geche gache theke jonno ekta ache nai na ar o ebong kintu sahajjo sahayata dorkar chai bolun bolo koro koro din dao'.split(' ')));

  const SYN = {
    gas: ['lpg'], lpg: ['gas'], gasleak: ['gas', 'leak'], gyas: ['gas'], gaser: ['gas'],
    leak: ['leak'], lik: ['leak'], leakie: ['leak'],
    cylinder: ['lpg', 'gas'], silinder: ['lpg', 'gas'], chulha: ['gas', 'lpg'], stove: ['gas'],
    train: ['railway', 'rail'], rail: ['train'], rel: ['train'], tren: ['train'], railgadi: ['train'], gaadi: ['train', 'car'],
    toilet: ['washroom'], toylet: ['toilet'], washroom: ['toilet'], shochaloy: ['toilet'], shouchaly: ['toilet'], bathroom: ['toilet'],
    dirty: ['dirty', 'clean'], nongra: ['dirty'], ganda: ['dirty'], maila: ['dirty'], unhygienic: ['dirty'],
    fraud: ['scam', 'cyber', 'cheating'], thagi: ['fraud'], thogi: ['fraud'], dhokha: ['fraud'], protarona: ['fraud'], protaronaa: ['fraud'], cheating: ['fraud'], scam: ['fraud'], frad: ['fraud'], fruad: ['fraud'],
    money: ['paisa', 'cash'], taka: ['money'], paisa: ['money'], poisa: ['money'], cash: ['money'],
    cyber: ['online'], online: ['cyber'],
    police: ['police'], pulis: ['police'], pulish: ['police'], thana: ['police'],
    ambulance: ['ambulance'], embulance: ['ambulance'], ambulence: ['ambulance'], oyambulens: ['ambulance'],
    fire: ['aag'], aag: ['fire'], agun: ['fire'], ogni: ['fire'], burning: ['fire'], smoke: ['fire'],
    women: ['woman'], woman: ['women'], mahila: ['women'], nari: ['women'], mohila: ['women'],
    child: ['children'], children: ['child'], bachcha: ['child'], baccha: ['child'], bacha: ['child'], shishu: ['child'], khoka: ['child'],
    lost: ['missing'], missing: ['lost'], khoya: ['lost'], hariye: ['lost'], gum: ['lost'],
    highway: ['road'], road: ['highway'], sadak: ['highway'], sarak: ['highway'], rasta: ['road'], rod: ['road'], rajmar: ['highway'], 'raj marg': ['highway'],
    breakdown: ['broken'], broken: ['breakdown'], kharab: ['broken', 'breakdown'], nosto: ['broken'], band: ['broken'],
    seat: ['berth'], berth: ['seat'], ason: ['seat'], sit: ['seat'],
    ticket: ['booking'], booking: ['ticket'], tikit: ['ticket'], tikat: ['ticket'],
    late: ['delay'], delay: ['late'], deri: ['late'], der: ['late'],
    refund: ['refund'], ferot: ['refund'], wapas: ['refund'],
    complaint: ['complaint', 'grievance'], shikayat: ['complaint'], abhijog: ['complaint'], obhiyog: ['complaint'], grievance: ['complaint'],
    hospital: ['hospital'], haspatal: ['hospital'],
    water: ['water'], pani: ['water'], jol: ['water'], jal: ['water'],
    electricity: ['power'], power: ['electricity'], bijli: ['electricity'], bidyut: ['electricity'], karant: ['electricity'], current: ['electricity'],
    bank: ['bank'], passport: ['passport'], pasport: ['passport'],
    government: ['govt'], govt: ['government'], sarkari: ['government'],
    mental: ['mind', 'counselling'], depressed: ['depression', 'mental'], depression: ['mental'], suicide: ['mental'], tanab: ['mental'], mon: ['mind'],
    accident: ['crash'], crash: ['accident'], durghotona: ['accident'], durghatana: ['accident'], hadsa: ['accident'],
    poison: ['poison'], vish: ['poison'], zeher: ['poison'], bis: ['poison'],
    snake: ['snakebite'], snakebite: ['snake', 'poison'], saanp: ['snake'], sap: ['snake'],
    passportseva: ['passport'],
    electricitybill: ['electricity', 'bill'], bill: ['bill'],
    pension: ['pension'], penson: ['pension'],
    harassment: ['harass'], haras: ['harassment'], harras: ['harassment'], nirapotta: ['harassment', 'police'],
    stray: ['animal'], dog: ['animal'], animal: ['animal'],
  };

  function queryTokens(q) {
    const words = norm(q).split(' ').filter(Boolean);
    const out = new Set();
    for (const w of words) {
      if (STOP.has(w) || STOP_LOCAL.has(w) || STOP_BN.has(w)) continue;
      out.add(w);
      for (const s of SYN[w] || []) out.add(s);
      // common joined words ("gasleak", "upifraud")
      for (const [k, vals] of Object.entries(SYN)) {
        if (w.length > k.length + 2 && w.startsWith(k)) { out.add(k); vals.forEach((v) => out.add(v)); }
      }
    }
    if (!out.size) words.forEach((w) => out.add(w));
    return [...out].slice(0, 14);
  }

  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      if (Math.min(...cur) > 1) return 2;
      prev = cur;
    }
    return prev[n];
  }

  function setOf(str) {
    return new Set(norm(str).split(' ').filter(Boolean));
  }

  function prepare() {
    for (const s of SERVICES) {
      const nameVals = Object.values(s.name || {});
      const names = [...nameVals, ...Object.values(s.stateName || {}), ...Object.values(s.districtName || {})].filter(Boolean).join(' ');
      const keys = [s.number, s.dial, ...(s.altNumbers || []), ...(s.keywords || []), categoryName(s.category)].filter(Boolean).join(' ');
      const body = [...Object.values(s.purpose || {}), ...Object.values(s.when || {}), s.operator, s.sourceName].filter(Boolean).join(' ');
      s._name = norm(names);
      s._keys = norm(keys);
      s._body = norm(body);
      s._nameTokens = setOf(names + ' ' + keys);
      s._keyTokens = setOf(keys);
      s._allTokens = setOf(names + ' ' + keys + ' ' + body);
      s._digits = digits(s.number || s.dial);
      s._alts = (s.altNumbers || []).map(digits);
    }
    for (const it of INTENTS) {
      const text = [L(it.title), ...Object.values(it.title || {}),
        ...Object.values(it.phrases || {}).flat()].filter(Boolean).join(' ');
      it._text = norm(text);
      it._tokens = setOf(text);
    }
  }
  prepare();

  function stateCodesInQuery(q) {
    const nq = norm(q);
    const found = new Set();
    for (const st of STATES) {
      for (const [key, name] of Object.entries(st)) {
        if (key === 'code') continue;
        const n = norm(name);
        if (n && (nq.includes(n) || n.split(' ').every((w) => w.length > 3 && nq.includes(w)))) found.add(st.code);
      }
    }
    return found;
  }

  function search(q) {
    const nq = norm(q);
    const qTokens = queryTokens(q);
    const rawWords = norm(q).split(' ').filter((w) => w && !STOP.has(w) && !STOP_LOCAL.has(w) && !STOP_BN.has(w));
    const rawTokens = [...new Set(rawWords)];
    if (!nq) return { intents: [], services: [] };
    const queryStates = stateCodesInQuery(q);
    const numQuery = /^[+\d][\d\s-]{2,}$/.test(q.trim()) ? digits(q) : '';

    const scoredServices = [];
    for (const s of SERVICES) {
      if (s.scope === 'state' && s.state !== state.state && !queryStates.has(s.state)) continue;
      let score = 0;
      let matched = 0;

      if (numQuery && (s._digits === numQuery || s._alts.includes(numQuery))) score += 140;
      if (nq.length >= 3 && s._name.includes(nq)) score += 80;
      if (nq.length >= 3 && s._keys.includes(nq)) score += 55;
      if (nq.length >= 3 && s._body.includes(nq)) score += 18;

      for (const tok of qTokens) {
        if (tok.length < 2) continue;
        if (s._nameTokens.has(tok)) { score += 30; matched++; continue; }
        if (s._keyTokens.has(tok)) { score += 25; matched++; continue; }
        if (s._body.split(' ').includes(tok)) { score += 9; matched++; continue; }
        if (tok.length >= 5) {
          let fuzzy = false;
          const pool = tok.length >= 6 ? s._allTokens : s._nameTokens;
          for (const cand of pool) {
            if (Math.abs(cand.length - tok.length) <= 1 && editDistance(cand, tok) <= 1) { fuzzy = true; break; }
          }
          if (fuzzy) { score += 6; matched++; }
        }
      }

      if (qTokens.length > 1 && matched === 0) score = 0;
      if (qTokens.length > 1 && matched === qTokens.length) score += 14;
      if (numQuery && score > 0) score += 30;
      if (score > 0 && s.emergency) score += 2;
      if (score > 0 && s.featured) score += 2;
      if (score > 0) scoredServices.push({ s, score });
    }

    const scoredIntents = [];
    for (const it of INTENTS) {
      let score = 0;
      if (it._text.includes(nq) && nq.length >= 3) score += 120;
      let matched = 0;
      for (const tok of qTokens) {
        if (it._tokens.has(tok)) matched++;
        else if (tok.length >= 6) {
          for (const cand of it._tokens) {
            if (Math.abs(cand.length - tok.length) <= 1 && editDistance(cand, tok) <= 1) { matched++; break; }
          }
        }
      }
      if (qTokens.length) score += (matched / qTokens.length) * 68;
      if (matched === 0) score = 0;

      // Words the person actually typed should not be diluted by synonym expansion.
      let rawMatched = 0;
      for (const tok of rawTokens) {
        if (it._tokens.has(tok)) { rawMatched++; continue; }
        if (tok.length >= 6) {
          for (const cand of it._tokens) {
            if (Math.abs(cand.length - tok.length) <= 1 && editDistance(cand, tok) <= 1) { rawMatched++; break; }
          }
        }
      }
      const rawScore = rawTokens.length ? (rawMatched / rawTokens.length) * 74 : 0;
      score = Math.max(score, rawScore);
      if (it._text.includes(nq) && nq.length >= 3) score += 12;
      if (score >= 55) scoredIntents.push({ it, score });
    }

    scoredServices.sort((a, b) => b.score - a.score || (b.s.featured - a.s.featured) || serviceName(a.s).localeCompare(serviceName(b.s)));
    scoredIntents.sort((a, b) => b.score - a.score);
    return {
      intents: scoredIntents.slice(0, 3).map((x) => x.it),
      services: scoredServices.slice(0, 60).map((x) => x.s),
    };
  }

  function servicesForCategory(catId) {
    const national = SERVICES.filter((s) => s.category === catId && s.scope === 'national');
    const local = state.state ? SERVICES.filter((s) => s.category === catId && s.scope === 'state' && s.state === state.state) : [];
    return { national, local };
  }

  function countStateServices(code) {
    return SERVICES.filter((s) => s.scope === 'state' && s.state === code).length;
  }

  /* ---------------- routing ---------------- */
  function getRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [pathPart, queryPart] = raw.split('?');
    const seg = pathPart.split('/').filter(Boolean);
    const params = new URLSearchParams(queryPart || '');
    let name = 'home';
    let id = null;
    if (seg[0] === 'search') name = 'search';
    else if (seg[0] === 'category') { name = 'category'; id = seg[1]; }
    else if (seg[0] === 'service') { name = 'service'; id = seg[1]; }
    else if (['saved', 'settings', 'state', 'about', 'privacy', 'emergency'].includes(seg[0])) name = seg[0];
    return { name, id, params, hash: raw };
  }

  function tabbar(route) {
    const items = [
      ['home', '#/', 'home', t('nav.home')],
      ['search', '#/search', 'search', t('nav.search')],
      ['saved', '#/saved', 'bookmark', t('nav.saved')],
      ['settings', '#/settings', 'settings', t('nav.settings')],
    ];
    const active = route.name === 'home' || route.name === 'emergency' ? 'home'
      : route.name === 'saved' ? 'saved'
        : ['settings', 'state', 'about', 'privacy'].includes(route.name) ? 'settings'
          : 'search';
    return `<div class="tabbar-inner">${items.map(([key, href, ic, label]) => `
      <a class="tab${active === key ? ' active' : ''}" href="${href}"${active === key ? ' aria-current="page"' : ''}>
        ${icon(ic)}
        <span class="tab-label">${esc(label)}</span>
        ${key === 'saved' && state.favourites.length ? `<span class="tab-badge">${state.favourites.length}</span>` : ''}
      </a>`).join('')}</div>`;
  }

  function header() {
    return `<div class="topbar-inner">
      <a class="brand" href="#/">
        <span class="brand-mark">${icon('bridge')}</span>
        <span class="brand-text"><span class="brand-name">HelpSetu</span><span class="brand-tag">${esc(t('brandTag'))}</span></span>
        <span class="sr-only">— ${esc(t('nav.home'))}</span>
      </a>
      <div class="top-actions">
        <button class="icon-btn lang-btn" type="button" data-action="language" aria-label="${esc(t('a11y.language'))} (${LANG_META[state.lang].code})">
          ${icon('globe')}<span class="lang-code">${LANG_META[state.lang].code}</span>
        </button>
        <button class="icon-btn" type="button" data-action="toggle-theme" aria-label="${esc(t('a11y.theme'))}">
          ${icon(resolvedTheme() === 'dark' ? 'sun' : 'moon')}
        </button>
      </div>
    </div>`;
  }

  let renderCount = 0;
  function render() {
    if (!window.HS.views) return;
    const route = getRoute();
    document.documentElement.lang = state.lang;
    document.documentElement.dir = LANG_META[state.lang]?.dir || 'ltr';
    applyTheme();
    applyScale();
    $('#topbar').innerHTML = header();
    $('#tabbar').innerHTML = tabbar(route);
    renderUpdateBar();
    const skip = $('.skip-link');
    if (skip) skip.textContent = t('skip');
    const offlineLabel = $('#offline-bar [data-i18n]');
    if (offlineLabel) offlineLabel.textContent = t('offlineText');

    const view = HS.views[route.name] || HS.views.home;
    let out;
    try {
      out = view(route);
    } catch (err) {
      console.error(err);
      out = { html: `<div class="empty"><h2>Something went wrong</h2><p>Please reload HelpSetu. In an emergency call <a href="tel:112">112</a>.</p></div>` };
    }
    const main = $('#main');
    const oldFocus = document.activeElement;
    main.innerHTML = typeof out === 'string' ? out : out.html;
    if (out && typeof out === 'object' && out.mount) {
      try { out.mount(main, route); } catch (err) { console.error(err); }
    }
    // keep search input focus while typing
    if (renderCount && route.name !== 'search') {
      main.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    if (renderCount === 0) window.scrollTo(0, 0);
    renderCount++;
    if (oldFocus && oldFocus.blur) oldFocus.blur();
  }

  function navigate(path, replace = false) {
    if (replace) history.replaceState(null, '', path);
    else location.hash = path.replace(/^#?/, '');
    if (replace) render();
  }

  /* ---------------- actions ---------------- */
  function copyText(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => toast(t('toast.copied'))).catch(() => fallbackCopy(text));
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast(t('toast.copied')); } catch (_) { /* ignore */ }
    ta.remove();
  }
  function shareService(id) {
    const s = SERVICE_BY_ID.get(id);
    if (!s) return;
    const url = `${location.origin}${location.pathname}#/service/${s.id}`;
    const text = t('service.shareText', { name: serviceName(s), number: s.number || '' });
    if (navigator.share) {
      navigator.share({ title: 'HelpSetu — ' + serviceName(s), text, url }).catch(() => {});
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(`${text} ${url}`).then(() => toast(t('toast.shareCopied'))).catch(() => {});
    } else toast(t('toast.noShare'));
  }
  function speakService(id) {
    const s = SERVICE_BY_ID.get(id);
    if (!s || !('speechSynthesis' in window)) { toast(t('toast.notSupported')); return; }
    window.speechSynthesis.cancel();
    const parts = [serviceName(s)];
    if (s.number) parts.push(s.number);
    if (servicePurpose(s)) parts.push(servicePurpose(s));
    if (s.when && L(s.when)) parts.push(L(s.when));
    if (s.steps && (s.steps[state.lang] || s.steps.en)) parts.push(...(s.steps[state.lang] || s.steps.en));
    const u = new SpeechSynthesisUtterance(parts.join('. '));
    u.lang = LANG_META[state.lang].locale;
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
    toast(t('toast.speaking'));
  }
  function speechSupported() {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }
  function startVoice(onResult) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast(t('search.voiceUnsupported')); return; }
    const rec = new SR();
    rec.lang = LANG_META[state.lang].locale;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript || '';
      if (text) onResult(text);
      else toast(t('search.noVoice'));
    };
    rec.onerror = () => toast(t('search.voiceUnsupported'));
    try { rec.start(); } catch (_) { /* ignore */ }
  }

  function handleAction(action, el, ev) {
    const id = el.dataset.id;
    switch (action) {
      case 'language': openLanguage(); break;
      case 'theme': openTheme(); break;
      case 'toggle-theme': toggleTheme(); break;
      case 'close-sheet': closeSheet(); break;
      case 'set-lang': setLang(el.dataset.lang); closeSheet(); break;
      case 'set-theme': setTheme(el.dataset.theme); closeSheet(); break;
      case 'set-scale': setScale(el.dataset.scale); break;
      case 'favorite': ev.preventDefault(); toggleFav(id); render(); break;
      case 'copy': ev.preventDefault(); copyText(el.dataset.number || ''); break;
      case 'share': ev.preventDefault(); shareService(id); break;
      case 'speak': ev.preventDefault(); speakService(id); break;
      case 'install': installApp(); break;
      case 'check-update': checkForUpdates(); break;
      case 'reload-app': location.reload(); break;
      case 'clear-recent': removeRecent(); render(); toast(t('toast.recentCleared')); break;
      case 'clear-saved':
        if (!state.favourites.length) break;
        if (window.confirm(t('saved.clear') + '?')) {
          state.favourites = [];
          savePrefs();
          render();
          toast(t('saved.cleared'));
        }
        break;
      case 'clear-data':
        if (window.confirm(t('privacy.clearHint'))) {
          try { localStorage.removeItem(LS_KEY); } catch (_) { /* ignore */ }
          state.favourites = []; state.recent = [];
          savePrefs(); render(); toast(t('privacy.cleared'));
        }
        break;
      default: break;
    }
  }

  function installApp() {
    if (state.installEvent) {
      state.installEvent.prompt();
      state.installEvent.userChoice?.finally(() => { state.installEvent = null; render(); });
    } else {
      toast(t('toast.installPrompt'));
    }
  }

  /* ---------------- updates ---------------- */
  function renderUpdateBar() {
    const root = $('#update-root');
    if (!root) return;
    if (!state.updateReady) { root.innerHTML = ''; return; }
    root.innerHTML = `<div class="update-bar" role="status">
      <span>${esc(t('update.available'))}</span>
      <button type="button" data-action="reload-app">${esc(t('update.now'))}</button>
    </div>`;
  }

  function checkForUpdates() {
    if (state.isApk) {
      if (window.HelpSetuNative?.checkUpdate) {
        toast(t('update.apkTitle'));
        window.HelpSetuNative.checkUpdate();
        return;
      }
      openSheet({
        title: t('update.apkTitle'),
        html: `<p class="sheet-note" style="margin-top:0">${esc(t('update.apkBody'))}</p>
          <p class="support-phone">${esc(SUPPORT_DISPLAY)}</p>
          <a class="btn btn-primary btn-block" href="${supportHref(t('support.updateMessage'))}" target="_blank" rel="noopener">${icon('whatsapp')} ${esc(t('support.whatsapp'))}</a>`,
      });
      return;
    }
    if (!('serviceWorker' in navigator)) { toast(t('update.unsupported')); return; }
    const reg = state.swReg;
    if (!reg) { toast(t('update.offline')); return; }
    reg.update().then(() => {
      if (reg.waiting || state.updateReady) {
        state.updateReady = true;
        renderUpdateBar();
        toast(t('update.available'));
      } else {
        toast(t('update.latest', { version: APP_VERSION }));
      }
    }).catch(() => toast(t('update.offline')));
  }

  /* ---------------- offline ---------------- */
  function onlineState(initial) {
    const bar = $('#offline-bar');
    if (!bar) return;
    bar.hidden = navigator.onLine;
    if (!initial) toast(navigator.onLine ? t('toast.online') : t('toast.offline'));
  }

  /* ---------------- init ---------------- */
  let inited = false;
  function init() {
    if (inited) return;
    inited = true;
    document.documentElement.lang = state.lang;
    applyTheme();
    applyScale();
    window.addEventListener('hashchange', render);
    document.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (actionEl) handleAction(actionEl.dataset.action, actionEl, e);
      const callEl = e.target.closest('a[data-recent]');
      if (callEl) addRecent(callEl.dataset.recent);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.sheet) closeSheet();
    });
    window.addEventListener('online', () => onlineState(false));
    window.addEventListener('offline', () => onlineState(false));
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener?.('change', () => { if (state.theme === 'system') applyTheme(); });
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.installEvent = e;
      render();
    });
    window.addEventListener('appinstalled', () => { state.installEvent = null; toast(t('install.title')); });

    onlineState(true);
    render();

    // Brief first-load splash. The app is already rendered underneath, so
    // there is no extra waiting once the 2 seconds are over.
    const splash = $('#splash');
    if (splash) {
      const splashTag = $('#splash-tag');
      if (splashTag) splashTag.textContent = t('brandTag');
      setTimeout(() => {
        splash.classList.add('hide');
        setTimeout(() => splash.remove(), 400);
      }, 2000);
    }

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      const wasControlled = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').then((reg) => {
        state.swReg = reg;
        if (reg.waiting && wasControlled) {
          state.updateReady = true;
          renderUpdateBar();
        }
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && wasControlled) {
              state.updateReady = true;
              renderUpdateBar();
            }
          });
        });
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (wasControlled) {
            state.updateReady = true;
            renderUpdateBar();
          }
        });
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      }).catch(() => {});
    }
  }

  /* ---------------- expose ---------------- */
  window.HS = {
    D, I18N, LANGS, LANG_META, LANG_LIST, SERVICES, INTENTS, CATEGORIES, STATES,
    SERVICE_BY_ID, CAT_BY_ID, STATE_BY_CODE, APP_VERSION, SUPPORT_PHONE, SUPPORT_DISPLAY,
    state, prefs, t, L, esc, telHref, waHref, supportHref, fmtDate, categoryName, serviceName, servicePurpose,
    scopeText, icon, isFav, addRecent, toast, setLang, setTheme, setStateCode, setScale,
    openSheet, closeSheet, openLanguage, openTheme, navigate, search, servicesForCategory,
    countStateServices, speechSupported, startVoice, installApp, checkForUpdates, savePrefs, render,
    getRoute, copyText, shareService,
  };

  // Deferred scripts run while readyState is "interactive" (before views.js),
  // so always let the remaining deferred scripts finish first.
  window.addEventListener('DOMContentLoaded', init);
  if (document.readyState === 'complete') init();
  else if (document.readyState === 'interactive') setTimeout(init, 0);
})();
