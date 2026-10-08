'use client';
/* 블로그 대행 한 건: 복사 → 올린 글 주소 → 완료 (시안 3m) */
import { useState, useTransition } from 'react';
import { finishAgencyPost } from './actions';

export default function AgencyJob({ id, text }: { id: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  return (
    <>
      <form className="agjob__act" onSubmit={(e) => { e.preventDefault(); start(async () => { setErr(''); const r = await finishAgencyPost(id, url); if (!r.ok) setErr(r.error); }); }}>
        <button type="button" className="btn-ghost" style={{ height: 46 }}
          onClick={async () => { try { await navigator.clipboard.writeText(text); } catch { /* 권한 없음 */ } setCopied(true); }}>{copied ? '복사됨' : '복사'}</button>
        <input className="fld__input" style={{ flex: 1, height: 46 }} value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="올린 글 주소 입력" aria-label="올린 글 주소" inputMode="url" />
        <button className="btn-ink" style={{ height: 46 }} disabled={url.length <= 5 || pending}>완료</button>
      </form>
      {err && <span className="pubhint" style={{ margin: 0, textAlign: 'left' }}>{err}</span>}
    </>
  );
}
