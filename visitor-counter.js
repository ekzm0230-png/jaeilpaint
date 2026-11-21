/* 제일페인트 방문자 카운터
 * 푸터에 "방문 세션(참고) · 오늘 N · 누적 N"을 표시합니다.
 * - 숫자는 사람 수가 아니라 탭(세션) 한 번을 1로 세는 참고 수치입니다. 실제 방문자 수·순방문자 수가 아닙니다.
 * - 백엔드: countapi.mileshilliard.com (무료·회원가입 없음·CORS 허용, Cloudflare)
 * - 오늘 카운트: 한국 시간(Asia/Seoul) 기준 날짜별 키(jaeilpaint_gj_day_YYYYMMDD) → 매일 자정 자동으로 새로 시작
 * - 누적 카운트: jaeilpaint_gj_total 누적
 * - 한 세션(탭)당 1회만 증가(hit). 같은 세션에서 페이지를 옮기면 조회(get)만 하므로 숫자가 일관됨
 * - 증가 요청은 한 번만 보냅니다. 실패했을 때 다시 보내면 앞선 요청이 실제로 집계된 경우 중복으로 +1 되어,
 *   세션당 1회라는 기준이 깨지기 때문입니다(값은 다음 조회에서 맞춰짐).
 * - 마지막으로 확인된 값은 localStorage에 남겨, API가 느리거나 실패해도 이전 방문자에게는 숫자가 보임
 * - API 응답이 아예 없으면 아무것도 표시하지 않아 레이아웃이 깨지지 않음
 */
(function () {
  'use strict';

  var API = 'https://countapi.mileshilliard.com/api/v1/';
  var PREFIX = 'jaeilpaint_gj_';
  var TOTAL_KEY = PREFIX + 'total';
  var SESSION_KEY = 'jpvc.v1';
  var CACHE_KEY = 'jpvc.last';
  var TIMEOUT = 8000;

  var targets = [];

  function kstDay() {
    try {
      var s = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    } catch (e) { /* Intl 미지원 환경 */ }
    return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  }

  function dayKey(day) {
    return PREFIX + 'day_' + day.replace(/-/g, '');
  }

  function readJSON(store, key) {
    try {
      var raw = store.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeJSON(store, key, value) {
    try { store.setItem(key, JSON.stringify(value)); } catch (e) { /* 저장 불가 환경 */ }
  }

  function store(name) {
    try { return window[name]; } catch (e) { return null; }
  }

  function request(action, key) {
    var url = API + action + '/' + encodeURIComponent(key);
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
      var v = data && Number(data.value);
      if (typeof v !== 'number' || !isFinite(v)) throw new Error('bad payload');
      return v;
    }).catch(function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  // 조회: 오늘 아직 방문자가 없어 키가 없으면 0
  function getValue(key) {
    return request('get', key).catch(function (err) {
      if (err && err.status === 404) return 0;
      throw err;
    });
  }

  // 증가: 한 번만 요청합니다(재시도는 응답 유실 시 중복 +1을 만들 수 있어 하지 않음)
  function hitValue(key) {
    return request('hit', key);
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
      el.appendChild(document.createTextNode('방문 세션(참고)'));

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
      }

      if (hasToday) part('오늘', state.today);
      if (hasTotal) part('누적', state.total);
      el.title = '탭(방문 세션)을 한 번씩 세는 참고 수치입니다. 실제 방문자 수와 다를 수 있습니다.';
      el.hidden = false;
    });
  }

  function ensureStyle() {
    if (document.getElementById('vc-style')) return;
    var st = document.createElement('style');
    st.id = 'vc-style';
    st.textContent =
      '.vc-visitors,.site-footer p.vc-visitors,.foot p.vc-visitors{' +
      'display:block;margin:14px 0 0;padding:0;' +
      'font-size:.75rem;line-height:1.6;font-weight:500;letter-spacing:.01em;color:inherit}' +
      '.foot p.vc-visitors{margin-top:16px}' +
      '.vc-visitors b{font-weight:700;font-variant-numeric:tabular-nums}' +
      '.vc-visitors .vc-sep{margin:0 .45em;opacity:.5}' +
      '.vc-visitors[hidden]{display:none}';
    (document.head || document.documentElement).appendChild(st);
  }

  function run() {
    targets = Array.prototype.slice.call(document.querySelectorAll('[data-visitor-counter]'));
    if (!targets.length || typeof fetch !== 'function') return;
    ensureStyle();

    var sess = store('sessionStorage');
    var local = store('localStorage');
    var day = kstDay();
    var todayKey = dayKey(day);

    var cached = local ? readJSON(local, CACHE_KEY) : null;
    var saved = sess ? readJSON(sess, SESSION_KEY) : null;
    var s = (saved && saved.day === day) ? saved : { day: day, hitDay: false, hitTotal: false };

    var shown = {};
    if (cached && cached.day === day && typeof cached.today === 'number') shown.today = cached.today;
    if (cached && typeof cached.total === 'number') shown.total = cached.total;
    render(shown);

    function save() {
      s.today = shown.today;
      s.total = shown.total;
      if (sess) writeJSON(sess, SESSION_KEY, s);
      if (local && (typeof shown.today === 'number' || typeof shown.total === 'number')) {
        writeJSON(local, CACHE_KEY, {
          day: typeof shown.today === 'number' ? day : (cached && cached.day) || day,
          today: shown.today,
          total: shown.total
        });
      }
    }

    function settle(field, value) {
      shown[field] = value;
      render(shown);
      save();
    }

    // 오늘 방문자
    var dayTask = s.hitDay
      ? getValue(todayKey)
      : hitValue(todayKey).then(function (v) { s.hitDay = true; save(); return v; });
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
