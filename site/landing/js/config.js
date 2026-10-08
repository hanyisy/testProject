/* 현장로그 랜딩 운영 설정 — 주소·번호는 여기 한 곳에서만 바꿉니다. */
window.HL_CONFIG = {
  /* 가입 문의 폼 2개(첫 화면 · 아래 전체 폼)가 POST로 보내는 주소.
     받는 쪽은 저장한 뒤 303으로 /landing/done.html 에 보내 주면 됩니다. */
  leadEndpoint: '/api/lead',

  /* 모바일 하단 "전화 상담" 번호. 비우면 랜딩 값의 phone, 그것도 비면 전체 문의 폼으로 이동 */
  phone: '',

  /* 랜딩이 읽는 데이터. 지금은 JSON 파일, 나중에 서버 주소로 바꿔도 응답 모양만 같으면 됩니다.
     항목 설명: site/data/README.md */
  data: {
    captures: '../data/captures.json',
    values: '../data/landing-values.json'
  }
};
