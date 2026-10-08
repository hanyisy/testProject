# DB 설계 (1차)

PostgreSQL · Drizzle ORM. 스키마 원본은 `web/db/schema.ts`이고, 이 문서는 그 설명입니다.
컨펌 단계 더미 데이터는 시안 값을 그대로 넣습니다(`web/db/seed.ts`). 시안 기준 "오늘"은 2026-10-07입니다.

## 원칙
- **파트너 데이터 분리**: 파트너가 가진 행에는 모두 `partner_id`가 있고, 파트너 화면의 모든 조회는 세션의 `partner_id`로만 거릅니다.
- **지우지 않기**: 직원·파트너·업종은 삭제하지 않고 상태로 막습니다(사용 중지 · 종료 · 신규 중지 · 보관).
- **기록 남기기**: 양산 범위 선택, 일괄 검수, 입금 확인, 계정 발급 같은 일은 누가·언제를 남깁니다(`audit_logs` + 각 기록 테이블).
- **설정값은 DB에**: 색인 기간 안내 23일, 하루 발행 상한, 결제·알림톡 코드 등은 `settings`.
- 시각은 `timestamptz`, 금액은 원 단위 `integer`, 선택값은 `text` + 체크 제약(화면 문구와 같은 값).

## 관계 한눈에

```
users ─┬─ sessions
       └─ (partner_id) ─ partners ─┬─ partner_regions ── industries(업종 템플릿) ── industry_items
                                   ├─ partner_features · scope_logs · domains
                                   ├─ sites(현장) ── photos
                                   ├─ pages ── page_queries
                                   ├─ inquiries(고객 문의)
                                   ├─ charges(청구·결제) ── tax_requests
                                   ├─ blog_posts
                                   └─ jobs(작업 로그)
plans(요금제) ── partners
leads(가입 문의) ── lead_memos          (랜딩 → 본사)
generation_runs ── generation_drafts · generation_assignments   (페이지 생성)
review_bundles ── review_items · review_history                   (검수)
translations · landing_captures · settings · audit_logs
```

## 계정 · 로그인

### users — 본사 직원과 파트너 계정 (파트너당 1개)
| 열 | 형식 | 설명 |
|---|---|---|
| id | uuid PK | |
| login_id | text unique | 아이디 (예 `doyoon.lee`, `hangyeol`) |
| password_hash | text | 해시만 저장 |
| kind | `staff` · `partner` | |
| role | `최고 관리자` · `관리팀` · `제작 담당` · null | 직원만 |
| partner_id | uuid FK null | 파트너 계정만 |
| name · phone · email | text | |
| status | `첫 로그인 전` · `사용 중` · `사용 중지` | 시안 직원 목록 상태 그대로 |
| must_change_password | boolean | 임시 비밀번호로 발급되면 true |
| last_login_at · created_at · created_by | | |

### sessions
`id`, `user_id`, `token_hash`(쿠키 값의 해시), `expires_at`, `keep`(로그인 상태 유지), `created_at`, `last_seen_at`, `user_agent`

### login_attempts — 5회 실패 10분 잠금
`login_id` PK, `failed_count`, `locked_until`, `updated_at`

## 업종 · 요금제 · 파트너

### industries — 업종 템플릿
| 열 | 설명 |
|---|---|
| id, code(unique), name | 코드와 보이는 이름 분리 (이름은 언제든 수정) |
| status | `사용 가능` · `신규 중지` · `보관` |
코드 변경·삭제 잠금은 연결된 파트너 수로 판단합니다(기획서 9장 잠금 규칙).

### industry_items — 템플릿 항목
`id`, `industry_id`, `group`(`작업 종류` · `대상 유형` · `현장 입력 항목` · `가이드 뼈대` · `핵심 검색어` · `지역 정보 항목`), `label`, `sort`

### plans — 요금제 (금액은 임시 값, 어드민에서 교체)
`id`, `name`(기본 · 성장 · 지원형), `setup_fee`, `monthly_fee`, `extra_note`, `default_features`(jsonb: alim · blog · place · ml · sheet), `updated_at`

