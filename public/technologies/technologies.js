/* Immersion Technologies — progressive enhancement only. Every page is complete
   HTML without this file; it adds the theme toggle, scroll reveal, the sector
   filter on the landing page and the screen switcher on case studies. */
(function () {
  var root = document.documentElement;
  root.classList.remove('no-js');

  /* ---------- theme toggle (initial value is set inline in <head>) ---------- */
  var themeBtn = document.getElementById('theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var cur = root.getAttribute('data-theme');
      var sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var next = cur ? (cur === 'dark' ? 'light' : 'dark') : (sysDark ? 'light' : 'dark');
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('it-theme', next); } catch (_) {}
    });
  }

  /* ---------- reveal on scroll ---------- */
  var rv = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    rv.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 6, 5) * 55 + 'ms';
      io.observe(el);
    });
  } else {
    rv.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- sector filter (landing) ---------- */
  var rail = document.getElementById('rail');
  var grid = document.getElementById('grid');
  if (rail && grid) {
    rail.hidden = false;
    var countEl = document.getElementById('count');
    rail.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      rail.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c === b)); });
      var f = b.getAttribute('data-f');
      var shown = 0;
      grid.querySelectorAll('.card').forEach(function (c) {
        var on = f === 'all' || c.getAttribute('data-sector') === f;
        c.hidden = !on;
        if (on) { shown++; c.classList.add('in'); }
      });
      if (countEl) countEl.textContent = 'Showing ' + shown;
    });
  }

  /* ---------- screen switcher (case study) ---------- */
  var thumbs = document.getElementById('thumbs');
  var stage = document.getElementById('stage');
  if (thumbs && stage) {
    var url = document.getElementById('stageUrl');
    thumbs.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      thumbs.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-current', String(x === b)); });
      var src = b.getAttribute('data-src');
      var alt = b.getAttribute('data-alt') || '';
      if (b.getAttribute('data-type') === 'video') {
        stage.innerHTML = '<video src="' + src + '" controls autoplay muted loop playsinline></video>';
      } else {
        var img = new Image();
        img.src = src;
        img.alt = alt;
        img.width = +b.getAttribute('data-w') || 0;
        img.height = +b.getAttribute('data-h') || 0;
        stage.innerHTML = '';
        stage.appendChild(img);
      }
      if (url) url.textContent = b.getAttribute('data-label') || url.textContent;
    });
  }
})();
