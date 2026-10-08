/* 업체 공개 사이트 공통: 주소(/p/{slug}/...)로 업체를 찾아 이름·대표 색·연락처를 채움
 * 업체 정보: /data/partner-sites.json (항목 설명: site/data/README.md) */
(function () {
  'use strict';
  var SOURCE = '/data/partner-sites.json';

  var m = /^\/p\/([a-z0-9-]+)\//.exec(location.pathname);
  var slug = m ? m[1] : '';

  var pick = function (o, key) { return key.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); };
  /* 받침 있으면 앞 글자, 없으면 뒤 글자 (이/가) */
  var josa = function (word, pair) {
    var c = String(word).charCodeAt(String(word).length - 1);
    var has = c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 > 0;
    return word + (has ? pair.charAt(0) : pair.charAt(1));
  };

  function fill(p) {
    document.documentElement.style.setProperty('--brand', p.brand || 'var(--ink)');
    Array.prototype.forEach.call(document.querySelectorAll('[data-ps]'), function (el) {
      var key = el.getAttribute('data-ps');
      if (!key) return;
      var v = pick(p, key);
      if (v == null || v === '') { var row = el.closest('.ps-foot__info > span'); if (row) row.classList.add('ps-hidden'); return; }
      var j = el.getAttribute('data-ps-josa');
      el.textContent = j ? josa(v, j) : v;
    });
    var tel = p.phone ? 'tel:' + String(p.phone).replace(/[^0-9+]/g, '') : '';
    Array.prototype.forEach.call(document.querySelectorAll('[data-ps-tel]'), function (a) {
      if (tel) a.setAttribute('href', tel); else a.classList.add('ps-hidden');
    });
    if (p.name) document.title = document.title + ' · ' + p.name;
  }

  function run() {
    fetch(SOURCE, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var list = Array.isArray(d) ? d : (d.items || []);
        var p = list.filter(function (x) { return x.slug === slug; })[0];
        /* 업체를 못 찾으면 이름 대신 "업체"로 두고 연락처 줄은 숨김 */
        fill(p || { name: '업체', mark: '', business: {} });
      })
      .catch(function () { fill({ name: '업체', mark: '', business: {} }); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
