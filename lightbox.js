/* 시공사례 사진 확대 뷰어(라이트박스) — index.html / cases.html 공통
   .case 카드 안의 .case-media 이미지를 클릭·탭하면 같은 사례 사진들을 좌우로 넘겨 볼 수 있습니다. */
(function () {
  if (document.getElementById('caseLightbox')) return;

  var groups = [];
  var index = new WeakMap();
  var current = null;
  var lastFocus = null;
  var closeTimer = null;
  var prevPadding = '';

  var overlay = document.createElement('div');
  overlay.className = 'lb';
  overlay.id = 'caseLightbox';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', '시공사례 사진 크게 보기');
  overlay.innerHTML =
    '<button class="lb-close" type="button" aria-label="확대 사진 닫기">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
    '</button>' +
    '<figure class="lb-stage"><img class="lb-img" alt="" decoding="async"></figure>' +
    '<div class="lb-panel">' +
      '<p class="lb-title"></p>' +
      '<p class="lb-desc"></p>' +
      '<div class="lb-nav">' +
        '<button class="lb-btn lb-prev" type="button" aria-label="이전 사진">&#8249; 이전</button>' +
        '<span class="lb-count" aria-hidden="true"></span>' +
        '<button class="lb-btn lb-next" type="button" aria-label="다음 사진">다음 &#8250;</button>' +
      '</div>' +
    '</div>';

  var stage = overlay.querySelector('.lb-stage');
  var image = overlay.querySelector('.lb-img');
  var titleEl = overlay.querySelector('.lb-title');
  var descEl = overlay.querySelector('.lb-desc');
  var countEl = overlay.querySelector('.lb-count');
  var closeBtn = overlay.querySelector('.lb-close');
  var prevBtn = overlay.querySelector('.lb-prev');
  var nextBtn = overlay.querySelector('.lb-next');

  function collect() {
    groups = [];
    index = new WeakMap();
    Array.prototype.forEach.call(document.querySelectorAll('.case'), function (card) {
      var imgs = card.querySelectorAll('.case-media img');
      if (!imgs.length) return;
      var heading = card.querySelector('h3');
      var title = heading ? (heading.textContent || '').replace(/\s+/g, ' ').trim() : '';
      var group = { title: title, items: [] };
      Array.prototype.forEach.call(imgs, function (img) {
        group.items.push({
          src: img.getAttribute('src') || img.src,
          alt: (img.getAttribute('alt') || '').trim()
        });
      });
      var gi = groups.push(group) - 1;
      Array.prototype.forEach.call(imgs, function (img, ii) {
        index.set(img, { g: gi, i: ii });
        if (img.dataset.lbReady) return;
        img.dataset.lbReady = '1';
        img.setAttribute('role', 'button');
        img.setAttribute('tabindex', '0');
        if (!img.getAttribute('aria-label')) {
          img.setAttribute('aria-label', (img.getAttribute('alt') || title || '시공사례 사진') + ' — 크게 보기');
        }
        img.addEventListener('click', function () {
          var pos = index.get(img);
          if (pos) open(pos.g, pos.i, img);
        });
        img.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault();
            var pos = index.get(img);
            if (pos) open(pos.g, pos.i, img);
          }
        });
      });
    });
  }

  function render() {
    var group = groups[current.g];
    var item = group.items[current.i];
    image.src = item.src;
    image.alt = item.alt;
    titleEl.textContent = group.title;
    descEl.textContent = item.alt && item.alt !== group.title ? item.alt : '';
    countEl.textContent = (current.i + 1) + ' / ' + group.items.length;
    overlay.setAttribute('data-single', String(group.items.length < 2));

    // 이웃 사진 미리 받아 두기
    [1, -1].forEach(function (dir) {
      if (group.items.length < 2) return;
      var n = (current.i + dir + group.items.length) % group.items.length;
      if (n === current.i) return;
      var pre = new Image();
      pre.src = group.items[n].src;
    });
  }

  function open(g, i, origin) {
    if (!groups[g] || !groups[g].items.length) return;
    current = { g: g, i: i };
    lastFocus = origin || document.activeElement;
    render();
    clearTimeout(closeTimer);
    overlay.hidden = false;
    document.body.classList.add('lb-open');
    prevPadding = document.body.style.paddingRight;
    var gap = window.innerWidth - document.documentElement.clientWidth;
    if (gap > 0) document.body.style.paddingRight = gap + 'px';
    window.requestAnimationFrame(function () { overlay.classList.add('is-open'); });
    try { closeBtn.focus({ preventScroll: true }); } catch (e) { closeBtn.focus(); }
  }

  function close() {
    if (overlay.hidden) return;
    overlay.classList.remove('is-open');
    document.body.classList.remove('lb-open');
    document.body.style.paddingRight = prevPadding || '';
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      if (!overlay.classList.contains('is-open')) overlay.hidden = true;
    }, 200);
    image.removeAttribute('src');
    current = null;
    var back = lastFocus;
    lastFocus = null;
    if (back && back.focus) {
      try { back.focus({ preventScroll: true }); } catch (e) { back.focus(); }
    }
  }

  function step(direction) {
    if (!current) return;
    var group = groups[current.g];
    if (group.items.length < 2) return;
    current.i = (current.i + direction + group.items.length) % group.items.length;
    render();
  }

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', function () { step(-1); });
  nextBtn.addEventListener('click', function () { step(1); });

  overlay.addEventListener('click', function (event) {
    if (event.target === overlay || event.target === stage) close();
  });

  // 모바일 좌우 스와이프
  var startX = null, startY = null;
  stage.addEventListener('pointerdown', function (event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    startX = event.clientX; startY = event.clientY;
  });
  stage.addEventListener('pointerup', function (event) {
    if (startX === null) return;
    var dx = event.clientX - startX;
    var dy = event.clientY - startY;
    startX = null; startY = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
  });
  stage.addEventListener('pointercancel', function () { startX = null; startY = null; });

  document.addEventListener('keydown', function (event) {
    if (overlay.hidden) return;
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1); return; }
    if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); return; }
    if (event.key === 'Tab') {
      var focusable = [closeBtn];
      if (overlay.getAttribute('data-single') !== 'true') focusable.push(prevBtn, nextBtn);
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  });

  document.body.appendChild(overlay);
  collect();

  // 페이지를 떠날 때 열린 뷰어 상태를 정리합니다.
  window.addEventListener('pagehide', function () {
    if (!overlay.hidden) {
      overlay.hidden = true;
      overlay.classList.remove('is-open');
      document.body.classList.remove('lb-open');
      document.body.style.paddingRight = prevPadding || '';
    }
  });
})();
