// Shared behaviour for all locales.
// Each page defines window.I18N before loading this file (strings + money format).

(function () {
  var I18N = window.I18N || {};

  // ---------- Tabs ----------
  var tabBtns = document.querySelectorAll('.tab-btn');
  var panels = document.querySelectorAll('.panel');
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      panels.forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      window.scrollTo({ top: 0 });
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
