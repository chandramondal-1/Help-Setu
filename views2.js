/* HelpSetu views — saved, settings, state picker, about, privacy, emergency. */
(() => {
  'use strict';
  const {
    D, state, t, L, esc, icon, telHref, supportHref, SUPPORT_DISPLAY, fmtDate, serviceName, servicePurpose,
    SERVICE_BY_ID, STATE_BY_CODE, STATES, SERVICES, countStateServices,
    setStateCode, navigate,
  } = HS;

  const { serviceCard, footerNote, installCard, emptyState } = HS.ui;
  const views = HS.views || (HS.views = {});

  const hostOf = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return url || ''; }
  };

  /* ---------------- saved ---------------- */
  views.saved = () => {
    const saved = state.favourites.map((id) => SERVICE_BY_ID.get(id)).filter(Boolean);

    return {
      html: `<div class="page-head">
        <h1 class="page-title">${esc(t('saved.title'))}</h1>
        <p class="page-sub">${esc(t('saved.sub'))}</p>
      </div>
      ${saved.length
        ? `<div class="section">
            <div class="service-list">${saved.map((s) => serviceCard(s)).join('')}</div>
            <div class="saved-actions">
              <button class="btn btn-danger btn-sm" type="button" data-action="clear-saved">${icon('trash')} ${esc(t('saved.clear'))}</button>
            </div>
          </div>`
        : `<div class="section">${emptyState(t('saved.empty'), t('saved.emptyHint'), '#/search', t('saved.browse'))}</div>`}
      ${footerNote()}`,
      mount() {
        document.title = `${t('saved.title')} — HelpSetu`;
      },
    };
  };

  /* ---------------- settings ---------------- */
  const themeLabel = () => t('settings.' + state.theme);
  const stateLabel = () => {
    const st = state.state ? STATE_BY_CODE.get(state.state) : null;
    return st ? L(st) : t('home.allIndia');
  };

  views.settings = () => {
    const textOptions = [
      ['1', t('settings.normal')],
      ['1.14', t('settings.large')],
      ['1.28', t('settings.xlarge')],
    ];

    return {
      html: `<div class="page-head">
        <h1 class="page-title">${esc(t('settings.title'))}</h1>
        <p class="page-sub">${esc(t('settings.sub'))}</p>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">${esc(t('settings.preferences'))}</div>
        <div class="settings-card">
          <button class="setting-row" type="button" data-action="language">
            <span class="setting-icon">${icon('globe')}</span>
            <span class="setting-text">
              <span class="setting-label">${esc(t('settings.language'))}</span>
              <span class="setting-value">${esc(t('settings.languageSub'))} · ${esc(HS.LANG_META[state.lang].native)}</span>
            </span>
            ${icon('chevron', 'setting-chev')}
          </button>

          <button class="setting-row" type="button" data-action="theme">
            <span class="setting-icon">${icon(state.theme === 'dark' ? 'moon' : 'sun')}</span>
            <span class="setting-text">
              <span class="setting-label">${esc(t('settings.theme'))}</span>
              <span class="setting-value">${esc(themeLabel())} · ${esc(t('settings.themeSub'))}</span>
            </span>
            ${icon('chevron', 'setting-chev')}
          </button>

          <a class="setting-row" href="#/state">
            <span class="setting-icon">${icon('pin')}</span>
            <span class="setting-text">
              <span class="setting-label">${esc(t('settings.location'))}</span>
              <span class="setting-value">${esc(stateLabel())} · ${esc(t('settings.locationSub'))}</span>
            </span>
            ${icon('chevron', 'setting-chev')}
          </a>

          <div class="seg-wrap">
            <div class="seg-label" id="text-size-label">${esc(t('settings.text'))}</div>
            <div class="segmented" role="group" aria-labelledby="text-size-label">
              ${textOptions.map(([scale, label]) => `<button class="seg-btn${Math.abs(state.scale - Number(scale)) < 0.01 ? ' active' : ''}" type="button" data-action="set-scale" data-scale="${scale}" aria-pressed="${Math.abs(state.scale - Number(scale)) < 0.01}">${esc(label)}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">${esc(t('settings.more'))}</div>
        <div class="settings-card">
          <div class="setting-row">
            <span class="setting-icon">${icon('checkCircle')}</span>
            <span class="setting-text">
              <span class="setting-label">${esc(t('settings.offline'))}</span>
              <span class="setting-value">${esc(t('settings.offlineSub'))}</span>
            </span>
          </div>

          <a class="setting-row" href="#/about">
            <span class="setting-icon">${icon('info')}</span>
            <span class="setting-text">
              <span class="setting-label">${esc(t('settings.about'))}</span>
              <span class="setting-value">${esc(t('settings.sources'))}</span>
            </span>
            ${icon('chevron', 'setting-chev')}
          </a>

          <a class="setting-row" href="#/privacy">
            <span class="setting-icon">${icon('lock')}</span>
            <span class="setting-text">
              <span class="setting-label">${esc(t('settings.privacy'))}</span>
              <span class="setting-value">${esc(t('settings.privacySub'))}</span>
            </span>
            ${icon('chevron', 'setting-chev')}
          </a>

          <a class="setting-row" href="${supportHref(t('support.updateMessage'))}" target="_blank" rel="noopener">
            <span class="setting-icon">${icon('whatsapp')}</span>
            <span class="setting-text">
              <span class="setting-label">${esc(t('support.title'))}</span>
              <span class="setting-value">${esc(t('support.sub'))}</span>
            </span>
            ${icon('chevron', 'setting-chev')}
          </a>

          <button class="setting-row" type="button" data-action="check-update">
            <span class="setting-icon">${icon('sync')}</span>
            <span class="setting-text">
              <span class="setting-label">${esc(t('settings.checkUpdate'))}</span>
              <span class="setting-value">${esc(t('settings.version'))} ${esc(HS.APP_VERSION)}</span>
            </span>
            ${icon('chevron', 'setting-chev')}
          </button>

          ${state.recent.length ? `<button class="setting-row" type="button" data-action="clear-recent">
            <span class="setting-icon">${icon('clock')}</span>
            <span class="setting-text">
              <span class="setting-label">${esc(t('settings.clearRecent'))}</span>
            </span>
            ${icon('trash', 'setting-chev')}
          </button>` : ''}

          <div class="setting-row">
            <span class="setting-icon">${icon('source')}</span>
            <span class="setting-text">
              <span class="setting-label">${esc(t('settings.version'))} ${esc(HS.APP_VERSION)}</span>
              <span class="setting-value">${esc(t('settings.dataDate', { date: fmtDate(D.built) }))}</span>
            </span>
          </div>
        </div>
      </div>

      ${installCard()}
      ${footerNote()}`,
      mount() {
        document.title = `${t('settings.title')} — HelpSetu`;
      },
    };
  };

  /* ---------------- state picker ---------------- */
  views.state = () => {
    const sorted = [...STATES].sort((a, b) => a.en.localeCompare(b.en));
    const nationalCount = SERVICES.filter((s) => s.scope === 'national').length;
    const item = (code, label, search, count) => {
      const active = state.state === code;
      return `<button class="state-item${active ? ' active' : ''}" type="button" data-state-code="${esc(code)}" data-search="${esc(search)}">
        <span class="state-name">${icon(code ? 'pin' : 'globe')}<span>${esc(label)}</span></span>
        ${active ? icon('check') : `<span class="count">${count}</span>`}
      </button>`;
    };

    return {
      html: `<div class="page-head">
        <a class="back-btn" href="#/">${icon('arrowLeft')} ${esc(t('common.home'))}</a>
        <h1 class="page-title">${esc(t('state.title'))}</h1>
        <p class="page-sub">${esc(t('state.sub'))}</p>
      </div>

      <div class="filter-box list-search">
        ${icon('search')}
        <label class="sr-only" for="state-search">${esc(t('state.placeholder'))}</label>
        <input class="search-input" id="state-search" type="search" placeholder="${esc(t('state.placeholder'))}" autocomplete="off" spellcheck="false">
      </div>

      <div class="state-list" id="state-list">
        ${item('', t('state.allIndia'), 'all india national', nationalCount)}
        ${sorted.map((st) => item(st.code, st[state.lang] || st.en, `${st.code} ${st.en} ${st.hi} ${st.bn}`, countStateServices(st.code))).join('')}
      </div>
      ${footerNote()}`,
      mount(main) {
        document.title = `${t('state.title')} — HelpSetu`;
        const input = main.querySelector('#state-search');
        const items = [...main.querySelectorAll('.state-item')];
        input?.addEventListener('input', () => {
          const q = input.value.trim().toLowerCase();
          for (const el of items) el.hidden = !!q && !el.dataset.search.toLowerCase().includes(q);
        });
        for (const btn of items) {
          btn.addEventListener('click', () => {
            setStateCode(btn.dataset.stateCode || '');
            navigate('#/');
          });
        }
      },
    };
  };

  /* ---------------- about ---------------- */
  views.about = () => {
    const sourceIds = [
      'national-erss-112', 'national-railmadad-139', 'consumer-1915',
      'national-cybercrime-1930', 'in-lpg-emergency-1906',
      'national-womenhelpline-181', 'national-childhelpline-1098',
    ];
    const sources = sourceIds.map((id) => SERVICE_BY_ID.get(id)).filter(Boolean);

    return {
      html: `<div class="about-hero">
        <div class="about-mark">${icon('bridge')}</div>
        <h1 class="about-title">${esc(t('about.title'))}</h1>
        <p class="about-sub">${esc(t('about.sub'))}</p>
      </div>

      <article class="prose">
        <p>${esc(t('about.p1'))}</p>
        <p>${esc(t('about.p2'))}</p>
        <p>${esc(t('about.p3'))}</p>

        <div class="callout">${icon('sos')}<span>${esc(t('about.callout'))}</span></div>

        <h2>${esc(t('about.howTitle'))}</h2>
        <ul>
          <li>${esc(t('about.how1'))}</li>
          <li>${esc(t('about.how2'))}</li>
          <li>${esc(t('about.how3'))}</li>
          <li>${esc(t('about.how4'))}</li>
        </ul>

        <h2>${esc(t('about.offlineTitle'))}</h2>
        <p>${esc(t('about.offlineText'))}</p>

        <h2>${esc(t('about.privacyTitle'))}</h2>
        <p>${esc(t('about.privacyText'))}</p>

        <h2>${esc(t('about.sourcesTitle'))}</h2>
        <ul class="source-links">
          ${sources.map((s) => {
            const url = s.sourceUrl || s.officialUrl || s.channels?.web;
            return url ? `<li><a href="${esc(url)}" target="_blank" rel="noopener">${esc(serviceName(s))}</a> <span class="src-host">${esc(hostOf(url))}</span></li>` : '';
          }).join('')}
        </ul>

        <div class="install-card support-card">
          <span class="ic">${icon('whatsapp')}</span>
          <span class="tx"><b>${esc(t('support.title'))}</b><span>${esc(t('support.sub'))} · ${esc(SUPPORT_DISPLAY)}</span></span>
          <a class="btn btn-primary btn-sm" href="${supportHref(t('support.reportMessage'))}" target="_blank" rel="noopener">${esc(t('support.whatsapp'))}</a>
        </div>

        <p class="about-disclaimer">${esc(t('about.disclaimer'))}</p>
      </article>
      ${footerNote()}`,
      mount() {
        document.title = t('about.title');
      },
    };
  };

  /* ---------------- privacy ---------------- */
  views.privacy = () => {
    return {
      html: `<div class="page-head">
        <a class="back-btn" href="#/settings">${icon('arrowLeft')} ${esc(t('nav.settings'))}</a>
        <h1 class="page-title">${esc(t('privacy.title'))}</h1>
      </div>

      <article class="prose">
        <p>${esc(t('privacy.p1'))}</p>
        <p>${esc(t('privacy.p2'))}</p>
        <p>${esc(t('privacy.p3'))}</p>
        <p>${esc(t('privacy.p4'))}</p>
        <p>${esc(t('privacy.p5'))}</p>

        <div class="privacy-actions">
          <button class="btn btn-danger btn-block" type="button" data-action="clear-data">${icon('trash')} ${esc(t('privacy.clear'))}</button>
          <p>${esc(t('privacy.clearHint'))}</p>
        </div>

        <p class="about-disclaimer">${esc(t('settings.independent'))}</p>
      </article>
      ${footerNote()}`,
      mount() {
        document.title = `${t('privacy.title')} — HelpSetu`;
      },
    };
  };

  /* ---------------- emergency ---------------- */
  const EMERGENCY_IDS = [
    'national-ambulance-108', 'national-maternal-102',
    'national-womenhelpline-181', 'national-childhelpline-1098',
    'national-cybercrime-1930', 'national-nhai-highway-1033',
    'in-lpg-emergency-1906', 'national-railmadad-139',
  ];

  views.emergency = () => {
    const main = SERVICE_BY_ID.get('national-erss-112');
    const services = EMERGENCY_IDS.map((id) => SERVICE_BY_ID.get(id)).filter(Boolean);
    const steps = (main?.steps && (main.steps[state.lang] || main.steps.en)) || [];

    return {
      html: `<div class="page-head">
        <a class="back-btn" href="#/">${icon('arrowLeft')} ${esc(t('common.home'))}</a>
        <h1 class="page-title">${esc(t('emergency.title'))}</h1>
        <p class="page-sub">${esc(t('emergency.sub'))}</p>
      </div>

      <div class="number-panel emg-panel">
        <div class="number-label">${esc(t('home.emergency'))} · ${esc(t('home.emergencyCaption'))}</div>
        <div class="big-number">112</div>
        <div class="number-note">${esc(t('service.scopeNational'))}</div>
        <div class="number-actions">
          <a class="btn btn-call" href="tel:112" data-recent="national-erss-112">${icon('phone')} ${esc(t('home.call112'))}</a>
          ${main ? `<a class="btn btn-secondary" href="#/service/national-erss-112">${esc(t('emergency.details'))}</a>` : ''}
        </div>
      </div>

      <section class="section">
        <div class="section-head"><h2 class="section-title">${esc(t('emergency.more'))}</h2></div>
        <div class="sos-grid">
          ${services.map((s) => {
            const number = s.number || s.dial;
            if (!number) return '';
            return `<a class="sos-tile" href="${telHref(number)}" data-recent="${esc(s.id)}">
              <span class="sos-ico">${icon(s.emergency ? 'phone' : 'heart')}</span>
              <b>${esc(number)}</b>
              <span>${esc(serviceName(s))}</span>
            </a>`;
          }).join('')}
        </div>
      </section>

      ${steps.length ? `<section class="detail-block">
        <h2>${esc(t('emergency.whatToSay'))}</h2>
        <ol class="steps">${steps.map((x, i) => `<li class="step"><span class="step-num">${i + 1}</span><span class="step-text">${esc(x)}</span></li>`).join('')}</ol>
      </section>` : ''}

      <div class="emergency-strip">
        <span class="ec-icon">${icon('sos')}</span>
        <p>${esc(t('service.emergencyStrip'))}</p>
        <a href="#/category/emergency">${esc(t('home.seeAll'))}</a>
      </div>

      ${footerNote()}`,
      mount() {
        document.title = `${t('emergency.title')} — HelpSetu`;
      },
    };
  };
})();
