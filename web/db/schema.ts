/* 현장로그 DB 스키마 — 설명은 docs/db.md
 * 선택값은 화면 문구와 같은 한국어 문자열을 그대로 씁니다. */
import { sql } from 'drizzle-orm';
import {
  pgTable, uuid, text, integer, boolean, timestamp, date, jsonb, primaryKey, index, uniqueIndex, real
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/* ---------- 계정 · 로그인 ---------- */

export const users = pgTable('users', {
  id: id(),
  loginId: text('login_id').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  kind: text('kind').$type<'staff' | 'partner'>().notNull(),
  role: text('role').$type<'최고 관리자' | '관리팀' | '제작 담당'>(),
  partnerId: uuid('partner_id').references(() => partners.id),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  status: text('status').$type<'첫 로그인 전' | '사용 중' | '사용 중지'>().notNull().default('첫 로그인 전'),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  activityCount: integer('activity_count').notNull().default(0),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdBy: uuid('created_by'),
  createdAt: createdAt()
});

export const sessions = pgTable('sessions', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull().unique(),
  keep: boolean('keep').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  userAgent: text('user_agent'),
  createdAt: createdAt()
});

export const loginAttempts = pgTable('login_attempts', {
  loginId: text('login_id').primaryKey(),
  failedCount: integer('failed_count').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/* ---------- 업종 · 요금제 · 파트너 ---------- */

export const industries = pgTable('industries', {
  id: id(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  status: text('status').$type<'사용 가능' | '신규 중지' | '보관'>().notNull().default('사용 가능'),
  sort: integer('sort').notNull().default(0),
  createdAt: createdAt()
});

export const industryItems = pgTable('industry_items', {
  id: id(),
  industryId: uuid('industry_id').notNull().references(() => industries.id),
  group: text('group').$type<'작업 종류' | '대상 유형' | '현장 입력 항목' | '가이드 뼈대' | '핵심 검색어' | '지역 정보 항목'>().notNull(),
  label: text('label').notNull(),
  sort: integer('sort').notNull().default(0)
});

export type MlConfig = { langs: string[]; countries: Record<string, string[]>; regions: string[]; scope: string };
export type Features = { alim: boolean; blog: '꺼짐' | '직접 올리기' | '본사 대행'; place: boolean; ml: boolean; sheet: boolean };

export const plans = pgTable('plans', {
  id: id(),
  name: text('name').notNull().unique(),
  setupFee: integer('setup_fee').notNull(),
  monthlyFee: integer('monthly_fee').notNull(),
  extraNote: text('extra_note').notNull().default(''),
  /** 지원형: 우리 사이트 경유 계약 금액의 정산율(%) — 0이면 정산 없음 */
  settleRatePct: integer('settle_rate_pct').notNull().default(0),
  defaultFeatures: jsonb('default_features').$type<Features>().notNull(),
  sort: integer('sort').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const partners = pgTable('partners', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  ceo: text('ceo'),
  bizRegNo: text('biz_reg_no'),
  tel: text('tel'),
  /** 전화 받는 시간 (공개 사이트 문의) */
  hours: text('hours'),
  /** 사업장 주소 (공개 사이트 바닥 사업자 정보) */
  address: text('address'),
  manager: text('manager'),
  mobile: text('mobile'),
  email: text('email'),
  /** 세금계산서용 사업자 정보 (상호 · 사업자등록번호 · 받을 이메일) — 셋 다 있어야 바로 요청됨 */
  bizName: text('biz_name'),
  taxEmail: text('tax_email'),
  /** 알림 설정: 새 문의 알림톡 · 결과 입력 알림 · 색인 완료 알림 */
  notify: jsonb('notify').$type<{ lead: boolean; result: boolean; indexed: boolean }>().notNull().default({ lead: true, result: true, indexed: true }),
  industryId: uuid('industry_id').notNull().references(() => industries.id),
  planId: uuid('plan_id').notNull().references(() => plans.id),
  status: text('status').$type<'준비 중' | '운영 중' | '종료'>().notNull().default('준비 중'),
  scope: text('scope').$type<'기본' | '확장' | '최대'>().notNull().default('기본'),
  payMode: text('pay_mode').$type<'계좌 입금' | '온라인 결제' | '둘 다'>().notNull().default('계좌 입금'),
  brandColor: text('brand_color'),
  mark: text('mark'),
  driveFolderUrl: text('drive_folder_url'),
  driveConnected: boolean('drive_connected').notNull().default(false),
  driveSyncedAt: timestamp('drive_synced_at', { withTimezone: true }),
  startedAt: date('started_at'),
  endedAt: date('ended_at'),
  createdBy: uuid('created_by'),
  createdAt: createdAt()
});

export const partnerRegions = pgTable('partner_regions', {
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  region: text('region').notNull(),
  sort: integer('sort').notNull().default(0)
}, (t) => [primaryKey({ columns: [t.partnerId, t.region] })]);

export const partnerFeatures = pgTable('partner_features', {
  partnerId: uuid('partner_id').primaryKey().references(() => partners.id),
  alim: boolean('alim').notNull().default(true),
  blog: text('blog').$type<Features['blog']>().notNull().default('꺼짐'),
  place: boolean('place').notNull().default(false),
  ml: boolean('ml').notNull().default(false),
  sheet: boolean('sheet').notNull().default(false),
  mlConfig: jsonb('ml_config').$type<MlConfig>()
});

export const scopeLogs = pgTable('scope_logs', {
  id: id(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  userId: uuid('user_id').references(() => users.id),
  who: text('who').notNull(),
  what: text('what').notNull(),
  warningAck: text('warning_ack').$type<'확인함' | '해당 없음'>().notNull(),
  createdAt: createdAt()
});

export const domains = pgTable('domains', {
  partnerId: uuid('partner_id').primaryKey().references(() => partners.id),
  domain: text('domain').notNull(),
  registrar: text('registrar').notNull().default('가비아'),
  connection: text('connection').$type<'미연결' | '확인 중' | '연결됨'>().notNull().default('미연결'),
  certificate: text('certificate').$type<'대기' | '발급 중' | '발급 완료'>().notNull().default('대기'),
  verifyToken: text('verify_token').notNull(),
  checkedAt: timestamp('checked_at', { withTimezone: true })
});

/* ---------- 현장 · 사진 · 페이지 ---------- */

export const sites = pgTable('sites', {
  id: id(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  title: text('title').notNull(),
  region: text('region'),
  workType: text('work_type'),
  buildingType: text('building_type'),
  areaPyeong: integer('area_pyeong'),
  days: integer('days'),
  note: text('note'),
  /** 공개 현장 기록(06): 층 · 한 줄 요약 · 있었던 문제와 처리 */
  floorNote: text('floor_note'),
  summary: text('summary'),
  issues: jsonb('issues').$type<{ title: string; body: string }[]>().notNull().default([]),
  workedAt: date('worked_at'),
  photoCount: integer('photo_count').notNull().default(0),
  status: text('status').$type<'작성 중' | '발행됨'>().notNull().default('작성 중'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: createdAt()
}, (t) => [index('sites_partner_idx').on(t.partnerId)]);

export const photos = pgTable('photos', {
  id: id(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  siteId: uuid('site_id').references(() => sites.id),
  fileKey: text('file_key').notNull(),
  takenAt: timestamp('taken_at', { withTimezone: true }),
  /** 촬영 위치로 정한 지역 이름 (예: 춘천 퇴계동) — 새 사진을 날짜 · 지역으로 묶을 때 씀 */
  place: text('place'),
  label: text('label'),
  /** 공개 페이지에서 쓰는 사진 설명 · 작업 전/후 · 현장 안 순서 */
  caption: text('caption'),
  shot: text('shot').$type<'전' | '후'>(),
  sort: integer('sort').notNull().default(0),
  source: text('source').$type<'직접 올림' | '드라이브'>().notNull(),
  hasPerson: boolean('has_person').notNull().default(false),
  partnerPublic: boolean('partner_public').notNull().default(false),
  duplicateOf: uuid('duplicate_of'),
  /** 같은 파일을 두 번 올리지 않게 (내용 해시) */
  contentHash: text('content_hash'),
  createdAt: createdAt()
}, (t) => [index('photos_partner_idx').on(t.partnerId)]);

export type PageType = '현장' | '지역' | '지역 허브' | '역 주변' | '가이드' | '질문';
export type PageStatus = '작성 중' | '검수 중' | '발행됨' | '색인 요청' | '색인 확인' | '비공개';

export const pages = pgTable('pages', {
  id: id(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  siteId: uuid('site_id').references(() => sites.id),
  type: text('type').$type<PageType>().notNull(),
  title: text('title').notNull(),
  /** 공개 주소 (/p/{slug}/ 뒤) · 페이지 생성 기록 · 지역(예: 춘천 석사동) · 작업 · 시안 */
  path: text('path'),
  runId: uuid('run_id'),
  regionKey: text('region_key'),
  work: text('work'),
  draftLabel: text('draft_label'),
  lang: text('lang').notNull().default('ko'),
  status: text('status').$type<PageStatus>().notNull().default('작성 중'),
  visits30d: integer('visits_30d').notNull().default(0),
  uniqueRatio: real('unique_ratio'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  indexRequestedAt: timestamp('index_requested_at', { withTimezone: true }),
  indexedAt: timestamp('indexed_at', { withTimezone: true }),
  sort: integer('sort').notNull().default(0),
  createdAt: createdAt()
}, (t) => [index('pages_partner_idx').on(t.partnerId)]);

export const pageQueries = pgTable('page_queries', {
  id: id(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  pageId: uuid('page_id').references(() => pages.id),
  query: text('query').notNull(),
  clicks: integer('clicks').notNull().default(0),
  period: text('period').notNull()
});

/* ---------- 페이지 생성 · 검수 ---------- */

export const generationRuns = pgTable('generation_runs', {
  id: id(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  pageType: text('page_type').notNull(),
  regions: text('regions').array().notNull(),
  draftCount: integer('draft_count').notNull(),
  status: text('status').$type<'사진 연결' | '생성 중' | '완료' | '배분 확인' | '검수로 넘김'>().notNull().default('사진 연결'),
  /** 작업 (예: 상가철거) — 업종 템플릿의 대상 유형 + 업종 */
  work: text('work').notNull().default(''),
  /** 시안 생성 시작 시각 (다시 생성하면 새로) · 다시 생성 횟수 */
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  regenCount: integer('regen_count').notNull().default(0),
  /** 파트너에게 미리보기 확인 요청을 보낸 때 */
  previewRequestedAt: timestamp('preview_requested_at', { withTimezone: true }),
  createdBy: uuid('created_by'),
  createdAt: createdAt()
});

export const generationDrafts = pgTable('generation_drafts', {
  runId: uuid('run_id').notNull().references(() => generationRuns.id),
  label: text('label').notNull(),
  style: text('style').notNull(),
  description: text('description').notNull().default(''),
  picked: boolean('picked').notNull().default(false),
  partnerLike: boolean('partner_like').notNull().default(false),
  partnerNote: text('partner_note').notNull().default('')
}, (t) => [primaryKey({ columns: [t.runId, t.label] })]);

export const generationAssignments = pgTable('generation_assignments', {
  runId: uuid('run_id').notNull().references(() => generationRuns.id),
  region: text('region').notNull(),
  draftLabel: text('draft_label').notNull(),
  photoIds: uuid('photo_ids').array().notNull().default(sql`'{}'::uuid[]`),
  /** 배정 사진 바꾸기 횟수 (같은 지역 사진 중 다음 묶음으로) */
  photoSeed: integer('photo_seed').notNull().default(0),
  override: boolean('override').notNull().default(false)
}, (t) => [primaryKey({ columns: [t.runId, t.region] })]);

export const reviewBundles = pgTable('review_bundles', {
  id: id(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  kind: text('kind').notNull(),
  type: text('type').$type<'지역' | '번역' | '질문'>().notNull(),
  draftStyle: text('draft_style'),
  col1: text('col1').notNull(),
  col2: text('col2').notNull(),
  commonBody: text('common_body').array().notNull(),
  createdOn: text('created_on').notNull(),
  createdAt: createdAt()
});

export const reviewItems = pgTable('review_items', {
  id: id(),
  bundleId: uuid('bundle_id').notNull().references(() => reviewBundles.id),
  pageId: uuid('page_id').references(() => pages.id),
  name: text('name').notNull(),
  info: text('info').notNull(),
  photos: integer('photos').notNull(),
  sites: integer('sites').notNull(),
  uniquePct: integer('unique_pct').notNull(),
  state: text('state').$type<'대기' | '검수 완료' | '발행 중 · 수정 대기' | '개별 검수' | '반려'>().notNull().default('대기'),
  selected: boolean('selected').notNull().default(true),
  reasons: text('reasons').array().notNull().default(sql`'{}'::text[]`),
  note: text('note'),
  /** 검수 완료 · 발행 안 함으로 정한 때 (오늘 검수 완료 수) */
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  sort: integer('sort').notNull().default(0)
});

export const reviewHistory = pgTable('review_history', {
  id: id(),
  bundleId: uuid('bundle_id').references(() => reviewBundles.id),
  bundleLabel: text('bundle_label').notNull(),
  userId: uuid('user_id').references(() => users.id),
  who: text('who').notNull(),
  what: text('what').notNull(),
  snapshot: jsonb('snapshot'),
  reverted: boolean('reverted').notNull().default(false),
  whenText: text('when_text').notNull(),
  createdAt: createdAt()
});

export const translations = pgTable('translations', {
  id: id(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  pageTitle: text('page_title').notNull(),
  lang: text('lang').notNull(),
  status: text('status').$type<'검수 대기' | '완료'>().notNull().default('검수 대기')
});

/* ---------- 문의 · 정산 · 블로그 ---------- */

export const leads = pgTable('leads', {
  id: id(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  company: text('company').notNull(),
  manager: text('manager'),
  phone: text('phone').notNull(),
  email: text('email'),
  homepage: text('homepage'),
  message: text('message'),
  industry: text('industry').notNull(),
  regions: text('regions').array().notNull().default(sql`'{}'::text[]`),
  requestType: text('request_type').$type<'new' | 'waitlist'>().notNull().default('new'),
  sourceForm: text('source_form'),
  status: text('status').$type<'신규' | '연락함' | '상담 중' | '계약' | '보류'>().notNull().default('신규'),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  partnerId: uuid('partner_id').references(() => partners.id)
});

export const leadMemos = pgTable('lead_memos', {
  id: id(),
  leadId: uuid('lead_id').notNull().references(() => leads.id),
  userId: uuid('user_id').references(() => users.id),
  body: text('body').notNull(),
  createdAt: createdAt()
});

export type InquiryStatus = '신규' | '상담' | '견적' | '계약' | '완료' | '무산';

export const inquiries = pgTable('inquiries', {
  id: id(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  title: text('title').notNull(),
  pageId: uuid('page_id').references(() => pages.id),
  pageTitle: text('page_title'),
  pageType: text('page_type').$type<PageType>(),
  channel: text('channel').$type<'폼' | '전화'>().notNull().default('폼'),
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  body: text('body'),
  status: text('status').$type<InquiryStatus>().notNull().default('신규'),
  verify: text('verify').$type<'확인 중' | '확인됨' | '본인 아님'>().notNull().default('확인 중'),
  amount: integer('amount'),
  /** 견적을 보낸 뒤 결과(계약 · 무산)를 아직 입력하지 않음 */
  needsResult: boolean('needs_result').notNull().default(false)
}, (t) => [index('inquiries_partner_idx').on(t.partnerId)]);

export const charges = pgTable('charges', {
  id: id(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  billedOn: date('billed_on').notNull(),
  item: text('item').notNull(),
  method: text('method').$type<'계좌 입금' | '온라인 결제'>().notNull(),
  amount: integer('amount').notNull(),
  state: text('state').$type<'입금 대기' | '미결제' | '결제 완료' | '입금 확인' | '면제'>().notNull(),
  payer: text('payer'),
  confirmedBy: uuid('confirmed_by'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true })
});

export const taxRequests = pgTable('tax_requests', {
  id: id(),
  chargeId: uuid('charge_id').notNull().references(() => charges.id),
  requestedOn: date('requested_on').notNull(),
  state: text('state').$type<'요청됨' | '발행 완료'>().notNull().default('요청됨'),
  issuedBy: uuid('issued_by'),
  issuedAt: timestamp('issued_at', { withTimezone: true })
});

export const settlements = pgTable('settlements', {
  id: id(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  month: text('month').notNull(),
  contractCount: integer('contract_count').notNull(),
  contractAmount: integer('contract_amount').notNull(),
  ratePct: integer('rate_pct').notNull(),
  fee: integer('fee').notNull(),
  /** 달이 끝나 청구한 정산 수수료 청구 건 — 없으면 아직 진행 중(다음 달 1일 청구 예정) */
  chargeId: uuid('charge_id').references(() => charges.id)
}, (t) => [uniqueIndex('settlements_partner_month').on(t.partnerId, t.month)]);

export const blogPosts = pgTable('blog_posts', {
  id: id(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  siteId: uuid('site_id').references(() => sites.id),
  siteTitle: text('site_title').notNull(),
  siteDate: text('site_date').notNull(),
  title: text('title').notNull(),
  body: text('body').array().notNull(),
  mode: text('mode').$type<'직접 올리기' | '본사 대행'>().notNull(),
  status: text('status').$type<'초안' | '승인 대기' | '승인' | '올림'>().notNull().default('초안'),
  url: text('url'),
  billedThisMonth: boolean('billed_this_month').notNull().default(false),
  approvedOn: text('approved_on'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  sort: integer('sort').notNull().default(0)
});

/** 파트너가 본사에 보내는 요청 (기능 추가 · 지역 추가 문의) — 본사 대시보드 할 일에 뜸 */
export const partnerRequests = pgTable('partner_requests', {
  id: id(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  kind: text('kind').$type<'기능 추가' | '지역 추가'>().notNull(),
  subject: text('subject').notNull(),
  note: text('note'),
  status: text('status').$type<'접수' | '처리 완료'>().notNull().default('접수'),
  createdAt: createdAt()
});

/* ---------- 운영 ---------- */

export const jobs = pgTable('jobs', {
  id: id(),
  partnerId: uuid('partner_id').references(() => partners.id),
  kind: text('kind').$type<'사진 처리' | '빌드' | '배포' | '색인 전송' | '시트 동기화'>().notNull(),
  status: text('status').$type<'성공' | '실패' | '재시도 중' | '제작 담당 전달'>().notNull(),
  reason: text('reason'),
  willFailAgain: boolean('will_fail_again').notNull().default(false),
  tries: integer('tries').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const landingCaptures = pgTable('landing_captures', {
  id: id(),
  imageKey: text('image_key').notNull(),
  query: text('query').notNull(),
  industry: text('industry').notNull(),
  partnerId: uuid('partner_id').references(() => partners.id),
  capturedOn: date('captured_on').notNull(),
  visible: boolean('visible').notNull().default(true),
  sort: integer('sort').notNull().default(0),
  blur: jsonb('blur').$type<{ x: number; y: number; w: number; h: number }[]>().notNull().default([]),
  createdBy: uuid('created_by'),
  createdAt: createdAt()
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const auditLogs = pgTable('audit_logs', {
  id: id(),
  userId: uuid('user_id'),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  detail: jsonb('detail'),
  createdAt: createdAt()
});
