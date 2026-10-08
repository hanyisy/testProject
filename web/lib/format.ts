/* 화면 표시 형식 — 시안 표기 그대로 (10월 7일 · 2,120,000원 · 09:12) */
const KST = 'Asia/Seoul';

const parts = (d: Date) => {
  const f = new Intl.DateTimeFormat('ko-KR', { timeZone: KST, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const o = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  return { y: Number(o.year), m: Number(o.month), d: Number(o.day), hm: `${o.hour}:${o.minute}` };
};

/** 10월 7일 */
export const md = (d: Date | string | null | undefined) => {
  if (!d) return '—';
  const p = parts(new Date(d));
  return `${p.m}월 ${p.d}일`;
};

/** 09:12 */
export const hm = (d: Date | string) => parts(new Date(d)).hm;

/** 오늘 09:12 · 어제 17:25 · 10월 5일 (today: 시안 기준일 YYYY-MM-DD) */
export function rel(d: Date | string, today: string) {
  const p = parts(new Date(d));
  const key = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  const t = new Date(today + 'T00:00:00+09:00');
  const y = new Date(t.getTime() - 86400000);
  const yKey = parts(y);
  if (key === today) return `오늘 ${p.hm}`;
  if (p.y === yKey.y && p.m === yKey.m && p.d === yKey.d) return `어제 ${p.hm}`;
  return `${p.m}월 ${p.d}일`;
}

/** 2,120,000 */
export const won = (n: number | null | undefined) => (n ?? 0).toLocaleString('ko-KR');

export type ChipKind = 'ok' | 'warn' | 'red' | 'gray' | 'info' | 'purple';
