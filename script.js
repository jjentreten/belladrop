/**
 * LADURRIE — script.js
 * Handles: header scroll, mobile drawer, cart drawer,
 *          search toggle, Swiper init, newsletter, back-to-top,
 *          quick-add cart simulation, color swatches, sub-nav mobile
 */

'use strict';

/* ── Utilities ──────────────────────────────────────────────── */
const $ = (selector, ctx = document) => ctx.querySelector(selector);
const $$ = (selector, ctx = document) => [...ctx.querySelectorAll(selector)];

function lockScroll()   { document.body.classList.add('no-scroll'); }
function unlockScroll() { document.body.classList.remove('no-scroll'); }

function trapFocus(el) {
  const focusable = el.querySelectorAll(
    'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  el.addEventListener('keydown', function handler(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

/* ── Resolve root-relative paths for pages in subdirectories ── */
const _rootPrefix = window.location.pathname.includes('/products/') ? '../' : '';

/* ── Cart state (client-side simulation) ────────────────────── */
const cart = {
  items: [],
  count: 0,

  save() {
    try { localStorage.setItem('bellario_cart', JSON.stringify(this.items)); } catch(e) {}
  },

  load() {
    try {
      const saved = localStorage.getItem('bellario_cart');
      if (saved) {
        this.items = JSON.parse(saved) || [];
        this.count = this.items.reduce((s, i) => s + i.qty, 0);
      }
    } catch(e) { this.items = []; this.count = 0; }
  },

  add(item) {
    const existing = this.items.find(i => i.id === item.id);
    if (existing) { existing.qty++; } else { this.items.push({ ...item, qty: 1 }); }
    this.count = this.items.reduce((s, i) => s + i.qty, 0);
    this.save();
    this.render();
    openCart();
  },

  remove(id) {
    this.items = this.items.filter(i => i.id !== id);
    this.count = this.items.reduce((s, i) => s + i.qty, 0);
    this.save();
    this.render();
  },

  setQty(id, qty) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    if (qty < 1) { this.remove(id); return; }
    item.qty = qty;
    this.count = this.items.reduce((s, i) => s + i.qty, 0);
    this.save();
    this.render();
  },

  fmt(n) {
    return 'R$ ' + n.toFixed(2).replace('.', ',');
  },

  getSubtotal() {
    return this.items.reduce((s, i) => s + i.price * i.qty, 0);
  },

  getDiscountRate(sub) {
    if (sub >= 299.90) return 0.20;
    if (sub >= 199.90) return 0.15;
    return 0;
  },

  renderProgress(sub) {
    const tiers = [
      { v: 149.90, label: 'Frete Grátis' },
      { v: 199.90, label: '+15% OFF'     },
      { v: 299.90, label: '+20% OFF'     },
    ];
    const next = tiers.find(t => sub < t.v);
    if (!next) {
      return `
        <div class="cart-progress">
          <p class="cart-progress__msg">Todos os benefícios desbloqueados.</p>
          <div class="cart-progress__track"><div class="cart-progress__fill" style="width:100%"></div></div>
        </div>`;
    }
    // Progress is relative to the current tier bracket
    const prevTier = tiers[tiers.indexOf(next) - 1];
    const from = prevTier ? prevTier.v : 0;
    const pct = Math.min(100, ((sub - from) / (next.v - from)) * 100).toFixed(1);
    return `
      <div class="cart-progress">
        <p class="cart-progress__msg">Faltam <strong>${this.fmt(next.v - sub)}</strong> para você ganhar <strong>${next.label}</strong></p>
        <div class="cart-progress__track"><div class="cart-progress__fill" style="width:${pct}%"></div></div>
      </div>`;
  },

  renderItem(item) {
    const esc = item.id.replace(/'/g, "\\'");
    const imgHtml = item.image
      ? `<img src="${item.image}" alt="${item.title}" class="cart-item__img" loading="lazy" width="80" height="100">`
      : `<div class="cart-item__img--placeholder"></div>`;
    const sizeRow  = item.size  ? `<p class="cart-item__variant-line">Tamanho: <strong>${item.size}</strong></p>`  : '';
    const colorRow = item.color ? `<p class="cart-item__variant-line">Cor: <strong>${item.color}</strong></p>` : '';
    const compareHtml = item.comparePrice && item.comparePrice > item.price
      ? `<span class="cart-item__price--compare">${this.fmt(item.comparePrice * item.qty)}</span>`
      : '';
    const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
    return `
      <li class="cart-item">
        ${imgHtml}
        <div class="cart-item__body">
          <div class="cart-item__header">
            <span class="cart-item__name">${item.title}</span>
            <button class="cart-item__remove" onclick="cart.remove('${esc}')" aria-label="Remover item">${trashIcon}</button>
          </div>
          ${sizeRow}${colorRow}
          <div class="cart-item__footer">
            <div class="cart-item__qty-ctrl">
              <button class="cart-item__qty-btn" onclick="cart.setQty('${esc}',${item.qty - 1})" aria-label="Diminuir">−</button>
              <span class="cart-item__qty-val">${item.qty}</span>
              <button class="cart-item__qty-btn" onclick="cart.setQty('${esc}',${item.qty + 1})" aria-label="Aumentar">+</button>
            </div>
            <div class="cart-item__prices">
              ${compareHtml}
              <span class="cart-item__price">${this.fmt(item.price * item.qty)}</span>
            </div>
          </div>
        </div>
      </li>`;
  },

  render() {
    // Update badge
    const countEl = $('#cartCount');
    if (countEl) {
      countEl.textContent = this.count;
      countEl.dataset.count = this.count;
      countEl.style.display = this.count > 0 ? '' : 'none';
    }
    // Update header title with count
    const titleEl = document.querySelector('.cart-drawer__title');
    if (titleEl) titleEl.textContent = this.count > 0 ? `CARRINHO (${this.count})` : 'CARRINHO';

    const bodyEl = $('#cartBody');
    if (!bodyEl) return;

    if (this.items.length === 0) {
      bodyEl.innerHTML = `
        <div class="cart-drawer__empty">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <p>Seu carrinho está vazio</p>
          <button class="btn btn--primary" onclick="closeCart()">Continuar comprando</button>
        </div>`;
      return;
    }

    const sub   = this.getSubtotal();
    const rate  = this.getDiscountRate(sub);
    const disc  = sub * rate;
    const total = sub - disc;
    const pixTotal = (total * 0.90).toFixed(2).replace('.', ',');
    const installment = (total / 3).toFixed(2).replace('.', ',');
    const hasFrete = sub >= 149.90;

    const discRow = rate > 0
      ? `<div class="cart-totals__row cart-totals__row--discount">
           <span>Desconto (${(rate * 100).toFixed(0)}% OFF)</span>
           <span>- ${this.fmt(disc)}</span>
         </div>` : '';
    const freteRow = hasFrete
      ? `<div class="cart-totals__row"><span>Frete</span><span>Grátis</span></div>`
      : '';

    bodyEl.innerHTML = `
      ${this.renderProgress(sub)}
      <ul class="cart-items">
        ${this.items.map(i => this.renderItem(i)).join('')}
      </ul>
      <div class="cart-footer">
        <div class="cart-totals__row cart-totals__row--subtotal">
          <span>Subtotal</span><span>${this.fmt(sub)}</span>
        </div>
        ${discRow}
        ${freteRow}
        <div class="cart-totals__row cart-totals__row--total">
          <span>Total</span>
          <div class="cart-total__right">
            <span class="cart-total__value">${this.fmt(total)}</span>
            <span class="cart-pix-note">10% OFF no PIX: R$ ${pixTotal}</span>
            <span class="cart-install-note">3x de R$ ${installment} sem juros</span>
            ${!hasFrete ? '<span class="cart-ship-note">Frete calculado na finalização.</span>' : ''}
          </div>
        </div>
        <a href="${_rootPrefix}checkout.html" class="btn btn--primary" style="width:100%;justify-content:center;display:flex;margin-top:.75rem;">
          FINALIZAR A COMPRA
        </a>
      </div>`;
  }
};

// Expose cart on window so PDP inline scripts can access it
window.cart = cart;

/* ── Header scroll ───────────────────────────────────────────── */
(function initHeaderScroll() {
  const header = $('#header');
  if (!header) return;
  let last = 0;
  const cb = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 10);
    last = y;
  };
  window.addEventListener('scroll', cb, { passive: true });
  cb();
})();

