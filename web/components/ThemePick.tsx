'use client';
/* 화면 테마 라이트 · 나이트 (파트너 설정 2h · 본사 설정 3n 공용) — 이 브라우저에 기억 (app/layout.tsx 의 themeBoot 가 읽음) */
import { useEffect, useState } from 'react';

const OPTS = [['light', '라이트'], ['dark', '나이트']] as const;

export default function ThemePick() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => { setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'); }, []);
  const pick = (v: 'light' | 'dark') => {
    setTheme(v);
    if (v === 'dark') document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('hl-theme', v); } catch { /* 저장 못 해도 이번 화면엔 적용 */ }
  };
  return (
    <div className="seg seg--lg" role="group" aria-label="화면 테마">
      {OPTS.map(([v, label]) => <button key={v} type="button" className="seg__opt" aria-pressed={theme === v} onClick={() => pick(v)}>{label}</button>)}
    </div>
  );
}
