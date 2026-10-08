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