### partners
| 열 | 설명 |
|---|---|
| id, slug(unique) | 공개 사이트 임시 주소 `/p/{slug}` |
| name, ceo, biz_reg_no, tel, manager, mobile, email | 업체 정보 (파트너 추가 1단계) |
| industry_id, plan_id | |
| status | `준비 중` · `운영 중` · `종료` |
| scope | 양산 범위 `기본` · `확장` · `최대` |
| pay_mode | `계좌 입금` · `온라인 결제` · `둘 다` |
| brand_color, mark | 공개 사이트 대표 색 · 로고 글자 |
| drive_folder_url, drive_connected, drive_synced_at | 사진 폴더 |
| started_at, ended_at, created_at, created_by | |

### partner_regions — 서비스 지역 (본사만 추가)
`partner_id`, `region`(예 `강원 춘천`), `sort`
**업종×지역 점유**는 `partner_regions` + `partners.industry_id` + `status ≠ 종료`로 계산합니다. 한 업종·지역에는 한 파트너만(서버에서 검사).

### partner_features — 기능 스위치 (요금제 기본값 → 파트너별 조정)
`partner_id` PK, `alim` bool, `blog`(`꺼짐` · `직접 올리기` · `본사 대행`), `place` bool, `ml` bool, `sheet` bool, `ml_config` jsonb(언어 · 대상 국가 · 지역 · 범위)

### scope_logs — 양산 범위 선택 기록
`id`, `partner_id`, `user_id`, `from_scope`, `to_scope`, `warning_ack`(`확인함` · `해당 없음`), `created_at`

### domains — 도메인 연결
`partner_id` PK, `domain`, `registrar`(가비아 · 후이즈 · 카페24 · 기타), `connection`(`미연결` · `확인 중` · `연결됨`), `certificate`(`대기` · `발급 중` · `발급 완료`), `verify_token`, `checked_at`

## 현장 · 사진 · 페이지

### sites — 현장
`id`, `partner_id`, `title`(예 춘천 석사동 상가 철거), `region`, `work_type`, `building_type`, `area_pyeong`, `days`, `note`, `worked_at`, `status`(`작성 중` · `발행됨`), `published_at`

### photos
`id`, `partner_id`, `site_id` null, `file_key`, `taken_at`, `lat`, `lng`, `source`(`직접 올림` · `드라이브`), `has_person`, `partner_public`(파트너가 공개 확인), `duplicate_of`, `created_at`
사람이 찍힌 사진과 공개 확인 전 사진은 배분·발행에서 빠집니다.

### pages
| 열 | 설명 |
|---|---|
| id, partner_id, site_id null | 현장이 연결되지 않은 페이지는 검수 통과·발행 불가 |
| type | `현장` · `지역` · `지역 허브` · `역 주변` · `가이드` · `질문` |
| title, path | |
| status | `작성 중` · `검수 중` · `발행됨` · `색인 요청` · `색인 확인` · `비공개` |
| lang | 기본 `ko`, 다국어면 `en` 등 |
| published_at, index_requested_at, indexed_at | 색인 기간 측정 |
| unique_ratio, photo_count | 검수 자동 분리 기준 |
| visits_30d | 유입 (더미) |

### page_queries — 실제 유입 검색어 (서치어드바이저)
`page_id`, `query`, `clicks`, `period`(월)

## 페이지 생성 · 검수

### generation_runs · generation_drafts · generation_assignments
- runs: `id`, `partner_id`, `page_type`(`지역×작업` 등), `regions` text[], `draft_count`, `status`(`생성 중` · `완료` · `배분 확인` · `검수로 넘김`), `created_by`, `created_at`
- drafts: `run_id`, `label`(A–E), `style`(사진 중심형 · 현장 기록형 · 질문 답변형 · 비용 안내형 · 지도 …), `picked`, `partner_like`, `partner_note`
- assignments: `run_id`, `region`, `draft_label`, `photo_ids` uuid[], `override`

