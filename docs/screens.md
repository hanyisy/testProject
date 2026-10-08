# 화면 목록 · 주소

시안 번호는 `design/` 파일 안 프레임 번호입니다. 상태가 다른 같은 화면(예: 사진 추가 3가지)은 주소 하나에서 상태로 나뉩니다.

## 공통

| 주소 | 화면 | 시안 |
|---|---|---|
| `/login` | 로그인 (틀렸을 때 · 5회 실패 포함) | 어드민 `3-login` · 파트너 `2k` `2k-2` `2k-3` / 모바일 `1k` … |
| `/login/password` | 첫 로그인 비밀번호 변경 | `3-login-2` · `2l` · `1l` |
| `/forbidden` | 권한 없음 | 시안 없음 — 같은 토큰으로 |
| — | 세션 만료 → `/login?next=…&reason=expired` | 시안 없음 — 로그인 화면 안내 문구 |
| — | 사용 중지 계정 안내 | 시안 없음 — 로그인 화면 안내 문구 |
| (컴포넌트) | 목록 빈 상태 · 불러오는 중 · 불러오기 실패 + 다시 시도 | 시안 없음 — 공용 컴포넌트 하나 |

## 본사 어드민 `/admin` (1440 기준 · 반응형)

| 주소 | 화면 | 시안 |
|---|---|---|
| `/admin` | 대시보드 | `3a` |
| `/admin/leads` | 가입 문의 | `3-lead` |
| `/admin/leads/[id]` | 가입 문의 상세 | `3-lead-2` |
| `/admin/partners` | 파트너 | `3b` |
| `/admin/partners/new` | 파트너 추가 4단계: 업체 정보 → 로그인 계정 → 서비스 설정 → 전달 | `3y-1` `3y-2` `3y-3` `3y-4` |
| `/admin/partners/[id]` | 파트너 상세 · 기본 정보 | `3c` |
| `/admin/partners/[id]/features` | 기능 스위치 · 양산 범위 선택 | `3d` `3g` |
| `/admin/partners/[id]/domain` | 도메인 연결 | `3e` |
| `/admin/partners/[id]/billing` | 결제 | `3f` |
| `/admin/generate` | 페이지 생성: 사진 연결 → 생성 설정 → 시안 미리보기(생성 중 · 완료) → 시안 선택 → 배분 확인 → 검수·배포 | `3r` `3s` `3t` `3u` `3v` `3w` `3x` |
| `/admin/templates` | 업종 템플릿 (업종×지역 점유 포함) | `3h` |
| `/admin/plans` | 요금제 | `3i` |
| `/admin/indexing` | 발행·색인 | `3j` |
| `/admin/review` | 검수 | `3o` |
| `/admin/review/[bundleId]` | 검수 · 묶음 상세 · 공통 본문 수정 | `3p` `3q` |
| `/admin/jobs` | 작업 로그 | `3k` |
| `/admin/billing` | 문의·정산 | `3l` |
| `/admin/agency` | 대행 작업 | `3m` |
| `/admin/settings` | 설정 | `3n` |
| `/admin/settings/landing` | 랜딩 관리: 검색 화면 캡처 · 랜딩 값 | 시안 없음 — 설정 아래 새 메뉴, 같은 컴포넌트로 |
| `/admin/staff` | 직원 계정 관리 | `3z` |
| `/admin/staff/new` | 직원 추가 · 완료 | `3z-2` `3z-3` |
| `/admin/staff/[id]` | 직원 상세 | `3z-4` |
| `/admin/me` | 내 계정 | `3z-5` |

## 파트너 관리자 `/partner` (데스크톱 1440 사이드바 · 모바일 390 하단 탭)

| 주소 | 화면 | 데스크톱 | 모바일 |
|---|---|---|---|
| `/partner` | 홈 | `2a` | `1a` |
| `/partner/sites` | 현장 발행 (자동 묶음 `?g=`) | `2b` | `1b` |
| `/partner/photos` | 사진 추가 (연결 전 · 올리는 중 · 올린 뒤) | `2i` `2i-2` `2i-3` | `1i` `1i-2` `1i-3` |
| `/partner/search` | 검색 노출 | `2c` | `1c` |
| `/partner/making` | 만들고 있는 페이지 | `2j` | `1j` |
| `/partner/inquiries` | 문의 (상태 드롭다운 · 모바일 하단 시트) | `2d` | `1d` |
| `/partner/blog` | 블로그 (잠금 · 사용 · 본사 대행) | `2e` `2f` `2f-2` | `1e` `1f` `1f-2` |
| `/partner/billing` | 결제 내역 | `2g` | `1g` |
| `/partner/settings` | 설정 | `2h` | `1h` |

## 공개 (지금 `site/`)

| 주소 | 화면 |
|---|---|
| `/landing/` · `done.html` · `privacy.html` · `terms.html` | 가입 문의 랜딩 |
| `/p/{slug}/contact/done` · 비공개 안내 | 업체 공개 사이트 일부 |
| `404` · `error` · `maintenance` | 안내 화면 |
