'use client';
/* 공통 본문 편집기 (3q): 왼쪽 글 · 오른쪽 미리보기(페이지 고르기) · 저장 전 반영 확인 창 */
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { saveCommonBody } from '../../actions';

type Prev = { id: string; name: string; info: string; sites: number; photos: number };
const TOKENS = ['{지역명}', '{지역 정보}', '{현장 수}', '{사진 수}'];
const fill = (p: string, r: Prev) => p.split(/(\{[^}]+\})/).filter(Boolean).map((s, i) => {
  const m = s.match(/^\{(.+)\}$/);
  if (!m) return s;
  const v = ({ '지역명': r.name, '지역 정보': r.info, '현장 수': String(r.sites), '사진 수': String(r.photos) } as Record<string, string>)[m[1]];
  return <span key={i} className="tok">{v ?? m[1]}</span>;
});

export default function BodyEditor({ bundleId, body, n, live, previews, suffix }: { bundleId: string; body: string; n: number; live: number; previews: Prev[]; suffix: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState(body);
  const [pv, setPv] = useState(0);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const ref = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const changed = draft.trim() !== body.trim();
  const row = previews[Math.min(pv, previews.length - 1)];
  const paras = draft.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  /* 바뀌는 칸을 누르면 커서 자리에 넣기 */
  const insert = (tok: string) => {
    const el = area.current;
    if (!el) return;
    const a = el.selectionStart, z = el.selectionEnd;
    setDraft(draft.slice(0, a) + tok + draft.slice(z));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + tok.length, a + tok.length); });
  };
  return (
    <>
      <div className="grid grid--2" style={{ alignItems: 'start' }}>
        <section className="panel rvedit" style={{ padding: 22, gap: 12 }}>
          <div className="panel__head"><h2 className="panel__title">공통 본문</h2><span className="panel__sub">빈 줄로 문단을 나눠요</span></div>
          <div className="tags" style={{ gap: 6, alignItems: 'center' }}>
            <span className="hint" style={{ fontWeight: 600 }}>바뀌는 칸</span>
            {TOKENS.map((t) => <button key={t} type="button" className="tok" style={{ border: 0, padding: '3px 8px', fontSize: 13, cursor: 'pointer' }} onClick={() => insert(t)}>{t}</button>)}
          </div>
          <textarea ref={area} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="공통 본문" />
          <span style={{ fontSize: 13, fontWeight: 700, color: changed ? 'var(--accent)' : 'var(--sub2)' }}>{changed ? `바뀐 내용이 있어요 · 저장하면 ${n}장에 반영돼요` : '아직 바뀐 내용이 없어요'}</span>
        </section>
        <section className="panel" style={{ padding: 22, gap: 14 }}>
          <div className="panel__head" style={{ alignItems: 'center' }}>
            <h2 className="panel__title">미리보기</h2>
            <div className="seg" style={{ marginLeft: 'auto' }}>
              {previews.map((p, i) => <button key={p.id} type="button" className="seg__opt seg__opt--sm" aria-pressed={i === pv} onClick={() => setPv(i)}>{p.name}</button>)}
            </div>
          </div>
          {row && (
            <>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{row.name} {suffix}</span>
              <div className="grid grid--3" style={{ gap: 8 }}>{[1, 2, 3].map((k) => <div key={k} className="phb" style={{ height: 96 }}>현장 사진 {k}</div>)}</div>
              {paras.map((p, i) => <p key={i} className="rvp">{fill(p, row)}</p>)}
            </>
          )}
        </section>
      </div>
      {err && <span className="pubhint" style={{ margin: 0, textAlign: 'right' }}>{err}</span>}
      <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn-ghost" style={{ height: 48, fontSize: 15 }} onClick={() => setDraft(body)} disabled={!changed}>되돌리기 전 내용으로</button>
        <button type="button" className="btn-acc" style={{ height: 48, fontSize: 15 }} disabled={!changed} onClick={() => ref.current?.showModal()}>저장 · {n}장에 반영</button>
      </div>
      <dialog ref={ref} className="modal" aria-labelledby="rv-confirm" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="modal__card" style={{ width: 480, gap: 14 }}>
          <span className="modal__title" id="rv-confirm" style={{ fontSize: 22 }}>{n}장에 반영됩니다</span>
          {live > 0 && <div className="infoblue">이미 발행된 {live}장은 다시 검수할 때까지 기존 내용으로 유지돼요.</div>}
          <span style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text2)' }}>{n - live ? `아직 발행 전인 ${n - live}장은 바로 새 본문으로 바뀌어요. ` : ''}발행 중인 페이지는 내려가지 않아서 색인에 영향이 없어요.</span>
          <span className="muted">작업 기록에 한 건으로 남고, 되돌릴 수 있어요</span>
          <div className="row" style={{ marginTop: 4 }}>
            <button type="button" className="btn-ghost" style={{ flex: 1, height: 50, fontSize: 15 }} onClick={() => ref.current?.close()}>취소</button>
            <button type="button" className="btn-acc" style={{ flex: 2, height: 50, fontSize: 15 }} disabled={busy}
              onClick={() => start(async () => {
                setErr('');
                const r = await saveCommonBody(bundleId, draft);
                ref.current?.close();
                if (r.ok) router.push(`/admin/review/${bundleId}?h=${r.historyId}`); else setErr(r.error);
              })}>{n}장에 반영</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