### review_bundles · review_items · review_history — 일괄 검수
- bundles: `id`, `partner_id`, `kind`(예 `지역×상가철거 · 시안 A`), `type`(`지역` · `번역` · `질문`), `common_body` text[], `created_at`
- items: `bundle_id`, `page_id`, `region`, `info`, `photos`, `sites`, `unique_pct`, `state`(`대기` · `검수 완료` · `배포됨` · `제외` · `개별 검수`), `reasons` text[]
- history: `id`, `bundle_id`, `user_id`, `action`(`일괄 검수 완료` · `공통 본문 수정`), `count`, `snapshot` jsonb(되돌리기용), `reverted`, `created_at`

### translations — 번역 검수
`id`, `partner_id`, `page_id`, `lang`, `status`(`검수 대기` · `완료`), `glossary_note`

## 문의 · 정산 · 블로그

### leads — 가입 문의 (랜딩 폼)
| 열 | 설명 |
|---|---|
| id, received_at | |
| company, manager, phone, email, homepage, message | 랜딩 폼 값 |
| industry | 랜딩 업종 문자열 (`기타` 포함) |
| regions text[] | |
| request_type | `new` · `waitlist` (대기 신청 버튼으로 온 것) |
| source_form | `hero` · `full` |
| status | `신규` · `연락함` · `상담 중` · `계약` · `보류` |
| owner_user_id | 담당 직원 |
| partner_id | 파트너로 등록되면 연결 |
"신청 가능" 칩(`가능` · `점유됨 · 대기` · `등록됨`)은 점유 현황으로 계산합니다.

### lead_memos
`id`, `lead_id`, `user_id`, `body`, `created_at`

### inquiries — 파트너가 받는 고객 문의
`id`, `partner_id`, `received_at`, `title`, `page_id`, `page_type`, `channel`(`폼` · `전화`), `customer_name`, `customer_phone`, `body`,
`status`(`신규` · `상담` · `견적` · `계약` · `완료` · `무산`), `verify`(`확인 중` · `확인됨` · `본인 아님`), `amount`(계약 금액)

### charges — 청구 · 결제 · 입금 확인
`id`, `partner_id`, `billed_on`, `item`(예 월 관리비 · 10월), `method`(`계좌 입금` · `온라인 결제`), `amount`,
`state`(`입금 대기` · `미결제` · `결제 완료` · `입금 확인` · `면제`), `confirmed_by`, `confirmed_at`

### tax_requests — 세금계산서 발행 요청
`id`, `charge_id`, `requested_at`, `state`(`요청됨` · `발행 완료`), `issued_by`, `issued_at`
(파트너 사업자 정보가 없으면 요청할 때 입력 → `partners`에 저장)

### settlements — 지원형 정산 (경유 계약 수수료)
`id`, `partner_id`, `month`, `contract_count`, `contract_amount`, `rate`, `fee`

### blog_posts — 블로그 초안 · 대행
`id`, `partner_id`, `site_id`, `title`, `body` text[], `mode`(`직접 올리기` · `본사 대행`), `status`(`초안` · `승인 대기` · `승인` · `올림`), `url`, `approved_at`, `published_at`, `published_by`, `billed_month`

## 운영

### jobs — 작업 로그
`id`, `partner_id`, `kind`(`사진 처리` · `빌드` · `배포` · `색인 전송` · `시트 동기화`), `status`(`성공` · `실패` · `재시도 중` · `제작 담당 전달`), `reason`, `tries`, `created_at`, `finished_at`

### landing_captures — 랜딩 "실제 검색 화면" (랜딩 관리)
`id`, `image_key`, `query`, `industry`, `partner_id`, `captured_at`, `visible`, `sort`, `blur` jsonb(가린 영역), `created_by`
랜딩은 지금처럼 같은 모양의 JSON을 받습니다(`site/data/README.md`).

### settings — 설정값 (key/value)
`index_days`(23, 계약 안내용), `cap_per_partner`, `cap_total`(하루 발행 상한), `payment_key`, `alimtalk_codes`, `landing_values`(운영 업종 수 · 제작한 페이지 수 · 월 발행 수 · 수정 반영 기한 · 푸터 사업자 정보) …

### audit_logs
`id`, `user_id`, `action`, `target_type`, `target_id`, `detail` jsonb, `created_at`
