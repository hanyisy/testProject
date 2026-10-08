/* 직원 화면 공용 표기 (시안 3z: 역할 칩 · 상태 칩) */
export const ROLE_CHIP: Record<string, string> = { '최고 관리자': 'red', '관리팀': 'info', '제작 담당': 'gray' };
export const STAFF_ST: Record<string, string> = { '사용 중': 'ok', '첫 로그인 전': 'warn', '사용 중지': 'gray' };
export const ROLE_INFO = [
  ['최고 관리자', '전부 + 직원 계정 관리 · 요금제 편집 · 양산 범위 변경'],
  ['관리팀', '파트너 관리 · 검수 · 입금 확인 · 세금계산서 · 대행 작업'],
  ['제작 담당', '작업 로그 · 업종 템플릿 · 외부 연동 값']
] as const;
