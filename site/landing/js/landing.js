/* 현장로그 가입 문의 랜딩 */
(function () {
  'use strict';

  /* ---- 운영 설정 (실제 값 입력) ---- */
  var CONFIG = {
    phone: '',          // 전화 상담 번호. 예) '1588-0000' — 비어 있으면 전체 문의 폼으로 이동
    formEndpoint: ''    // 문의를 보낼 API 주소. 비어 있으면 전송 없이 접수 완료 화면으로만 이동(데모)
  };

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

  var state = { ind: '철거', reg: '강원 춘천' };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var isDesktop = function () { return window.matchMedia('(min-width: 1024px)').matches; };

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
    var taken = (TAKEN[state.ind] || []).indexOf(state.reg) > -1;
    var kind = etc ? 'etc' : taken ? 'taken' : 'ok';
    $$('[data-result]').forEach(function (el) { el.hidden = el.dataset.result !== kind; });
    $$('[data-chk-text]').forEach(function (el) { el.textContent = state.reg + ' · ' + state.ind; });
  }

  /* ---- 가입 문의 버튼: 데스크톱은 첫 화면 폼, 모바일은 아래 전체 폼 ---- */
  function bindApplyLinks() {
    $$('[data-apply]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var target = isDesktop() ? $('#form') : $('#form-full');
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
        var first = target.querySelector('input:not([type=checkbox])');
        if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 400);
      });
    });
    var tel = $('[data-tel]');
    if (tel) tel.setAttribute('href', CONFIG.phone ? 'tel:' + CONFIG.phone.replace(/[^0-9+]/g, '') : '#form-full');
  }

  /* ---- 폼: 동의해야 버튼 켜짐, 보내면 접수 완료로 ---- */
  function maskPhone(v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length < 8) return v || '';
    return d.slice(0, 3) + '-****-' + d.slice(-4);
  }

  function bindForms() {
    $$('[data-lead-form]').forEach(function (form) {
      var agree = form.querySelector('[data-agree]');
      var btn = form.querySelector('button[type=submit]');
      var sync = function () { btn.disabled = !agree.checked; };
      agree.addEventListener('change', sync); sync();

      form.addEventListener('input', function (e) { if (e.target.getAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid'); });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!agree.checked) return;
        var bad = $$('[required]', form).filter(function (el) { return !el.value.trim(); });
        bad.forEach(function (el) { el.setAttribute('aria-invalid', 'true'); });
        if (bad.length) { bad[0].focus(); return; }

        var data = {};
        new FormData(form).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });
        data.industry = data.industry || state.ind;

        var summary = [data.company, IND_LABEL(data.industry), data.region].filter(Boolean).join(' · ') +
          (data.phone ? ' / ' + maskPhone(data.phone) : '');

        var go = function () {
          try { sessionStorage.setItem('hl-lead-summary', summary); } catch (err) { /* 저장 불가 시 예시 문구 사용 */ }
          location.href = 'done.html';
        };

        if (!CONFIG.formEndpoint) { go(); return; }
        btn.disabled = true;
        fetch(CONFIG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
          .then(function (r) { if (!r.ok) throw new Error(r.status); go(); })
          .catch(function () { btn.disabled = false; alert('보내지 못했어요. 잠시 후 다시 시도해 주세요.'); });
      });
    });
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
    initMarquee();
  });
})();
