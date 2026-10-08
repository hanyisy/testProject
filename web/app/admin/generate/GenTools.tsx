'use client';
/* 페이지 생성 (3r–3x) 화면 조각: 파트너 고르기 · 사진 올리기 · 생성 설정 · 시안 고르기 · 다음 단계 버튼 */
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { adminUploadPhoto, markGenerated, startRun, toAssign, togglePick, toReview } from './actions';

export function PartnerPick({ value, options }: { value: string; options: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <label className="ppick">
      <select value={value} onChange={(e) => router.push(`/admin/generate?p=${e.target.value}`)} aria-label="파트너">
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <span aria-hidden="true">▼</span>
    </label>
  );
}

/** 직접 올리기 (3r) — 파트너 사진으로 저장 · 같은 사진은 건너뜀 */
export function DropUpload({ partnerId }: { partnerId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const upload = async (files: File[]) => {
    const list = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)).slice(0, 200);
    if (!list.length) return;
    setBusy(true);
    let ok = 0, dup = 0, fail = 0;
    for (const [i, f] of list.entries()) {
      setMsg(`${list.length}장 중 ${i + 1}장 올리는 중`);
      const fd = new FormData(); fd.set('file', f); fd.set('lastModified', String(f.lastModified));
      const r = await adminUploadPhoto(partnerId, fd).catch(() => ({ ok: false as const, error: '' }));
      if (r.ok && !r.duplicate) ok++; else if (r.ok) dup++; else fail++;
    }
    setBusy(false);
    setMsg(`새 사진 ${ok}장${dup ? ` · 중복 ${dup}장 제외` : ''}${fail ? ` · ${fail}장 실패` : ''} · 파트너가 공개를 확인하면 쓸 수 있어요`);
    router.refresh();
  };
  return (
    <>
      <button type="button" className={'drop drop--admin' + (drag ? ' is-drag' : '')} disabled={busy} onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(Array.from(e.dataTransfer.files)); }}>
        <b>사진을 여기로 끌어다 놓으세요</b><span>또는 클릭해서 고르기 · JPG·HEIC · 한 번에 200장까지</span>
      </button>
      <input ref={input} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { upload(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      {msg && <span className={busy ? 'hint' : 'okline'}>{msg}</span>}
    </>
  );
}

type Group = { city: string; opts: { name: string; dong: string; photos: number }[] };