/* ── Mobile Drawer ───────────────────────────────────────────── */
const menuToggle  = $('#menuToggle');
const drawerClose = $('#drawerClose');
const drawerOverlay = $('#drawerOverlay');
const mobileDrawer  = $('#mobileDrawer');

function openDrawer() {
  if (!mobileDrawer) return;
  mobileDrawer.classList.add('is-open');
  mobileDrawer.setAttribute('aria-hidden', 'false');
  menuToggle && menuToggle.setAttribute('aria-expanded', 'true');
  lockScroll();
  trapFocus(mobileDrawer);
  drawerClose && drawerClose.focus();
}

function closeDrawer() {
  if (!mobileDrawer) return;
  mobileDrawer.classList.remove('is-open');
  mobileDrawer.setAttribute('aria-hidden', 'true');
  menuToggle && menuToggle.setAttribute('aria-expanded', 'false');
  unlockScroll();
  menuToggle && menuToggle.focus();
}

menuToggle    && menuToggle.addEventListener('click', openDrawer);
drawerClose   && drawerClose.addEventListener('click', closeDrawer);
drawerOverlay && drawerOverlay.addEventListener('click', closeDrawer);

/* Mobile sub-nav toggle */
$$('.mobile-drawer__nav-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.has-sub');
    if (!item) return;
    const expanded = item.classList.toggle('is-expanded');
    btn.setAttribute('aria-expanded', expanded);
  });
});

