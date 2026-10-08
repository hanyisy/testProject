/* 본사 직원 권한 — 한 곳에서만 정함. 사이드바 메뉴와 각 화면 접근 검사가 모두 여기서 읽음
 * 표는 시안 3n 설정의 PERMS 그대로 (최고 관리자 · 관리팀 · 제작 담당) */
import type { Role } from './auth';

export const PERMS = {
  '직원 계정 관리': ['최고 관리자'],
  '요금제 편집': ['최고 관리자'],
  '양산 범위 변경': ['최고 관리자', '관리팀'],
  '파트너 관리': ['최고 관리자', '관리팀'],
  '검수': ['최고 관리자', '관리팀'],
  '입금 확인 · 세금계산서': ['최고 관리자', '관리팀'],
  '대행 작업': ['최고 관리자', '관리팀'],
  '작업 로그': ['최고 관리자', '관리팀', '제작 담당'],
  '업종 템플릿': ['최고 관리자', '제작 담당'],
  '설정 · 외부 연동 값': ['최고 관리자', '제작 담당'],
  '랜딩 관리': ['최고 관리자', '관리팀'],
  '모두': ['최고 관리자', '관리팀', '제작 담당']
} as const satisfies Record<string, readonly Role[]>;
export type Perm = keyof typeof PERMS;

export const can = (role: Role | null | undefined, perm: Perm) => !!role && (PERMS[perm] as readonly Role[]).includes(role);

/* 사이드바 메뉴 → 필요한 권한 (메뉴 순서는 시안 3a) */
export const ADMIN_MENU: { href: string; label: string; perm: Perm; count?: 'leads' | 'review' | 'jobs' | 'money' | 'agency' }[] = [
  { href: '/admin', label: '대시보드', perm: '모두' },
  { href: '/admin/leads', label: '가입 문의', perm: '파트너 관리', count: 'leads' },
  { href: '/admin/partners', label: '파트너', perm: '파트너 관리' },
  { href: '/admin/generate', label: '페이지 생성', perm: '모두' },
  { href: '/admin/templates', label: '업종 템플릿', perm: '업종 템플릿' },
  { href: '/admin/plans', label: '요금제', perm: '모두' },
  { href: '/admin/indexing', label: '발행·색인', perm: '모두' },
  { href: '/admin/review', label: '검수', perm: '검수', count: 'review' },
  { href: '/admin/jobs', label: '작업 로그', perm: '작업 로그', count: 'jobs' },
  { href: '/admin/billing', label: '문의·정산', perm: '입금 확인 · 세금계산서', count: 'money' },
  { href: '/admin/agency', label: '대행 작업', perm: '대행 작업', count: 'agency' }
];
export const ADMIN_FOOT: { href: string; label: string; perm: Perm; sub?: boolean }[] = [
  { href: '/admin/settings', label: '설정', perm: '모두' },
  { href: '/admin/settings/landing', label: '랜딩 관리', perm: '랜딩 관리', sub: true }
];
