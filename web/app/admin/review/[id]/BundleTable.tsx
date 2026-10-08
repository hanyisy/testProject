'use client';
/* 페이지마다 다른 부분 표 (3p): 체크로 고르고 일괄 검수 완료 · 되돌리기 토스트 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { approveItems, undoHistory } from '../actions';

type Row = { id: string; name: string; info: string; photos: number; sites: number; uniq: number; state: string; selected: boolean; href: string | null };
const COLS = '28px minmax(0,0.8fr) minmax(0,1fr) 40px 40px 96px 140px';
const pending = (r: Row) => r.state === '대기' || r.state === '발행 중 · 수정 대기';

export default function BundleTable({ bundleId, c1, c2, rows, minUnique }: { bundleId: string; c1: string; c2: string; rows: Row[]; minUnique: number }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(() => new Set(rows.filter((r) => pending(r) && r.selected).map((r) => r.id)));
  const [busy, start] = useTransition();
  const pend = rows.filter(pending);
  const picked = pend.filter((r) => sel.has(r.id));
  const allOn = pend.length > 0 && picked.length === pend.length;
  const toggle = (id: string) => { const n = new Set(sel); if (n.has(id)) n.delete(id); else n.add(id); setSel(n); };
  const chip = (r: Row): [string, string] => r.state === '검수 완료' ? ['검수 완료', 'ok'] : r.state === '발행 중 · 수정 대기' ? ['발행 중 · 수정 대기', 'info'] : sel.has(r.id) ? ['대기', 'gray'] : ['뺌', 'warn'];

  return (
    <section className="table">
      <div className="rvbar">
        <b style={{ fontSize: 15 }}>페이지마다 다른 부분</b>
        <span className="hint" style={{ fontSize: 14 }}>{picked.length}장 선택 · 대기 {pend.length}장</span>
        <Link href={`/admin/review/${bundleId}/edit`} className="btn-ghost btn-ghost--sm" style={{ marginLeft: 'auto' }}>공통 본문 수정</Link>
        <button type="button" className="btn-acc" disabled={!picked.length || busy}
          onClick={() => start(async () => {
            const r = await approveItems(bundleId, picked.map((x) => x.id));
            if (r.ok) router.replace(`/admin/review/${bundleId}?h=${r.historyId}`, { scroll: false });
          })}>선택한 {picked.length}장 검수 완료</button>
      </div>
      <div className="table__scroll">
        <div className="table__head" style={{ '--cols': COLS, '--min': '700px' } as React.CSSProperties}>
          <span><button type="button" className="cbox" role="checkbox" aria-checked={allOn} aria-label="모두 고르기" disabled={!pend.length}
            onClick={() => setSel(allOn ? new Set() : new Set(pend.map((r) => r.id)))}>{allOn ? '✓' : ''}</button></span>
          <span>{c1}</span><span>{c2}</span><span className="r">사진</span><span className="r">현장</span><span>고유 내용</span><span>상태</span>
        </div>
        {rows.map((r) => {
          const done = !pending(r), on = !done && sel.has(r.id), [label, kind] = chip(r);
          return (
            <div key={r.id} className="table__row" style={{ '--cols': COLS, '--min': '700px', minHeight: 60 } as React.CSSProperties}>
              <button type="button" className="cbox" role="checkbox" aria-checked={on} aria-label={`${r.name} 고르기`} disabled={done} onClick={() => toggle(r.id)}>{on ? '✓' : ''}</button>
              <span className="cell-name" style={{ opacity: done ? 0.5 : 1 }}><b className="ell">{r.name}</b>{r.href && <a href={r.href} target="_blank" rel="noreferrer" className="link-accent" style={{ fontSize: 12 }}>페이지 보기 ↗</a>}</span>
              <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text2)', opacity: done ? 0.5 : 1 }}>{r.info}</span>
              <span className="cell-num cell-num--n">{r.photos}</span>
              <span className="cell-num cell-num--n">{r.sites || '—'}</span>
              <span className="progline"><span className="bar bar--sm"><span style={{ width: `${r.uniq}%` }} /></span><b style={{ width: 36 }}>{r.uniq}%</b></span>
              <span><span className={`chip chip--${kind}`}>{label}</span></span>
            </div>
          );
        })}
      </div>
      <div className="hint" style={{ padding: '12px 20px', color: 'var(--sub2)' }}>고유 내용 = 페이지 본문 중 공통 본문이 아닌 부분 · {minUnique}% 미만은 묶음에서 빠져요</div>
    </section>
  );
}

/** 일괄 작업 직후 안내 + 되돌리기 */
export function Toast({ id, text }: { id: string; text: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <div className="toast" role="status">
      <span>{text}</span>
      <button type="button" disabled={busy} onClick={() => start(async () => { await undoHistory(id); router.refresh(); })}>되돌리기</button>
    </div>
  );
}
