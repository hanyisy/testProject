'use client';
/* 상담 메모 추가 — 글자가 있어야 "추가"가 켜짐 (시안), 저장되면 칸을 비움 */
import { useRef, useState } from 'react';
import { addLeadMemo } from '../actions';

export default function MemoForm({ id }: { id: string }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={async (fd) => { await addLeadMemo(fd); setText(''); }} className="row">
      <input type="hidden" name="id" value={id} />
      <input className="input" name="body" value={text} onChange={(e) => setText(e.target.value)} placeholder="통화 내용, 다음 연락 일정" aria-label="상담 메모" maxLength={2000} />
      <button className="btn-ink" disabled={!text.trim()}>추가</button>
    </form>
  );
}