/* ── Cart Drawer ─────────────────────────────────────────────── */
const cartToggle  = $('#cartToggle');
const cartClose   = $('#cartClose');
const cartOverlay = $('#cartOverlay');
const cartDrawer  = $('#cartDrawer');

function openCart() {
  if (!cartDrawer) return;
  cartDrawer.classList.add('is-open');
  cartDrawer.setAttribute('aria-hidden', 'false');
  lockScroll();
  trapFocus(cartDrawer);
  cartClose && cartClose.focus();
}

function closeCart() {
  if (!cartDrawer) return;
  cartDrawer.classList.remove('is-open');
  cartDrawer.setAttribute('aria-hidden', 'true');
  unlockScroll();
  cartToggle && cartToggle.focus();
}

cartToggle  && cartToggle.addEventListener('click', openCart);
cartClose   && cartClose.addEventListener('click', closeCart);
cartOverlay && cartOverlay.addEventListener('click', closeCart);

// Expose closeCart globally (used in inline HTML)
window.closeCart = closeCart;

/* ── Search Toggle ───────────────────────────────────────────── */
const searchToggle = $('#searchToggle');
const searchClose  = $('#searchClose');
const searchBar    = $('#searchBar');

function openSearch() {
  if (!searchBar) return;
  searchBar.removeAttribute('aria-hidden');
  searchBar.setAttribute('aria-hidden', 'false');
  searchBar.classList.add('is-open');
  const input = searchBar.querySelector('input');
  input && setTimeout(() => input.focus(), 50);
}

function closeSearch() {
  if (!searchBar) return;
  searchBar.setAttribute('aria-hidden', 'true');
  searchBar.classList.remove('is-open');
  searchToggle && searchToggle.focus();
}

searchToggle && searchToggle.addEventListener('click', () => {
  const isOpen = searchBar.getAttribute('aria-hidden') === 'false';
  isOpen ? closeSearch() : openSearch();
});

