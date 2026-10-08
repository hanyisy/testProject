/* 현장로그 가입 문의 랜딩 — config.js, data.js 다음에 불러옵니다. */
(function () {
  'use strict';

  var CONFIG = window.HL_CONFIG || { data: {} };
  var HL = window.HL || {};

  /* ---- 업종별 예시 ---- */
  var IND = {
    '철거': { q: '춘천 상가철거', title: '춘천 석사동 상가 철거 · 한결철거', snip: '석사동에서 직접 철거한 40평 상가 현장 사진 19장. 천장·칸막이·바닥 2일 작업 기록.', url: 'hangyeol.kr › 춘천 › 석사동', r2: '춘천 상가 철거 비용 · 평수별 예시', r2s: '20평 이하, 20~40평, 40평 이상으로 나눠 실제 현장과 함께 정리했어요.', site: '춘천 석사동 상가 철거', inq: '석사동 상가 40평 철거', inq2: '퇴계동 학원 철거 기간 문의' },
    '입주청소': { q: '서초 입주청소', title: '서초 반포동 34평 아파트 입주청소 · 맑은집클린', snip: '반포동 34평 아파트 입주청소 현장 사진 24장. 욕실 곰팡이와 창틀까지 하루 작업.', url: 'malgeunjip.kr › 서초 › 반포동', r2: '서초 입주청소 비용 · 평수별 예시', r2s: '평수와 오염 정도, 추가 항목으로 나눠 실제 현장과 함께 정리했어요.', site: '서초 반포동 아파트 입주청소', inq: '반포동 34평 입주청소', inq2: '역삼동 오피스텔 이사청소' },
    '인테리어': { q: '성남 아파트 인테리어', title: '분당 정자동 32평 아파트 부분 인테리어 · 예시 업체', snip: '정자동 32평 주방·욕실 부분 인테리어 현장 사진 31장. 3주 공정 기록.', url: 'example-interior.kr › 성남 › 정자동', r2: '성남 부분 인테리어 순서와 기간', r2s: '주방, 욕실, 바닥 순서로 공정과 기간을 실제 현장으로 정리했어요.', site: '분당 정자동 아파트 부분 인테리어', inq: '정자동 32평 주방 인테리어', inq2: '서현동 욕실 리모델링' },
    '바닥 시공': { q: '수원 강마루 시공', title: '수원 영통동 아파트 강마루 시공 · 예시 업체', snip: '영통동 28평 아파트 강마루 시공 현장 사진 16장. 기존 장판 철거부터 하루 작업.', url: 'example-floor.kr › 수원 › 영통동', r2: '강마루와 장판, 무엇을 고를까', r2s: '자재별 차이와 시공 기간을 실제 현장 사진으로 비교했어요.', site: '수원 영통동 아파트 강마루 시공', inq: '영통동 28평 강마루', inq2: '매탄동 장판 교체' },
    '기타': { q: '마포 카페 창업 컨설팅', title: '망원동 12평 카페 창업 상담 기록 · 예시 업체', snip: '망원동 12평 카페 창업 준비 과정. 상권 확인부터 인테리어 견적까지 기록.', url: 'example-consult.kr › 마포 › 망원동', r2: '카페 창업 준비 순서', r2s: '상권, 임대, 인테리어, 인허가 순서로 실제 상담 사례와 함께 정리했어요.', site: '망원동 카페 창업 상담', inq: '망원동 카페 창업 상담', inq2: '연남동 소형 매장 상권 문의' }
  };
  var IND_LABEL = function (k) { return k === '기타' ? '기타 (창업 컨설팅 등)' : k; };

  /* 업종·지역 확인용 (지역 목록과 이미 운영 중인 조합) */
  var REGS = ['강원 춘천', '강원 원주', '강원 홍천', '서울 서초', '서울 강남', '서울 송파', '경기 수원', '경기 용인', '인천 부평'];
  var TAKEN = { '철거': ['강원 춘천', '강원 원주', '강원 홍천'], '입주청소': ['서울 서초', '서울 강남'], '바닥 시공': ['경기 수원', '경기 용인'] };

  var state = { ind: '철거', reg: '강원 춘천', waitlist: false };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var isDesktop = function () { return window.matchMedia('(min-width: 1024px)').matches; };
  var isTaken = function () { return (TAKEN[state.ind] || []).indexOf(state.reg) > -1; };

  /* ---- 칩 만들기 ---- */
  function buildChips() {
    $$('[data-ind-chips]').forEach(function (box) {
      Object.keys(IND).forEach(function (k) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.dataset.ind = k; b.textContent = k;
        b.addEventListener('click', function () { setInd(k); });
        box.appendChild(b);
      });
    });
    $$('[data-reg-chips]').forEach(function (box) {
      REGS.forEach(function (r) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'chip chip--reg'; b.dataset.reg = r; b.textContent = r;
        b.addEventListener('click', function () { state.reg = r; render(); });
        box.appendChild(b);
      });
    });
    $$('[data-ind-select]').forEach(function (sel) {
      Object.keys(IND).forEach(function (k) {
        var o = document.createElement('option'); o.value = k; o.textContent = IND_LABEL(k); sel.appendChild(o);
      });
      sel.addEventListener('change', function () { setInd(sel.value); });
    });
  }

  function setInd(k) { state.ind = k; render(); }

  /* ---- 화면 갱신 ---- */
  function render() {
    var ex = IND[state.ind];
    $$('[data-ex]').forEach(function (el) { el.textContent = ex[el.dataset.ex]; });
    $$('.chip[data-ind]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.ind === state.ind)); });
    $$('.chip[data-reg]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.reg === state.reg)); });
    $$('[data-ind-select]').forEach(function (s) { s.value = state.ind; });

    var etc = state.ind === '기타';
    var kind = etc ? 'etc' : isTaken() ? 'taken' : 'ok';
    $$('[data-result]').forEach(function (el) { el.hidden = el.dataset.result !== kind; });
    $$('[data-chk-text]').forEach(function (el) { el.textContent = state.reg + ' · ' + state.ind; });

    /* 대기 신청 중에 운영 중이 아닌 조합으로 바꾸면 일반 가입 문의로 돌아감 */
    if (state.waitlist && (etc || !isTaken())) setWaitlist(false);
    sortCaptures();
  }

  /* ---- 대기 신청: 폼에 업종·지역을 채우고 request_type=waitlist로 보냄 ---- */
  function setWaitlist(on) {
    state.waitlist = on;
    $$('[data-lead-form]').forEach(function (form) {
      form.elements.request_type.value = on ? 'waitlist' : 'new';
      if (on) form.elements.region.value = state.reg;
      var mode = $('[data-form-mode]', form);
      mode.hidden = !on;
      $('[data-form-mode-text]', mode).textContent = state.reg + ' · ' + state.ind;
      $('button[type=submit]', form).textContent = on ? '대기 신청 남기기' : '가입 문의 남기기';
    });
  }

  /* ---- 가입 문의 버튼: 데스크톱은 첫 화면 폼, 모바일은 아래 전체 폼 ---- */
  function bindApplyLinks() {
    $$('[data-apply]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        setWaitlist(a.dataset.apply === 'waitlist');
        var target = isDesktop() ? $('#form') : $('#form-full');
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
        var first = target.querySelector('input:not([type=checkbox]):not([type=hidden])');
        if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 400);
      });
    });
    var setTel = function (num) {
      var tel = $('[data-tel]');
      if (tel) tel.setAttribute('href', num ? 'tel:' + String(num).replace(/[^0-9+]/g, '') : '#form-full');
    };
    setTel(CONFIG.phone);
    if (!CONFIG.phone && HL.values) HL.values.then(function (v) { setTel(v.business && v.business.phone); });
  }

  /* ---- 폼: 실제 <form method="post">. 전송은 브라우저 기본 동작 그대로 ---- */
  function maskPhone(v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length < 8) return v || '';
    return d.slice(0, 3) + '-****-' + d.slice(-4);
  }

  function bindForms() {
    $$('[data-lead-form]').forEach(function (form) {
      form.action = CONFIG.leadEndpoint;
      var agree = form.elements.agree;
      var btn = $('button[type=submit]', form);
      var sync = function () { btn.disabled = !agree.checked; };
      agree.addEventListener('change', sync); sync();

      /* 막지 않고, 접수 완료 화면에 보여 줄 요약만 남김 */
      form.addEventListener('submit', function () {
        var f = form.elements;
        var summary = (f.request_type.value === 'waitlist' ? '대기 신청 · ' : '') +
          [f.company.value.trim(), IND_LABEL(f.industry.value), f.region.value.trim()].filter(Boolean).join(' · ') +
          (f.phone.value ? ' / ' + maskPhone(f.phone.value) : '');
        try { sessionStorage.setItem('hl-lead-summary', summary); } catch (err) { /* 저장 불가 시 완료 화면 기본 문구 */ }
      });
    });
  }

  /* ---- 개인정보 수집·이용 동의 "보기" 창 ---- */
  function bindConsent() {
    var dlg = $('[data-consent]');
    if (!dlg) return;
    $$('[data-consent-open]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        if (typeof dlg.showModal === 'function') dlg.showModal(); else location.href = 'privacy.html';
      });
    });
    $$('[data-consent-close]', dlg).forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  }

  /* ---- 실제 검색 화면 캡처 ---- */
  var captures = [];

  function fmtDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? m[1] + '. ' + Number(m[2]) + '. ' + Number(m[3]) + '.' : '';
  }

  function capCard(c) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cap'; b.dataset.industry = c.industry;
    b.innerHTML =
      '<span class="cap__img"><img loading="lazy" alt=""></span>' +
      '<span class="cap__body"><span class="cap__q"></span>' +
      '<span class="cap__meta"><span class="st st--surf cap__ind"></span><span class="cap__date"></span></span></span>';
    var img = $('img', b);
    img.src = c.src;
    img.alt = '“' + c.query + '” 검색 결과 캡처';
    $('.cap__q', b).textContent = '“' + c.query + '”';
    $('.cap__ind', b).textContent = c.industry;
    $('.cap__date', b).textContent = fmtDate(c.capturedAt) + ' 캡처';
    b.addEventListener('click', function () { openCapture(c); });
    return b;
  }

  /* 고른 업종이 앞, 그 안에서는 order 순 */
  function sortCaptures() {
    var grid = $('[data-cap-grid]');
    if (!grid || !captures.length) return;
    var list = captures.slice().sort(function (a, b) {
      var sa = a.industry === state.ind ? 0 : 1, sb = b.industry === state.ind ? 0 : 1;
      return sa - sb || a.order - b.order;
    });
    list.forEach(function (c) { grid.appendChild(c.el); });
  }

  function openCapture(c) {
    var dlg = $('[data-cap-view]');
    $('[data-cap-view-img]', dlg).src = c.src;
    $('[data-cap-view-img]', dlg).alt = '“' + c.query + '” 검색 결과 캡처';
    $('[data-cap-view-q]', dlg).textContent = '“' + c.query + '”';
    $('[data-cap-view-meta]', dlg).textContent = c.industry + ' · ' + fmtDate(c.capturedAt) + ' 캡처';
    if (typeof dlg.showModal === 'function') dlg.showModal(); else window.open(c.src, '_blank', 'noopener');
  }

  function initCaptures() {
    var sec = $('[data-captures]');
    if (!sec || !HL.getJSON) return;
    var dlg = $('[data-cap-view]');
    $$('[data-cap-view-close]', dlg).forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

    HL.getJSON(CONFIG.data && CONFIG.data.captures).then(function (res) {
      var items = Array.isArray(res.data) ? res.data : (res.data && res.data.items) || [];
      captures = items
        .filter(function (c) { return c && c.visible === true && c.image && c.query; })
        .map(function (c, i) {
          var o = { query: String(c.query), industry: String(c.industry || ''), capturedAt: c.capturedAt,
            order: typeof c.order === 'number' ? c.order : i, src: new URL(c.image, res.base).href };
          o.el = capCard(o);
          return o;
        });
      if (!captures.length) return;          /* 0건이면 섹션은 계속 숨김 */
      sortCaptures();
      sec.hidden = false;
    }).catch(function () { /* 못 읽으면 숨김 그대로 */ });
  }

  /* ---- 흐르는 검색어 띠: 한 벌 더 복제해 끊김 없이 ---- */
  function initMarquee() {
    var track = $('[data-marquee]');
    if (!track) return;
    $$('.marquee__item', track).forEach(function (it) { track.appendChild(it.cloneNode(true)); });
    track.classList.add('is-running');
  }

  document.addEventListener('DOMContentLoaded', function () {
    buildChips();
    render();
    bindApplyLinks();
    bindForms();
    bindConsent();
    initCaptures();
    initMarquee();
  });
})();
