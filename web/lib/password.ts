/* 비밀번호 해시 · 임시 비밀번호 생성 */
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

/** 새 비밀번호 규칙 (시안: 8자 이상 · 영문과 숫자 함께) */
export function passwordRules(pw: string, again: string) {
  return [
    { label: '8자 이상', ok: pw.length >= 8 },
    { label: '영문과 숫자 함께', ok: /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw) },
    { label: '두 칸이 같아요', ok: !!again && pw === again }
  ];
}

/** 임시 비밀번호 (시안 형식: Ab12-cd3Ef) */
export function tempPassword() {
  const lo = 'abcdefghjkmnpqrstuvwxyz', up = 'ABCDEFGHJKLMNPQRSTUVWXYZ', d = '23456789';
  const r = (s: string) => s[randomInt(s.length)];
  return r(up) + r(lo) + r(d) + r(d) + '-' + r(lo) + r(lo) + r(d) + r(up) + r(lo);
}