/** 생성 설정 (3s) → 페이지 생성 */
export function SetupForm({ partnerId, types, works, defaultWork, groups, minPhotos }: { partnerId: string; types: { label: string; sub: string }[]; works: string[]; defaultWork: string; industry: string; groups: Group[]; minPhotos: number }) {
  const router = useRouter();
  const all = groups.flatMap((g) => g.opts);
  const [type, setType] = useState(types[0].label);
  const [work, setWork] = useState(defaultWork);
  const [sel, setSel] = useState<string[]>(() => all.filter((o) => o.photos > 0).map((o) => o.name));
  const [n, setN] = useState(4);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  const chosen = all.filter((o) => sel.includes(o.name));
  const short = chosen.filter((o) => o.photos < minPhotos).length;
  const toggle = (name: string) => setSel(sel.includes(name) ? sel.filter((x) => x !== name) : [...sel, name]);
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', alignItems: 'start' }}>
      <div className="stack">
        <section className="panel" style={{ padding: 22, gap: 12 }}>
          <h2 className="panel__title">페이지 유형</h2>
          <div className="grid grid--3" style={{ gap: 10 }}>
            {types.map((t) => <button key={t.label} type="button" className="roleopt" aria-pressed={type === t.label} onClick={() => setType(t.label)}><b>{t.label}</b><small>{t.sub}</small></button>)}
          </div>
          <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="fld__label">작업</span>
            {works.map((w) => <button key={w} type="button" className={'workchip' + (work === w ? ' is-on' : '')} onClick={() => setWork(w)}>{w}</button>)}
            <span className="muted">업종 템플릿의 대상 유형에서 골라요</span>
          </div>
        </section>
        <section className="panel" style={{ padding: 22, gap: 14 }}>
          <div className="panel__head"><h2 className="panel__title">대상 지역</h2><span className="panel__sub">{sel.length}곳 선택</span></div>
          {groups.map((g) => (
            <div key={g.city} className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <b style={{ width: 44, paddingTop: 10, fontSize: 15 }}>{g.city}</b>
              <div className="tags" style={{ flex: 1 }}>
                {g.opts.map((o) => { const on = sel.includes(o.name); return <button key={o.name} type="button" className={'regchip2' + (on ? ' is-on' : '')} onClick={() => toggle(o.name)}>{on ? '✓ ' : ''}{o.dong}<small>{o.photos}</small></button>; })}
                {!g.opts.length && <span className="hint">이 지역은 동 단위 사진 현황이 아직 없어요</span>}
              </div>
            </div>
          ))}
          <span className="muted">지역 옆 숫자 = 그 지역 사용 가능 사진 수</span>
        </section>
        <section className="panel" style={{ padding: 22, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <div className="stack" style={{ gap: 2, flex: 1 }}><b style={{ fontSize: 16 }}>만들 시안 수</b><span className="hint">구성이 다른 시안을 만들어 비교해요 · 3~6개</span></div>
          <div className="stepper3"><button type="button" onClick={() => setN(Math.max(3, n - 1))} aria-label="줄이기">−</button><b style={{ minWidth: 48 }}>{n}</b><button type="button" onClick={() => setN(Math.min(6, n + 1))} aria-label="늘리기">+</button></div>
        </section>
      </div>
      <section className="panel gensum">
        <h2 className="panel__title">요약</h2>
        <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.4, letterSpacing: '-0.02em' }}>{sel.length}개 지역 × {type} = {sel.length}장 생성 예정</span>
        <div className="stack" style={{ gap: 8, paddingTop: 12, borderTop: '1px solid var(--line2)' }}>
          <div className="sumrow"><span>사진으로 채울 수 있는 페이지</span><b>{sel.length - short}장</b></div>
          <div className="sumrow"><span>사진 부족 · 개별 검수로</span><b style={{ color: short ? 'var(--warnf)' : undefined }}>{short}장</b></div>
          <div className="sumrow"><span>만들 시안</span><b>{n}개</b></div>
        </div>
        <span className="muted">사진 {minPhotos}장 미만 지역은 설정의 기준을 따라 개별 검수로 가요</span>
        {err && <span className="pubhint" style={{ margin: 0 }}>{err}</span>}
        <button type="button" className="btn-acc btn-acc--lg" style={{ height: 54, fontSize: 17 }} disabled={!sel.length || pending}
          onClick={() => start(async () => {
            setErr('');
            const r = await startRun({ partnerId, type, work, regions: chosen.map((o) => o.name), draftCount: n });
            if (r.ok) router.push(`/admin/generate?run=${r.runId}`); else setErr(r.error);
          })}>{pending ? '만드는 중…' : '페이지 생성'}</button>
      </section>
    </div>
  );
}

/** 생성 진행이 다 차면 상태를 "완료"로 */
export function MarkDone({ runId }: { runId: string }) {
  const router = useRouter();
  useEffect(() => { markGenerated(runId).then(() => router.refresh()); }, [runId, router]);
  return null;
}

export function PickCard({ runId, label, name, desc, picked, locked }: { runId: string; label: string; name: string; desc: string; picked: boolean; locked: boolean }) {
  const [on, setOn] = useState(picked);
  const [pending, start] = useTransition();
  return (
    <button type="button" className="panel draftcard" aria-pressed={on} disabled={locked || pending} style={{ textAlign: 'left' }}
      onClick={() => { setOn(!on); start(() => togglePick(runId, label)); }}>
      <div className="row" style={{ alignItems: 'center' }}><span className={'cbox' + (on ? ' is-on' : '')} role="checkbox" aria-checked={on}>{on ? '✓' : ''}</span><b style={{ fontSize: 16 }}>{label} {name}</b></div>
      <span className="hint" style={{ lineHeight: 1.5 }}>{desc}</span>
    </button>
  );
}

export function NextToAssign({ runId, n }: { runId: string; n: number }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  return (
    <>
      {err && <span className="pubhint" style={{ margin: 0 }}>{err}</span>}
      <button type="button" className="btn-acc btn-acc--lg" disabled={n < 2 || pending}
        onClick={() => start(async () => { const r = await toAssign(runId); if (r.ok) router.push(`/admin/generate?run=${runId}&step=5`); else setErr(r.error); })}>{n}개 시안 선택 · 다음</button>
    </>
  );
}

export function NextToReview({ runId, done }: { runId: string; done: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  return (
    <>
      {err && <span className="pubhint" style={{ margin: 0 }}>{err}</span>}
      <button type="button" className="btn-acc btn-acc--lg" disabled={pending}
        onClick={() => start(async () => { const r = await toReview(runId); if (r.ok) router.push(`/admin/generate?run=${runId}&step=6`); else setErr(r.error); })}>{done ? '검수·배포 보기' : '다음 · 검수·배포'}</button>
    </>
  );
}