searchClose && searchClose.addEventListener('click', closeSearch);

searchBar && searchBar.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSearch();
});

/* ── Escape key closes all drawers ──────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (mobileDrawer?.classList.contains('is-open')) closeDrawer();
  if (cartDrawer?.classList.contains('is-open'))   closeCart();
  if (searchBar?.getAttribute('aria-hidden') === 'false') closeSearch();
});

/* ── Quick Add ───────────────────────────────────────────────── */
$$('.product-card__quick-add').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    const card  = btn.closest('.product-card');
    const title = card?.querySelector('.product-card__title')?.textContent?.trim() ?? 'Produto';
    const priceText = card?.querySelector('.product-card__price')?.textContent ?? 'R$ 0,00';
    const price = parseFloat(priceText.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
    const id    = btn.dataset.productId || title.toLowerCase().replace(/\s+/g, '-').slice(0, 40);
    const image = card?.querySelector('.product-card__img')?.src || '';

    // Button feedback
    const original = btn.textContent;
    btn.textContent = 'Adicionado ✓';
    btn.style.background = 'rgba(37,163,54,.9)';
    setTimeout(() => {
      btn.textContent = original;
      btn.style.background = '';
    }, 1800);

    cart.add({ id, title, price, image, size: null, color: null });
  });
});

/* ── Color Swatches ──────────────────────────────────────────── */
$$('.product-card__colors').forEach(group => {
  group.addEventListener('click', e => {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;
    $$('.color-swatch', group).forEach(s => s.classList.remove('color-swatch--active'));
    swatch.classList.add('color-swatch--active');
  });
});

/* ── Hero Swiper ─────────────────────────────────────────────── */
(function initHeroSwiper() {
  if (!window.Swiper) return;
  new Swiper('#heroSwiper', {
    loop: true,
    speed: 700,
    autoplay: {
      delay: 5500,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
    },
    pagination: {
      el: '.hero__pagination',
      clickable: true,
    },
    navigation: {
      prevEl: '.hero__arrow--prev',
      nextEl: '.hero__arrow--next',
    },
    a11y: {
      prevSlideMessage: 'Slide anterior',
      nextSlideMessage: 'Próximo slide',
    },
    grabCursor: true,
  });
})();

/* ── Products installment injection ─────────────────────────── */
// Called after DOM ready; injects "12x de R$ X,XX" with 15% total interest
// into every product card inside #productsSwiper that doesn't already have one.
(function injectInstallments() {
  const TAX  = 0.15;   // 15% total
  const INST = 12;

  document.addEventListener('DOMContentLoaded', () => {
    $$('#productsSwiper .product-card').forEach(card => {
      // skip if installment already present
      if (card.querySelector('.product-card__installment')) return;

      const priceEl = card.querySelector('.product-card__price');
      if (!priceEl) return;

      // parse "R$ 1.798,90" → 1798.90
      const raw   = priceEl.textContent.replace('R$', '').trim()
                      .replace(/\./g, '').replace(',', '.');
      const price = parseFloat(raw);
      if (isNaN(price)) return;

      const total   = price * (1 + TAX);
      const per     = total / INST;
      const perFmt  = per.toFixed(2).replace('.', ',');

      const div = document.createElement('div');
      div.className = 'product-card__installment';
      div.innerHTML = `<p>ou 12x de R$ ${perFmt} c/ juros</p>`;

      // insert after .product-card__pricing
      const pricing = card.querySelector('.product-card__pricing');
      if (pricing && pricing.parentNode) {
        pricing.parentNode.insertBefore(div, pricing.nextSibling);
      }
    });
  });
})();

