'use client';
/* 문의 메모 남기기 — 진행 기록에 쌓임 (고객에게는 안 보임) */
import { useState, useTransition } from 'react';
import { addInquiryMemo } from '../actions';

export default function MemoForm({ id }: { id: string }) {
  const [text, setText] = useState('');
  const [pending, start] = useTransition();
  const [err, setErr] = useState(false);
  const save = () => start(async () => {
    const r = await addInquiryMemo(id, text);
    if (r.ok) { setText(''); setErr(false); } else setErr(true);
  });
  return (
    <div className="imemo">
      <label htmlFor="memo" className="sr-only">메모</label>
      <textarea id="memo" className="input imemo__in" rows={3} maxLength={1000} value={text} placeholder="예: 다음 주 화요일 현장 보기로 함 · 견적 문자로 보냄" onChange={(e) => setText(e.target.value)} />
      <div className="imemo__bot">
        <span className="hint">고객에게는 보이지 않아요{err && ' · 저장하지 못했어요. 다시 눌러 주세요'}</span>
        <button type="button" className="btn-acc" disabled={pending || !text.trim()} onClick={save}>{pending ? '저장 중…' : '메모 저장'}</button>
      </div>
    </div>
  );
}
