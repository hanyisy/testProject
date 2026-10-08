'use client';
/* 만들고 있는 페이지 — 본사가 고른 시안 카드(좋아요 · 의견) + 큰 미리보기 + 내 사진이 들어가는 페이지 (시안 2j) */
import { useState, useTransition } from 'react';
import { saveDraftNote, toggleDraftLike } from './actions';

type Draft = { label: string; style: string; n: number; like: boolean; note: string; href: string | null };
type Props = {
  runId: string; drafts: Draft[]; partnerName: string;
  preview: { region: string; name: string; info: string | null; photos: number; sites: number }; work: string;
  timeline: { title: string; date: string }[];
  usage: { site: string; date: string; n: number; pages: { name: string; k: string; st: string }[] }[];
};
const ST: Record<string, string> = { '배포됨': 'ok', '검수 중': 'warn' };
/* 스케치 미리보기는 시안 A · B · D 판만 — 나머지(C · E · F)는 실제 페이지 미리보기로 */
const kindOf = (label: string) => (['A', 'B', 'D'].includes(label) ? label : 'X');
const md = (ymd: string) => { const m = /\d{4}-(\d{2})-(\d{2})/.exec(ymd); return m ? `${Number(m[1])}월 ${Number(m[2])}일` : ymd; };

function Ph({ h, label = '' }: { h: number; label?: string }) {
  return <div className="phb" style={{ height: h }}>{label}</div>;
}
function Line({ w, h = 8 }: { w: string; h?: number }) {
  return <span className="skl" style={{ width: w, height: h }} />;
}
function Thumb({ kind }: { kind: string }) {
  if (kind === 'X') return <div className="mthumb"><Line w="70%" h={10} /><Ph h={56} label="실제 페이지로 확인" /><Line w="90%" /><Line w="60%" /></div>;
  if (kind === 'B') {
    return (
      <div className="mthumb">
        <Line w="70%" h={10} />
        {[0, 1, 2].map((i) => (
          <div key={i} className="mthumb__b">
            <div className="row" style={{ gap: 4, alignItems: 'center' }}><span className="dot" /><Line w="40%" /></div>
            <div className="mthumb__g2"><Ph h={20} /><Ph h={20} /></div>
          </div>
        ))}
      </div>
    );
  }
  if (kind === 'D') {
    return (
      <div className="mthumb">
        <Line w="70%" h={10} />
        <div className="mthumb__tbl">{[0, 1, 2, 3].map((i) => <div key={i} className={i ? '' : 'is-head'}><Line w="30%" /><Line w="40%" /></div>)}</div>
        <div className="mthumb__g3"><Ph h={24} /><Ph h={24} /><Ph h={24} /></div>
        <Line w="60%" />
      </div>
    );
  }
  return (
    <div className="mthumb">
      <Ph h={54} />
      <div className="mthumb__g3">{[0, 1, 2, 3, 4, 5].map((i) => <Ph key={i} h={22} />)}</div>
      <Line w="80%" /><Line w="60%" /><span className="skl" style={{ height: 12, background: 'var(--accent)' }} />
    </div>
  );
}