/* ── Products Swiper ─────────────────────────────────────────── */
(function initProductsSwiper() {
  if (!window.Swiper) return;
  new Swiper('#productsSwiper', {
    loop: false,
    speed: 500,
    slidesPerView: 2,
    spaceBetween: 12,
    breakpoints: {
      600: { slidesPerView: 3, spaceBetween: 16 },
      900: { slidesPerView: 4, spaceBetween: 20 },
      1200:{ slidesPerView: 5, spaceBetween: 20 },
    },
    pagination: {
      el: '.products-swiper__pagination',
      type: 'progressbar',
    },
    grabCursor: true,
    a11y: {
      prevSlideMessage: 'Produto anterior',
      nextSlideMessage: 'Próximo produto',
    },
  });
})();

/* ── Benefits Swiper ─────────────────────────────────────────── */
(function initBenefitsSwiper() {
  if (!window.Swiper) return;
  new Swiper('#benefitsSwiper', {
    loop: true,
    speed: 600,
    autoplay: {
      delay: 2800,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
    },
    slidesPerView: 1.2,
    spaceBetween: 12,
    centeredSlides: true,
    pagination: {
      el: '.benefits__pagination',
      clickable: true,
    },
    breakpoints: {
      480: { slidesPerView: 2,   spaceBetween: 14, centeredSlides: false },
      768: { slidesPerView: 3,   spaceBetween: 16, centeredSlides: false },
      1024:{ slidesPerView: 5,   spaceBetween: 20, centeredSlides: false },
    },
    grabCursor: true,
    a11y: {
      prevSlideMessage: 'Benefício anterior',
      nextSlideMessage: 'Próximo benefício',
    },
  });
})();

/* ── Combos Swiper ───────────────────────────────────────────── */
(function initCombosSwiper() {
  if (!window.Swiper) return;
  new Swiper('#combosSwiper', {
    loop: false,
    speed: 500,
    slidesPerView: 1.2,
    spaceBetween: 12,
    breakpoints: {
      480: { slidesPerView: 2,   spaceBetween: 14 },
      768: { slidesPerView: 3,   spaceBetween: 18 },
      1024:{ slidesPerView: 4,   spaceBetween: 20 },
    },
    navigation: {
      prevEl: '.combos-swiper__arrow--prev',
      nextEl: '.combos-swiper__arrow--next',
    },
    pagination: {
      el: '.combos-swiper__pagination',
      type: 'progressbar',
    },
    grabCursor: true,
    a11y: {
      prevSlideMessage: 'Combo anterior',
      nextSlideMessage: 'Próximo combo',
    },
  });
})();

/* ── Panties Swiper ──────────────────────────────────────────── */
(function initPantiesSwiper() {
  if (!window.Swiper) return;
  new Swiper('#pantiesSwiper', {
    loop: false,
    speed: 500,
    slidesPerView: 2.2,
    spaceBetween: 10,
    breakpoints: {
      480: { slidesPerView: 3,   spaceBetween: 12 },
      768: { slidesPerView: 4,   spaceBetween: 16 },
      1024:{ slidesPerView: 5,   spaceBetween: 20 },
      1280:{ slidesPerView: 6,   spaceBetween: 20 },
    },
    navigation: {
      prevEl: '.panties-swiper__arrow--prev',
      nextEl: '.panties-swiper__arrow--next',
    },
    pagination: {
      el: '.panties-swiper__pagination',
      type: 'progressbar',
    },
    grabCursor: true,
    a11y: {
      prevSlideMessage: 'Calcinha anterior',
      nextSlideMessage: 'Próxima calcinha',
    },
  });
})();

/* ── Testimonials Swiper ─────────────────────────────────────── */
(function initTestimonialsSwiper() {
  if (!window.Swiper) return;
  new Swiper('#testimonialsSwiper', {
    loop: true,
    speed: 600,
    autoplay: {
      delay: 6000,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
    },
    slidesPerView: 1,
    spaceBetween: 16,
    breakpoints: {
      600: { slidesPerView: 2, spaceBetween: 20 },
      900: { slidesPerView: 3, spaceBetween: 24 },
    },
    pagination: {
      el: '.testimonials__pagination',
      clickable: true,
    },
    grabCursor: true,
    a11y: {
      prevSlideMessage: 'Avaliação anterior',
      nextSlideMessage: 'Próxima avaliação',
    },
  });
})();

