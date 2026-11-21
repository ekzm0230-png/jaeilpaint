/* 제일페인트 GA4 이벤트 — 전화 상담 클릭 계측
 * - 보내는 값: 이벤트 이름 call_click, 위치(placement) 한 개뿐입니다.
 * - 이름·연락처·현장 위치·문의 내용 등 개인정보는 절대 GA4로 보내지 않습니다.
 * - placement 는 누른 전화 링크가 어느 화면 영역에 있는지를 나타내는 값입니다
 *   (예: callbar, footer, contact, store. 링크에 data-ga-placement 를 붙이면 그 값을 우선 사용).
 */
(function () {
  'use strict';

  function placementOf(a) {
    if (a.getAttribute) {
      var explicit = a.getAttribute('data-ga-placement');
      if (explicit) return explicit;
    }
    if (a.closest) {
      if (a.closest('.callbar')) return 'callbar';
      if (a.closest('.site-footer') || a.closest('.foot')) return 'footer';
      if (a.closest('.mast')) return 'nav';
    }
    var el = a;
    while (el && el !== document.body) {
      if (el.id) return el.id;
      el = el.parentElement;
    }
    return 'other';
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    var a = (target && target.closest) ? target.closest('a[href^="tel:"]') : null;
    if (!a) return;
    if (typeof window.gtag !== 'function') return;
    try {
      window.gtag('event', 'call_click', { placement: placementOf(a) });
    } catch (e) { /* 계측 실패는 전화 연결에 영향을 주지 않음 */ }
  }, true);
})();
