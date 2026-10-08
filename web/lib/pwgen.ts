/* 화면에서 "자동 생성"을 누를 때 쓰는 임시 비밀번호 (시안 형식: Ab12-cd3Ef) — 서버 쪽은 lib/password.ts tempPassword */
export function genPw() {
  const lo = 'abcdefghjkmnpqrstuvwxyz', up = 'ABCDEFGHJKLMNPQRSTUVWXYZ', d = '23456789';
  const r = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  return r(up) + r(lo) + r(d) + r(d) + '-' + r(lo) + r(lo) + r(d) + r(up) + r(lo);
}
