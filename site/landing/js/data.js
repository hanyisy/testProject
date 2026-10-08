/* 랜딩 데이터 읽기 — config.js 다음, landing.js 앞에 불러옵니다.
 * JSON 파일이든 서버 응답이든 같은 모양이면 그대로 씁니다. (항목 설명: site/data/README.md)
 * 랜딩 값이 있는 자리만 채우고, 없으면 빈칸 + "실제 값 입력" 표시를 그대로 둡니다. */
(function () {
  'use strict';
  var C = window.HL_CONFIG || { data: {} };
  var HL = window.HL = window.HL || {};

  /* 주소에서 JSON을 읽어 { data, base }로 돌려줌. base는 응답 안 상대 주소(이미지 등)를 풀 때 기준 */
  HL.getJSON = function (url) {
    if (!url) return Promise.reject(new Error('no url'));
    var base = new URL(url, location.href).href;
    return fetch(base, { cache: 'no-cache', headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { return { data: data, base: base }; });
  };

  var pick = function (obj, key) {
    return key.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  };
  var isEmpty = function (v) { return v === null || v === undefined || String(v).trim() === ''; };
  var fmt = function (v) { return typeof v === 'number' ? v.toLocaleString('ko-KR') : String(v).trim(); };

  /* <span class="blank" data-val="pages"> → 값으로 바꾸고, data-val-todo="pages" 표시는 지움 */
  function apply(values) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-val]'), function (el) {
      var key = el.getAttribute('data-val');
      var v = pick(values, key);
      if (isEmpty(v)) return;
      el.textContent = fmt(v);
      el.className = 'val';
      el.removeAttribute('style');
      var box = el.closest('[data-val-box]');
      if (box) box.classList.add('is-filled');
      Array.prototype.forEach.call(document.querySelectorAll('[data-val-todo="' + key + '"]'), function (t) { t.remove(); });
    });
  }

  /* 다른 스크립트가 값(예: 전화번호)을 쓸 수 있게 약속으로 남겨 둠. 못 읽으면 빈 값 */
  HL.values = HL.getJSON(C.data && C.data.values)
    .then(function (res) { return res.data || {}; })
    .catch(function () { return {}; });

  var ready = new Promise(function (r) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', r); else r();
  });
  Promise.all([HL.values, ready]).then(function (a) { apply(a[0]); });
})();
