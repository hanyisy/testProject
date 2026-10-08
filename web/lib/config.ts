/* 서비스 설정 — 화면 코드에 직접 쓰지 않고 여기 한 곳에서 읽음 (환경 변수로 바꿀 수 있음) */
import 'server-only';
import { getSetting } from './admin';

/** 컨펌용 데모 계정 바로 들어가기 (로그인 화면 아래). 운영에서는 DEMO_LOGIN=off */
export const DEMO_LOGIN = process.env.DEMO_LOGIN !== 'off';

/** 서비스 도메인: 파트너 임시 주소, DNS 안내, 접속 주소에 쓰임 */
export const SERVICE_DOMAIN = process.env.SERVICE_DOMAIN || 'hyeonjanglog.kr';
export const PARTNER_APP_HOST = process.env.PARTNER_APP_HOST || `partner.${SERVICE_DOMAIN}`;
export const DNS_TARGET = { a: process.env.DNS_A_RECORD || '76.76.21.21', cname: `partners.${SERVICE_DOMAIN}` };
export const tempHost = (slug: string) => `${slug}.${SERVICE_DOMAIN}`;
export const dnsRecords = (verifyToken: string) => [
  ['A', '@', DNS_TARGET.a], ['CNAME', 'www', DNS_TARGET.cname], ['TXT', '@', `hjlog-verify=${verifyToken}`]
] as const;

/** 화면의 "오늘" 기준일 (YYYY-MM-DD) — 컨펌 단계는 시안 기준일(설정 demo_today), 없으면 실제 오늘 */
export async function today(): Promise<string> {
  const real = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  return getSetting<string>('demo_today', real);
}
/** 본사 어드민 접속 주소 (직원 계정 안내문) */
export const ADMIN_APP_HOST = process.env.ADMIN_APP_HOST || `admin.${SERVICE_DOMAIN}`;
