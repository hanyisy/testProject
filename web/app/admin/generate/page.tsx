import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import TopBar from '@/components/TopBar';
import AutoRefresh from '@/components/AutoRefresh';
import { requireStaff } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { getSetting } from '@/lib/admin';
import { today } from '@/lib/config';
import { rel } from '@/lib/format';
import { draftProgress, allDone } from '@/lib/adapters/generator';
import { PAGE_TYPES, latestRuns, partnerOptions, partnerSource, runState, workPhrase, type Preset } from '@/lib/generate';
import { autoRedistribute, cycleDraft, regenerate, requestPreview, swapPhotos, syncPartnerDrive } from './actions';
import { DropUpload, MarkDone, NextToAssign, NextToReview, PartnerPick, PickCard, SetupForm } from './GenTools';

export const metadata = { title: '페이지 생성' };

type SP = { p?: string; run?: string; step?: string; v?: string; dev?: string; pr?: string };
const STEPS = ['사진 연결', '생성 설정', '시안 미리보기', '시안 선택', '배분 확인', '검수·배포'];
const FEED: Record<string, [string, string]> = { like: ['좋아요', 'ok'], note: ['의견', 'info'], none: ['확인 전', 'gray'] };

/* 시안 3r 사진 연결 · 3s 생성 설정 · 3t/3u 시안 미리보기 · 3v 시안 선택 · 3w 배분 확인 · 3x 검수·배포 */
export default async function GeneratePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireStaff();
  const sp = await searchParams;
  const db = await getDb();
  const partners = await partnerOptions();
  const st = sp.run ? await runState(sp.run) : null;
  const partnerId = st?.run.partnerId ?? partners.find((p) => p.id === sp.p)?.id ?? partners.find((p) => p.status === '운영 중')?.id ?? partners[0]?.id;
  const src = partnerId ? await partnerSource(partnerId) : null;
  if (!src) return (<><TopBar title="페이지 생성" user={user} /><div className="page"><span className="hint">파트너가 없어요</span></div></>);
  const [runs, day, minPhotos, cap, maxUse, presets] = await Promise.all([
    latestRuns(src.partner.id), today(), getSetting<number>('review_min_photos', 3), getSetting<number>('cap_per_partner', 5),
    getSetting<number>('photo_max_use', 2), getSetting<Record<string, Preset>>('generation_presets', {})
  ]);

  /* 지금 단계: 생성 기록 상태까지 갈 수 있고, ?step 으로 앞 단계를 다시 봄 */
  const reached = !st ? 2 : st.run.status === '생성 중' || st.run.status === '완료' ? 4 : st.run.status === '배분 확인' ? 5 : 6;
  const want = Number(sp.step) || (!st ? 1 : st.run.status === '생성 중' || st.run.status === '완료' ? 3 : st.run.status === '배분 확인' ? 5 : 6);
  const step = Math.min(Math.max(1, want), reached);
  const href = (o: Partial<SP>) => {
    const q = new URLSearchParams(Object.entries({ p: st ? undefined : src.partner.id, run: sp.run, ...o }).filter(([, v]) => v) as [string, string][]);
    return '/admin/generate?' + q;
  };
  const areaText = `${src.industry.name} · ${src.regions.map((r, i) => (i ? r.split(' ').slice(-1)[0] : r)).join('·')}`;

  return (
    <>
      <TopBar title="페이지 생성" user={user} />
      <div className="page">
        <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="dhead__title">페이지 생성</span>
          <PartnerPick value={src.partner.id} options={partners.map((p) => ({ id: p.id, name: p.name + (p.status !== '운영 중' ? ` · ${p.status}` : '') }))} />
          <span className="hint" style={{ fontSize: 14 }}>{areaText}</span>
          {runs.length > 0 && (
            <div className="row" style={{ marginLeft: 'auto', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="muted" style={{ whiteSpace: 'nowrap' }}>생성 기록</span>
              {runs.slice(0, 3).map((r) => <Link key={r.id} href={`/admin/generate?run=${r.id}`} className="chip chip--plain" aria-current={r.id === sp.run ? 'true' : undefined} style={r.id === sp.run ? { outline: '2px solid var(--ink)' } : undefined}>{r.pageType} · {rel(r.createdAt, day)}</Link>)}
              {st && <Link href={`/admin/generate?p=${src.partner.id}`} className="link-accent">+ 새로 만들기</Link>}
            </div>
          )}
        </div>
        <nav className="genstep" aria-label="단계">
          {STEPS.map((label, i) => {
            const n = i + 1, ok = n < step, on = n === step, can = n <= reached;
            const inner = (<><span className={'genstep__n' + (ok ? ' is-ok' : on ? ' is-on' : '')}>{ok ? '✓' : n}</span><span className={'genstep__t' + (on ? ' is-on' : '')}>{label}</span>{n < 6 && <span className="genstep__line" />}</>);
            return can ? <Link key={label} href={href({ step: String(n) })} className="genstep__i" aria-current={on ? 'step' : undefined}>{inner}</Link> : <span key={label} className="genstep__i">{inner}</span>;
          })}
        </nav>

        {step === 1 && (
          <>
            <div className="grid grid--2" style={{ alignItems: 'start' }}>
              <div className="stack">
                <section className="panel" style={{ padding: 22, gap: 12 }}>
                  <h2 className="panel__title">직접 올리기</h2>
                  <DropUpload partnerId={src.partner.id} />
                </section>
                <section className="panel" style={{ padding: 22, gap: 12 }}>
                  <div className="row" style={{ alignItems: 'center' }}><h2 className="panel__title">구글 드라이브 폴더</h2><span className={`chip chip--${src.partner.driveConnected ? 'ok' : 'gray'}`}>{src.partner.driveConnected ? '연결됨' : '연결 전'}</span></div>
                  <div className="surfbox" style={{ padding: '12px 14px', gap: 2 }}>
                    <span className="cell-mono" style={{ color: 'var(--text2)' }}>현장로그 / 파트너 / {src.partner.name}</span>
                    <small style={{ fontSize: 13, fontWeight: 400 }}>마지막 동기화 {src.partner.driveSyncedAt ? rel(src.partner.driveSyncedAt, day) : '아직 없음'}</small>
                  </div>
                  <div className="row">
                    <form action={syncPartnerDrive.bind(null, src.partner.id)}><button className="btn-ghost btn-ghost--sm" disabled={!src.partner.driveConnected}>지금 동기화</button></form>
                    {src.partner.driveFolderUrl
                      ? <a className="btn-ghost btn-ghost--sm" href={src.partner.driveFolderUrl} target="_blank" rel="noreferrer">폴더 열기</a>
                      : <button type="button" className="btn-ghost btn-ghost--sm" disabled title="폴더 주소가 아직 없어요">폴더 열기</button>}
                  </div>
                </section>
              </div>
              <section className="panel" style={{ padding: 22, gap: 14 }}>
                <h2 className="panel__title">사진 현황</h2>
                <span style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.03em' }}>{src.status.total}<small style={{ fontSize: 20 }}>장</small></span>
                <div className="segbar">
                  <span style={{ flex: src.status.usable, background: 'var(--ink)' }} /><span style={{ flex: src.status.unconfirmed, background: 'var(--warnseg)' }} /><span style={{ flex: src.status.person, background: 'var(--bar)' }} />
                </div>
                {([['사용 가능', '공개 확인을 마친 사진', src.status.usable, 'var(--ink)'], ['파트너 미확인', '파트너가 공개 여부를 아직 안 정했어요', src.status.unconfirmed, 'var(--warnseg)'], ['사람 사진 비공개', '자동으로 비공개 처리', src.status.person, 'var(--bar)']] as const).map(([a, b, n, c], i) => (
                  <div key={a} className="critrow" style={{ minHeight: 52, borderTop: i ? '1px solid var(--line2)' : undefined }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: c, flexShrink: 0 }} />
                    <div><b>{a}</b><small>{b}</small></div><b style={{ fontSize: 18 }}>{n}장</b>
                  </div>
                ))}
                <div className="stack" style={{ gap: 10, paddingTop: 12, borderTop: '1px solid var(--line2)' }}>
                  <span className="fld__label">지역별 사용 가능 사진</span>
                  {src.status.byCity.map((c) => {
                    const mx = Math.max(1, ...src.status.byCity.map((x) => x.n));
                    return <div key={c.city} className="row" style={{ alignItems: 'center', gap: 12 }}><span style={{ width: 44, fontSize: 14, fontWeight: 700 }}>{c.city}</span><span className="bar" style={{ height: 10 }}><span style={{ width: `${Math.round((c.n / mx) * 100)}%` }} /></span><b style={{ width: 52, textAlign: 'right', fontSize: 15 }}>{c.n}장</b></div>;
                  })}
                </div>
              </section>
            </div>
            <div className="genfoot"><span /><Link href={href({ step: '2' })} className="btn-acc btn-acc--lg">다음 · 생성 설정</Link></div>
          </>
        )}

        {step === 2 && !st && (
          <SetupForm partnerId={src.partner.id} types={PAGE_TYPES.map(([l, s]) => ({ label: l, sub: s }))} works={src.works} defaultWork={src.defaultWork} industry={src.industry.name}
            groups={src.groups.map((g) => ({ city: g.city, opts: g.opts.map((o) => ({ name: o.name, dong: o.dong, photos: o.photos })) }))} minPhotos={minPhotos} />
        )}
        {step === 2 && st && (
          <section className="panel" style={{ padding: 22, gap: 8 }}>
            <h2 className="panel__title">생성 설정</h2>
            <span style={{ fontSize: 18, fontWeight: 800 }}>{st.regions.length}개 지역 × {st.run.pageType} · 시안 {st.run.draftCount}개</span>
            <span className="hint">{st.regions.map((r) => r.name).join(', ')}</span>
            <span className="muted">설정을 바꾸려면 새로 만들어 주세요 · <Link href={`/admin/generate?p=${src.partner.id}&step=2`} className="link-accent">+ 새로 만들기</Link></span>
          </section>
        )}

        {step === 3 && st && <DraftPreview st={st} sp={sp} href={href} src={src} presets={presets} />}

        {step === 4 && st && (
          <>
            <div className="row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 className="panel__title">쓸 시안을 골라 주세요</h2><span className="panel__sub">2개 이상</span>
              <span className="infobox" style={{ marginLeft: 'auto', padding: '8px 12px', fontSize: 14 }}>여러 시안을 섞으면 페이지 구성이 달라져요</span>
            </div>
            <div className="grid grid--4">
              {st.drafts.map((d) => <PickCard key={d.label} runId={st.run.id} label={d.label} name={d.style} desc={d.description} picked={d.picked} locked={st.run.status === '검수로 넘김'} />)}
            </div>
            {st.drafts.filter((d) => d.picked).length < 2 && <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>시안을 2개 이상 골라 주세요</span>}
            <div className="genfoot genfoot--sticky">
              <Link href={href({ step: '3' })} className="btn-ghost" style={{ height: 48, padding: '0 18px', fontSize: 15 }}>이전</Link>
              <span style={{ flex: 1, fontSize: 15, color: 'var(--sub)' }}>{st.drafts.filter((d) => d.picked).map((d) => `${d.label} ${d.style}`).join(' · ') || '선택한 시안이 없어요'}</span>
              <NextToAssign runId={st.run.id} n={st.drafts.filter((d) => d.picked).length} />
            </div>
          </>
        )}

        {step === 5 && st && (() => {
          const picked = st.drafts.filter((d) => d.picked);
          const rows = st.regions.map((r) => {
            const a = st.assigns.find((x) => x.region.endsWith(r.name));
            const d = picked.find((x) => x.label === a?.draftLabel) ?? picked[0];
            const base = 3100 + ([...r.name].reduce((x, c) => x + c.charCodeAt(0), 0) % 50) * 7 + (a?.photoSeed ?? 0) * 3;
            return { ...r, region: a?.region ?? r.name, label: d?.label ?? '—', dname: d?.style ?? '', thumbs: Array.from({ length: Math.min(3, r.photos) }, (_, j) => String(base + j)) };
          });
          const COLS = 'minmax(0,0.9fr) 150px minmax(0,1.3fr) 70px 200px';
          const locked = st.run.status === '검수로 넘김';
          return (
            <>
              <div className="grid grid--4">
                {picked.map((d) => <div key={d.label} className="stat"><span className="stat__label">시안 {d.label} · {d.style}</span><span className="stat__num" style={{ fontSize: 32 }}>{rows.filter((r) => r.label === d.label).length}<small style={{ fontSize: 17 }}>장</small></span></div>)}
                <div className="stat"><span className="stat__label">사진 한 장 최대 사용</span><span className="stat__num" style={{ fontSize: 32 }}>{maxUse}<small style={{ fontSize: 17 }}>회</small></span></div>
              </div>
              <section className="table">
                <div className="rvbar"><b style={{ fontSize: 17 }}>지역별 배분</b><span className="hint" style={{ fontSize: 14 }}>{rows.length}개 지역</span>
                  {!locked && <form action={autoRedistribute.bind(null, st.run.id)} style={{ marginLeft: 'auto' }}><button className="btn-ghost btn-ghost--sm">자동으로 다시 배분</button></form>}</div>
                <div className="table__scroll">
                  <div className="table__head" style={{ '--cols': COLS, '--min': '820px' } as React.CSSProperties}><span>지역</span><span>배정된 시안</span><span>배정된 사진</span><span className="r">현장 수</span><span>상태</span></div>
                  {rows.map((r) => (
                    <div key={r.name} className="table__row" style={{ '--cols': COLS, '--min': '820px', minHeight: 64 } as React.CSSProperties}>
                      <b style={{ fontSize: 15 }}>{r.name}</b>
                      <form action={cycleDraft.bind(null, st.run.id, r.region)}><button className="draftsel" disabled={locked} title="눌러서 다음 시안으로"><span>{r.label}</span>{r.dname}<i>▼</i></button></form>
                      <span className="row" style={{ alignItems: 'center', gap: 8 }}>
                        {r.thumbs.map((x) => <span key={x} className="thumb44">{x}</span>)}
                        <b style={{ fontSize: 14 }}>{r.photos}장</b>
                        {!locked && r.photos > 0 && <form action={swapPhotos.bind(null, st.run.id, r.region)}><button className="linkbtn" style={{ fontSize: 13 }}>바꾸기</button></form>}
                      </span>
                      <span className="cell-num cell-num--n">{r.sites || '—'}</span>
                      <span><span className={`chip chip--${r.photos < minPhotos ? 'warn' : 'ok'}`}>{r.photos < minPhotos ? '사진 부족 · 개별 검수로 이동' : '준비됨'}</span></span>
                    </div>
                  ))}
                </div>
              </section>
              <div className="genfoot"><Link href={href({ step: '4' })} className="btn-ghost" style={{ height: 48, padding: '0 18px', fontSize: 15 }}>이전</Link><span style={{ flex: 1 }} /><NextToReview runId={st.run.id} done={locked} /></div>
            </>
          );
        })()}

        {step === 6 && st && await (async () => {
          const bundles = await db.select({ id: t.reviewBundles.id, kind: t.reviewBundles.kind, createdAt: t.reviewBundles.createdAt }).from(t.reviewBundles)
            .where(eq(t.reviewBundles.partnerId, st.run.partnerId)).orderBy(desc(t.reviewBundles.createdAt));
          const mine = bundles.filter((b) => b.kind.startsWith(st.run.pageType + ' · 시안')).slice(0, st.drafts.filter((d) => d.picked).length);
          const items = mine.length ? await db.select().from(t.reviewItems).where(eq(t.reviewItems.bundleId, mine[0].id)) : [];
          const all = await Promise.all(mine.map(async (b) => ({ ...b, items: b.id === mine[0]?.id ? items : await db.select().from(t.reviewItems).where(eq(t.reviewItems.bundleId, b.id)) })));
          const short = all.flatMap((b) => b.items.filter((i) => i.reasons.length));
          const total = all.reduce((a, b) => a + b.items.length, 0);
          const days = ['오늘', '내일', '모레', '글피', '5일째'];
          const sched: { day: string; n: number }[] = [];
          for (let left = total, d = 0; left > 0 && d < 5; d++) { const n = Math.min(cap, left); sched.push({ day: days[d], n }); left -= n; }
          const picked = st.drafts.filter((d) => d.picked);
          const made = await db.select().from(t.pages).where(eq(t.pages.runId, st.run.id)).orderBy(t.pages.draftLabel, t.pages.title);
          const PST: Record<string, string> = { '작성 중': 'gray', '검수 중': 'warn', '발행됨': 'ok', '색인 요청': 'ok', '색인 확인': 'ok', '비공개': 'gray' };
          return (
            <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', alignItems: 'start' }}>
              <section className="panel" style={{ padding: 24, gap: 14 }}>
                <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>검수 묶음 {all.filter((b) => b.items.some((i) => !i.reasons.length)).length}개가 만들어졌어요</span>
                <span className="hint" style={{ fontSize: 15 }}>같은 시안을 쓰는 페이지끼리 묶었어요 · 사진 부족 {short.filter((i) => i.reasons.includes('사진 부족')).length}장은 개별 검수로 갔어요</span>
                <div className="stack" style={{ gap: 0 }}>
                  {[...all].reverse().map((b) => {
                    const n = b.items.filter((i) => !i.reasons.length).length;
                    return n ? <Link key={b.id} href={`/admin/review/${b.id}`} className="genbundle"><span className="genbundle__k">{b.kind.slice(-1)}</span><b>{src.partner.name} · {b.kind}</b><b>{n}장</b></Link> : null;
                  })}
                  {short.length > 0 && <div className="genbundle"><span className="chip chip--warn">개별 검수</span><span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>{short.map((i) => i.name).join(', ')}</span><b>{short.length}장</b></div>}
                </div>
                <Link href="/admin/review" className="btn-acc btn-acc--lg" style={{ alignSelf: 'flex-start' }}>검수로 가기</Link>
                {made.length > 0 && (
                  <div className="stack" style={{ gap: 0, paddingTop: 10, borderTop: '1px solid var(--line2)' }}>
                    <span className="fld__label" style={{ paddingBottom: 4 }}>만든 페이지 · 공개 사이트 미리보기</span>
                    {made.map((p) => (
                      <a key={p.id} href={`/p/${src.partner.slug}/${(p.path ?? '').split('/').map(encodeURIComponent).join('/')}`} target="_blank" rel="noreferrer" className="genbundle" style={{ minHeight: 44 }}>
                        <span className="genbundle__k" style={{ width: 24, height: 24, fontSize: 13 }}>{p.draftLabel}</span><b style={{ flex: 1, fontSize: 14 }}>{p.title}</b>
                        <span className={`chip chip--${PST[p.status]}`}>{p.status === '검수 중' || p.status === '작성 중' ? '미리보기' : p.status}</span><span className="link-accent" style={{ fontSize: 13 }}>보기 ↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </section>
              <div className="stack">
                <section className="panel" style={{ padding: 22, gap: 12 }}>
                  <div className="panel__head"><h2 className="panel__title">배포 일정</h2><span className="panel__sub">하루 상한 {cap}장 · <Link href="/admin/settings" className="link-accent" style={{ fontSize: 13 }}>설정에서 변경</Link></span></div>
                  {sched.map((d) => <div key={d.day} className="row" style={{ alignItems: 'center', gap: 12 }}><b style={{ width: 44, fontSize: 15 }}>{d.day}</b><span className="bar" style={{ height: 22, borderRadius: 6 }}><span style={{ width: `${Math.round((d.n / cap) * 100)}%`, borderRadius: 6 }} /></span><b style={{ width: 40, textAlign: 'right', fontSize: 16 }}>{d.n}장</b></div>)}
                  <span className="muted">검수가 끝난 페이지부터 순서대로 나가요</span>
                </section>
                <section className="panel" style={{ padding: 22, gap: 12 }}>
                  <h2 className="panel__title">파트너 확인</h2>
                  <span className="hint" style={{ fontSize: 14, lineHeight: 1.5 }}>{src.partner.name}에게 고른 시안 미리보기를 보내요. 파트너는 좋아요나 의견만 남길 수 있어요.</span>
                  {st.run.previewRequestedAt
                    ? <div className="okbox">확인 요청을 보냈어요 · {rel(st.run.previewRequestedAt, day)}</div>
                    : <form action={requestPreview.bind(null, st.run.id)}><button className="btn-ink" style={{ width: '100%', height: 50, fontSize: 15 }}>미리보기 확인 요청 보내기</button></form>}
                  <div className="stack" style={{ gap: 6, paddingTop: 10, borderTop: '1px solid var(--line2)' }}>
                    <span className="fld__label">파트너 반응</span>
                    {picked.map((d) => {
                      const [label, kind] = FEED[!st.run.previewRequestedAt ? 'none' : d.partnerLike ? 'like' : d.partnerNote ? 'note' : 'none'];
                      return <div key={d.label} className="row" style={{ alignItems: 'center', gap: 8, fontSize: 14 }}><b style={{ width: 56 }}>시안 {d.label}</b><span className={`chip chip--${kind}`}>{label}</span><span className="ell hint" style={{ fontSize: 14 }}>{d.partnerNote}</span></div>;
                    })}
                  </div>
                </section>
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );

  /* 3t 생성 중 · 3u 완료 미리보기 */
  async function DraftPreview({ st, sp, href, src, presets }: { st: NonNullable<Awaited<ReturnType<typeof runState>>>; sp: SP; href: (o: Partial<SP>) => string; src: NonNullable<Awaited<ReturnType<typeof partnerSource>>>; presets: Record<string, Preset> }) {
    const generating = st.run.status === '생성 중' && !allDone(st.run.startedAt, st.drafts.length);
    /* 예시 지역: 지역 정보가 있는 곳을 생성 순서대로 두 곳 (없으면 사진 많은 순) */
    const sample = [...st.regions.filter((r) => r.info), ...[...st.regions].filter((r) => !r.info).sort((a, b) => b.photos - a.photos)].slice(0, 2);
    if (generating) {
      return (
        <>
          <AutoRefresh every={1200} />
          <div className="row" style={{ alignItems: 'center', gap: 10 }}>
            <h2 className="panel__title">시안을 만들고 있어요</h2><span className="panel__sub">보통 3분쯤 걸려요 · 창을 닫아도 계속돼요</span>
            <span className="hint" style={{ marginLeft: 'auto', fontSize: 14 }}>{sample.map((r) => r.name.split(' ').slice(-1)[0]).join(' · ')} 예시로 먼저 만들어요</span>
          </div>
          <div className="grid grid--4">
            {st.drafts.map((d, i) => {
              const w = draftProgress(st.run.startedAt, i);
              return (
                <div key={d.label} className="panel" style={{ padding: 18, gap: 12 }}>
                  <div className="row" style={{ alignItems: 'center' }}><span className="dk">{d.label}</span><b style={{ fontSize: 16 }}>{d.style}</b></div>
                  <div className="genskel"><span style={{ width: '70%' }} /><span style={{ height: 60 }} /><span style={{ width: '85%', height: 10 }} /><span style={{ width: '55%', height: 10 }} /></div>
                  <span className="bar"><span style={{ width: `${w}%`, background: 'var(--accent)' }} /></span>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}><span className="hint" style={{ fontWeight: 600, fontSize: 14 }}>{w >= 100 ? '완료' : w > 50 ? `${sample[0]?.name.split(' ').slice(-1)[0] ?? ''} 페이지 구성 중` : w > 0 ? '사진 고르는 중' : '대기'}</span><b>{w}%</b></div>
                </div>
              );
            })}
          </div>
          <div className="genfoot"><Link href={href({ step: '2' })} className="btn-ghost" style={{ height: 48, padding: '0 18px', fontSize: 15 }}>이전</Link><span /></div>
        </>
      );
    }
    const view = st.drafts.find((d) => d.label === sp.v) ?? st.drafts[0];
    const prevR = sample[Number(sp.pr) === 1 ? 1 : 0] ?? sample[0];
    const mobile = sp.dev === 'm';
    const work = workPhrase(st.run.work, src.industry.name);
    const preset = presets[src.industry.code];
    const faq = (preset?.faq ?? src.items.filter((i) => i.group === '가이드 뼈대').map((i) => i.label + '?')).slice(0, 4).map((q) => q.replaceAll('{작업}', work));
    const db2 = await getDb();
    const sites = await db2.select({ title: t.sites.title, workedAt: t.sites.workedAt }).from(t.sites).where(eq(t.sites.partnerId, src.partner.id)).orderBy(desc(t.sites.workedAt)).limit(3);
    const cta = <div className="pv__cta">전화로 견적 받기</div>;
    const head = (<><span className="pv__eyebrow">{src.partner.name} · {work}</span><span className="pv__title">{prevR?.name.split(' ').slice(-1)[0]} {work}</span><span className="pv__info">{prevR?.info ?? ''}</span></>);
    const L = view?.label ?? 'A';
    return (
      <>
        {st.run.status === '생성 중' && <MarkDone runId={st.run.id} />}
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <h2 className="panel__title">시안 {st.drafts.length}개가 준비됐어요</h2>
          {st.run.status !== '검수로 넘김' && <form action={regenerate.bind(null, st.run.id)} style={{ marginLeft: 'auto' }}><button className="btn-ghost btn-ghost--sm">{st.run.regenCount ? `다시 생성 (${st.run.regenCount}회)` : '다시 생성'}</button></form>}
        </div>
        <div className="grid grid--4">
          {st.drafts.map((d) => (
            <Link key={d.label} href={href({ step: '3', v: d.label, dev: sp.dev, pr: sp.pr })} scroll={false} className="panel draftcard" aria-current={d.label === L ? 'true' : undefined}>
              <div className="row" style={{ alignItems: 'center' }}><span className="dk">{d.label}</span><b style={{ fontSize: 16 }}>{d.style}</b></div>
              <Wire k={d.label} />
              <span className="hint" style={{ lineHeight: 1.5 }}>{d.description}</span>
            </Link>
          ))}
        </div>
        <section className="panel" style={{ padding: 22, gap: 16 }}>
          <div className="row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="panel__title">시안 {L} · {view?.style}</h2>
            <div className="row" style={{ marginLeft: 'auto', gap: 10 }}>
              <div className="seg">{([['', '데스크톱'], ['m', '모바일']] as const).map(([v, l]) => <Link key={l} href={href({ step: '3', v: L, dev: v, pr: sp.pr })} scroll={false} className="seg__opt seg__opt--sm" aria-pressed={(sp.dev ?? '') === v}>{l}</Link>)}</div>
              <div className="seg">{sample.map((r, i) => <Link key={r.name} href={href({ step: '3', v: L, dev: sp.dev, pr: String(i) })} scroll={false} className="seg__opt seg__opt--sm" aria-pressed={(Number(sp.pr) === 1 ? 1 : 0) === i}>{r.name}</Link>)}</div>
            </div>
          </div>
          <div className="pvwrap">
            <div className="pv" style={{ width: mobile ? 390 : '100%' }}>
              {head}
              {L === 'A' && <><div className="phb" style={{ height: 180 }}>대표 현장 사진</div><div className="grid grid--3" style={{ gap: 8 }}>{[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="phb" style={{ height: 80 }}>현장 {n}</div>)}</div>
                <span className="pv__p">{prevR?.name.split(' ').slice(-1)[0]}에서 진행한 {src.industry.name} 현장 {prevR?.sites}곳의 사진 {prevR?.photos}장을 그대로 보여드려요.</span></>}
              {L === 'B' && (sites.length ? sites : [{ title: '현장 기록', workedAt: null }]).map((s, i) => (
                <div key={i} className="pv__tl"><b>{s.workedAt ? `${Number(String(s.workedAt).slice(5, 7))}월 ${Number(String(s.workedAt).slice(8, 10))}일 · ` : ''}{s.title}</b><div className="grid grid--2" style={{ gap: 8 }}><div className="phb" style={{ height: 90 }}>작업 전</div><div className="phb" style={{ height: 90 }}>작업 후</div></div></div>
              ))}
              {L === 'C' && <>{faq.map((q) => <div key={q} className="pv__faq"><b>{q}</b><span>{prevR?.name.split(' ').slice(-1)[0]} 현장 기록을 근거로 답해요</span></div>)}<div className="phb" style={{ height: 120 }}>현장 사진</div></>}
              {!['A', 'B', 'C'].includes(L) && <>
                {preset ? (
                  <div className="pv__table">
                    <div>{preset.table.head.map((h) => <span key={h}>{h}</span>)}</div>
                    {preset.table.rows.map((r) => <div key={r.join()}>{r.map((c) => <span key={c}>{c}</span>)}</div>)}
                  </div>
                ) : <span className="hint">업종 프리셋에 비용표가 없어요 · 현장 입력 항목으로 채워요</span>}
                <span className="hint">{preset?.table.note ?? '비용은 현장 사진을 보고 안내해 드려요'}</span>
                <div className="grid grid--3" style={{ gap: 8 }}>{[1, 2, 3].map((n) => <div key={n} className="phb" style={{ height: 80 }}>현장 {n}</div>)}</div>
              </>}
              {cta}
            </div>
          </div>
        </section>
        <div className="genfoot"><Link href={href({ step: '2' })} className="btn-ghost" style={{ height: 48, padding: '0 18px', fontSize: 15 }}>이전</Link><span style={{ flex: 1 }} /><Link href={href({ step: '4' })} className="btn-acc btn-acc--lg">다음 · 시안 선택</Link></div>
      </>
    );
  }
}

/* 시안 카드 작은 구성 그림 (3u · 3v) */
function Wire({ k }: { k: string }) {
  const ph = (h: number, key?: number) => <div key={key} className="phb" style={{ height: h, borderRadius: 6 }} />;
  const line = (w: string, h = 8, key?: number) => <span key={key} className="wire__l" style={{ width: w, height: h }} />;
  return (
    <div className="wire">
      {k === 'A' && <>{ph(54)}<div className="grid grid--3" style={{ gap: 3 }}>{[0, 1, 2, 3, 4, 5].map((i) => ph(22, i))}</div>{line('80%')}{line('60%')}<span style={{ height: 12, borderRadius: 4, background: 'var(--accent)' }} /></>}
      {k === 'B' && <>{line('70%', 10)}{[0, 1, 2].map((i) => <div key={i} className="stack" style={{ gap: 3 }}><div className="row" style={{ gap: 4, alignItems: 'center' }}><span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--ink)' }} />{line('40%')}</div><div className="grid grid--2" style={{ gap: 3, paddingLeft: 12 }}>{ph(20)}{ph(20)}</div></div>)}</>}
      {k === 'C' && <>{line('70%', 10)}{[0, 1, 2, 3].map((i) => <div key={i} className="wire__box">{line('75%')}{line('50%', 6)}</div>)}{ph(20)}</>}
      {!['A', 'B', 'C'].includes(k) && <>{line('70%', 10)}<div className="wire__tbl">{[0, 1, 2, 3].map((i) => <div key={i} style={i ? undefined : { background: 'var(--surf)' }}>{line('30%')}{line('40%')}</div>)}</div><div className="grid grid--3" style={{ gap: 3 }}>{ph(22)}{ph(22)}{ph(22)}</div>{line('60%')}</>}
    </div>
  );
}
