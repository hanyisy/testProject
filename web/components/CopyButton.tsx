'use client';
/* 복사 버튼 — 누르면 잠깐 "복사됨" (시안 공통) */
import { useState } from 'react';

export default function CopyButton({ text, label = '복사', done = '복사됨', className = 'btn-ghost btn-ghost--xs' }: { text: string; label?: string; done?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setOk(true);
        setTimeout(() => setOk(false), 1600);
      }}
    >
      {ok ? done : label}
    </button>
  );
}
