# 현장로그

가입 문의 랜딩 · 본사 어드민 · 파트너 관리자를 한 Next.js 앱(`web/`)으로 돌립니다.
확정 시안은 로컬 `design/` 폴더에만 두고 저장소에는 올리지 않습니다(.gitignore).

**바로 보기(깃허브 페이지):** 랜딩 https://hanyisy.github.io/testProject/ · 전체 화면 목차 https://hanyisy.github.io/testProject/preview/ (정적 미리보기 · `node tools/snapshot.mjs`로 다시 만듦)

설계: [docs/architecture.md](docs/architecture.md) · [docs/db.md](docs/db.md) · [docs/screens.md](docs/screens.md) · 데모 계정: [docs/demo-accounts.md](docs/demo-accounts.md) · 컨펌용 링크: [docs/confirm-links.md](docs/confirm-links.md)

## 실행
```
cd web
npm install
npm run dev          # 어드민 · 파트너: http://localhost:3000/login · 랜딩: http://localhost:3000/landing/
npm run db:reset     # 시안 더미 데이터로 처음 상태 되돌리기 (개발 서버를 끄고)
npm run demo:photos  # 업체 공개 사이트 데모 사진 받기 (Unsplash 무료 스톡 61장 · 약 11MB · web/.data, git 제외)
```
- Postgres 설치 없이 돌아요(PGlite, `web/.data/`). `DATABASE_URL`을 넣으면 실제 PostgreSQL을 씁니다.
- 올린 사진 · 랜딩 캡처는 `web/.data/uploads/`(git 제외). 운영에서는 저장소 어댑터를 S3 호환으로 바꿉니다.
- **데모 사진은 확인용 스톡 사진이에요.** 업체 공개 사이트(`/p/{slug}`)가 실제 사진처럼 보이게 넣은 것이라, 운영 전에 업체의 실제 현장 사진으로 꼭 바꿔야 해요 (`web/db/demo-photos.json` · `web/db/demo-world.json`).
- 데모 계정은 시안 그대로입니다(`web/db/seed-data.json`의 `logins`). 컨펌용 더미 값이에요.

## 구성
```
design/                         확정 시안 (로컬에만)
docs/                           기술 구성 · DB 설계 · 화면 목록 · 데모 계정
tools/design-to-seed.mjs        시안의 데모 데이터 → web/db/seed-data.json
tools/dev-server.js             (선택) 정적 파일만 보기 + /design/ 시안 보기 — 앱 없이 랜딩 모양만 볼 때
web/
  app/admin · app/partner       본사 어드민 · 파트너 관리자 화면
  app/api/lead                  랜딩 가입 문의 폼 받기 → 가입 문의(leads) → 303 /landing/done.html
  app/data/*.json               랜딩 · 업체 공개 사이트가 읽는 값 (DB에서 · 모양: public/data/README.md)
  app/media · app/files         랜딩 캡처(공개) · 파트너 사진(로그인 필요)
  app/p/[slug]                  업체 공개 사이트: 종료 업체 410 · 문의 접수 완료
  public/
    landing/                    가입 문의 랜딩 (index · done · privacy · terms, js/config.js 설정 한 곳)
    p/                          업체 공개 사이트 조각 (contact-done · closed)
    404.html · error.html · maintenance.html · robots.txt · sitemap.xml · indexnow/
  db/ · lib/ · components/ · styles/
```

## 실제 값 넣을 곳
- **어드민 › 설정 › 랜딩 관리**: 실제 검색 화면 캡처(다른 업체 상호는 화면에서 흐리게 칠하면 이미지에 입혀서 올라감), 운영 업종 수 · 제작한 페이지 수 · 월 발행 수 · 수정 반영 기한 · 색인 기간 · 푸터 사업자 정보
- **업종×지역 점유**: 파트너 서비스 지역에서 자동 (랜딩 업종·지역 확인과 대기 신청에 바로 반영)
- `web/public/landing/js/config.js`: 폼 받는 주소(`/api/lead`) · 모바일 "전화 상담" 번호 · 데이터 주소
- 개인정보처리방침 · 이용약관 · 동의 보기 창 · 점검 시간: `실제 내용 입력` / `실제 값 입력` 표시 자리

## 서버가 하는 일
| 요청 | 할 일 |
|---|---|
| `POST /api/lead` | 가입 문의 저장 → `303` `/landing/done.html`. `request_type=waitlist`면 어드민 가입 문의에 "점유됨 · 대기" |
| `/data/*.json` | 캡처 · 랜딩 값 · 점유 · 업체 공개 사이트 정보를 DB에서 |
| 종료된 업체 사이트 `/p/{slug}/…` | `p/closed.html`을 `410` + noindex |
| `/p/{slug}/contact/done` | 문의 접수 완료 |
| 임시 주소 전체 | `X-Robots-Tag: noindex, nofollow` |

폼 값: `form_id`(hero · full), `request_type`(new · waitlist), `company`, `name`, `phone`, `email`, `industry`, `region`, `homepage`, `message`, `agree`

## 도메인 연결할 때
1. `web/public/robots.txt`를 `robots.production.txt` 내용으로 바꾸고 도메인을 적습니다.
2. `web/public/sitemap.xml`의 `https://도메인`을 바꿉니다.
3. 공개할 페이지(`landing/index.html`, `privacy.html`, `terms.html`)의 `<meta name="robots" content="noindex, nofollow">` 줄을 지웁니다.
4. `web/next.config.ts`의 `X-Robots-Tag: noindex`를 임시 주소에서만 붙이도록 바꿉니다.
5. IndexNow 키 파일을 올립니다 (`web/public/indexnow/README.txt`).
