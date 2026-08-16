(() => {
  'use strict';

  const products = Array.isArray(window.LANDI_PRODUCTS) ? window.LANDI_PRODUCTS : [];
  const byId = id => document.getElementById(id);

  // Simple client-side gate for the internal prototype.
  // This is intentionally lightweight and not a replacement for server-side authentication.
  const demoAuth = {
    username: 'LANDIWebsite',
    passwordSha256: '04092bd9e55a6f5903955645a2eb84f73f44ba15d1d8b19681a08d7e51e35114'
  };
  const authKey = 'landiPrototypeAuthenticatedV2';
  const authGate = byId('authGate');

  async function sha256Hex(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function unlockPrototype() {
    sessionStorage.setItem(authKey, '1');
    authGate?.setAttribute('hidden', '');
    document.body.classList.remove('auth-locked');
  }

  function lockPrototype() {
    sessionStorage.removeItem(authKey);
    document.body.classList.add('auth-locked');
    authGate?.removeAttribute('hidden');
    if (byId('authPassword')) byId('authPassword').value = '';
    if (byId('authError')) byId('authError').textContent = '';
    setTimeout(() => byId('authUsername')?.focus(), 30);
  }

  if (sessionStorage.getItem(authKey) === '1') unlockPrototype();
  else lockPrototype();

  byId('authForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const username = byId('authUsername').value.trim();
    const password = byId('authPassword').value;
    const passwordHash = await sha256Hex(password);
    if (username === demoAuth.username && passwordHash === demoAuth.passwordSha256) {
      byId('authError').textContent = '';
      unlockPrototype();
      return;
    }
    byId('authError').textContent = 'Benutzername oder Passwort ist nicht korrekt.';
    byId('authPassword').select();
  });

  byId('authTogglePassword')?.addEventListener('click', () => {
    const input = byId('authPassword');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    byId('authTogglePassword').textContent = show ? 'Ausblenden' : 'Anzeigen';
    byId('authTogglePassword').setAttribute('aria-label', show ? 'Passwort ausblenden' : 'Passwort anzeigen');
  });

  byId('prototypeLogoutBtn')?.addEventListener('click', lockPrototype);
  const pages = {
    home: byId('landingPage'),
    product: byId('productPage'),
    compare: byId('comparePage'),
    account: byId('accountPage')
  };

  const money = value => new Intl.NumberFormat('de-CH', {
    style: 'currency', currency: 'CHF', minimumFractionDigits: value % 1 ? 2 : 0
  }).format(value).replace('CHF', 'CHF ');
  const pdpPrice = value => Number.isInteger(value) ? `${value}.–` : value.toFixed(2);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
  const getProduct = article => products.find(p => p.articleNo === String(article)) || null;

  let lastPage = 'home';
  let currentProduct = null;
  let qty = 1;

  function showPage(name) {
    Object.entries(pages).forEach(([key, page]) => page?.classList.toggle('active', key === name));
    if (name !== 'product') lastPage = name;
    byId('landingChat')?.classList.toggle('is-hidden', name !== 'home');
    if (name !== 'home') closeLandingChat();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toast(text) {
    const el = byId('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(window.__toast);
    window.__toast = setTimeout(() => el.classList.remove('show'), 1900);
  }

  function productOption(p) {
    const o = document.createElement('option');
    o.value = p.articleNo;
    o.textContent = `${p.name} · Art. ${p.articleNo}`;
    return o;
  }

  function compareSlotPreview(p, target) {
    const label = target === 'first' ? 'LANDI Produkt auswählen' : 'Vergleichsprodukt auswählen';
    if (!p) return `
      <div class="compare-empty">
        <div class="compare-empty-icon" aria-hidden="true">＋</div>
        <strong>${label}</strong>
        <p>${target === 'first' ? 'Wählen Sie ein Produkt aus dem LANDI Sortiment.' : 'Wählen Sie ein zweites LANDI Produkt zum direkten Vergleich.'}</p>
        <button class="choose-product-btn" type="button" data-picker-target="${target}">Produkt auswählen <span>→</span></button>
      </div>`;
    const stats = reviewStats(p);
    return `
      <div class="compare-selected-card">
        <div class="compare-selected-image"><img src="${escapeHtml(p.image)}" alt="Produktbild: ${escapeHtml(p.name)}"></div>
        <div class="compare-selected-copy">
          <div class="compare-selected-kicker">${escapeHtml(p.category)} · Art. ${escapeHtml(p.articleNo)}</div>
          <strong class="compare-selected-title">${escapeHtml(p.name)}</strong>
          <div class="compare-selected-rating"><span>${starString(stats.average)}</span><b>${stats.average.toFixed(1)}</b><small>${stats.count} Demo-Rezensionen</small></div>
          <div class="compare-selected-price">${escapeHtml(money(p.price))}</div>
          <button class="change-product-btn" type="button" data-picker-target="${target}">Produkt ändern</button>
        </div>
      </div>`;
  }

  function reviewStats(p) {
    const items = Array.isArray(p?.reviews?.items) ? p.reviews.items : [];
    const average = items.length ? items.reduce((sum, review) => sum + Number(review.rating || 0), 0) / items.length : 0;
    return { items, count: items.length, average };
  }

  function starString(value) {
    const rounded = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`;
  }

  function renderCards(list) {
    const grid = byId('productGrid');
    grid.innerHTML = '';
    list.forEach(p => {
      const stats = reviewStats(p);
      const summary = p.reviews?.summary || p.featureSummary;
      const card = document.createElement('article');
      card.className = 'product-card';
      card.dataset.article = p.articleNo;
      card.innerHTML = `
        <div class="review-popover" role="status" aria-label="Rezensionszusammenfassung">
          <div class="review-popover-head">
            <strong>Aus ${stats.count} Beispielrezensionen</strong>
            <span class="review-score">${starString(stats.average)} <b>${stats.average.toFixed(1)}</b></span>
          </div>
          <p>${escapeHtml(summary)}</p>
          <div class="note">Demo-Inhalte für den Prototyp – keine echten Kundenbewertungen.</div>
        </div>
        <button class="product-image-wrap product-open" type="button" aria-label="${escapeHtml(p.name)} öffnen">
          <img class="product-image" src="${escapeHtml(p.image)}" alt="Produktbild: ${escapeHtml(p.name)}" loading="lazy">
          <span class="product-badge">${escapeHtml(p.badge)}</span>
        </button>
        <div class="product-body">
          <div class="product-kicker">${escapeHtml(p.category)} · Art. ${escapeHtml(p.articleNo)}</div>
          <button class="product-title-btn product-open" type="button"><h3>${escapeHtml(p.name)}</h3></button>
          <p class="product-desc">${escapeHtml(p.description)}</p>
          <div class="product-rating" aria-label="${stats.average.toFixed(1)} von 5 Sternen aus ${stats.count} Beispielrezensionen">
            <span class="stars">${starString(stats.average)}</span>
            <strong>${stats.average.toFixed(1)}</strong>
            <span>${stats.count} Demo-Rezensionen</span>
          </div>
          <div class="price">${escapeHtml(money(p.price))}</div>
          <div class="product-actions">
            <button class="mini-btn primary add-compare" type="button">Vergleichen</button>
            <button class="link-btn details-btn" type="button">Details →</button>
          </div>
        </div>`;

      let timer;
      const pop = card.querySelector('.review-popover');
      const showSummary = () => {
        clearTimeout(timer);
        timer = setTimeout(() => pop.classList.add('show'), 650);
      };
      const hideSummary = () => {
        clearTimeout(timer);
        pop.classList.remove('show');
      };
      card.addEventListener('mouseenter', showSummary);
      card.addEventListener('mouseleave', hideSummary);
      card.addEventListener('focusin', showSummary);
      card.addEventListener('focusout', e => {
        if (!card.contains(e.relatedTarget)) hideSummary();
      });
      card.querySelectorAll('.product-open').forEach(btn => btn.addEventListener('click', e => {
        e.stopPropagation();
        openProduct(p.articleNo);
      }));
      card.querySelector('.add-compare').addEventListener('click', e => {
        e.stopPropagation();
        byId('landiProduct').value = p.articleNo;
        updateCompareState();
        showPage('compare');
      });
      card.querySelector('.details-btn').addEventListener('click', e => {
        e.stopPropagation();
        openProduct(p.articleNo);
      });
      grid.appendChild(card);
    });
    byId('productCount').textContent = `${list.length} Produkt${list.length === 1 ? '' : 'e'} angezeigt`;
  }

  function filterProducts() {
    const q = byId('globalSearch').value.trim().toLowerCase();
    const cat = byId('categoryFilter').value;
    const list = products.filter(p =>
      (cat === 'all' || p.category === cat) &&
      (!q || `${p.name} ${p.articleNo} ${p.category} ${p.description}`.toLowerCase().includes(q))
    );
    renderCards(list);
    if (q) toast(`${list.length} Produkt${list.length === 1 ? '' : 'e'} gefunden.`);
  }

  /* PDP */
  function galleryViews() {
    return [
      { label: 'Produktansicht 1', transform: 'scale(1)' },
      { label: 'Produktansicht 2', transform: 'scale(1.08) translateX(-2%)' },
      { label: 'Produktansicht 3', transform: 'scale(1.12) translateX(3%)' },
      { label: 'Detailansicht', transform: 'scale(1.22) translateY(-2%)' }
    ];
  }

  function setGalleryView(index) {
    const view = galleryViews()[index] || galleryViews()[0];
    const main = byId('pdpMainImage');
    main.style.transform = view.transform;
    document.querySelectorAll('.pdp-gallery-thumb[data-view]').forEach((btn, i) => btn.classList.toggle('active', i === index));
  }

  function renderGallery(p) {
    const gallery = byId('pdpGallery');
    gallery.innerHTML = '';
    galleryViews().forEach((view, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pdp-gallery-thumb${index === 0 ? ' active' : ''}`;
      btn.dataset.view = String(index);
      btn.setAttribute('aria-label', view.label);
      btn.innerHTML = `<img src="${escapeHtml(p.image)}" alt="">`;
      btn.querySelector('img').style.transform = view.transform;
      btn.addEventListener('click', () => setGalleryView(index));
      gallery.appendChild(btn);
    });

    const infoTiles = [
      ['⌁', 'Sensorik'],
      ['▣', 'Datenblatt'],
      ['▶', 'Video']
    ];
    infoTiles.forEach(([icon, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pdp-gallery-thumb icon-thumb';
      btn.textContent = icon;
      btn.setAttribute('aria-label', label);
      btn.addEventListener('click', () => toast(`${label} geöffnet (Demo).`));
      gallery.appendChild(btn);
    });

    const count = p.pdp?.galleryCount || galleryViews().length;
    const videos = p.pdp?.videoCount || 0;
    byId('pdpGalleryCount').textContent = videos ? `${count} Fotos, ${videos} Video` : `${count} Fotos`;
  }

  function renderSpecs(p) {
    return `<div class="pdp-spec-grid">${Object.entries(p.attributes || {}).map(([k, v]) => `
      <dl class="pdp-spec"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></dl>`).join('')}</div>`;
  }

  function renderQuestions(p) {
    const area = p.attributes?.['Max. Rasenfläche'];
    const drive = p.attributes?.['Radantrieb'];
    const warranty = p.attributes?.['Garantiedauer in Monaten'];
    const rows = [];
    if (area) rows.push(`<strong>Für welche Fläche ist das Produkt geeignet?</strong><br>Empfohlen bis ${escapeHtml(area)}.`);
    if (drive) rows.push(`<strong>Hat das Gerät Radantrieb?</strong><br>${escapeHtml(drive)}.`);
    if (warranty) rows.push(`<strong>Wie lange ist die Garantie?</strong><br>${escapeHtml(warranty)} Monate.`);
    if (p.articleNo === '108065') rows.unshift('<strong>Benötigt der Mähroboter einen Begrenzungsdraht?</strong><br>Nein. Die Navigation erfolgt mit Kamera und Ultraschallsensoren; Magnetstreifen können zur Abgrenzung eingesetzt werden.');
    return `<div class="pdp-question-demo">${rows.join('<hr style="border:0;border-top:1px solid #e1e7e3;margin:12px 0">') || 'Produktfragen werden später hier angezeigt.'}</div>`;
  }

  function renderReviews(p) {
    const { items, count, average } = reviewStats(p);
    if (!count) return '<p class="pdp-feature-copy">Noch keine Rezensionen vorhanden.</p>';
    const reviewsHtml = items.map(review => `
      <article class="pdp-review-card">
        <div class="pdp-review-meta">
          <span class="pdp-review-stars">${starString(review.rating)}</span>
          <strong>${escapeHtml(review.title)}</strong>
        </div>
        <p>${escapeHtml(review.text)}</p>
        <div class="pdp-review-footer">
          <span>${escapeHtml(review.author)} · ${escapeHtml(review.date || '')}</span>
          ${review.verifiedPurchase ? '<span class="verified-review">✓ Verifizierter Kauf (Demo)</span>' : ''}
        </div>
      </article>`).join('');
    return `
      <div class="pdp-review-summary">
        <div class="pdp-review-aggregate">
          <strong>${average.toFixed(1)}</strong>
          <span class="pdp-review-stars">${starString(average)}</span>
          <small>${count} Beispielrezensionen</small>
        </div>
        <div>
          <strong>Zusammenfassung aus den Beispielrezensionen</strong>
          <p>${escapeHtml(p.reviews?.summary || p.featureSummary)}</p>
          <small>Hinweis: Die Rezensionen sind bewusst als Demo-Daten erstellt und keine echten LANDI-Kundenbewertungen.</small>
        </div>
      </div>
      <div class="pdp-review-list">${reviewsHtml}</div>`;
  }

  function openProduct(article) {
    const p = getProduct(article);
    if (!p) return;
    currentProduct = p;
    qty = 1;
    byId('pdpQty').textContent = '1';

    byId('pdpBreadcrumbs').innerHTML = `
      <button type="button" class="home-crumb" aria-label="Startseite">⌂</button><span>/</span>
      <button type="button" class="category-crumb">${escapeHtml(p.category)}</button><span>/</span>
      <span>${escapeHtml(p.name)}</span>`;
    byId('pdpBreadcrumbs').querySelector('.home-crumb').addEventListener('click', () => showPage('home'));
    byId('pdpBreadcrumbs').querySelector('.category-crumb').addEventListener('click', () => {
      showPage('home'); byId('categoryFilter').value = p.category; filterProducts();
    });

    byId('pdpMainImage').src = p.image;
    byId('pdpMainImage').alt = `Produktbild: ${p.name}`;
    byId('pdpMainImage').style.transform = 'scale(1)';
    byId('pdpBrand').textContent = p.brand || 'Okay';
    byId('pdpTitle').textContent = p.name;
    byId('pdpPrice').textContent = pdpPrice(p.price);
    byId('pdpDescription').textContent = p.description;

    const tags = (p.pdp?.promoTags || [p.badge]).filter(Boolean);
    byId('pdpTags').innerHTML = tags.map(t => `<span class="pdp-tag">${escapeHtml(t)}</span>`).join('');

    const oldPrice = p.pdp?.oldPrice;
    const note = oldPrice
      ? `<span>Preis abschlag</span> <del>${escapeHtml(money(oldPrice))}</del>`
      : `<span>${escapeHtml(p.badge || 'Aktuelles Angebot')}</span>`;
    byId('pdpPriceNote').innerHTML = note;

    const disposal = Number(p.pdp?.disposalFee || 0);
    byId('pdpDisposalRow').style.display = disposal > 0 ? 'grid' : 'none';
    byId('pdpDisposalPrice').textContent = disposal > 0 ? `+ CHF ${disposal.toFixed(2)}` : '';
    byId('pdpDisposal').checked = false;

    byId('pdpDeliveryLink').textContent = p.pdp?.deliveryCopy || 'Lieferoptionen prüfen';
    byId('pdpPickupLink').textContent = p.pdp?.pickupCopy || 'Wählen Sie einen Laden aus';
    document.querySelector('input[name="fulfilment"][value="delivery"]').checked = true;

    renderGallery(p);
    byId('pdpFeatures').innerHTML = `<p class="pdp-feature-copy">${escapeHtml(p.featureSummary)}<br><br>${escapeHtml(p.description)}</p><a class="pdp-source-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">Originalprodukt auf landi.ch ↗</a>`;
    byId('pdpSpecs').innerHTML = renderSpecs(p);
    byId('pdpReviews').innerHTML = renderReviews(p);
    byId('pdpQuestions').innerHTML = renderQuestions(p);
    document.querySelectorAll('.pdp-accordion-panel').forEach(panel => panel.classList.remove('open'));
    document.querySelectorAll('.pdp-accordion-toggle').forEach(btn => { btn.setAttribute('aria-expanded', 'false'); btn.querySelector('span').textContent = '＋'; });

    showPage('product');
  }

  /* Initialise product controls */
  products.forEach(p => {
    byId('landiProduct').appendChild(productOption(p));
    byId('otherProduct').appendChild(productOption(p));
  });
  [...new Set(products.map(p => p.category))].sort().forEach(cat => {
    const o = document.createElement('option');
    o.value = cat; o.textContent = cat; byId('categoryFilter').appendChild(o);
  });
  renderCards(products);

  /* Global navigation */
  byId('homeLogo').addEventListener('click', () => showPage('home'));
  byId('compareNav').addEventListener('click', () => showPage('compare'));
  byId('backHome').addEventListener('click', () => showPage('home'));
  byId('accountUtilityBtn').addEventListener('click', () => showPage('account'));
  byId('cartHeaderBtn').addEventListener('click', () => toast('Warenkorb geöffnet.'));
  byId('wishlistBtn').addEventListener('click', () => toast('Merkzettel geöffnet.'));
  byId('heroProduct').addEventListener('click', () => openProduct('108065'));
  byId('searchBtn').addEventListener('click', () => { showPage('home'); filterProducts(); });
  byId('globalSearch').addEventListener('keydown', e => { if (e.key === 'Enter') { showPage('home'); filterProducts(); } });
  byId('categoryFilter').addEventListener('change', filterProducts);

  /* PDP interactions */
  byId('pdpBack').addEventListener('click', () => showPage(lastPage === 'product' ? 'home' : lastPage));
  byId('pdpQtyMinus').addEventListener('click', () => { qty = Math.max(1, qty - 1); byId('pdpQty').textContent = String(qty); });
  byId('pdpQtyPlus').addEventListener('click', () => { qty = Math.min(99, qty + 1); byId('pdpQty').textContent = String(qty); });
  byId('pdpAddCart').addEventListener('click', () => {
    if (!currentProduct) return;
    const extra = byId('pdpDisposal').checked ? Number(currentProduct.pdp?.disposalFee || 0) : 0;
    const total = currentProduct.price * qty + extra;
    toast(`${qty} × ${currentProduct.name} – ${money(total)} in den Warenkorb gelegt.`);
  });
  byId('pdpWishlist').addEventListener('click', () => toast('Produkt zum Merkzettel hinzugefügt.'));
  byId('pdpPrint').addEventListener('click', () => window.print());
  byId('pdpCompare').addEventListener('click', () => {
    if (!currentProduct) return;
    byId('landiProduct').value = currentProduct.articleNo;
    updateCompareState();
    showPage('compare');
  });
  byId('pdpDeliveryLink').addEventListener('click', e => { e.preventDefault(); document.querySelector('input[name="fulfilment"][value="delivery"]').checked = true; toast('Lieferoptionen werden später mit PLZ/Bestand verbunden.'); });
  byId('pdpPickupLink').addEventListener('click', e => { e.preventDefault(); document.querySelector('input[name="fulfilment"][value="pickup"]').checked = true; toast('Ladenauswahl wird später mit dem Standort verbunden.'); });
  document.querySelectorAll('.pdp-accordion-toggle').forEach(btn => btn.addEventListener('click', () => {
    const panel = byId(btn.dataset.target);
    const open = panel.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
    btn.querySelector('span').textContent = open ? '−' : '＋';
  }));

  /* Compare */
  let secondMode = 'landi';
  let pickerTarget = 'first';
  const pickerModal = byId('productPickerModal');
  const pickerGrid = byId('pickerProductGrid');
  const pickerSearch = byId('pickerSearch');

  function openProductPicker(target) {
    pickerTarget = target;
    byId('pickerModalTitle').textContent = target === 'first' ? 'LANDI Produkt auswählen' : 'Vergleichsprodukt auswählen';
    pickerSearch.value = '';
    renderPickerProducts(products);
    pickerModal.hidden = false;
    document.body.classList.add('modal-open');
    window.setTimeout(() => pickerSearch.focus(), 40);
  }

  function closeProductPicker() {
    pickerModal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function renderPickerProducts(list) {
    const oppositeArticle = pickerTarget === 'first' ? byId('otherProduct').value : byId('landiProduct').value;
    pickerGrid.innerHTML = list.map(p => {
      const stats = reviewStats(p);
      const disabled = p.articleNo === oppositeArticle;
      return `<button class="picker-product-card${disabled ? ' is-disabled' : ''}" type="button" data-picker-article="${escapeHtml(p.articleNo)}" ${disabled ? 'disabled' : ''}>
        <span class="picker-product-image"><img src="${escapeHtml(p.image)}" alt=""></span>
        <span class="picker-product-copy">
          <small>${escapeHtml(p.category)} · Art. ${escapeHtml(p.articleNo)}</small>
          <strong>${escapeHtml(p.name)}</strong>
          <span class="picker-product-rating">${starString(stats.average)} <b>${stats.average.toFixed(1)}</b></span>
          <span class="picker-product-price">${escapeHtml(money(p.price))}</span>
        </span>
        <span class="picker-product-action">Auswählen</span>
      </button>`;
    }).join('');
    byId('pickerResultCount').textContent = `${list.length} Produkt${list.length === 1 ? '' : 'e'}`;
  }

  pickerSearch.addEventListener('input', () => {
    const q = pickerSearch.value.trim().toLowerCase();
    renderPickerProducts(products.filter(p => !q || `${p.name} ${p.articleNo} ${p.category}`.toLowerCase().includes(q)));
  });
  pickerGrid.addEventListener('click', e => {
    const card = e.target.closest('[data-picker-article]');
    if (!card || card.disabled) return;
    const article = card.dataset.pickerArticle;
    if (pickerTarget === 'first') byId('landiProduct').value = article;
    else byId('otherProduct').value = article;
    closeProductPicker();
    updateCompareState();
  });
  document.querySelectorAll('[data-picker-close]').forEach(btn => btn.addEventListener('click', closeProductPicker));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !pickerModal.hidden) closeProductPicker();
  });
  byId('comparePanel').addEventListener('click', e => {
    const trigger = e.target.closest('[data-picker-target]');
    if (trigger) openProductPicker(trigger.dataset.pickerTarget);
  });

  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', String(t === tab));
    });
    secondMode = tab.dataset.mode;
    byId('secondLandi').style.display = secondMode === 'landi' ? 'block' : 'none';
    byId('externalFields').classList.toggle('active', secondMode === 'web');
    updateCompareState();
  }));
  ['landiProduct','otherProduct','externalName','externalUrl'].forEach(id => byId(id).addEventListener('input', updateCompareState));

  function validExternal() {
    if (secondMode !== 'web') return true;
    const name = byId('externalName').value.trim();
    const raw = byId('externalUrl').value.trim();
    if (!name || !raw) return false;
    try { const u = new URL(raw); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; }
  }

  function externalPreview() {
    const name = byId('externalName').value.trim();
    const raw = byId('externalUrl').value.trim();
    if (!name && !raw) return `
      <div class="compare-external-placeholder">
        <span>↗</span><div><strong>Produktdaten ergänzen</strong><p>Name und URL oben eintragen. Für die echte Integration werden Preis, Bilder und technische Daten später automatisch geladen.</p></div>
      </div>`;
    let host = '';
    try { host = new URL(raw).hostname.replace(/^www\./, ''); } catch {}
    const valid = validExternal();
    return `<div class="compare-external-selected ${valid ? 'is-valid' : 'is-invalid'}">
      <span class="external-status-icon">${valid ? '✓' : '!'}</span>
      <div><small>${host ? escapeHtml(host) : 'Externe Quelle'}</small><strong>${escapeHtml(name || 'Produktname fehlt')}</strong><p>${valid ? 'URL ist gültig und bereit für die spätere Datenanbindung.' : 'Bitte Produktname und eine gültige http(s)-URL ergänzen.'}</p></div>
    </div>`;
  }

  function updateCompareState() {
    const first = getProduct(byId('landiProduct').value);
    const second = secondMode === 'landi' ? getProduct(byId('otherProduct').value) : null;
    byId('firstPreview').innerHTML = compareSlotPreview(first, 'first');
    byId('secondPreview').innerHTML = secondMode === 'landi' ? compareSlotPreview(second, 'second') : externalPreview();

    const different = secondMode === 'web' || (first && second && first.articleNo !== second.articleNo);
    const ready = Boolean(first && different && (secondMode === 'landi' ? second : validExternal()));
    byId('compareBtn').disabled = !ready;
    const status = byId('compareStatus');
    status.classList.toggle('ready', ready);
    status.innerHTML = ready
      ? '<span>✓</span><div><strong>Bereit zum Vergleichen</strong><small>Produkte sind vollständig ausgewählt.</small></div>'
      : `<span>○</span><div><strong>${first ? 'Noch ein Vergleichsprodukt wählen' : 'Zwei Produkte auswählen'}</strong><small>${first ? 'Rechts LANDI oder externe Quelle ergänzen.' : 'Starten Sie mit einem LANDI Produkt auf der linken Seite.'}</small></div>`;
    byId('compareResult').classList.remove('show');
  }

  function comparisonRows(a,b) {
    const preferred = ['Antriebsart','Max. Rasenfläche','Arbeitsbreite','Schnitthöhenverstellung','Fangvolumen','Akkuspannung','Akkukapazität','Max. Akkulaufzeit','Ladezeit','Radantrieb','Gewicht Netto','Garantiedauer in Monaten'];
    const available = [...new Set([...Object.keys(a.attributes), ...Object.keys(b.attributes)])];
    const keys = [...preferred.filter(k => available.includes(k)), ...available.filter(k => !preferred.includes(k))];
    return keys.map(k => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(a.attributes[k] || '–')}</td><td>${escapeHtml(b.attributes[k] || '–')}</td></tr>`).join('');
  }

  function comparisonHero(p) {
    const stats = reviewStats(p);
    return `<div class="compare-result-product">
      <img src="${escapeHtml(p.image)}" alt="">
      <div><small>${escapeHtml(p.category)} · Art. ${escapeHtml(p.articleNo)}</small><strong>${escapeHtml(p.name)}</strong><span class="compare-result-rating">${starString(stats.average)} <b>${stats.average.toFixed(1)}</b> · ${stats.count} Demo-Rezensionen</span><span class="compare-result-price">${escapeHtml(money(p.price))}</span></div>
    </div>`;
  }

  function aiComparisonCard() {
    return `<section class="ai-comparison-card" id="aiComparisonCard" aria-labelledby="aiComparisonTitle">
      <div class="ai-comparison-head">
        <div class="ai-comparison-brand"><span class="ai-spark">✦</span><div><span>KI-Produktvergleich</span><h3 id="aiComparisonTitle">Einordnung aus Produktdaten und Rezensionen</h3></div></div>
        <div class="ai-comparison-badges"><small>LLM-generiert</small><small id="aiModelBadge" hidden></small></div>
      </div>
      <div class="ai-comparison-body is-loading" id="aiComparisonBody" aria-live="polite">
        <div class="ai-loading"><span class="ai-loader" aria-hidden="true"></span><div><strong>Vergleich wird formuliert …</strong><small>Produktdaten und Beispielrezensionen werden zusammengeführt.</small></div></div>
      </div>
      <div class="ai-comparison-note">Der Text wird serverseitig erzeugt. Grundlage sind die im Prototype hinterlegten Produktdaten und Beispielrezensionen; KI-Ausgaben können Fehler enthalten.</div>
    </section>`;
  }

  let aiComparisonController = null;

  async function loadAIComparison(first, second) {
    const body = byId('aiComparisonBody');
    const modelBadge = byId('aiModelBadge');
    if (!body) return;

    if (aiComparisonController) aiComparisonController.abort();
    aiComparisonController = new AbortController();
    const timeout = setTimeout(() => aiComparisonController.abort(), 32000);

    body.className = 'ai-comparison-body is-loading';
    body.innerHTML = `<div class="ai-loading"><span class="ai-loader" aria-hidden="true"></span><div><strong>Vergleich wird formuliert …</strong><small>Produktdaten und Beispielrezensionen werden zusammengeführt.</small></div></div>`;
    if (modelBadge) modelBadge.hidden = true;

    try {
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleA: first.articleNo, articleB: second.articleNo }),
        signal: aiComparisonController.signal
      });
      let payload = {};
      try { payload = await response.json(); } catch {}
      if (!response.ok) throw new Error(payload.error || `API-Fehler ${response.status}`);
      if (!payload.text) throw new Error('Die API hat keinen Vergleichstext geliefert.');

      body.className = 'ai-comparison-body is-ready';
      body.textContent = payload.text;
      if (modelBadge && payload.model) {
        modelBadge.textContent = payload.model;
        modelBadge.hidden = false;
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        body.className = 'ai-comparison-body is-error';
        body.innerHTML = `<div class="ai-error"><strong>Der KI-Vergleich hat zu lange gedauert.</strong><span>Bitte erneut versuchen.</span><button type="button" id="aiRetryBtn">Erneut versuchen</button></div>`;
      } else {
        body.className = 'ai-comparison-body is-error';
        body.innerHTML = `<div class="ai-error"><strong>KI-Vergleich konnte nicht geladen werden.</strong><span>${escapeHtml(error?.message || 'Unbekannter Fehler')}</span><button type="button" id="aiRetryBtn">Erneut versuchen</button></div>`;
      }
      byId('aiRetryBtn')?.addEventListener('click', () => loadAIComparison(first, second));
    } finally {
      clearTimeout(timeout);
    }
  }

  byId('compareBtn').addEventListener('click', () => {
    const first = getProduct(byId('landiProduct').value);
    if (!first) return;
    let html = '';
    if (secondMode === 'landi') {
      const second = getProduct(byId('otherProduct').value);
      if (!second) return;
      const delta = Math.abs(first.price - second.price);
      const cheaper = first.price === second.price ? null : (first.price < second.price ? first : second);
      const priceText = cheaper ? `${escapeHtml(cheaper.name)} ist ${escapeHtml(money(delta))} günstiger.` : 'Beide Produkte haben denselben Preis.';
      html = `<section class="compare-result-shell">
        <div class="compare-result-top"><div><span class="compare-eyebrow">Direktvergleich</span><h2>Die Produkte im Überblick</h2><p>${priceText} Die Rezensionstexte sind Demo-Inhalte für diesen Prototyp.</p></div><button type="button" class="result-reset-btn" id="resultResetBtn">Auswahl ändern</button></div>
        <div class="compare-result-products">${comparisonHero(first)}<div class="compare-result-vs">VS</div>${comparisonHero(second)}</div>
        <div class="compare-review-comparison">
          <article><span>Rezensions-Zusammenfassung <small>Demo</small></span><p>${escapeHtml(first.reviews?.summary || first.featureSummary)}</p></article>
          <article><span>Rezensions-Zusammenfassung <small>Demo</small></span><p>${escapeHtml(second.reviews?.summary || second.featureSummary)}</p></article>
        </div>
        ${aiComparisonCard()}
        <div class="spec-table-wrap"><table class="spec-table"><thead><tr><th>Merkmal</th><td><strong>${escapeHtml(first.name)}</strong></td><td><strong>${escapeHtml(second.name)}</strong></td></tr></thead><tbody><tr class="price-row"><th>Preis</th><td>${escapeHtml(money(first.price))}</td><td>${escapeHtml(money(second.price))}</td></tr>${comparisonRows(first, second)}</tbody></table></div>
      </section>`;
    } else {
      const name = byId('externalName').value.trim();
      const url = byId('externalUrl').value.trim();
      let host = url;
      try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
      html = `<section class="compare-result-shell"><div class="compare-result-top"><div><span class="compare-eyebrow">Externer Vergleich</span><h2>Integration ist vorbereitet</h2><p>Das LANDI Produkt ist vollständig vorhanden. Das externe Produkt wird in der späteren Integration serverseitig ausgelesen und normalisiert.</p></div><button type="button" class="result-reset-btn" id="resultResetBtn">Auswahl ändern</button></div><div class="compare-result-products external-result">${comparisonHero(first)}<div class="compare-result-vs">VS</div><div class="external-result-card"><span>↗</span><div><small>${escapeHtml(host)}</small><strong>${escapeHtml(name)}</strong><p>Preis, Bild, Spezifikationen und Rezensionen werden später automatisch ergänzt.</p></div></div></div></section>`;
    }
    byId('compareResult').innerHTML = html;
    byId('compareResult').classList.add('show');
    if (secondMode === 'landi') {
      const second = getProduct(byId('otherProduct').value);
      if (second) loadAIComparison(first, second);
    }
    byId('resultResetBtn')?.addEventListener('click', () => {
      if (aiComparisonController) aiComparisonController.abort();
      byId('compareResult').classList.remove('show');
      byId('comparePanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    byId('compareResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* Customer account + service orders */
  const purchasedArticles = ['108065','100788'];
  const purchaseList = byId('purchaseList');
  purchasedArticles.forEach((article,index) => {
    const p = getProduct(article); if (!p) return;
    const row = document.createElement('div'); row.className = 'purchase';
    row.innerHTML = `<img class="thumb" src="${escapeHtml(p.image)}" alt=""><div><strong>${escapeHtml(p.name)}</strong><small>Gekauft am ${index === 0 ? '18.05.2026' : '03.04.2026'} · Art. ${escapeHtml(p.articleNo)}</small></div><button class="ask-link" data-article="${escapeHtml(p.articleNo)}">Fragen zu meinen Produkten</button>`;
    purchaseList.appendChild(row);
  });

  const overview = byId('accountOverview');
  const purchased = byId('purchasedView');
  const qbox = byId('questionBox');
  const serviceView = byId('serviceOrdersView');
  const accountNavIds = ['overviewItem','purchasedItem','serviceOrdersItem'];

  function resetAccountViews() {
    overview.hidden = true;
    purchased.hidden = true;
    qbox.classList.remove('show');
    serviceView.hidden = true;
    accountNavIds.forEach(id => byId(id)?.classList.remove('active'));
  }
  function openPurchased() {
    resetAccountViews();
    byId('purchasedSubmenu').classList.add('open');
    byId('purchasedItem').classList.add('active');
    purchased.hidden = false;
  }
  function openServiceOrders() {
    resetAccountViews();
    byId('serviceOrdersItem').classList.add('active');
    serviceView.hidden = false;
    renderServiceOrders();
  }

  byId('purchasedItem').addEventListener('click', openPurchased);
  byId('serviceOrdersItem').addEventListener('click', openServiceOrders);
  byId('overviewItem').addEventListener('click', () => {
    resetAccountViews();
    overview.hidden = false;
    byId('overviewItem').classList.add('active');
  });
  byId('questionsSubitem').addEventListener('click', () => {
    openPurchased(); qbox.classList.add('show'); byId('questionsSubitem').classList.add('active');
  });
  purchaseList.addEventListener('click', e => {
    const btn = e.target.closest('.ask-link'); if (!btn) return;
    openPurchased(); qbox.classList.add('show');
    const p = getProduct(btn.dataset.article);
    byId('questionProductLabel').textContent = p ? `Produkt: ${p.name} · Art. ${p.articleNo}` : 'Produkt ausgewählt';
    byId('questionInput').focus();
  });
  byId('askBtn').addEventListener('click', () => {
    if (!byId('questionInput').value.trim()) { toast('Bitte zuerst eine Frage eingeben.'); return; }
    byId('qaResponse').classList.add('show');
  });

  // Populate purchased-product selectors for service.
  [byId('serviceProduct'), byId('serviceChatProduct')].forEach(select => {
    if (!select) return;
    select.innerHTML = purchasedArticles.map(article => {
      const p = getProduct(article);
      return p ? `<option value="${escapeHtml(p.articleNo)}">${escapeHtml(p.name)} · Art. ${escapeHtml(p.articleNo)}</option>` : '';
    }).join('');
  });

  const SERVICE_STORAGE_KEY = 'landi-service-orders-v8';
  function getServiceOrders() {
    try { return JSON.parse(localStorage.getItem(SERVICE_STORAGE_KEY) || '[]'); } catch { return []; }
  }
  function saveServiceOrders(orders) {
    try { localStorage.setItem(SERVICE_STORAGE_KEY, JSON.stringify(orders.slice(0, 20))); } catch {}
  }
  function renderServiceOrders() {
    const list = byId('serviceOrdersList');
    if (!list) return;
    const orders = getServiceOrders();
    if (!orders.length) {
      list.innerHTML = '<div class="service-orders-empty">Noch keine Serviceaufträge in diesem Prototype erfasst.</div>';
      return;
    }
    list.innerHTML = orders.map(order => `<div class="service-order-row"><div><strong>${escapeHtml(order.id)} · ${escapeHtml(order.productName)}</strong><span>${escapeHtml(order.issueType)}</span></div><span class="service-order-state">${escapeHtml(order.status)}</span><small>${escapeHtml(order.createdAt)} · Kontakt: ${escapeHtml(order.contact)}</small></div>`).join('');
  }
  byId('serviceOrderForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const product = getProduct(byId('serviceProduct').value);
    const issueType = byId('serviceIssueType').value;
    const description = byId('serviceDescription').value.trim();
    if (!product || !issueType || !description) { toast('Bitte alle Pflichtfelder ausfüllen.'); return; }
    const now = new Date();
    const id = `SA-${now.toISOString().slice(0,10).replaceAll('-','')}-${String(Math.floor(Math.random()*900)+100)}`;
    const contact = document.querySelector('input[name="serviceContact"]:checked')?.value || 'E-Mail';
    const order = {
      id, articleNo: product.articleNo, productName: product.name, issueType,
      description: description.slice(0,1800), contact, status: 'Neu erfasst',
      createdAt: new Intl.DateTimeFormat('de-CH', { dateStyle:'medium', timeStyle:'short' }).format(now)
    };
    const orders = getServiceOrders(); orders.unshift(order); saveServiceOrders(orders);
    renderServiceOrders();
    const created = byId('serviceCreated');
    created.hidden = false;
    created.innerHTML = `<strong>✓ Serviceauftrag ${escapeHtml(id)} erstellt.</strong><br>Im Prototype wurde der Auftrag lokal in diesem Browser gespeichert.`;
    byId('serviceDescription').value = '';
    byId('serviceIssueType').value = '';
  });

  /* Shared server-side AI chat */
  async function requestChat({ mode, message, history, articleNo }) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, message, history, articleNo })
    });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok) throw new Error(payload.error || `API-Fehler ${response.status}`);
    if (!payload.text) throw new Error('Die API hat keine Antwort geliefert.');
    return payload;
  }

  function addChatMessage(container, role, content, temporary = false) {
    const el = document.createElement('div');
    el.className = `chat-message ${role}${temporary ? ' typing' : ''}`;
    if (temporary) el.innerHTML = '<i></i><i></i><i></i>';
    else el.textContent = content;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  // Service AI chat.
  const serviceChatHistory = [];
  let lastServiceProblem = '';
  const serviceMessages = byId('serviceChatMessages');
  addChatMessage(serviceMessages, 'assistant', 'Grüezi! Wählen Sie oben das betroffene Produkt und beschreiben Sie, was nicht funktioniert. Ich helfe Ihnen beim sicheren Eingrenzen des Problems.');

  async function sendServiceChat(message) {
    const clean = String(message || '').trim(); if (!clean) return;
    const previous = serviceChatHistory.slice(-8);
    serviceChatHistory.push({ role:'user', content:clean });
    lastServiceProblem = clean;
    addChatMessage(serviceMessages, 'user', clean);
    byId('serviceChatInput').value = '';
    byId('serviceCopyToOrder').hidden = false;
    const typing = addChatMessage(serviceMessages, 'assistant', '', true);
    try {
      const payload = await requestChat({ mode:'service', message:clean, history:previous, articleNo:byId('serviceChatProduct').value });
      typing.remove(); addChatMessage(serviceMessages, 'assistant', payload.text);
      serviceChatHistory.push({ role:'assistant', content:payload.text });
    } catch (error) {
      typing.remove(); addChatMessage(serviceMessages, 'assistant', `Der KI-Serviceassistent ist gerade nicht verfügbar: ${error.message}`);
    }
  }
  byId('serviceChatForm')?.addEventListener('submit', e => { e.preventDefault(); sendServiceChat(byId('serviceChatInput').value); });
  byId('serviceChatInput')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); byId('serviceChatForm').requestSubmit(); } });
  byId('serviceChatSuggestions')?.addEventListener('click', e => { const btn=e.target.closest('button'); if(btn) sendServiceChat(btn.textContent); });
  byId('serviceCopyToOrder')?.addEventListener('click', () => {
    if (!lastServiceProblem) return;
    byId('serviceProduct').value = byId('serviceChatProduct').value;
    byId('serviceDescription').value = lastServiceProblem;
    if (!byId('serviceIssueType').value) byId('serviceIssueType').value = 'Sonstiges';
    byId('serviceDescription').focus();
    toast('Problembeschreibung übernommen.');
  });

  // Landing-page AI assistant.
  const landingChatHistory = [];
  const landingMessages = byId('landingChatMessages');
  addChatMessage(landingMessages, 'assistant', 'Grüezi! Ich helfe Ihnen bei der Produktauswahl. Sagen Sie mir zum Beispiel Ihre Rasenfläche, Ihr Budget oder was Ihnen bei einem Rasenmäher wichtig ist.');

  function openLandingChat() {
    byId('landingChatPanel').hidden = false;
    byId('landingChatLauncher').setAttribute('aria-expanded','true');
    byId('landingChatLauncher').querySelector('i').textContent = '⌄';
    setTimeout(() => byId('landingChatInput').focus(), 30);
  }
  function closeLandingChat() {
    const panel = byId('landingChatPanel');
    if (!panel) return;
    panel.hidden = true;
    byId('landingChatLauncher')?.setAttribute('aria-expanded','false');
    const caret = byId('landingChatLauncher')?.querySelector('i'); if (caret) caret.textContent = '⌃';
  }
  window.closeLandingChat = closeLandingChat;
  byId('landingChatLauncher')?.addEventListener('click', () => byId('landingChatPanel').hidden ? openLandingChat() : closeLandingChat());
  byId('landingChatClose')?.addEventListener('click', closeLandingChat);

  async function sendLandingChat(message) {
    const clean = String(message || '').trim(); if (!clean) return;
    const previous = landingChatHistory.slice(-8);
    landingChatHistory.push({ role:'user', content:clean });
    addChatMessage(landingMessages, 'user', clean);
    byId('landingChatInput').value = '';
    byId('landingChatSuggestions').style.display = 'none';
    const typing = addChatMessage(landingMessages, 'assistant', '', true);
    try {
      const payload = await requestChat({ mode:'shopping', message:clean, history:previous });
      typing.remove(); addChatMessage(landingMessages, 'assistant', payload.text);
      landingChatHistory.push({ role:'assistant', content:payload.text });
    } catch (error) {
      typing.remove(); addChatMessage(landingMessages, 'assistant', `Der LANDI Assistent ist gerade nicht verfügbar: ${error.message}`);
    }
  }
  byId('landingChatForm')?.addEventListener('submit', e => { e.preventDefault(); sendLandingChat(byId('landingChatInput').value); });
  byId('landingChatInput')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); byId('landingChatForm').requestSubmit(); } });
  byId('landingChatSuggestions')?.addEventListener('click', e => { const btn=e.target.closest('button'); if(btn) sendLandingChat(btn.textContent); });

  updateCompareState();
  const requestedProduct = new URLSearchParams(window.location.search).get('product');
  if (requestedProduct && getProduct(requestedProduct)) openProduct(requestedProduct);
})();
