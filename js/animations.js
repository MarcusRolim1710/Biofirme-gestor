(function (global) {
  'use strict';

  // Aguarda GSAP carregar; se não existir, sai sem quebrar
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  // Helpers de acessibilidade
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function withGsap(fn) {
    if (typeof gsap === 'undefined') return;
    if (prefersReducedMotion()) return;
    fn();
  }

  // Configuração global GSAP
  function configureGsap() {
    if (typeof gsap === 'undefined') return;
    gsap.defaults({ duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
    // Não pausar globalTimeline — apenas respeitar prefers-reduced-motion nos helpers
    // matchMedia apenas para garantir revert automático se preferência mudar (GSAP interno limpa)
  }

  // ================= LOGIN =================
  function initLogin() {
    withGsap(function () {
      var card = document.querySelector('.login-card');
      var emblemText = document.querySelector('.emblem-text');
      var emblemLines = document.querySelectorAll('.emblem-line');
      var subtitle = document.querySelector('.login-subtitle');
      var fields = document.querySelectorAll('.login-form .field');
      var btn = document.querySelector('.login-form .btn-primary');
      var footer = document.querySelector('.login-footer');
      var ruler = document.querySelector('.login-ruler');

      if (!card) return;

      // Evita flash: set inicial
      gsap.set([card, emblemText, subtitle, footer, ruler, btn], { clearProps: 'all' });

      var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from(card, { y: 24, autoAlpha: 0, duration: 0.8, ease: 'power3.out' }, 0)
        .from(emblemLines, { scaleX: 0, transformOrigin: 'center center', duration: 0.6, stagger: 0.08, ease: 'power2.out' }, 0.15)
        .from(emblemText, { y: 10, autoAlpha: 0, duration: 0.5 }, 0.2)
        .from(subtitle, { y: 8, autoAlpha: 0, duration: 0.4 }, 0.35)
        .from(fields, { y: 12, autoAlpha: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }, 0.4)
        .from(btn, { y: 10, autoAlpha: 0, duration: 0.4 }, 0.7)
        .from(footer, { autoAlpha: 0, duration: 0.4 }, 0.8)
        .from(ruler, { scaleX: 0, transformOrigin: 'center', duration: 0.6, ease: 'power2.inOut' }, 0.75);

      // Micro-interação botão login: leve lift no hover via transform (performático)
      if (btn) {
        btn.style.willChange = 'transform';
        btn.addEventListener('mouseenter', function () {
          gsap.to(btn, { y: -1, scale: 1.01, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
        });
        btn.addEventListener('mouseleave', function () {
          gsap.to(btn, { y: 0, scale: 1, duration: 0.25, ease: 'power2.out' });
        });
        btn.addEventListener('mousedown', function () {
          gsap.to(btn, { scale: 0.98, duration: 0.1 });
        });
        btn.addEventListener('mouseup', function () {
          gsap.to(btn, { scale: 1.01, duration: 0.15 });
        });
      }

      // Focus field bounce sutil (usa x/y apenas)
      fields.forEach(function (field) {
        var input = field.querySelector('input');
        if (!input) return;
        input.addEventListener('focus', function () {
          gsap.to(field, { y: -1, duration: 0.2, ease: 'power2.out' });
        });
        input.addEventListener('blur', function () {
          gsap.to(field, { y: 0, duration: 0.2 });
        });
      });
    });

    // Fallback se reduced motion: garante visibilidade de TODOS os alvos do login
    if (prefersReducedMotion() && typeof gsap !== 'undefined') {
      gsap.set('.login-card, .login-form .field, .login-form .btn-primary, .login-subtitle, .emblem-text, .login-footer, .login-ruler, .emblem-line', { clearProps: 'all', autoAlpha: 1, x: 0, y: 0, scale: 1, scaleX: 1 });
    }
    // Safety: se GSAP falhar ou timeline pausar, força visibilidade após 800ms
    setTimeout(function(){
      var btn = document.querySelector('.login-form .btn-primary');
      if (btn && (btn.style.visibility === 'hidden' || getComputedStyle(btn).opacity === '0')) {
        if (typeof gsap !== 'undefined') gsap.set(btn, { autoAlpha: 1, clearProps: 'transform,visibility' });
        else { btn.style.visibility = 'visible'; btn.style.opacity = '1'; }
      }
      var card = document.querySelector('.login-card');
      if (card && getComputedStyle(card).opacity === '0') {
        if (typeof gsap !== 'undefined') gsap.set(card, { autoAlpha: 1 });
        else card.style.opacity = '1';
      }
    }, 900);
  }

  function shakeLoginCard() {
    if (prefersReducedMotion()) return;
    if (typeof gsap === 'undefined') return;
    var card = document.querySelector('.login-card');
    if (!card) return;
    // Kill tweens anteriores de x
    gsap.killTweensOf(card);
    var tl = gsap.timeline();
    tl.to(card, { x: -8, duration: 0.08, ease: 'power2.inOut' })
      .to(card, { x: 8, duration: 0.08 })
      .to(card, { x: -6, duration: 0.08 })
      .to(card, { x: 6, duration: 0.08 })
      .to(card, { x: -3, duration: 0.08 })
      .to(card, { x: 0, duration: 0.12, ease: 'power2.out' });
    // Também pulsa borda
    gsap.fromTo(card, { borderColor: 'var(--color-danger)' }, { borderColor: 'var(--color-gold-light)', duration: 0.6, ease: 'power2.out' });
  }

  function loginButtonLoading(isLoading) {
    if (typeof gsap === 'undefined') return;
    var btn = document.querySelector('#loginForm .btn-primary');
    if (!btn) return;
    if (prefersReducedMotion()) {
      btn.disabled = isLoading;
      btn.textContent = isLoading ? 'Entrando...' : 'Entrar';
      return;
    }
    if (isLoading) {
      btn.dataset.originalText = btn.textContent;
      gsap.to(btn, { scale: 0.98, duration: 0.15 });
      btn.disabled = true;
      // Loading pulse contínuo no botão
      gsap.to(btn, { autoAlpha: 0.85, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      btn.textContent = 'Entrando...';
    } else {
      gsap.killTweensOf(btn);
      gsap.to(btn, { autoAlpha: 1, scale: 1, duration: 0.2, clearProps: 'autoAlpha' });
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || 'Entrar';
    }
  }

  // ================= DASHBOARD =================
  function initDashboard() {
    withGsap(function () {
      var header = document.querySelector('.app-header');
      var pageHeader = document.querySelector('.page-header');
      var pageTitle = document.querySelector('.page-title-group h1');
      var pageSub = document.querySelector('.page-title-group p');
      var pageBtn = document.querySelector('.page-actions .btn-primary');
      var cards = document.querySelectorAll('.dashboard-grid .card');
      var statItems = document.querySelectorAll('.stat-item');
      var filters = document.querySelector('.filters');
      var tableWrap = document.querySelector('.table-wrap');

      // Will-change hint apenas durante animação
      function tempWillChange(els) {
        els.forEach(function (el) { if (el) el.style.willChange = 'transform, opacity'; });
        setTimeout(function () { els.forEach(function (el) { if (el) el.style.willChange = 'auto'; }); }, 1200);
      }

      var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      if (header) {
        tl.from(header, { y: -16, autoAlpha: 0, duration: 0.6 }, 0);
      }
      if (pageHeader) {
        tl.from([pageTitle, pageSub], { y: 12, autoAlpha: 0, duration: 0.45, stagger: 0.08 }, 0.25);
        if (pageBtn) tl.from(pageBtn, { y: 10, scale: 0.98, autoAlpha: 0, duration: 0.4 }, 0.35);
      }
      if (cards.length) {
        tempWillChange(Array.from(cards));
        tl.from(cards, { y: 18, autoAlpha: 0, duration: 0.6, stagger: 0.09, ease: 'power2.out' }, 0.4);
      }
      if (filters) tl.from(filters, { y: 8, autoAlpha: 0, duration: 0.35 }, 0.55);
      if (tableWrap) tl.from(tableWrap, { y: 10, autoAlpha: 0, duration: 0.4 }, 0.6);
      if (statItems.length) {
        tempWillChange(Array.from(statItems));
        tl.from(statItems, { y: 10, autoAlpha: 0, scale: 0.98, duration: 0.45, stagger: 0.06, ease: 'back.out(1.2)' }, 0.65);
      }

      // Hover micro-interação: header nav link underline dourado já CSS, complementa com y
      document.querySelectorAll('.nav-link').forEach(function (link) {
        link.addEventListener('mouseenter', function () {
          gsap.to(link, { y: -1, duration: 0.18, ease: 'power2.out' });
        });
        link.addEventListener('mouseleave', function () {
          gsap.to(link, { y: 0, duration: 0.2 });
        });
      });

      // Botões: hover lift performático (transform)
      document.querySelectorAll('.btn-primary, .btn-secondary').forEach(function (btn) {
        btn.style.willChange = 'transform';
        btn.addEventListener('mouseenter', function () {
          if (btn.classList.contains('btn-primary')) {
            gsap.to(btn, { y: -1, scale: 1.015, duration: 0.18, ease: 'power2.out' });
          } else {
            gsap.to(btn, { y: -1, duration: 0.18 });
          }
        });
        btn.addEventListener('mouseleave', function () {
          gsap.to(btn, { y: 0, scale: 1, duration: 0.2, ease: 'power2.out' });
        });
      });

    });
    // Fallback + safety fora do withGsap para cobrir prefers-reduced-motion e CDN falho
    if (prefersReducedMotion() && typeof gsap !== 'undefined') {
      gsap.set('.app-header, .page-title-group h1, .page-title-group p, .page-actions .btn-primary, .dashboard-grid .card, .stat-item, .filters, .table-wrap', { clearProps: 'all', autoAlpha: 1, x: 0, y: 0, scale: 1 });
    }
    setTimeout(function(){
      var toFix = document.querySelectorAll('.app-header, .page-title-group h1, .page-title-group p, .page-actions .btn-primary, .dashboard-grid .card, .stat-item, .filters, .table-wrap');
      var needsFix = false;
      toFix.forEach(function(el){ if(el && getComputedStyle(el).opacity === '0') needsFix = true; });
      if (needsFix) {
        if (typeof gsap !== 'undefined') gsap.set(toFix, { autoAlpha: 1, y: 0, x: 0, scale: 1, clearProps: 'transform,visibility' });
        else toFix.forEach(function(el){ el.style.opacity='1'; el.style.visibility='visible'; });
      }
    }, 1000);
  }
  }

  function animateTableRows() {
    withGsap(function () {
      var rows = document.querySelectorAll('#employeeList tr');
      if (!rows.length) return;
      // Filtra apenas rows com dados (não empty-state sem botão?)
      var dataRows = Array.from(rows).filter(function (r) { return !r.querySelector('.empty-state'); });
      if (!dataRows.length) return;
      dataRows.forEach(function (r) { r.style.willChange = 'transform, opacity'; });
      gsap.from(dataRows, {
        y: 10,
        autoAlpha: 0,
        duration: 0.45,
        stagger: { each: 0.04, from: 'start' },
        ease: 'power2.out',
        clearProps: 'transform,opacity,visibility',
        onComplete: function () { dataRows.forEach(function (r) { r.style.willChange = 'auto'; }); }
      });
      // Anima badges com micro pop
      var badges = document.querySelectorAll('#employeeList .status-badge, #employeeList .vinculo-badge');
      if (badges.length) {
        gsap.from(badges, { scale: 0.9, autoAlpha: 0, duration: 0.3, stagger: 0.02, delay: 0.15, ease: 'back.out(1.5)' });
      }
    });
  }

  function animateStatCount() {
    if (prefersReducedMotion() || typeof gsap === 'undefined') return;
    var els = document.querySelectorAll('.stat-value');
    els.forEach(function (el) {
      var target = parseInt((el.textContent || '0').replace(/\D/g, ''), 10) || 0;
      if (target === 0) return;
      var obj = { val: 0 };
      gsap.killTweensOf(obj);
      gsap.to(obj, {
        val: target,
        duration: 0.7,
        ease: 'power2.out',
        snap: { val: 1 },
        onUpdate: function () { el.textContent = Math.round(obj.val); }
      });
      // Pop do card
      gsap.fromTo(el, { scale: 0.96 }, { scale: 1, duration: 0.35, ease: 'back.out(1.2)' });
    });
  }

  function animateDetailSwitch() {
    withGsap(function () {
      var box = document.getElementById('detailContent');
      if (!box) return;
      box.style.willChange = 'transform, opacity';
      // Se já animando, mata anterior
      gsap.killTweensOf(box);
      gsap.fromTo(box,
        { y: 8, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.35, ease: 'power2.out', clearProps: 'transform,opacity,visibility',
          onComplete: function () { box.style.willChange = 'auto'; } }
      );
      // Avatar pop
      var avatar = box.querySelector('.detail-avatar, img');
      if (avatar) gsap.from(avatar, { scale: 0.88, duration: 0.3, ease: 'back.out(1.7)' });
    });
  }

  function animateFiltersFocus() {
    withGsap(function () {
      var inputs = document.querySelectorAll('.filter-input, .filter-select, #searchInput');
      inputs.forEach(function (inp) {
        inp.addEventListener('focus', function () {
          gsap.to(inp, { y: -1, duration: 0.18, ease: 'power2.out' });
        });
        inp.addEventListener('blur', function () {
          gsap.to(inp, { y: 0, duration: 0.2 });
        });
      });
    });
  }

  // ================= MODAIS (timeline com controle) =================
  // Armazena timelines por modal para poder fazer reverse
  var modalTimelines = {};

  function openModalAnimated(modalEl) {
    if (!modalEl) return;
    if (prefersReducedMotion() || typeof gsap === 'undefined') {
      modalEl.classList.add('active');
      return;
    }
    var card = modalEl.querySelector('.modal-card');
    if (!card) { modalEl.classList.add('active'); return; }

    // Mata timeline anterior
    if (modalTimelines[modalEl.id]) modalTimelines[modalEl.id].kill();
    gsap.killTweensOf([modalEl, card]);

    modalEl.style.display = 'flex';
    // Garante display antes de animar
    modalEl.classList.add('active');
    // Parte de backdrop invisível para animar
    gsap.set(modalEl, { autoAlpha: 0 });
    gsap.set(card, { y: 18, scale: 0.98, autoAlpha: 0 });

    card.style.willChange = 'transform, opacity';
    modalEl.style.willChange = 'opacity';

    var tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: function () {
      card.style.willChange = 'auto';
      modalEl.style.willChange = 'auto';
      gsap.set([modalEl, card], { clearProps: 'transform,opacity,visibility' });
    }});
    tl.to(modalEl, { autoAlpha: 1, duration: 0.28, ease: 'power2.out' }, 0)
      .to(card, { y: 0, scale: 1, autoAlpha: 1, duration: 0.45, ease: 'power3.out' }, 0.08)
      // Stagger dos campos internos
      .from(card.querySelectorAll('.field, .form-grid, .modal-header'), { y: 8, autoAlpha: 0, duration: 0.3, stagger: 0.02, ease: 'power2.out', clearProps: 'all' }, 0.18);

    modalTimelines[modalEl.id] = tl;
  }

  function closeModalAnimated(modalEl, onDone) {
    if (!modalEl) { if (onDone) onDone(); return; }
    if (prefersReducedMotion() || typeof gsap === 'undefined') {
      modalEl.classList.remove('active');
      if (onDone) onDone();
      return;
    }
    var card = modalEl.querySelector('.modal-card');
    if (!card) { modalEl.classList.remove('active'); if (onDone) onDone(); return; }

    if (modalTimelines[modalEl.id]) modalTimelines[modalEl.id].kill();
    card.style.willChange = 'transform, opacity';
    var tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, onComplete: function () {
      modalEl.classList.remove('active');
      modalEl.style.display = '';
      gsap.set([modalEl, card], { clearProps: 'all' });
      card.style.willChange = 'auto';
      if (onDone) onDone();
    }});
    tl.to(card, { y: 10, scale: 0.98, autoAlpha: 0, duration: 0.22 }, 0)
      .to(modalEl, { autoAlpha: 0, duration: 0.2 }, 0.08);
    modalTimelines[modalEl.id] = tl;
  }

  // Foto preview pop
  function popFotoPreview() {
    withGsap(function () {
      var wrap = document.getElementById('fotoPreviewWrap');
      if (!wrap) return;
      wrap.style.willChange = 'transform';
      gsap.fromTo(wrap, { scale: 0.9 }, { scale: 1, duration: 0.35, ease: 'back.out(1.6)', clearProps: 'transform', onComplete: function () { wrap.style.willChange = 'auto'; } });
    });
  }

  // Row selection highlight: anima o inset shadow
  function animateRowSelection(rowEl) {
    withGsap(function () {
      if (!rowEl) return;
      rowEl.style.willChange = 'transform';
      gsap.fromTo(rowEl, { x: 4 }, { x: 0, duration: 0.3, ease: 'power2.out', clearProps: 'transform', onComplete: function () { rowEl.style.willChange = 'auto'; } });
    });
  }

  // Expor API global
  global.BiofirmAnimations = {
    initLogin: initLogin,
    shakeLoginCard: shakeLoginCard,
    loginButtonLoading: loginButtonLoading,
    initDashboard: initDashboard,
    animateTableRows: animateTableRows,
    animateStatCount: animateStatCount,
    animateDetailSwitch: animateDetailSwitch,
    animateFiltersFocus: animateFiltersFocus,
    openModalAnimated: openModalAnimated,
    closeModalAnimated: closeModalAnimated,
    popFotoPreview: popFotoPreview,
    animateRowSelection: animateRowSelection,
    prefersReducedMotion: prefersReducedMotion
  };

  ready(function () {
    configureGsap();
    // Auto-init baseado na página
    if (document.body.classList.contains('login-body') || document.getElementById('loginForm')) {
      initLogin();
    }
    if (document.querySelector('.app-header') || document.getElementById('employeeList')) {
      // Dashboard auto init aguarda um tick para DOM estar estável
      setTimeout(function () { initDashboard(); animateFiltersFocus(); }, 50);
    }
  });

})(window);
