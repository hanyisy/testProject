# 컨펌용 페이지 링크

## 바로 보기 (깃허브 페이지 · 서버 없이)
- **첫 화면 = 랜딩:** https://hanyisy.github.io/testProject/
- **미리보기 목차 (어드민 · 파트너 · 업체 사이트 · 시안 A~F 전부):** https://hanyisy.github.io/testProject/preview/
- 개발 서버의 더미 데이터 화면을 HTML로 저장한 것이라 **화면 · 링크 이동은 되지만 버튼 · 저장 · 폼은 동작하지 않아요.**
- 다시 만들기: `cd web && npm run dev` 켠 상태에서 저장소 루트에서 `node tools/snapshot.mjs` → `preview/` · `index.html`이 새로 생김 → 커밋 · 푸시
  - 로컬에서 깃허브 페이지처럼 보기: `node tools/pages-server.js 8100` → http://localhost:8100/testProject/

## 직접 눌러 보기 (개발 서버)
모두 더미 데이터예요. 개발 서버(`cd web && npm run dev`)를 켠 뒤 `http://localhost:3000` 기준으로 열어요.
처음 상태로 되돌리기: 서버를 끄고 `npm --prefix web run db:reset`. 계정은 [demo-accounts.md](demo-accounts.md).

## 0. 로그인
- 로그인 · 데모 계정 전환: http://localhost:3000/login
  - 아래 "데모 계정으로 보기"에서 비밀번호 없이 바로 들어가요. 첫 로그인 계정은 **우선 로그인하기**로 넘어가요.
  - 본사는 `박서준 · 최고 관리자`, 파트너는 `한결철거`로 보면 화면이 제일 많이 채워져 있어요.

## 1. 랜딩 (가입 문의)
- 랜딩: http://localhost:3000/landing/
- 접수 완료: http://localhost:3000/landing/done.html
- 개인정보처리방침 · 이용약관: http://localhost:3000/landing/privacy.html · http://localhost:3000/landing/terms.html

## 2. 본사 어드민 (본사 계정으로)
| 화면 | 주소 |
|---|---|
| 대시보드 | http://localhost:3000/admin |
| 가입 문의 | http://localhost:3000/admin/leads (줄을 누르면 상세) |
| 파트너 목록 · 상세 | http://localhost:3000/admin/partners (업체를 누르면 상세 · 결제 · 도메인 · 기능 · 양산 범위 탭) |
| 파트너 추가 | http://localhost:3000/admin/partners/new |
| 페이지 생성 | http://localhost:3000/admin/generate (위 "생성 기록"에서 지난 생성 열기) |
| 업종 템플릿 | http://localhost:3000/admin/templates |
| 요금제 | http://localhost:3000/admin/plans |
| 발행 · 색인 | http://localhost:3000/admin/indexing |
| 검수 | http://localhost:3000/admin/review (묶음을 누르면 상세 · 공통 본문 고치기) |
| 작업 로그 | http://localhost:3000/admin/jobs |
| 문의 · 정산 | http://localhost:3000/admin/billing |
| 대행 작업 | http://localhost:3000/admin/agency |
| 설정 · 랜딩 관리 | http://localhost:3000/admin/settings · http://localhost:3000/admin/settings/landing |
| 직원 계정 · 내 계정 | http://localhost:3000/admin/staff · http://localhost:3000/admin/me |

## 3. 파트너 관리자 (파트너 계정으로 · 한결철거 추천)
| 화면 | 주소 |
|---|---|
| 홈 | http://localhost:3000/partner |
| 현장 발행 | http://localhost:3000/partner/sites |
| 사진 추가 (드라이브 연결 · 폴더 바꾸기) | http://localhost:3000/partner/photos |
| 검색 노출 | http://localhost:3000/partner/search |
| 만들고 있는 페이지 | http://localhost:3000/partner/making |
| 문의 · 문의 자세히 | http://localhost:3000/partner/inquiries (제목이나 "자세히"를 누르면 상세) |
| 블로그 | http://localhost:3000/partner/blog |
| 결제 내역 | http://localhost:3000/partner/billing |
| 설정 (최근 알림) | http://localhost:3000/partner/settings |
| 종료 업체 화면 | 다온플라워로 들어가면 결제 내역만 보여요 |

## 4. 업체 공개 사이트 (로그아웃해도 보임 · 검수 중 페이지는 본사/그 업체 계정으로만 미리보기)
**홈**
- 한결철거 (철거): http://localhost:3000/p/hangyeol
- 맑은집클린 (입주청소): http://localhost:3000/p/malgeunjip
- 단정인테리어 (인테리어): http://localhost:3000/p/danjeong
- 온마루 (준비 중 · 미리보기만): http://localhost:3000/p/onmaru
- 다온플라워 (종료 → 410 안내): http://localhost:3000/p/daon

**지역 × 작업 페이지 — 시안 A~F** (본사 계정으로 열면 위에 "미리보기 · 시안 X" 띠가 보여요)
| 시안 | 주소 |
|---|---|
| A 사진 중심형 | http://localhost:3000/p/danjeong/성남/수내동-아파트인테리어 |
| B 현장 기록형 | http://localhost:3000/p/danjeong/성남/서현동-아파트인테리어 |
| C 질문 답변형 | http://localhost:3000/p/hangyeol/원주/단계동-학원철거 |
| D 비용 안내형 | http://localhost:3000/p/hangyeol/춘천/석사동-학원철거 |
| E 지도 중심형 | http://localhost:3000/p/malgeunjip/강남/역삼동-오피스텔입주청소 |
| F 후기 인용형 | http://localhost:3000/p/malgeunjip/서초/서초동-오피스텔입주청소 |
| 발행된 지역 페이지(시안 A) | http://localhost:3000/p/hangyeol/춘천/퇴계동-상가철거 |

**그 밖의 페이지 종류**
| 종류 | 주소 |
|---|---|
| 지역 허브 | http://localhost:3000/p/hangyeol/춘천 |
| 역 주변 | http://localhost:3000/p/hangyeol/역/남춘천역 |
| 업종 가이드 | http://localhost:3000/p/hangyeol/가이드/철거-비용-계산하는-법 |
| 질문 | http://localhost:3000/p/hangyeol/질문/학원-철거-기간 |
| 현장 기록 | 홈의 "최근 현장" 카드를 누르면 (`/p/hangyeol/현장/…`) |
| 문의 · 접수 완료 | http://localhost:3000/p/hangyeol/문의 · http://localhost:3000/p/hangyeol/contact/done |
| 개인정보처리방침 | http://localhost:3000/p/hangyeol/개인정보처리방침 |

## 5. 같이 확인하면 좋은 흐름
1. **공개 사이트 문의 → 파트너 문의:** `/p/hangyeol/문의`에서 문의를 남기면 → 파트너 **문의**에 신규로 뜨고, **설정 › 최근 알림**에 "새 문의" 알림이 남아요.
2. **현장 발행:** 파트너 **현장 발행**에서 사진을 공개로 고르고 정보를 넣어 발행하면 → 홈 "최근 발행 현장", 공개 사이트 홈 · 같은 동 지역 페이지에 바로 들어가요.
3. **페이지 생성 → 검수 → 공개:** 어드민 **페이지 생성**에서 만든 페이지는 "검수 중"(미리보기만)이에요. **검수**에서 승인하면 → 공개 사이트에 손님에게도 보이게 돼요.

> 사진은 확인용 무료 스톡 사진이에요. 운영 전에 업체의 실제 현장 사진으로 바꿔야 해요.