export default function Making({ runId, drafts, partnerName, preview, work, timeline, usage }: Props) {
  const [sel, setSel] = useState(drafts[0]?.label ?? 'A');
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, start] = useTransition();
  const cur = drafts.find((d) => d.label === sel) ?? drafts[0];
  const kind = cur ? kindOf(cur.label) : 'A';
  return (
    <div className="mkgrid">
      <div className="stack" style={{ gap: 12 }}>
        <span className="mklabel">본사가 고른 시안</span>
        {drafts.map((d) => (
          <div key={d.label} className={'mkcard' + (sel === d.label ? ' is-sel' : '')}>
            <button type="button" className="mkcard__view" onClick={() => setSel(d.label)} aria-pressed={sel === d.label}>
              <div className="mkcard__head"><span className="mkcard__k">{d.label}</span><span className="mkcard__name">{d.style}</span><span className="mkcard__n">{d.n}장</span></div>
              <Thumb kind={kindOf(d.label)} />
            </button>
            <div className="row">
              <button type="button" className={'mkbtn' + (d.like ? ' is-on' : '')} disabled={pending} onClick={() => start(() => toggleDraftLike(runId, d.label))}>{d.like ? '좋아요 ✓' : '좋아요'}</button>
              <button type="button" className="mkbtn" onClick={() => { setNoteOpen(noteOpen === d.label ? null : d.label); setDraft(d.note); }}>의견 남기기</button>
              {d.href && <a href={d.href} target="_blank" rel="noopener" className="mkbtn">실제 페이지 ↗</a>}
            </div>
            {noteOpen === d.label && (
              <form className="row" onSubmit={(e) => { e.preventDefault(); start(async () => { await saveDraftNote(runId, d.label, draft); setNoteOpen(null); }); }}>
                <input className="fld__input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="예) 사진을 더 크게 보여 주세요" aria-label={`시안 ${d.label} 의견`} />
                <button className="btn-ink" style={{ height: 46 }} disabled={pending}>보내기</button>
              </form>
            )}
            {d.note && noteOpen !== d.label && <span className="mknote">내 의견 · {d.note}</span>}
          </div>
        ))}
      </div>

      <div className="stack">
        <section className="pcard" style={{ gap: 14, padding: 22 }}>
          <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <span className="pcard__title">시안 {sel} 미리보기</span><span className="hint">예시 · {preview.region}</span>
            {cur?.href && <a href={cur.href} target="_blank" rel="noopener" className="link-accent" style={{ marginLeft: 'auto' }}>실제 페이지로 보기 ↗</a>}
          </div>
          <div className="seg">
            {drafts.map((d) => <button key={d.label} type="button" className="seg__opt" aria-pressed={sel === d.label} onClick={() => setSel(d.label)}>{d.label} {d.style}</button>)}
          </div>
          <div className="pvwrap">
            <div className="pv">
              <span className="pv__brand">{partnerName} · {work}</span>
              <span className="pv__title">{preview.region} {work}</span>
              {preview.info && <span className="pv__info">{preview.info}</span>}
              {kind === 'X' && <span className="pv__text">이 시안은 스케치 대신 실제 페이지로 확인해 주세요 · 위의 “실제 페이지로 보기”</span>}
              {kind === 'A' && (
                <>
                  <Ph h={220} label="대표 현장 사진" />
                  <div className="mthumb__g3" style={{ gap: 8 }}>{[1, 2, 3, 4, 5, 6].map((i) => <Ph key={i} h={90} label={`현장 ${i}`} />)}</div>
                  <span className="pv__text">{preview.name}에서 진행한 현장 {preview.sites}곳의 사진 {preview.photos}장을 그대로 보여드려요.</span>
                </>
              )}
              {kind === 'B' && timeline.map((s) => (
                <div key={s.title} className="pv__tl">
                  <span>{md(s.date)} · {s.title}</span>
                  <div className="mthumb__g2" style={{ gap: 8 }}><Ph h={90} label="작업 전" /><Ph h={90} label="작업 후" /></div>
                </div>
              ))}
              {kind === 'D' && (
                <>
                  <div className="pv__tbl">
                    <div className="is-head"><span>평수</span><span>작업 범위</span><span>기간</span></div>
                    {[0, 1, 2].map((i) => <div key={i}><Line w="60%" /><Line w="80%" /><Line w="40%" /></div>)}
                  </div>
                  <span className="hint">비용은 현장 사진을 보고 안내해 드려요</span>
                  <div className="mthumb__g3" style={{ gap: 8 }}>{[1, 2, 3].map((i) => <Ph key={i} h={90} label={`현장 ${i}`} />)}</div>
                </>
              )}
              <div className="pv__cta">전화로 견적 받기</div>
            </div>
          </div>
        </section>

        {usage.length > 0 && (
          <section className="pcard" style={{ padding: '8px 22px', gap: 0 }}>
            <div style={{ padding: '14px 0 6px' }}><span className="panel__title">내 사진이 들어가는 페이지</span></div>
            {usage.map((u) => (
              <div key={u.site} className="usage">
                <div className="row" style={{ alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}><b>{u.site}</b><span className="hint">{u.date} · 사진 {u.n}장</span></div>
                {u.pages.map((p) => (
                  <div key={p.name} className="usage__p"><span className="usage__arrow">→</span><span className="usage__name">{p.name}</span><span className="hint" style={{ fontWeight: 700 }}>시안 {p.k}</span><span className={`chip chip--${ST[p.st] ?? 'gray'}`}>{p.st}</span></div>
                ))}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
