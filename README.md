# 현장로그 정적 사이트

빌드 없이 바로 여는 HTML/CSS/JS입니다.

## 구성
```
site/
  assets/css/tokens.css     공통 색·폰트·리셋 (파트너·어드민과 같은 색)
  landing/index.html        가입 문의 랜딩 (모바일 먼저, 1024px 이상 데스크톱)
  landing/done.html         접수 완료
  landing/css/landing.css
  landing/js/landing.js     업종 칩, 업종·지역 확인, 폼, 흐르는 띠
```

## 로컬에서 보기
`landing/index.html`을 브라우저로 바로 열어도 되고, 아래처럼 띄워도 됩니다.
```
cd site
python3 -m http.server 8000
# http://localhost:8000/landing/
```

## 실제 값 넣을 곳
- `landing/js/landing.js` 맨 위 `CONFIG`
  - `phone`: 모바일 하단 "전화 상담" 번호 (비우면 문의 폼으로 이동)
  - `formEndpoint`: 문의를 보낼 API 주소 (비우면 전송 없이 접수 완료 화면으로만 이동)
- `landing/js/landing.js`의 `TAKEN`: 이미 운영 중인 업종×지역 조합
- `landing/index.html`의 `실제 값 입력` 표시(`.todo-chip`)와 점선 빈칸(`.blank`): 운영 업종 수, 제작한 페이지 수, 실측 결과, 월 발행 수, 수정 반영 기한, 푸터 사업자 정보
- 개인정보처리방침·이용약관 링크(`#privacy`, `#terms`)
