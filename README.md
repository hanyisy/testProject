# 현장로그 정적 사이트

빌드 없이 바로 여는 HTML/CSS/JS입니다. 확정 시안은 로컬 `design/` 폴더에만 두고 저장소에는 올리지 않습니다(.gitignore).

## 구성
```
design/                         확정 시안 (로컬에만 보관 · 공개 저장소에는 올리지 않음)
tools/dev-server.js             로컬 개발 서버 (의존성 없음)
site/
  index.html                    → landing/ 으로 이동
  404.html · error.html · maintenance.html   없는 주소 · 오류 · 점검 중
  robots.txt                    임시 주소용 (전부 색인 제외)
  robots.production.txt         도메인 연결 후 robots.txt 로 바꿔 쓸 내용
  sitemap.xml                   랜딩 사이트맵 (도메인 자리 비어 있음)
  indexnow/README.txt           IndexNow 키 파일 자리 안내
  assets/css/tokens.css         공통 색·폰트·리셋 (파트너·어드민과 같은 색)
  assets/css/components.css     공용 조각: 버튼 · 칩 · 입력칸 · 배지 · 빈칸 · 창
  data/                         랜딩이 읽는 JSON (항목 설명: data/README.md)
    captures.json               실제 검색 화면 캡처 (0건이면 섹션 숨김)
    landing-values.json         "실제 값 입력" 자리 값
    partner-sites.json          업체 공개 사이트 정보 (문의 접수 완료 화면용)
  landing/
    index.html                  가입 문의 랜딩 (모바일 먼저, 1024px 이상 데스크톱)
    done.html                   접수 완료
    privacy.html · terms.html   개인정보처리방침 · 이용약관 (본문은 "실제 내용 입력" 자리)
    js/config.js                설정 한 곳: 폼 받는 주소 · 전화번호 · 데이터 주소
    js/data.js                  JSON 읽기 · 랜딩 값 채우기
    js/landing.js               업종 칩, 업종·지역 확인, 대기 신청, 실제 검색 화면, 동의 보기, 흐르는 띠
  p/                            업체 공개 사이트 (시안: design/한결철거 공개 사이트.dc.html)
    contact-done.html           /p/{slug}/contact/done — 문의 접수 완료
    closed.html                 계약이 끝나 비공개가 된 업체 주소 (410 · 색인 제외)
```

## 관리자 앱 (web/ · Next.js) — 본사 어드민 · 파트너
설계: [docs/architecture.md](docs/architecture.md) · [docs/db.md](docs/db.md) · [docs/screens.md](docs/screens.md)
```
cd web
npm install
npm run dev          # http://localhost:3000/login
npm run db:reset     # 시안 더미 데이터로 처음 상태 되돌리기
```
- Postgres 설치 없이 돌아요(PGlite, `web/.data/`). `DATABASE_URL`을 넣으면 실제 PostgreSQL을 씁니다.
- 데모 계정은 시안 그대로입니다(`web/db/seed-data.json`의 `logins`). 컨펌용 더미 값이에요.

## 로컬에서 보기 (정적 랜딩)
```
node tools/dev-server.js
```
- 랜딩: http://localhost:8000/landing/
- 시안: http://localhost:8000/design/ 아래 파일 이름 (개발 서버에서만)
- 폼을 보내면 `.devdata/leads.json`에 쌓이고(git 제외) 접수 완료 화면으로 넘어갑니다.
- 업체 사이트 문의 완료 예: http://localhost:8000/p/hangyeol/contact/done
- 비공개 안내 예: http://localhost:8000/p/closed-sample/ (410)

파일을 브라우저로 바로 열면 JSON을 못 읽어서 랜딩 값 · 캡처가 안 나옵니다. 개발 서버로 열어 주세요.

## 실제 값 넣을 곳
- `site/landing/js/config.js`
  - `leadEndpoint`: 가입 문의 폼 2개가 POST로 보내는 주소 (기본 `/api/lead`)
  - `phone`: 모바일 하단 "전화 상담" 번호 (비우면 `landing-values.json`의 전화, 그것도 비면 문의 폼으로 이동)
  - `data`: 캡처 · 랜딩 값 주소. 서버 응답으로 바꿔도 모양만 같으면 랜딩 코드는 그대로
- `site/data/landing-values.json`: 운영 업종 수, 제작한 페이지 수, 월 발행 수, 수정 반영 기한, 색인 기간, 푸터 사업자 정보
- `site/data/captures.json`: 실제 검색 결과 캡처만. 다른 업체 상호는 이미지에서 미리 흐리게
- `site/landing/js/landing.js`의 `TAKEN`: 이미 운영 중인 업종×지역 조합
- 개인정보처리방침 · 이용약관 · 동의 보기 창 · 점검 시간: `실제 내용 입력` / `실제 값 입력` 표시 자리

## 서버가 할 일 (지금은 `tools/dev-server.js`가 흉내 냄)
| 요청 | 할 일 |
|---|---|
| `POST {leadEndpoint}` | 폼 값 저장 → `303` 으로 `/landing/done.html`. `request_type=waitlist`면 어드민 가입 문의에 "점유됨 · 대기"로 표시 |
| 없는 주소 | `404.html`을 `404`로 |
| 서버 오류 | `error.html`을 `500`으로 |
| 점검 중 | `maintenance.html`을 `503`(+ `Retry-After`)으로 |
| 계약이 끝난 업체 사이트 주소 | `p/closed.html`을 `410` + `X-Robots-Tag: noindex`로 |
| 업체 사이트 `/contact` 전송 후 | `/contact/done` (`p/contact-done.html`) 으로 |
| 임시 주소 전체 | `X-Robots-Tag: noindex, nofollow` |

폼 값: `form_id`(hero · full), `request_type`(new · waitlist), `company`, `name`, `phone`, `email`, `industry`, `region`, `homepage`, `message`, `agree`

## 도메인 연결할 때
1. `site/robots.txt`를 `robots.production.txt` 내용으로 바꾸고 도메인을 적습니다.
2. `site/sitemap.xml`의 `https://도메인`을 바꿉니다.
3. 공개할 페이지(`landing/index.html`, `privacy.html`, `terms.html`)의 `<meta name="robots" content="noindex, nofollow">` 줄을 지웁니다. (done · 404 · 오류 · 점검 · 업체 비공개 안내는 그대로 둡니다)
4. 서버의 `X-Robots-Tag: noindex`를 임시 주소에서만 붙이도록 바꿉니다.
5. IndexNow 키 파일을 올립니다 (`site/indexnow/README.txt`).
