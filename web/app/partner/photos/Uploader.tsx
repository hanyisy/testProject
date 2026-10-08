'use client';
/* 직접 올리기 + 올리는 중 진행 + 올린 뒤(현장 후보 · 기존 현장에 추가) — 시안 2i · 2i-3 */
import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import { addToSite, uploadPhoto } from './actions';

type Tile = { name: string; state: '대기' | '올리는 중' | '완료' | '중복' | '실패'; error?: string };
type Site = { id: string; title: string; date: string; n: number };

export default function Uploader({ drive, sites }: { drive: ReactNode; sites: Site[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [site, setSite] = useState(sites[0]?.id ?? '');
  const [added, setAdded] = useState<string | null>(null);

  async function upload(files: File[]) {
    const list = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)).slice(0, 200);
    if (!list.length) return;
    setBusy(true); setAdded(null); setIds([]);
    setTiles(list.map((f) => ({ name: f.name, state: '대기' })));
    const got: string[] = [];
    for (let i = 0; i < list.length; i++) {
      setTiles((ts) => ts.map((x, j) => (j === i ? { ...x, state: '올리는 중' } : x)));
      const fd = new FormData();
      fd.set('file', list[i]);
      fd.set('lastModified', String(list[i].lastModified));
      const r = await uploadPhoto(fd).catch(() => ({ ok: false as const, error: '보내지 못했어요' }));
      if (r.ok && !r.duplicate) got.push(r.id);
      setTiles((ts) => ts.map((x, j) => (j === i ? { ...x, state: r.ok ? (r.duplicate ? '중복' : '완료') : '실패', error: r.ok ? undefined : r.error } : x)));
    }
    setIds(got);
    setBusy(false);
  }

  const done = tiles.filter((t) => t.state === '완료').length;
  const dups = tiles.filter((t) => t.state === '중복').length;
  const fails = tiles.filter((t) => t.state === '실패').length;
  const finished = tiles.length > 0 && !busy;
  const pct = tiles.length ? Math.round((tiles.filter((t) => t.state !== '대기' && t.state !== '올리는 중').length / tiles.length) * 100) : 0;

  return (
    <>
      {finished && (
        <section className="pcard" style={{ padding: '20px 22px', gap: 10 }}>
          <div className="row" style={{ alignItems: 'center', gap: 10 }}><span className="okdot">✓</span><b style={{ fontSize: 19 }}>다 올렸어요</b></div>
          <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5 }}>
            새 사진 {done}장{dups ? ` · 중복 ${dups}장 제외` : ''}{fails ? ` · ${fails}장은 올리지 못했어요` : ''}
          </span>
        </section>
      )}
      <div className="infobox infobox--i"><span className="infobox__i">i</span>올린 사진은 공개를 확인하기 전까지 페이지에 쓰이지 않아요</div>

      {!finished && (
        <div className="upgrid upgrid--even">
          <section className="pcard" style={{ padding: 22, gap: 12 }}>
            <span className="panel__title">직접 올리기</span>
            <button type="button" className={'drop' + (drag ? ' is-drag' : '')} disabled={busy} onClick={() => input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); upload(Array.from(e.dataTransfer.files)); }}>
              <b>사진을 여기로 끌어다 놓으세요</b>
              <span>또는 클릭해서 고르기 · 한 번에 200장까지</span>
            </button>
            <input ref={input} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { upload(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
          </section>
          {drive}
        </div>
      )}

      {busy && (
        <section className="pcard" style={{ padding: 22, gap: 14 }}>
          <div className="row" style={{ alignItems: 'baseline' }}><b style={{ fontSize: 20 }}>{tiles.length}장 중 {done + dups}장 올리는 중</b></div>
          <span className="upbar"><span style={{ width: `${pct}%` }} /></span>
          <div className="uptiles">
            {tiles.slice(0, 14).map((t, i) => (
              <div key={i} className="uptile">
                <div className="uptile__img" style={{ opacity: t.state === '대기' ? 0.45 : 1 }}>{t.state === '완료' && <span>✓</span>}</div>
                <span className="upbar upbar--sm"><span style={{ width: t.state === '완료' || t.state === '중복' ? '100%' : t.state === '올리는 중' ? '50%' : '0%' }} /></span>
                <span className="uptile__l" data-state={t.state}>{t.state}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {finished && (
        <div className="upgrid">
          <div className="stack" style={{ gap: 12 }}>
            <span className="mklabel">촬영일과 위치로 묶인 현장 후보</span>
            <section className="pcard" style={{ padding: 20, gap: 12 }}>
              <b style={{ fontSize: 17 }}>방금 올린 사진 {done}장</b>
              <div className="thumbs6">{Array.from({ length: Math.min(6, done) }, (_, i) => <span key={i} />)}</div>
              <Link href="/partner/sites" className="pbtn pbtn--accent" style={{ width: '100%', height: 52 }}>이 사진으로 현장 만들기</Link>
            </section>
            <button type="button" className="btn-ghost btn-ghost--block" onClick={() => { setTiles([]); setIds([]); }}>사진 더 올리기</button>
          </div>
          {sites.length > 0 && (
            <section className="pcard" style={{ padding: '8px 22px 22px', gap: 0 }}>
              <div style={{ padding: '14px 0 6px' }}><span className="panel__title">기존 현장에 추가</span> <span className="hint">이미 발행된 현장에 사진을 더해요</span></div>
              {sites.map((s) => (
                <button key={s.id} type="button" className="sitepick" aria-pressed={site === s.id} onClick={() => { setSite(s.id); setAdded(null); }}>
                  <span className="cand__dot" aria-hidden="true" />
                  <span className="sitepick__t"><b>{s.title}</b><small>{s.date} · 사진 {s.n}장</small></span>
                </button>
              ))}
              {added ? <div className="okbox" style={{ marginTop: 12 }}>{added}</div> : (
                <button type="button" className="btn-ink" style={{ marginTop: 12, height: 52, fontSize: 16, borderRadius: 14 }} disabled={!ids.length}
                  onClick={async () => { const r = await addToSite(site, ids); if (r.ok) { setAdded(`${r.title}에 사진 ${r.n}장을 더했어요 · 공개 확인 후 페이지에 반영돼요`); setIds([]); } }}>
                  선택한 현장에 {ids.length}장 추가
                </button>
              )}
            </section>
          )}
        </div>
      )}
    </>
  );
}
