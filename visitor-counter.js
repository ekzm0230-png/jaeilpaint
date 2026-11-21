/* 제일페인트 방문자 카운터
 * 푸터에 "방문자 · 오늘 N명 · 총 N명"을 표시합니다.
 * - 오늘 카운트: 한국 시간(Asia/Seoul) 기준 날짜 키(day-YYYY-MM-DD) → 매일 자정 자동으로 새로 시작
 * - 총 카운트: total 키에 누적
 * - 한 세션(탭)당 1회만 증가(hit), 같은 세션에서 페이지를 옮기면 조회(get)만 함
 * - API 응답 실패 시 아무것도 표시하지 않아 레이아웃이 깨지지 않음
 */
(function () {
  'use strict';

  var API = 'https://abacus.jasoncameron.dev/';
  var NS = 'jaeilpaint-gj';
  var TOTAL_KEY = 'total';
  var DAY_PREFIX = 'day-';
  var STORE_KEY = 'jpvc.v1';
  var TIMEOUT = 8000;
  var RETRY_DELAY = 700;

  var targets = [];

  function kstDay() {
    try {
      var s = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    } catch (e) { /* Intl 미지원 환경 */ }
    var d = new Date(Date.now() + 9 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }

  function readStore() {
    try {
      var raw = window.sessionStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeStore(v) {
    try { window.sessionStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ }
  }

  function request(action, key) {
    var url = API + action + '/' + NS + '/' + key;
    var opts = { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' };
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    if (ctrl) opts.signal = ctrl.signal;

    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT);

    return fetch(url, opts).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) {
        var err = new Error('HTTP ' + res.status);
        err.status = res.status;
        throw err;
      }
      return res.json();
    }).then(function (data) {
      if (!data || typeof data.value !== 'number' || !isFinite(data.value)) throw new Error('bad payload');
      return data.value;
    }).catch(function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  // 조회: 키가 아직 없으면(오늘 첫 방문 전) 0
  function getValue(key) {
    return request('get', key).catch(function (err) {
      if (err && err.status === 404) return 0;
      throw err;
    });
  }

  // 증가: 새 키를 처음 만들 때 서버가 드물게 500을 돌려주므로 한 번만 재시도
  function hitValue(key) {
    return request('hit', key).catch(function (err) {
      if (err && (err.status === 404 || err.name === 'AbortError')) throw err;
      return new Promise(function (resolve) { setTimeout(resolve, RETRY_DELAY); }).then(function () {
        return request('hit', key);
      });
    });
  }

  function fmt(n) {
    try { return Number(n).toLocaleString('ko-KR'); } catch (e) { return String(n); }
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function render(state) {
    var hasToday = typeof state.today === 'number';
    var hasTotal = typeof state.total === 'number';
    if (!hasToday && !hasTotal) return;

    targets.forEach(function (el) {
      clear(el);
      el.appendChild(document.createTextNode('방문자'));

      function part(label, n) {
        var sep = document.createElement('span');
        sep.className = 'vc-sep';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '·';
        el.appendChild(sep);
        el.appendChild(document.createTextNode(label + ' '));
        var b = document.createElement('b');
        b.textContent = fmt(n);
        el.appendChild(b);
        el.appendChild(document.createTextNode('명'));
      }

      if (hasToday) part('오늘', state.today);
      if (hasTotal) part('총', state.total);
      el.hidden = false;
    });
  }

  function ensureStyle() {
    if (document.getElementById('vc-style')) return;
    var st = document.createElement('style');
    st.id = 'vc-style';
    st.textContent =
      '.vc-visitors{display:flex;flex-wrap:wrap;align-items:center;margin:14px 0 0;padding:0;' +
      'font-size:.75rem;line-height:1.6;font-weight:500;letter-spacing:.01em;color:inherit}' +
      '.vc-visitors b{font-weight:700;font-variant-numeric:tabular-nums}' +
      '.vc-visitors .vc-sep{margin:0 .45em;opacity:.5}' +
      '.vc-visitors[hidden]{display:none}' +
      '.foot .vc-visitors{margin-top:16px}';
    (document.head || document.documentElement).appendChild(st);
  }

  function run() {
    targets = Array.prototype.slice.call(document.querySelectorAll('[data-visitor-counter]'));
    if (!targets.length) return;
    ensureStyle();

    var day = kstDay();
    var dayKey = DAY_PREFIX + day;
    var saved = readStore();
    var s = (saved && saved.day === day) ? saved : { day: day, hitDay: false, hitTotal: false };

    var shown = {};
    if (typeof s.today === 'number') shown.today = s.today;
    if (typeof s.total === 'number') shown.total = s.total;
    render(shown);

    function save() {
      s.today = shown.today;
      s.total = shown.total;
      writeStore(s);
    }

    function settle(field, value) {
      shown[field] = value;
      render(shown);
      save();
    }

    // 오늘 방문자
    var dayTask = s.hitDay
      ? getValue(dayKey)
      : hitValue(dayKey).then(function (v) { s.hitDay = true; save(); return v; });
    dayTask.then(function (v) { settle('today', v); }, function () { /* 실패 시 표시값 유지 */ });

    // 총 방문자
    var totalTask = s.hitTotal
      ? getValue(TOTAL_KEY)
      : hitValue(TOTAL_KEY).then(function (v) { s.hitTotal = true; save(); return v; });
    totalTask.then(function (v) { settle('total', v); }, function () { /* 실패 시 표시값 유지 */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