/* ── Newsletter form ─────────────────────────────────────────── */
(function initNewsletter() {
  const form = $('#newsletterForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const email = form.querySelector('input[type="email"]')?.value;
    if (!email) return;
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.textContent = 'Inscrito! ✓';
      btn.disabled = true;
      btn.style.opacity = '0.7';
    }
    // In production, send to Shopify Customer/Klaviyo/etc.
    console.info('[LADURRIE] Newsletter signup:', email);
  });
})();

/* ── Back to top ─────────────────────────────────────────────── */
(function initBackToTop() {
  const btn = $('#backToTop');
  if (!btn) return;
  const toggle = () => {
    const show = window.scrollY > 400;
    if (show) {
      btn.removeAttribute('hidden');
    } else {
      btn.setAttribute('hidden', '');
    }
  };
  window.addEventListener('scroll', toggle, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  toggle();
})();

/* ── Lazy images — IntersectionObserver polyfill fallback ────── */
(function initLazyImages() {
  if (!('IntersectionObserver' in window)) return;
  const imgs = $$('img[loading="lazy"]');
  // Native lazy loading handles it; this is just a safety net
  // for the hover swap on product cards
  imgs.forEach(img => {
    if (img.complete) return;
    img.addEventListener('error', () => {
      img.style.opacity = '0';
    });
  });
})();

/* ── Smooth anchor scroll ────────────────────────────────────── */
$$('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const id = link.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Close any open drawers
    if (mobileDrawer?.classList.contains('is-open')) closeDrawer();
  });
});

/* ── Bellario PDP Countdown ──────────────────────────────────── */
/*
 * Displays a "offer ends in HH:MM:SS" strip only on Bellario line
 * product pages. Detection uses the existing .pdp-brand element whose
 * text content is "BELLARIO". No HTML changes required on product files.
 *
 * The timer always counts down to local midnight and automatically
 * resets into the next cycle — no page reload needed.
 */
function initBellarioCountdown() {
  // ── Guard: only Bellario line products ──────────────────────
  const brandEl = document.querySelector('.pdp-brand');
  if (!brandEl || brandEl.textContent.trim() !== 'BELLARIO') return;

  // ── Guard: needs gallery anchor points ──────────────────────
  const galleryMain   = document.getElementById('galleryMain');
  const galleryThumbs = document.getElementById('galleryThumbs');
  if (!galleryMain || !galleryThumbs) return;

  // ── Build strip ─────────────────────────────────────────────
  const strip = document.createElement('div');
  strip.className = 'product-countdown';
  strip.setAttribute('role', 'timer');
  strip.setAttribute('aria-live', 'off');          // avoid noisy screen-reader updates
  strip.setAttribute('aria-label', 'Contagem regressiva da oferta');
  strip.innerHTML =
    '<span class="product-countdown__label">Essa oferta acaba em</span>' +
    '<span class="product-countdown__sep" aria-hidden="true"></span>' +
    '<span class="product-countdown__timer" id="pdpCountdownTimer" aria-hidden="true">--:--:--</span>';

  // Insert below gallery, above the brand/title block
  const pdpGallery = galleryMain.closest('.pdp-gallery');
  pdpGallery.insertAdjacentElement('afterend', strip);

  const timerEl = document.getElementById('pdpCountdownTimer');
  const pad = n => String(n).padStart(2, '0');

  function tick() {
    const now      = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);             // next midnight in local time
    const diff = midnight - now;                  // ms remaining

    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000)    / 1_000);

    timerEl.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  tick();                          // render immediately — no 1 s blank flash
  setInterval(tick, 1_000);
}

/* ── Init ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Restore cart from localStorage then render
  cart.load();
  cart.render();
  initBellarioCountdown();
  console.info('[LADURRIE] Scripts loaded.');
});
