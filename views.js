/* HelpSetu views — home, search, categories, service details. */
(() => {
  'use strict';
  const {
    D, state, t, L, esc, icon, telHref, waHref, fmtDate, categoryName, serviceName, servicePurpose,
    scopeText, isFav, SERVICE_BY_ID, INTENT_BY_ID, CAT_BY_ID, CATEGORIES, SERVICES, INTENTS, STATES, STATE_BY_CODE,
    search, servicesForCategory, countStateServices,
  } = HS;

  const views = {};
  const POPULAR = ['national-railmadad-139', 'national-nhai-highway-1033', 'in-lpg-emergency-1906', 'national-cybercrime-1930', 'consumer-1915', 'national-womenhelpline-181', 'national-childhelpline-1098', 'national-ambulance-108'];
  // The problems people search for most. One tap opens a guided answer with
  // clear steps and a one-tap call button — no typing or reading required.
  const QUICK_PROBLEMS = [
    'need-ambulance', 'fire', 'woman-in-danger', 'gas-leak',
    'online-financial-fraud', 'highway-breakdown', 'train-late-status', 'poison-snakebite',
  ];

  /* ---------------- shared components ---------------- */
  const catOf = (s) => CAT_BY_ID.get(s.category);
  const catIcon = (s) => (catOf(s)?.icon || 'info');
  const catColor = (s) => (catOf(s)?.color || 'indigo');
  const firstServiceOf = (it) => (it.serviceIds || []).map((id) => SERVICE_BY_ID.get(id)).find(Boolean);

  function pillScope(s) {
    return `<span class="pill state">${icon('pin')}${esc(scopeText(s))}</span>`;
  }

  function serviceCard(s, opts = {}) {
    const number = s.number || s.dial;
    const href = `#/service/${s.id}`;
    const fav = isFav(s.id);
    return `<article class="svc-card">
      <a class="svc-main" href="${href}">
        <span class="svc-icon ${s.emergency ? 'emergency' : ''}">${icon(catIcon(s))}</span>
        <div class="svc-body">
          <h3 class="svc-name">${esc(serviceName(s))}</h3>
          ${opts.hideDesc ? '' : `<p class="svc-desc">${esc(servicePurpose(s))}</p>`}
          <div class="svc-meta">
            <span class="pill">${esc(categoryName(s.category))}</span>
            ${pillScope(s)}
          </div>
        </div>
      </a>
      <div class="svc-action">
        ${number
          ? `<a class="call-mini" href="${telHref(number)}" data-recent="${esc(s.id)}" aria-label="${esc(t('a11y.call'))} ${esc(number)}">${icon('phone')}<span>${esc(number)}</span></a>`
          : `<a class="call-mini ghost" href="${href}">${esc(t('common.open'))}</a>`}
        <button class="fav-mini${fav ? ' active' : ''}" type="button" data-action="favorite" data-id="${esc(s.id)}" aria-label="${esc(fav ? t('a11y.unsave') : t('a11y.save'))}" aria-pressed="${fav}">${icon('star')}</button>
      </div>
    </article>`;
  }

  function intentCard(it) {
    const first = firstServiceOf(it);
    const num = first && (first.number || first.dial);
    const steps = (it.steps && (it.steps[state.lang] || it.steps.en)) || [];
    return `<article class="intent-card">
      <div class="intent-eyebrow">${icon('spark')} ${esc(t('search.likely'))}</div>
      <h2 class="intent-title"><a href="#/problem/${esc(it.id)}">${esc(L(it.title))}</a></h2>
      ${steps.length ? `<div class="result-group-title" style="margin-top:14px">${esc(t('search.steps'))}</div>
      <ol class="intent-steps">${steps.slice(0, 3).map((x, i) => `<li><span class="n">${i + 1}</span><span>${esc(x)}</span></li>`).join('')}</ol>` : ''}
      <div class="intent-actions">
        ${num ? `<a class="btn btn-primary" href="${telHref(num)}" data-recent="${esc(first.id)}">${icon('phone')} ${esc(t('search.callNow', { number: num }))}</a>` : ''}
        ${first?.officialUrl ? `<a class="btn btn-secondary" href="${esc(first.officialUrl)}" target="_blank" rel="noopener">${icon('external')} ${esc(t('search.openNow'))}</a>` : ''}
        <a class="btn btn-secondary" href="#/problem/${esc(it.id)}">${esc(t('search.seeService'))}</a>
      </div>
    </article>`;
  }

  function footerNote() {
    return `<div class="footer-note">
      <div class="f-title">${icon('checkCircle')} ${esc(t('home.independent'))}</div>
      <p>${esc(D.meta.verifiedNote[state.lang] || D.meta.verifiedNote.en)}</p>
      <div class="footer-meta">
        <span>${esc(t('home.worksOffline'))}</span>
        <span>${esc(t('home.noAds'))}</span>
        <span>${esc(t('home.noTracking'))}</span>
        <span>${esc(t('settings.dataDate', { date: fmtDate(D.built) }))}</span>
      </div>
      <div class="footer-meta">
        <a href="#/about">${esc(t('settings.about'))}</a>
        <a href="#/privacy">${esc(t('settings.privacy'))}</a>
        <a href="#/emergency">${esc(t('emergency.title'))}</a>
        <a href="#/settings">${esc(t('nav.settings'))}</a>
      </div>
    </div>
    <p class="footer-heart">HelpSetu · ${esc(t('brandTag'))}</p>`;
  }

  function installCard() {
    return `<div class="install-card">
      <span class="ic">${icon('install')}</span>
      <span class="tx"><b>${esc(t('install.title'))}</b><span>${esc(t('install.sub'))}</span></span>
      <button class="btn btn-primary btn-sm" type="button" data-action="install">${esc(t('install.button'))}</button>
    </div>`;
  }

  function stateChip() {
    const st = state.state ? STATE_BY_CODE.get(state.state) : null;
    const label = st ? L(st) : t('home.allIndia');
    return `<a class="state-chip" href="#/state">${icon('pin')}<span>${esc(label)}</span>${icon('chevronDown', 'chew')}</a>`;
  }

  function searchForm(id, value, placeholder) {
    return `<form class="search-form" role="search" id="${id}-form">
      ${icon('search', 'search-icon')}
      <label class="sr-only" for="${id}">${esc(t('a11y.search'))}</label>
      <input class="search-input" id="${id}" name="q" type="search" value="${esc(value || '')}" placeholder="${esc(placeholder || t('home.searchPlaceholder'))}" autocomplete="off" enterkeyhint="search" spellcheck="false">
      <button class="search-submit mic-btn" type="button" data-action="voice" id="${id}-mic" aria-label="${esc(t('a11y.voice'))}">${icon('mic')}</button>
      <button class="search-submit" type="submit" aria-label="${esc(t('home.searchBtn'))}">${icon('arrowRight')}</button>
    </form>`;
  }

  function problemTiles() {
    return `<div class="problem-grid">
      <a class="problem-tile problem-tile--big" href="tel:112">
        <span class="p-ic">${icon('sos')}</span>
        <span class="p-tx"><b>${esc(t('common.emergencyShort'))}</b><small>${esc(t('common.tapToCall'))}</small></span>
      </a>${QUICK_PROBLEMS.map((id) => {
      const it = INTENT_BY_ID.get(id);
      if (!it) return '';
      const first = firstServiceOf(it);
      const num = first && (first.number || first.dial);
      const sub = num ? t('search.callNow', { number: num })
        : first ? t('common.onlineOnly') : '';
      return `<a class="problem-tile" href="#/problem/${esc(it.id)}">
        <span class="p-ic">${icon(it.icon || 'spark')}</span>
        <span class="p-tx"><b>${esc(L(it.title))}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>
      </a>`;
    }).join('')}</div>`;
  }

  function categoryGrid() {
    return `<div class="cat-grid">${CATEGORIES.map((c) => `
      <a class="cat-card" href="#/category/${esc(c.id)}">
        <span class="cat-icon ${esc(c.color)}">${icon(c.icon)}</span>
        <span class="cat-label">${esc(L(c.name))}</span>
      </a>`).join('')}</div>`;
  }

  function emptyState(title, hint, actionHref, actionLabel) {
    return `<div class="empty">
      <div class="empty-icon">${icon('search')}</div>
      <h2>${esc(title)}</h2>
      <p>${esc(hint)}</p>
      ${actionHref ? `<a class="btn btn-primary" href="${actionHref}">${esc(actionLabel)}</a>` : ''}
    </div>`;
  }

  /* ---------------- home ---------------- */
  views.home = () => {
    const popular = POPULAR.map((id) => SERVICE_BY_ID.get(id)).filter(Boolean);
    const recent = state.recent.map((id) => SERVICE_BY_ID.get(id)).filter(Boolean).slice(0, 4);
    const saved = state.favourites.map((id) => SERVICE_BY_ID.get(id)).filter(Boolean).slice(0, 3);
    const st = state.state ? STATE_BY_CODE.get(state.state) : null;

    return {
      html: `<section class="home-hero">
        <div class="hero-kicker"><span class="dot"></span>${esc(t('home.kicker'))}</div>
        <h1 class="hero-title">${esc(t('home.title'))}</h1>
        <p class="hero-sub">${esc(t('home.sub'))}</p>
        <div class="hero-controls">
          ${stateChip()}
          <span class="pill verified">${icon('checkCircle')} ${esc(t('home.worksOffline'))}</span>
        </div>
        ${searchForm('home-q', '', t('home.searchPlaceholder'))}
        <div class="chips" aria-label="${esc(t('home.tryLabel'))}">
          ${(t('home.chips') || []).map((c) => `<a class="chip" href="#/search?q=${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}
        </div>
      </section>

      <section class="emg-card" aria-labelledby="emg-title">
        <div class="emg-top">
          <span class="emg-badge">${icon('sos')} ${esc(t('home.emergency'))}</span>
        </div>
        <div class="emg-main">
          <div>
            <div class="emg-number" id="emg-title">112</div>
            <div class="emg-caption">${esc(t('home.emergencyCaption'))}</div>
          </div>
          <a class="btn btn-emergency emg-call" href="tel:112" data-recent="national-erss-112">${icon('phone')} ${esc(t('home.call112'))}</a>
        </div>
        <div class="emg-quick">
          <a class="quick-call" href="tel:108" data-recent="national-ambulance-108"><b>108</b><span>${esc(t('home.quick.ambulance'))}</span></a>
          <a class="quick-call" href="tel:112"><b>112</b><span>${esc(t('home.quick.fire'))}</span></a>
          <a class="quick-call" href="tel:181" data-recent="national-womenhelpline-181"><b>181</b><span>${esc(t('home.quick.women'))}</span></a>
          <a class="quick-call" href="tel:1098" data-recent="national-childhelpline-1098"><b>1098</b><span>${esc(t('home.quick.child'))}</span></a>
        </div>
      </section>

      <section class="section" aria-labelledby="cats-title">
        <div class="section-head"><h2 class="section-title" id="cats-title">${esc(t('home.categories'))}</h2></div>
        ${categoryGrid()}
      </section>

      <section class="section" aria-labelledby="popular-title">
        <div class="section-head">
          <h2 class="section-title" id="popular-title">${esc(t('home.popular'))}</h2>
          <a class="section-link" href="#/search">${esc(t('home.seeAll'))}</a>
        </div>
        <div class="service-list">${popular.map((s) => serviceCard(s)).join('')}</div>
      </section>

      ${recent.length ? `<section class="section" aria-labelledby="recent-title">
        <div class="section-head"><h2 class="section-title" id="recent-title">${esc(t('home.recent'))}</h2></div>
        <div class="service-list">${recent.map((s) => serviceCard(s, { hideDesc: true })).join('')}</div>
      </section>` : ''}

      ${saved.length ? `<section class="section" aria-labelledby="saved-title">
        <div class="section-head">
          <h2 class="section-title" id="saved-title">${esc(t('home.savedTitle'))}</h2>
          <a class="section-link" href="#/saved">${esc(t('home.seeAll'))}</a>
        </div>
        <div class="service-list">${saved.map((s) => serviceCard(s, { hideDesc: true })).join('')}</div>
      </section>` : ''}

      ${footerNote()}`,
      mount(main) {
        document.title = `HelpSetu — ${t('brandTag')}`;
        const form = main.querySelector('#home-q-form');
        const input = main.querySelector('#home-q');
        form?.addEventListener('submit', (e) => {
          e.preventDefault();
          const q = input.value.trim();
          location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/search';
        });
        main.querySelector('#home-q-mic')?.addEventListener('click', () => {
          HS.startVoice((text) => {
            input.value = text;
            HS.toast(t('search.heard', { q: text }));
            location.hash = `#/search?q=${encodeURIComponent(text)}`;
          });
        });
      },
    };
  };

  /* ---------------- search ---------------- */
  function resultsHtml(q) {
    if (!q.trim()) {
      return `<div class="section">
        <div class="result-group-title">${esc(t('search.startTitle'))}</div>
        <p class="section-sub" style="margin-bottom:14px">${esc(t('search.startHint'))}</p>
        <div class="section-label">${icon('spark')} ${esc(t('home.tryLabel'))}</div>
        ${problemTiles()}
        <div class="section-head" style="margin-top:28px"><h2 class="section-title">${esc(t('search.browse'))}</h2></div>
        ${categoryGrid()}
      </div>`;
    }
    const res = search(q);
    if (!res.intents.length && !res.services.length) {
      return `<div class="no-results">
        ${icon('search')}
        <h2>${esc(t('search.noResults'))}</h2>
        <p>${esc(t('search.noResultsHint'))}</p>
        <a class="btn btn-primary" href="tel:112">${icon('phone')} ${esc(t('common.emergencyShort'))}</a>
      </div>`;
    }
    const n = res.services.length;
    const count = n === 0 ? '' : n === 1 ? t('search.oneResult') : t('search.results', { n });
    return `<div class="results-head">
        <h2 class="section-title">${esc(t('search.resultFor', { q }))}</h2>
        <span class="results-count" aria-live="polite">${esc(count)}</span>
      </div>
      ${state.state ? `<p class="section-sub" style="margin-bottom:14px">${esc(t('search.stateOnly', { state: L(STATE_BY_CODE.get(state.state)) }))}</p>` : ''}
      ${res.intents.length ? `<div class="result-group">${res.intents.map(intentCard).join('')}</div>` : ''}
      ${res.services.length ? `<div class="result-group">
        <div class="result-group-title">${esc(t('search.allResults'))}</div>
        <div class="service-list">${res.services.map((s) => serviceCard(s)).join('')}</div>
      </div>` : ''}`;
  }

  views.search = (route) => {
    const q = route.params.get('q') || '';
    return {
      html: `<div class="search-top">
        <div class="page-head">
          <h1 class="page-title">${esc(t('search.title'))}</h1>
          <p class="page-sub">${esc(t('search.sub'))}</p>
        </div>
        ${searchForm('search-q', q, t('search.placeholder'))}
        <div id="search-results" aria-live="polite" aria-label="${esc(t('a11y.results'))}">${resultsHtml(q)}</div>
      </div>
      ${footerNote()}`,
      mount(main) {
        const form = main.querySelector('#search-q-form');
        const input = main.querySelector('#search-q');
        const box = main.querySelector('#search-results');
        let timer = 0;
        const run = () => {
          const value = input.value.trim();
          box.innerHTML = resultsHtml(value);
          const newHash = value ? `#/search?q=${encodeURIComponent(value)}` : '#/search';
          if (location.hash !== newHash) history.replaceState(null, '', location.pathname + location.search + newHash);
          document.title = value ? `${value} — HelpSetu` : `${t('search.title')} — HelpSetu`;
        };
        input.addEventListener('input', () => {
          clearTimeout(timer);
          timer = setTimeout(run, 160);
        });
        form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); run(); });
        main.querySelector('#search-q-mic')?.addEventListener('click', () => {
          HS.startVoice((text) => {
            input.value = text;
            HS.toast(t('search.heard', { q: text }));
            run();
          });
        });
        document.title = q ? `${q} — HelpSetu` : `${t('search.title')} — HelpSetu`;
        window.scrollTo(0, 0);
      },
    };
  };

  /* ---------------- guided problem answer ---------------- */
  views.problem = (route) => {
    const it = INTENT_BY_ID.get(route.id);
    if (!it) return views.search({ params: new URLSearchParams() });
    const steps = (it.steps && (it.steps[state.lang] || it.steps.en)) || [];
    const related = (it.serviceIds || []).map((id) => SERVICE_BY_ID.get(id)).filter(Boolean);
    const first = firstServiceOf(it);
    const num = first && (first.number || first.dial);
    const localOnly = !related.length;

    return {
      html: `<div class="problem-top">
        <a class="back-btn" href="#/search">${icon('arrowLeft')} ${esc(t('common.back'))}</a>
        <div class="page-head" style="margin-top:16px">
          <h1 class="page-title">${esc(L(it.title))}</h1>
          <p class="page-sub">${esc(t('search.likely'))}</p>
        </div>
        ${num ? `<a class="btn btn-primary" style="min-height:60px;margin-top:18px;width:100%;font-size:1.05rem" href="${telHref(num)}" data-recent="${esc(first.id)}">${icon('phone')} ${esc(t('search.callNow', { number: num }))}</a>` : ''}
        ${steps.length ? `<section class="intent-card" style="margin-top:16px">
          <div class="intent-eyebrow">${icon('spark')} ${esc(t('search.steps'))}</div>
          <ol class="intent-steps">${steps.map((x, i) => `<li><span class="n">${i + 1}</span><span>${esc(x)}</span></li>`).join('')}</ol>
        </section>` : ''}
        ${localOnly ? `<div class="empty" style="margin-top:20px">
          <div class="empty-icon">${icon('pin')}</div>
          <h2>${esc(t('category.chooseState'))}</h2>
          <a class="btn btn-primary" href="#/state">${esc(t('category.chooseStateBtn'))}</a>
        </div>` : `<section style="margin-top:24px">
          <div class="result-group-title">${esc(t('search.allResults'))}</div>
          <div class="service-list">${related.map((s) => serviceCard(s)).join('')}</div>
        </section>`}
        <a class="btn btn-secondary" style="min-height:56px;margin-top:22px;width:100%" href="tel:112">${icon('sos')} ${esc(t('common.emergencyShort'))}</a>
      </div>
      ${footerNote()}`,
      mount() {
        document.title = `${L(it.title)} — HelpSetu`;
        window.scrollTo(0, 0);
      },
    };
  };

  /* ---------------- category ---------------- */
  views.category = (route) => {
    const cat = CAT_BY_ID.get(route.id);
    if (!cat) return views.home();
    const { national, local } = servicesForCategory(cat.id);
    const allLocalCount = SERVICES.filter((s) => s.category === cat.id && s.scope === 'state').length;
    const st = state.state ? STATE_BY_CODE.get(state.state) : null;
    const total = national.length + local.length;

    return {
      html: `<div class="page-head">
        <a class="back-btn" href="#/">${icon('arrowLeft')} ${esc(t('common.home'))}</a>
        <h1 class="page-title">${esc(L(cat.name))}</h1>
        <p class="page-sub">${esc(t('category.count', { n: total }))}${st ? ` · ${esc(t('category.inState', { state: L(st) }))}` : ''}</p>
      </div>
      ${!state.state && allLocalCount ? `<div class="install-card" style="margin-top:18px">
        <span class="ic">${icon('pin')}</span>
        <span class="tx"><b>${esc(t('category.chooseState'))}</b><span>${esc(t('category.stateCount', { n: allLocalCount }))}</span></span>
        <a class="btn btn-primary btn-sm" href="#/state">${esc(t('category.chooseStateBtn'))}</a>
      </div>` : ''}

      ${local.length ? `<section class="section">
        <div class="section-head"><h2 class="section-title">${st ? esc(L(st)) : esc(t('home.allIndia'))}</h2><span class="results-count">${local.length}</span></div>
        <div class="service-list">${local.map((s) => serviceCard(s)).join('')}</div>
      </section>` : ''}

      ${national.length ? `<section class="section">
        <div class="section-head"><h2 class="section-title">${esc(t('category.nationwide'))}</h2><span class="results-count">${national.length}</span></div>
        <div class="service-list">${national.map((s) => serviceCard(s)).join('')}</div>
      </section>` : ''}

      ${!total ? emptyState(t('category.empty'), t('search.noResultsHint'), '#/', t('common.back')) : ''}
      ${footerNote()}`,
      mount(main) {
        document.title = `${L(cat.name)} — HelpSetu`;
        main.querySelector('.back-btn')?.addEventListener('click', () => { /* link handles it */ });
      },
    };
  };

  /* ---------------- service detail ---------------- */
  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return url; }
  }

  views.service = (route) => {
    const s = SERVICE_BY_ID.get(route.id);
    if (!s) return views.home();
    const number = s.number || s.dial;
    const fav = isFav(s.id);
    const steps = s.steps && (s.steps[state.lang] || s.steps.en);
    const when = s.when ? L(s.when) : '';
    const hours = s.hours ? L(s.hours) : t('service.hoursUnknown');
    const langs = (s.languages || []).filter(Boolean);
    const related = INTENTS.filter((it) => (it.serviceIds || []).includes(s.id)).slice(0, 4);
    const official = s.officialUrl || s.channels?.web || null;

    return {
      html: `<div class="detail-hero">
        <a class="back-btn" href="#/category/${esc(s.category)}">${icon('arrowLeft')} ${esc(categoryName(s.category))}</a>
        <div class="detail-badges">
          <span class="pill">${esc(categoryName(s.category))}</span>
          ${s.emergency ? `<span class="pill emergency">${icon('sos')} ${esc(t('home.emergency'))}</span>` : ''}
          <span class="pill verified">${icon('checkCircle')} ${esc(t('service.verified'))}</span>
          ${s.scope === 'state' ? `<span class="pill state">${icon('pin')} ${esc(scopeText(s))}</span>` : ''
          }
        </div>
        <h1 class="detail-title">${esc(serviceName(s))}</h1>
        <p class="detail-purpose">${esc(servicePurpose(s))}</p>
      </div>

      <div class="number-panel">
        ${number ? `<div class="number-label">${esc(t('common.tapToCall'))}</div>
          <div class="big-number">${esc(number)}</div>
          <div class="number-note">${esc(hours)} · ${esc(scopeText(s))}</div>
          <div class="number-actions">
            <a class="btn btn-call" href="${telHref(number)}" data-recent="${esc(s.id)}">${icon('phone')} ${esc(t('service.callNow', { number }))}</a>
            ${official ? `<a class="btn btn-web" href="${esc(official)}" target="_blank" rel="noopener" data-recent="${esc(s.id)}">${icon('external')} ${esc(t('service.openWebsite'))}</a>` : ''}
          </div>`
        : `<div class="number-label">${esc(t('common.onlineOnly'))}</div>
          <p class="detail-purpose" style="margin:6px auto 0;max-width:34ch">${esc(t('common.noNumber'))}</p>
          <div class="number-actions" style="margin-top:16px">
            ${official ? `<a class="btn btn-web" href="${esc(official)}" target="_blank" rel="noopener" data-recent="${esc(s.id)}">${icon('external')} ${esc(t('service.openWebsite'))}</a>` : ''}
          </div>`}

        <div class="action-grid">
          <button class="icon-action${fav ? ' active' : ''}" type="button" data-action="favorite" data-id="${esc(s.id)}" aria-pressed="${fav}">
            ${icon('star')}<span>${esc(fav ? t('common.saved') : t('common.save'))}</span>
          </button>
          ${number ? `<button class="icon-action" type="button" data-action="copy" data-number="${esc(number)}">${icon('copy')}<span>${esc(t('common.copy'))}</span></button>` : ''}
          <button class="icon-action" type="button" data-action="share" data-id="${esc(s.id)}">${icon('share')}<span>${esc(t('common.share'))}</span></button>
          <button class="icon-action" type="button" data-action="speak" data-id="${esc(s.id)}">${icon('play')}<span>${esc(t('common.listen'))}</span></button>
        </div>

        ${s.channels?.whatsapp ? `<a class="btn btn-secondary btn-block" style="margin-top:10px" href="${waHref(s.channels.whatsapp)}" target="_blank" rel="noopener">${icon('whatsapp')} ${esc(t('common.whatsapp'))}</a>` : ''}
      </div>

      ${when ? `<section class="detail-block">
        <h2>${esc(t('service.when'))}</h2>
        <p>${esc(when)}</p>
      </section>` : ''}

      ${steps && steps.length ? `<section class="detail-block">
        <h2>${esc(t('service.steps'))}</h2>
        <ol class="steps">${steps.map((x, i) => `<li class="step"><span class="step-num">${i + 1}</span><span class="step-text">${esc(x)}</span></li>`).join('')}</ol>
      </section>` : ''}

      <section class="detail-block">
        <h2>${esc(t('service.info'))}</h2>
        <div class="info-grid">
          <div class="info-item"><div class="k">${esc(t('service.hours'))}</div><div class="v">${esc(hours)}</div></div>
          <div class="info-item"><div class="k">${esc(t('service.coverage'))}</div><div class="v">${esc(scopeText(s))}</div></div>
          ${langs.length ? `<div class="info-item"><div class="k">${esc(t('service.languages'))}</div><div class="v">${esc(langs.join(', '))}</div></div>` : ''}
          <div class="info-item"><div class="k">${esc(t('service.verified'))}</div><div class="v">${esc(fmtDate(s.verifiedDate))}</div></div>
        </div>
        ${s.altNumbers?.length ? `<div style="margin-top:14px"><div class="k" style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-muted);font-weight:800;margin-bottom:6px">${esc(t('service.alt'))}</div>
          <div class="chips" style="padding-top:0;flex-wrap:wrap;overflow:visible">${s.altNumbers.map((n) => `<a class="chip" href="${telHref(n)}" data-recent="${esc(s.id)}">${icon('phone')}${esc(n)}</a>`).join('')}</div></div>` : ''}
      </section>

      ${related.length ? `<section class="detail-block">
        <h2>${esc(t('service.problems'))}</h2>
        <div class="chips" style="padding-top:0;flex-wrap:wrap;overflow:visible">
          ${related.map((it) => `<a class="chip" href="#/search?q=${encodeURIComponent(L(it.title))}">${icon('spark')}${esc(L(it.title))}</a>`).join('')}
        </div>
      </section>` : ''}

      <div class="source-card">
        <div class="source-line">${icon('checkCircle')}<span>${esc(t('service.sourceBy', { name: s.sourceName || hostOf(s.sourceUrl) }))}</span></div>
        ${s.sourceUrl ? `<div class="source-line" style="margin-top:6px">${icon('source')}<span><a href="${esc(s.sourceUrl)}" target="_blank" rel="noopener">${esc(hostOf(s.sourceUrl))}</a> · ${esc(t('service.verifiedOn', { date: fmtDate(s.verifiedDate) }))}</span></div>` : ''}
        <p class="source-note">${esc(t('service.independent'))}</p>
      </div>

      ${!s.emergency ? `<div class="emergency-strip">
        <span class="ec-icon">${icon('sos')}</span>
        <p>${esc(t('service.emergencyStrip'))}</p>
        <a href="tel:112" data-recent="national-erss-112">${icon('phone')} 112</a>
      </div>` : ''}

      ${footerNote()}`,
      mount() {
        document.title = `${serviceName(s)} — HelpSetu`;
        HS.addRecent(s.id);
      },
    };
  };

  HS.views = Object.assign(HS.views || {}, views);
  HS.ui = { serviceCard, intentCard, footerNote, installCard, stateChip, searchForm, categoryGrid, emptyState };
})();
