/* 한국어 문구 도구 — 조사 맞추기 · {칸} 채우기 (서버 전용 아님: 시드 · 화면 어디서나) */

/* 받침 있으면 은/을/이/과, 없으면 는/를/가/와 */
const JOSA: Record<string, [string, string]> = { 은: ['은', '는'], 을: ['을', '를'], 이: ['이', '가'], 과: ['과', '와'], 으로: ['으로', '로'] };
export function josa(word: string, kind: string) {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  const pair = JOSA[kind] ?? [kind, kind];
  if (code < 0 || code > 11171) return word + pair[1];
  const jong = code % 28;
  if (kind === '으로' && jong === 8) return word + '로';
  return word + (jong ? pair[0] : pair[1]);
}
/** "{작업|은} 며칠 걸리나요?" → "상가 철거는 며칠 걸리나요?" */
export const fill = (s: string, v: Record<string, string>) => s.replace(/\{([^}|]+)(?:\|([^}]+))?\}/g, (m, k, j) => (v[k] === undefined ? m : j ? josa(v[k], j) : v[k]));

/** "1~2일" → "1~2일이에요" · "하루" → "하루예요" (받침에 맞춘 -이에요/-예요) */
export function copula(word: string) {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00;
  return word + (code >= 0 && code <= 11171 && code % 28 === 0 ? '예요' : '이에요');
}

/** 업종마다 다른 말 (공개 사이트 · 생성 본문) — 시공 업종이 기본, 개인회생처럼 "현장"이 아닌 업종은 업종 내용(terms)에서 바꿈 */
export type Terms = {
  /** 현장 / 사례 */ case: string;
  /** 머리 메뉴 · 홈 섹션 이름: 시공 사례 / 진행 사례 */ cases: string;
  /** 홈 최근 현장 아래 한 줄 */ recentSub: string;
  /** 사진 두 장의 이름 (작업 전 · 후) — 빈 배열이면 이름표 없이 */ shots: string[];
  /** 작업 전 · 후 섹션 제목 */ ba: string;
  /** 있었던 문제와 처리 */ issues: string;
  /** 문의 버튼 · 제목 */ quote: string;
  /** 시안 본문 {문의 방법} — 현장 사진과 함께 / 채무와 소득을 간단히 적어 */ ask: string;
  /** 문의 제목 아래 한 줄 */ quoteSub: string;
  /** 문의 화면 머리 문구 */ contactLead: string;
  /** 지역 정보 카드 제목 뒤쪽 (○○동 · 신고 절차) */ permit: string;
  /** 지역 정보 카드 제목 뒤쪽 (○○동 · 이 지역 건물 특성) */ areaInfo: string;
  /** 비용 표 제목 (값이 있으면 이것으로) */ costTitle: string;
  /** 지역 페이지끼리 잇는 묶음 이름 (다른 작업 · 작업별) */ kind: string;
  /** 기간 표시 ({n}일) */ days: string;
  /** 접수 후 안내 3단계 */ after: [string, string][];
};
export const DEFAULT_TERMS: Terms = {
  case: '현장', cases: '시공 사례', recentSub: '날짜, 평수, 작업 기간을 그대로 적었어요', shots: ['작업 전', '작업 후'], ba: '작업 전 · 후', issues: '있었던 문제와 처리',
  quote: '사진 보내고 견적 받기', ask: '현장 사진과 함께', quoteSub: '현장 사진이 있으면 더 정확하게 안내해 드려요', contactLead: '전화가 가장 빨라요. 작업 중이라 못 받으면 문자로 다시 연락드려요.',
  permit: '신고 절차', areaInfo: '이 지역 건물 특성', costTitle: '', kind: '작업', days: '{n}일',
  after: [['접수되면 확인 알림톡을 보내드려요', '남겨 주신 연락처로 바로 보내요'], ['하루 안에 연락드려요', '작업 중이면 저녁에 연락드릴 수 있어요'], ['사진을 보고 견적을 안내해요', '필요하면 현장에 직접 가서 확인해요']]
};
export const termsOf = (t?: Partial<Terms> | null): Terms => ({ ...DEFAULT_TERMS, ...(t ?? {}) });
/** 기간 표시: "{n}일" → "2일" · "개시까지 {n}일" → "개시까지 45일" */
export const daysText = (t: Terms, n: number) => t.days.replace('{n}', String(n));
