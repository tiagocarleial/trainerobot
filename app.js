// Shared behaviour for all locales.
// Each page defines window.I18N before loading this file (strings + money format).

(function () {
  var I18N = window.I18N || {};

  // ---------- Tabs ----------
  var tabBtns = document.querySelectorAll('.tab-btn');
  var panels = document.querySelectorAll('.panel');

  function showTab(name) {
    tabBtns.forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    panels.forEach(function (p) { p.classList.toggle('active', p.id === name); });
    window.scrollTo({ top: 0 });
  }

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { showTab(btn.dataset.tab); });
  });

  // In-page links that jump to another tab: <a data-goto="tarefas">
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-goto]');
    if (!a) return;
    e.preventDefault();
    showTab(a.dataset.goto);
  });

  // ---------- Platform card expand ----------
  document.querySelectorAll('.plat').forEach(function (plat) {
    var head = plat.querySelector('.plat-head');
    var label = plat.querySelector('.expand-label');
    if (!head) return;
    var toggle = function () {
      var open = plat.classList.toggle('open');
      head.setAttribute('aria-expanded', String(open));
      if (label) label.textContent = open ? (I18N.close || 'Fechar') : (I18N.details || 'Ver detalhes');
    };
    head.addEventListener('click', function (e) {
      if (e.target.closest('a')) return; // let links inside the header work
      toggle();
    });
    head.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });

  // ---------- Tasks filter (markup is pre-rendered in the HTML for SEO) ----------
  var taskEls = [].slice.call(document.querySelectorAll('#task-list .task'));
  var countEl = document.getElementById('task-count');
  var searchEl = document.getElementById('task-search');
  var noResultsEl = document.getElementById('no-results');
  var activeCat = 'all';

  function renderTasks() {
    var q = searchEl.value.trim().toLowerCase();
    var shown = 0;
    taskEls.forEach(function (el) {
      var match = (activeCat === 'all' || el.dataset.cat === activeCat) &&
                  (!q || el.dataset.s.indexOf(q) !== -1);
      el.hidden = !match;
      if (match) shown++;
    });
    countEl.textContent = shown + ' ' + (shown === 1 ? I18N.taskOne : I18N.taskMany);
    noResultsEl.hidden = shown > 0;
  }

  if (taskEls.length) {
    document.getElementById('filters').addEventListener('click', function (e) {
      if (!e.target.classList.contains('chip')) return;
      document.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
      e.target.classList.add('active');
      activeCat = e.target.dataset.cat;
      renderTasks();
    });
    searchEl.addEventListener('input', renderTasks);
    renderTasks();
  }

  // ---------- Referral calculator ----------
  var WEEKS = 4.33;
  var rd = document.getElementById('r-directs'),
      rh = document.getElementById('r-hours'),
      rl = document.getElementById('r-l2');

  if (rd && rh && rl) {
    var money = new Intl.NumberFormat(I18N.locale, {
      style: 'currency',
      currency: I18N.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    var calc = function () {
      var d = +rd.value, h = +rh.value, l2 = +rl.value;
      document.getElementById('v-directs').textContent = d;
      document.getElementById('v-hours').textContent = h;
      document.getElementById('v-l2').textContent = l2;
      var monthly = d * h * WEEKS * I18N.rateL1 + d * l2 * h * WEEKS * I18N.rateL2;
      document.getElementById('calc-total').textContent = money.format(monthly);
    };
    [rd, rh, rl].forEach(function (r) { r.addEventListener('input', calc); });
    calc();
  }

  // ---------- Earnings estimator ----------
  var slider = document.getElementById('hours-slider');
  var est = I18N.est;

  if (slider && est) {
    var DAYS = 30;
    var SYM = { USD: 'US$', BRL: 'R$' };
    var mode = est.startCurrency || 'USD';
    var curBtn = document.getElementById('currency-toggle');

    var nf = new Intl.NumberFormat(I18N.locale, { maximumFractionDigits: 0 });

    // Converts between the two currencies the estimator knows about.
    var convert = function (amount, from, to) {
      if (from === to) return amount;
      return from === 'USD' ? amount * est.exchangeRate : amount / est.exchangeRate;
    };

    var tabsEl = document.getElementById('est-tabs');
    var current = est.platforms[0];

    var renderTabs = function () {
      tabsEl.innerHTML = est.platforms.map(function (p) {
        return '<button type="button" class="est-tab' + (p === current ? ' active' : '') +
               '" data-plat="' + p.id + '"><span class="dot">' + p.initial + '</span>' + p.name + '</button>';
      }).join('');
    };

    var renderReview = function () {
      document.getElementById('est-review').innerHTML =
        '<div class="est-highlight">' + est.highlightLabel + ': ' + current.highlight + '</div>' +
        '<div class="rev-block" style="margin-bottom:0">' +
        '<div class="rev-col pros"><div class="rev-col-title pros">' + est.prosLabel + '</div><ul>' +
        current.pros.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div>' +
        '<div class="rev-col cons"><div class="rev-col-title cons">' + est.consLabel + '</div><ul>' +
        current.cons.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div></div>';
    };

    var render = function () {
      var h = parseFloat(slider.value);
      var monthlyHours = h * DAYS;
      var sym = SYM[mode];
      var rate = Math.round(convert(current.rate, current.rateCurrency, mode));
      var base = h * rate * DAYS;

      var hit = [], locked = [];
      (current.bonuses || []).forEach(function (b) {
        var amount = Math.round(convert(b.amount, current.bonusCurrency, mode));
        (monthlyHours >= b.threshold ? hit : locked).push({ milestone: b.milestone, amount: amount });
      });
      var bonusSum = hit.reduce(function (s, b) { return s + b.amount; }, 0);

      document.getElementById('hours-display').textContent = h + est.hoursSuffix;
      document.getElementById('est-platform-name').textContent = current.name;
      document.getElementById('total-amount').innerHTML =
        sym + ' ' + nf.format(base + bonusSum) + '<span class="per"> ' + est.perMonth + '</span>';
      if (curBtn && !est.noToggle) curBtn.textContent = mode === 'USD' ? est.toBRL : est.toUSD;

      document.getElementById('est-footnote').textContent =
        bonusSum > 0 ? est.footWithBonus(sym, nf.format(bonusSum))
                     : ((current.bonuses || []).length ? est.footNoBonus : est.footNoBonusAtAll);

      var html = '<div class="brk-row"><span class="brk-label">' + est.recLabel(h, rate, sym) +
                 '</span><span class="brk-val">' + sym + ' ' + nf.format(base) + '</span></div>';
      hit.forEach(function (b) {
        html += '<div class="brk-row"><span class="brk-label">' + est.bonusHit(b.milestone) +
                '</span><span class="brk-val plus">+ ' + sym + ' ' + nf.format(b.amount) + '</span></div>';
      });
      if (locked.length) {
        html += '<div class="brk-head">' + est.nextMilestones + '</div>';
        locked.slice(0, 6).forEach(function (b) {
          html += '<div class="brk-row brk-locked"><span class="brk-label">' + est.bonusLocked(b.milestone) +
                  '</span><span class="brk-val">' + sym + ' ' + nf.format(b.amount) + '</span></div>';
        });
      }
      if (!(current.bonuses || []).length) {
        html += '<div class="brk-row"><span class="brk-label" style="color:var(--muted)">' +
                est.footNoBonusAtAll + '</span></div>';
      }
      document.getElementById('earnings-breakdown').innerHTML = html;
    };

    var renderAll = function () { renderTabs(); renderReview(); render(); };

    tabsEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.est-tab');
      if (!btn) return;
      est.platforms.forEach(function (p) { if (p.id === btn.dataset.plat) current = p; });
      renderAll();
    });

    slider.addEventListener('input', render);
    if (curBtn && !est.noToggle) {
      curBtn.hidden = false;
      curBtn.addEventListener('click', function () {
        mode = mode === 'USD' ? 'BRL' : 'USD';
        render();
      });
    }
    renderAll();
  }

  // ---------- Copy link ----------
  var copyBtn = document.getElementById('copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var input = document.getElementById('ref-link');
      var done = function () {
        copyBtn.textContent = I18N.copied;
        setTimeout(function () { copyBtn.textContent = I18N.copy; }, 2000);
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(input.value).then(done, function () {
          input.select();
          document.execCommand('copy');
          done();
        });
      } else {
        input.select();
        document.execCommand('copy');
        done();
      }
    });
  }

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---------- Analytics events ----------
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a || typeof gtag !== 'function') return;
    if (a.href.indexOf('ai.hub.xyz') !== -1) {
      gtag('event', 'referral_click', {
        link_url: a.href,
        link_text: a.textContent.trim(),
        page_language: I18N.lang
      });
      // Google Ads conversion — there is no thank-you page (signup happens on Hub),
      // so leaving via the referral link is the conversion event.
      gtag('event', 'conversion', { send_to: 'AW-945891303/CCu5COi-1NIcEOfPhMMD' });
    } else if (a.href.indexOf('chat.whatsapp.com') !== -1) {
      gtag('event', 'whatsapp_click', { link_url: a.href, page_language: I18N.lang });
    }
  });

  // ---------- Example videos: load and play only when on screen ----------
  var vids = document.querySelectorAll('[data-videos] video');
  if (!vids.length) return;

  // Anyone asking for reduced motion gets controls instead of autoplay.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    vids.forEach(function (v) { v.controls = true; v.preload = 'metadata'; });
    return;
  }
  if (!('IntersectionObserver' in window)) {
    vids.forEach(function (v) { v.controls = true; });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        var p = v.play();
        // Safari/iOS in low-power mode refuses play: fall back to controls.
        if (p && p.catch) p.catch(function () { v.controls = true; });
      } else {
        v.pause();
      }
    });
  }, { threshold: 0.4 });

  vids.forEach(function (v) { io.observe(v); });
})();
