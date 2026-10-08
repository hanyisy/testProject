'use client';
/* 현장 발행 화면 본문 (시안 2b) — 자동으로 묶인 현장 · 사진 검토(공개 체크, 사람 사진 경고) · 현장 정보 · 발행 결과 */
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { publishSite, type NewPage } from './actions';

type Photo = { id: string; label: string; person: boolean; pub: boolean; src: string | null };
type Props = { groups: { key: string; label: string }[]; current: string; place: string; photos: Photo[]; works: string[]; buildings: string[] };
const IDX: Record<string, string> = { '발행됨': 'gray', '색인 요청': 'warn', '색인 확인': 'ok' };
const SHOW = 15;

export default function Publisher({ groups, current, place, photos, works, buildings }: Props) {
  const [pub, setPub] = useState<Set<string>>(() => new Set(photos.filter((p) => p.pub).map((p) => p.id)));
  const [work, setWork] = useState(works[0] ?? '');
  const [bldg, setBldg] = useState('');
  const [area, setArea] = useState('');
  const [days, setDays] = useState(1);
  const [note, setNote] = useState('');
  const [more, setMore] = useState(false);
  /* 발행 결과는 화면이 새 데이터로 다시 그려져도 남김 (snapshot: 발행한 묶음의 사진 · 공개 상태) */
  const [done, setDone] = useState<{ title: string; photos: number; pages: NewPage[]; snap: Photo[]; pub: Set<string>; group: string } | null>(null);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  /* 다른 묶음을 고르면 처음 상태로 (발행 결과를 보는 중이면 그대로) */
  useEffect(() => {
    if (done) return;
    setPub(new Set(photos.filter((p) => p.pub).map((p) => p.id)));
    setBldg(''); setArea(''); setDays(1); setNote(''); setMore(false); setErr('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const list = done ? done.snap : photos;
  const pubSet = done ? done.pub : pub;
  const personPublic = list.filter((p) => p.person && pubSet.has(p.id)).length;
  const s1 = personPublic === 0 && pubSet.size > 0;
  const s2 = !!(work && bldg && Number(area) > 0 && days > 0);
  const can = s1 && s2 && !done;
  const steps: [string, boolean, string][] = [
    ['사진 검토', s1, s1 ? '완료' : personPublic ? `사람 사진 ${personPublic}장 공개 중` : '공개할 사진을 골라 주세요'],
    ['현장 정보', s2, s2 ? '완료' : !bldg ? '건물 유형을 골라 주세요' : '평수를 입력해 주세요'],
    ['발행', !!done, done ? '완료' : '대기']
  ];
  const toggle = (p: Photo) => {
    if (done) return;
    const n = new Set(pub);
    if (n.has(p.id)) n.delete(p.id); else n.add(p.id);
    setPub(n);
  };
  const shown = more ? list : list.slice(0, SHOW);

  return (
    <>
      <div className="pcard pubsteps">
        {steps.map(([name, ok, sub], i) => (
          <div key={name} className="pubsteps__i">
            <span className={'pubsteps__n' + (ok ? ' is-ok' : '')}>{ok ? '✓' : i + 1}</span>
            <div className="pubsteps__t"><b>{name}</b><small style={{ color: ok ? 'var(--s4f)' : i === 2 ? 'var(--sub2)' : 'var(--red)' }}>{sub}</small></div>
            {i < 2 && <span className="pubsteps__line" />}
          </div>
        ))}
      </div>

      <div className="pubgrid">
        <div className="stack" style={{ gap: 12 }}>
          <span className="mklabel">자동으로 묶인 현장</span>
          <div className="cands">
            {groups.map((g) => (
              <Link key={g.key} href={`/partner/sites?g=${encodeURIComponent(g.key)}`} className="cand" aria-current={g.key === (done?.group ?? current) ? 'true' : undefined} onClick={() => setDone(null)}>
                <span className="cand__dot" aria-hidden="true" /><span>{g.label}</span>
              </Link>
            ))}
          </div>
          <section className="pcard" style={{ padding: 20, gap: 14 }}>
            <div className="row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="pcard__title">사진 검토</span>
              {done && <span className="lockchip"><span className="lock"><span /><span /></span>발행됨 · 수정 불가</span>}
              {!done && personPublic > 0 && <div className="warnbox" style={{ padding: '10px 12px', fontSize: 14, fontWeight: 600 }}><span className="warnbox__i">!</span>사람이 찍힌 사진 {personPublic}장이 공개돼 있어요</div>}
              <span className="pubcount">공개 <b>{pubSet.size}</b><span> / {list.length}</span></span>
            </div>
            <div className="pgrid5">
              {shown.map((p) => {
                const on = pubSet.has(p.id);
                return (
                  <button key={p.id} type="button" className={'ptile' + (on ? ' is-on' : '') + (p.person && on ? ' is-warn' : '')} disabled={!!done} onClick={() => toggle(p)}
                    style={p.src ? { background: `center / cover no-repeat url("${p.src}")` } : undefined} aria-pressed={on} aria-label={`${p.label}${p.person ? ' · 사람이 찍힘' : ''} · ${on ? '공개' : '비공개'}`}>
                    <span className="ptile__label">{p.label}</span>
                    <span className="ptile__box">{on ? '✓' : ''}</span>
                    {p.person && <span className="ptile__person">! 사람</span>}
                  </button>
                );
              })}
            </div>
            {list.length > SHOW && !more && <button type="button" className="btn-ghost btn-ghost--block" onClick={() => setMore(true)}>나머지 {list.length - SHOW}장 더보기</button>}
          </section>
        </div>

        <section className="pcard pubside">
          {!done ? (
            <>
              <span className="pcard__title">현장 정보</span>
              <div className="fld" style={{ gap: 10 }}>
                <span className="fld__label" style={{ fontSize: 15 }}>작업 종류</span>
                <div className="tags">{works.map((w) => <button key={w} type="button" className="sel sel--opt" aria-pressed={work === w} onClick={() => setWork(w)}>{w}</button>)}</div>
              </div>
              <div className="fld" style={{ gap: 10 }}>
                <span className="fld__label" style={{ fontSize: 15 }}>건물 유형</span>
                <div className="tags">{buildings.map((b) => <button key={b} type="button" className="sel sel--opt" aria-pressed={bldg === b} onClick={() => setBldg(b)}>{b}</button>)}</div>
              </div>
              <div className="grid grid--2" style={{ gap: 12 }}>
                <label className="fld" style={{ gap: 8 }}>
                  <span className="fld__label" style={{ fontSize: 15 }}>평수</span>
                  <span className="bigin"><input inputMode="numeric" placeholder="0" value={area} onChange={(e) => setArea(e.target.value.replace(/[^0-9]/g, ''))} /><span>평</span></span>
                </label>
                <div className="fld" style={{ gap: 8 }}>
                  <span className="fld__label" style={{ fontSize: 15 }}>작업 기간</span>
                  <span className="stepper2">
                    <button type="button" onClick={() => setDays(Math.max(1, days - 1))} aria-label="하루 줄이기">−</button>
                    <b>{days}<small>일</small></b>
                    <button type="button" onClick={() => setDays(days + 1)} aria-label="하루 늘리기">+</button>
                  </span>
                </div>
              </div>
              <label className="fld" style={{ gap: 8 }}>
                <span className="fld__label" style={{ fontSize: 15 }}>특이사항 한 줄</span>
                <input className="fld__input" style={{ height: 52, fontSize: 16 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예) 3층 엘리베이터 없음, 야간 작업" />
              </label>
              <button type="button" className="auth__submit" disabled={!can || pending}
                onClick={() => start(async () => {
                  setErr('');
                  const r = await publishSite({ photoIds: photos.map((p) => p.id), publicIds: [...pub], place, work, building: bldg, area: Number(area), days, note });
                  if (r.ok) setDone({ ...r, snap: photos, pub: new Set(pub), group: current }); else setErr(r.error);
                })}>
                {pending ? '발행하는 중…' : '발행하기'}
              </button>
              {(!can || err) && <span className="pubhint">{err || (!s1 ? steps[0][2] : '현장 정보를 모두 입력해 주세요')}</span>}
            </>
          ) : (
            <>
              <div className="pubdone"><span className="pubdone__i">✓</span><b>발행 완료</b><span>{done.title} · 사진 {done.photos}장</span></div>
              <div className="stack" style={{ gap: 0 }}>
                <span className="fld__label" style={{ fontSize: 15, paddingBottom: 4 }}>이 현장으로 생긴 페이지</span>
                {done.pages.map((n) => (
                  <div key={n.kind + n.title} className="newpage">
                    <div><small>{n.kind} · {n.tag}</small><b>{n.title}</b></div>
                    <span className={`chip chip--${IDX[n.status] ?? 'gray'}`}>{n.status}</span>
                  </div>
                ))}
              </div>
              <Link href="/partner/sites" className="btn-ghost btn-ghost--block" style={{ height: 52, fontSize: 16 }} onClick={() => setDone(null)}>다른 현장 검토하기</Link>
            </>
          )}
        </section>
      </div>
    </>
  );
}
