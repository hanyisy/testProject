'use client';
/* 실패한 작업: 재시도(한 번) → 다시 실패하면 제작 담당에게 전달 */
import { useTransition } from 'react';
import { forwardJob, retryJob } from './actions';

export default function JobButtons({ id, status, tries }: { id: string; status: string; tries: number }) {
  const [pending, start] = useTransition();
  if (status === '제작 담당 전달') return <span className="chip chip--gray">전달됨 · 제작팀</span>;
  if (status === '재시도 중' || pending) return <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sub)' }}>재시도 중…</span>;
  if (status !== '실패') return null;
  return tries < 2
    ? <button type="button" className="btn-ink btn-ink--sm" onClick={() => start(() => retryJob(id))}>재시도</button>
    : <button type="button" className="btn-ghost btn-ghost--sm" onClick={() => start(() => forwardJob(id))}>제작 담당에게 전달</button>;
}
