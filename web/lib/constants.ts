/* 시안에 고정값으로 들어 있는 선택지 · 안내 문구 (design/현장로그 본사 어드민.dc.html 스크립트 그대로) */
import type { ChipKind } from './format';

export const PARTNER_STATUS_CHIP: Record<string, ChipKind> = { '운영 중': 'ok', '준비 중': 'warn', '종료': 'gray' };

/* 양산 범위 3단계 (기획서 4장) */
export const TIERS = [
  { name: '기본', risk: ['위험 낮음', 'ok'], types: ['현장 기록', '구 단위 지역 페이지', '업종 가이드'], pages: 60 },
  { name: '확장', risk: ['주의', 'warn'], types: ['기본 전체', '동 단위 지역 페이지', '역 주변 · 자주 묻는 질문'], pages: 180 },
  { name: '최대', risk: ['위험 높음 · 스팸 패턴과 일치', 'red'], types: ['확장 전체', '동 × 작업 조합 페이지', '아파트 단지별 페이지'], pages: 640 }
] as const satisfies readonly { name: string; risk: readonly [string, ChipKind]; types: readonly string[]; pages: number }[];
export type Scope = (typeof TIERS)[number]['name'];

/* 기능 스위치 */
export const FEATURES = [
  { key: 'alim', label: '알림톡 리드 검증', sub: '문의가 들어오면 고객에게 알림톡으로 본인 확인을 받아요' },
  { key: 'blog', label: '블로그', sub: '현장 기록으로 블로그 글 초안을 만들어요' },
  { key: 'place', label: '플레이스 소식 초안', sub: '새 현장을 지도 플레이스 소식 글로 정리해요' },
  { key: 'ml', label: '다국어', sub: '지역·가이드 페이지를 다른 언어로 만들어요 · 검수 후 공개' },
  { key: 'sheet', label: '구글시트 자동 동기화', sub: '문의와 상태를 파트너 시트에 매일 옮겨요' }
] as const;
export const BLOG_MODES = ['꺼짐', '직접 올리기', '본사 대행'] as const;

/* 다국어 */
export const LANGS = ['영어', '중국어(간체)', '일본어', '베트남어'] as const;
export const COUNTRIES: Record<string, string[]> = { '영어': ['미국', '캐나다', '호주'], '중국어(간체)': ['중국', '싱가포르'], '일본어': ['일본'], '베트남어': ['베트남'] };
export const DOMESTIC = '국내 거주 외국인';
export const ML_SCOPE: Record<string, number> = { '지역 페이지만': 3, '지역 + 가이드': 6, '전체': 21 };

/* 도메인 연결 */
export const REGISTRARS: Record<string, string[]> = {
  '가비아': ['가비아 로그인 → My가비아 → 도메인 통합 관리툴', 'DNS 정보 → DNS 설정 → 레코드 수정', '아래 설정값 3개를 추가하고 저장'],
  '후이즈': ['후이즈 로그인 → 도메인 관리 → 네임서버/DNS', 'DNS 레코드 관리에서 레코드 추가', '아래 설정값 3개를 입력하고 적용'],
  '카페24': ['카페24 호스팅센터 → 도메인 관리 → DNS 관리', 'A 레코드와 CNAME 레코드를 각각 추가', 'TXT 레코드에 인증값 추가 후 저장'],
  '기타': ['도메인을 산 곳의 관리 화면에 로그인', 'DNS 또는 레코드 설정 메뉴로 이동', '아래 설정값 3개를 같은 형식으로 추가']
};

/* 결제 */
export const PAY_MODES = ['계좌 입금', '온라인 결제', '둘 다'] as const;
export const PAY_MODE_NOTE: Record<string, string> = {
  '계좌 입금': '청구서에 입금 계좌만 보여요. 입금 확인은 문의·정산에서 처리해요.',
  '온라인 결제': '청구서에 결제하기 버튼만 보여요. 카드 영수증이 자동 발급돼요.',
  '둘 다': '월 관리비는 온라인 결제, 정산 수수료는 계좌 입금으로 받고 있어요.'
};
export const CHARGE_CHIP: Record<string, ChipKind> = { '입금 대기': 'warn', '미결제': 'red', '결제 완료': 'ok', '입금 확인': 'ok', '면제': 'gray' };
export const TAX_CHIP: Record<string, ChipKind> = { '요청됨': 'warn', '발행 완료': 'ok', '요청 전': 'gray', '카드 영수증': 'gray', '해당 없음': 'gray' };
/** 업종 템플릿 항목 묶음 (시안 3h 순서) */
export const TEMPLATE_GROUPS = ['작업 종류', '대상 유형', '현장 입력 항목', '가이드 뼈대', '핵심 검색어'] as const;
