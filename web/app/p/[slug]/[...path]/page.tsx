import Link from 'next/link';
import { notFound } from 'next/navigation';
import { After, Contact, Cost, Crumb, Hero, MapPins, Ph, Photos, QnA, Records, RegionInfo, Related, Sec, SiteCards, Steps, Summary } from '@/components/site/Blocks';
import {
  LIVE, daysText, dotDate, fill, generatedBody, href, josa, livePages, pageByPath, regionStat, siteBySlug, sitesOf, workLabel, type Site, type SiteRow
} from '@/lib/site';

type Props = { params: Promise<{ slug: string; path: string[] }>; searchParams: Promise<{ err?: string }> };

/* 생성 본문이 없을 때의 시안별 한 줄 (시안 04-A~D 머리 문구 · E 지도 · F 후기) */
const DRAFT_LEAD: Record<string, string> = {
  A: '{동}에서 직접 {동사} {대상} {현장} 사진을 먼저 보여드려요.',
  B: '{동} {작업} {현장|을} 날짜순으로 정리했어요.',
  C: '{동} {작업|을} 맡기기 전에 많이 묻는 질문 네 가지에 {현장} 기록으로 답해요.',
  D: '{동} {작업|은} 상황과 범위에 따라 비용 · 기간이 달라져요. 진행 순서와 실제 {현장|을} 함께 보세요.',
  E: '{동} 가까이에서 {동사} {현장|을} 지도에 모았어요.',
  F: '{동} {작업} {현장|을} 마친 순서대로 보여드려요.'
};

export async function generateMetadata({ params }: Props) {
  const { slug, path } = await params;
  const s = await siteBySlug(slug);
  const p = path.map(decodeURIComponent).join('/');
  const pg = s ? await pageByPath(s.partner.id, p) : null;
  const special: Record<string, string> = { 'contact/done': '문의 접수 완료', '문의': '문의', '개인정보처리방침': '개인정보처리방침' };
  return {
    title: { absolute: `${special[p] ?? pg?.title ?? decodeURIComponent(path[path.length - 1]).replaceAll('-', ' ')} · ${s?.partner.name ?? ''}` },
    description: s?.ic ? await describe(s, p, pg) : undefined
  };
}

/* 검색 결과 요약 문구 — 페이지 내용(생성 본문 · 가이드 · 질문 · 현장 기록)에서 뽑음, 150자 안쪽 */
async function describe(s: Site, p: string, pg: { id: string; type: string; title: string } | null) {
  const cut = (x: string) => (x.length > 150 ? x.slice(0, 149) + '…' : x);
  const [head, second] = p.split('/');
  if (head === '가이드') { const g = s.ic.guides.find((x) => x.slug === second); return g ? cut(`${g.lead} ${s.partner.name} ${s.t.case}와 함께 정리했어요.`) : undefined; }
  if (head === '질문') { const q = s.ic.questions.find((x) => x.slug === second); return q ? cut(`${q.short} ${q.a}`) : undefined; }
  if (head === '역' && second) return cut(`${second} 주변에서 ${josa(s.partner.name, '이')} 직접 ${s.ic.verb} ${s.t.case}를 지도와 사진으로 모았어요.`);
  if (head === '현장' && second) {
    const site = (await sitesOf(s.partner.id, s.partner.slug)).find((x) => x.id.startsWith(second));
    return site ? cut(`${site.title} · ${dotDate(site.workedAt)}${site.areaPyeong ? ` · ${site.areaPyeong}평` : ''}${site.days ? ` · ${daysText(s.t, site.days)}` : ''}. ${site.summary ?? '작업 전·후 사진과 현장 정보를 그대로 올렸어요.'}`) : undefined;
  }
  if (!second && s.cities.includes(head)) return cut(fill(s.ic.hubLead, s.vars({ 시: head, 시이름: s.cityName(head) })));
  if (pg?.type === '지역') {
    const gen = await generatedBody(pg.id);
    const first = gen?.b.commonBody[0] ? fill(gen.b.commonBody[0], { 지역명: gen.i.name, '현장 수': String(gen.i.sites), '사진 수': String(gen.i.photos), '지역 정보': gen.i.info }) : '';
    return cut(first || `${pg.title} · ${s.partner.name} ${s.t.case} 사진과 기록`);
  }
  return undefined;
}

export default async function SitePath({ params, searchParams }: Props) {
  const [{ slug, path: raw }, sp] = await Promise.all([params, searchParams]);
  const s = await siteBySlug(slug);
  if (!s || !s.ic) notFound();
  const path = raw.map(decodeURIComponent);
  const joined = path.join('/');
  const err = sp.err === '1';
  const [head, second] = path;

  if (joined === 'contact/done') return <Done s={s} />;
  if (joined === '문의') return <ContactPage s={s} err={err} />;
  if (joined === '개인정보처리방침') return <Privacy s={s} />;
  if (head === '현장' && second) return <SitePage s={s} id={second} err={err} />;

  /* 그 밖의 페이지는 pages 행이 있어야 함 — 공개 전(검수 중 등)은 본사 · 업체 미리보기만 */
  const pg = await pageByPath(s.partner.id, joined);
  const preview = pg && !LIVE.includes(pg.status);
  if (preview && !s.canPreview) notFound();
  const banner = preview ? <div className="s-preview"><b>미리보기</b>{pg.status} · 검수를 마치고 발행되면 손님에게 보여요{pg.draftLabel && <> · 시안 {pg.draftLabel}</>}<Link href="/admin/review">검수로 가기</Link></div> : null;

  if (head === '가이드' && second && pg) return <>{banner}<GuidePage s={s} guideSlug={second} err={err} /></>;
  if (head === '질문' && second && pg) return <>{banner}<QuestionPage s={s} qSlug={second} err={err} /></>;
  if (head === '역' && second && pg) return <>{banner}<StationPage s={s} name={second} err={err} /></>;
  if (path.length === 1 && s.cities.includes(head)) return <HubPage s={s} city={head} err={err} />;
  if (path.length === 2 && s.cities.includes(head) && pg) return <>{banner}<RegionPage s={s} pg={pg} err={err} /></>;
  notFound();
}

/* ---------- 04 지역×작업 (시안 A · B · C · D) ---------- */
async function RegionPage({ s, pg, err }: { s: Site; pg: NonNullable<Awaited<ReturnType<typeof pageByPath>>>; err: boolean }) {
  const slug = s.partner.slug;
  const key = pg.regionKey ?? '';
  const [city, dong] = key.split(' ');
  const place = dong ?? s.cityName(city);
  const work = workLabel(pg.work ?? '', s.industry.name);
  const label = ['A', 'B', 'C', 'D', 'E', 'F'].includes(pg.draftLabel ?? '') ? pg.draftLabel! : 'A';
  const [stat, gen, regionSites, citySites, live] = await Promise.all([regionStat(key), generatedBody(pg.id), sitesOf(s.partner.id, slug, { region: dong ? key : undefined, city: dong ? undefined : city }), sitesOf(s.partner.id, slug, { city }), livePages(s.partner.id)]);
  /* 함께 볼 페이지: 같은 시 다른 동의 같은 작업 · 같은 동의 다른 작업 (공개된 것만) */
  const sameWork = live.filter((p) => p.type === '지역' && p.id !== pg.id && p.work === pg.work && p.regionKey?.startsWith(city + ' ') && p.regionKey !== key).slice(0, 8);
  const sameDong = live.filter((p) => p.type === '지역' && p.id !== pg.id && p.regionKey === key && p.work !== pg.work).slice(0, 6);
  const sites = (regionSites.length ? regionSites : citySites).slice(0, 3);
  /* 이 동에 현장이 아직 없으면 같은 시의 가까운 현장으로 — 제목 · 숫자도 그렇게 (이 동 현장인 것처럼 보이지 않게) */
  const nearOnly = !!dong && !regionSites.length;
  const latest = sites[0];
  /* 질문 답변(C)의 근거 현장: 이 동 현장이 모자라면 같은 시 현장으로 채워 답마다 다른 현장을 붙임 */
  const qaSites = [...regionSites, ...citySites].filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).slice(0, 4);
  const cover = latest?.photos.find((p) => p.shot === '후') ?? latest?.photos[0];
  const info = gen?.i.info || stat?.info || '';
  const v = s.vars({ 동: place, 시: city, 시이름: s.cityName(city), 시청: `${s.cityName(city)}청`, 작업: work, 대상: work.replace(s.industry.name, '').trim() || work });
  /* 생성 본문: 검수 묶음의 공통 본문을 이 지역 값으로 채움 — 첫 문단은 머리 한 줄, 나머지는 안내 */
  /* 현장 수는 이 페이지에 실제로 보여 주는 현장 수로 (본문 숫자와 아래 목록이 어긋나지 않게) */
  const body = gen ? gen.b.commonBody.map((p) => fill(p, { 지역명: gen.i.name, '지역 정보': gen.i.info, '현장 수': String(nearOnly ? gen.i.sites : sites.length || gen.i.sites), '사진 수': String(gen.i.photos) })).filter((p) => p.trim() && p !== gen.i.info) : [];
  const lead = body[0] ?? fill(DRAFT_LEAD[label], v);
  const infoCards: [string, string][] = [[`${place} · ${s.t.permit}`, fill(s.ic.permit, v)], [`${place} · ${s.t.areaInfo}`, info]];
  const siteTitle = nearOnly ? `${s.cityName(city)} 가까운 ${s.t.case}` : `${place} ${s.t.case}`;
  const siteSec = <Sec title={siteTitle} card={label !== 'B'}><SiteCards slug={slug} sites={sites} t={s.t} /></Sec>;
  const guideSec = body.length > 1 ? <Sec title={`${place} ${work} 안내`} narrow><div className="s-sechead">{body.slice(1).map((p, i) => <p key={i} className="s-p">{p}</p>)}</div></Sec> : null;
  return (
    <>
      <Crumb slug={slug} items={[[s.cityName(city), city], [work]]} />
      <Hero s={s} eyebrow={`${s.cityName(city).replace(/[시군구]$/, '')} ${place} · ${work}`.replace(`${city} ${city}`, city)} title={`${city} ${dong ? dong + ' ' : ''}${work}`} lead={lead} photo={cover} caption={cover ? `${cover.caption} · ${dotDate(latest?.workedAt ?? null)}` : undefined} />
      {label === 'A' && (
        <>
          <Sec title={`${s.t.case} 사진`} sub={`${place} ${work} · 사진 ${Math.max(stat?.photos ?? 0, sites.flatMap((x) => x.photos).length)}장 중 ${Math.min(5, sites.flatMap((x) => x.photos).length)}장`}><Photos photos={sites.flatMap((x) => x.photos).slice(0, 5)} /></Sec>
          {siteSec}
          <Sec title={`${place} 지역 정보`}><RegionInfo items={infoCards} /></Sec>
          {guideSec}
        </>
      )}
      {label === 'B' && (
        <>
          <Sec title={nearOnly ? siteTitle : `${s.t.case} 기록`} sub="최근 순"><Records sites={sites} t={s.t} /></Sec>
          <Sec title="진행 순서" card><Steps ic={s.ic} /></Sec>
          <Sec title={`${place} 지역 정보`}><RegionInfo items={infoCards} /></Sec>
          {guideSec}
        </>
      )}
      {label === 'C' && (
        <>
          <Sec title="많이 묻는 질문"><QnA caseWord={s.t.case} items={s.ic.faq.slice(0, 4).map((f, i) => {
            const site = qaSites[i % Math.max(1, qaSites.length)];
            /* 작업 기간 질문({작업}이 들어간 질문)은 근거 현장의 실제 기록으로 먼저 답함 — 지어낸 수치 대신 */
            const record = f.q.includes('{작업') && site?.days ? `${josa(site.title, '은')} ${site.areaPyeong ? `${site.areaPyeong}평, ` : ''}${daysText(s.t, site.days)} 걸렸어요. ` : '';
            return { q: fill(f.q, v), a: record + fill(f.a, v), photo: site?.photos[(i + 1) % Math.max(1, site.photos.length)], basis: site ? `${site.title}${site.areaPyeong ? ` · ${site.areaPyeong}평` : ''}${site.days ? ` · ${daysText(s.t, site.days)}` : ''}` : s.partner.name };
          })} /></Sec>
          {siteSec}
          <Sec title={`${place} 지역 정보`}><RegionInfo items={infoCards} /></Sec>
          {guideSec}
        </>
      )}
      {label === 'D' && (
        <>
          <Sec><Summary ic={s.ic} /></Sec>
          <Sec title={s.t.costTitle || (s.ic.cost.table.priced ? '평수별 비용' : `${s.ic.cost.table.head[0]}별 작업 범위`)}><Cost ic={s.ic} /></Sec>
          {siteSec}
          <Sec title={`${place} 지역 정보`}><RegionInfo items={infoCards} /></Sec>
          {guideSec}
        </>
      )}
      {/* E 지도 중심형: 이 동 현장을 지도에 · 현장 카드 · 지역 정보 */}
      {label === 'E' && (
        <>
          <Sec title={`${place} 주변 ${s.t.case} 지도`}><MapPins label={`지도 · ${place} 주변`} pins={(regionSites.length ? regionSites : citySites).slice(0, 8).map((x) => `${x.dong} ${x.buildingType ?? ''}${x.areaPyeong ? ` · ${x.areaPyeong}평` : ''}`.replace(/\s+·/, ' ·'))} /></Sec>
          {siteSec}
          <Sec title={`${place} 지역 정보`}><RegionInfo items={infoCards} /></Sec>
          {guideSec}
        </>
      )}
      {/* F 후기 인용형: 후기 자료(고객 동의)가 연결되기 전에는 현장 기록으로 — 없는 후기를 지어내지 않음 */}
      {label === 'F' && (
        <>
          <Sec title={nearOnly ? siteTitle : `${s.t.case} 기록`} sub="마친 순서"><Records sites={sites} t={s.t} /></Sec>
          <Sec title={`${place} 지역 정보`}><RegionInfo items={infoCards} /></Sec>
          {guideSec}
        </>
      )}
      {(sameWork.length > 0 || sameDong.length > 0) && (
        <Sec card><Related slug={slug} groups={[
          { h: `${s.cityName(city)} 다른 동 ${work}`, links: sameWork.map((p) => ({ label: `${p.regionKey!.split(' ')[1] ?? p.regionKey} ${work}`, path: p.path! })) },
          { h: `${place} 다른 ${s.t.kind}`, links: sameDong.map((p) => ({ label: `${place} ${workLabel(p.work ?? '', s.industry.name)}`, path: p.path! })) }
        ]} /></Sec>
      )}
      <Sec><Contact s={s} from={pg.path ?? ''} error={err} /></Sec>
    </>
  );
}

/* ---------- 03 지역 허브 ---------- */
async function HubPage({ s, city, err }: { s: Site; city: string; err: boolean }) {
  const slug = s.partner.slug;
  const [sites, pages] = await Promise.all([sitesOf(s.partner.id, slug, { city }), livePages(s.partner.id)]);
  const v = s.vars({ 시: city, 시이름: s.cityName(city), 시청: `${s.cityName(city)}청` });
  const cover = sites.flatMap((x) => x.photos).find((p) => p.src);
  const inCity = pages.filter((p) => p.type === '지역' && p.path?.startsWith(city + '/'));
  const byDong = Array.from(new Map(inCity.filter((p) => p.regionKey?.includes(' ')).map((p) => [p.regionKey!.split(' ')[1], p])).values());
  const byWork = Array.from(new Map(inCity.filter((p) => p.work).map((p) => [p.work!, p])).values());
  return (
    <>
      <Crumb slug={slug} items={[[s.cityName(city)]]} />
      <Hero s={s} eyebrow={s.cityName(city)} title={`${s.cityName(city)} ${s.industry.name}`} lead={fill(s.ic.hubLead, v)} photo={cover} caption={cover ? `${cover.caption} · ${s.t.case} 사진` : undefined} />
      <Sec title={`${city} 지역 정보`}><RegionInfo items={[[`${s.cityName(city)} · ${s.t.permit}`, fill(s.ic.cityPermit, v)], [`${s.cityName(city)} · ${s.t.areaInfo}`, s.content?.cityInfo[city] ?? '']]} /></Sec>
      <Sec title={`${city} ${s.t.case}`} sub={`${sites.length}곳 · 최근 순`} card><SiteCards slug={slug} sites={sites.slice(0, 8)} cols={4} t={s.t} /></Sec>
      <Sec title={`${city} 안에서 찾기`}>
        <Related slug={slug} groups={[
          { h: '동별', links: byDong.map((p) => ({ label: `${p.regionKey!.split(' ')[1]} ${s.industry.name}`, path: p.path! })) },
          { h: `${s.t.kind}별`, links: byWork.map((p) => ({ label: `${city} ${workLabel(p.work!, s.industry.name)}`, path: p.path! })) }
        ]} />
        {!inCity.length && <span className="s-h2sub">이 지역 페이지는 아직 만들고 있어요</span>}
      </Sec>
      <Sec><Contact s={s} from={city} error={err} /></Sec>
    </>
  );
}

/* ---------- 05 역 주변 ---------- */
async function StationPage({ s, name, err }: { s: Site; name: string; err: boolean }) {
  const slug = s.partner.slug;
  const st = s.content?.stations.find((x) => x.name === name);
  if (!st) notFound();
  const [sites, pages] = await Promise.all([sitesOf(s.partner.id, slug, { titles: st.sites }), livePages(s.partner.id)]);
  const others = pages.filter((p) => p.type === '역 주변' && p.path !== `역/${name}`);
  return (
    <>
      <Crumb slug={slug} items={[[s.cityName(st.city), st.city], [`${name} 인근`]]} />
      <Hero s={s} text eyebrow={`${name} 반경 ${st.radius}`} title={`${name} 인근 ${s.industry.name}`} lead={`${name} 주변에서 직접 ${s.ic.verb} ${s.t.case} ${sites.length}곳이에요. 지도의 점을 누르면 ${s.t.case} 기록으로 가요.`} />
      <section className="s-sec" style={{ paddingTop: 28, paddingBottom: 0 }}><div className="s-sec__in"><MapPins tall label={`지도 · ${name} 주변`} station={name} pins={sites.map((x) => `${x.dong} ${x.buildingType ?? ''}${x.areaPyeong ? ` · ${x.areaPyeong}평` : ''}`.replace(/\s+·/, ' ·'))} /></div></section>
      <Sec title={`지도에 표시된 ${s.t.case}`}><SiteCards slug={slug} sites={sites} t={s.t} /></Sec>
      {others.length > 0 && <Sec card><Related slug={slug} groups={[{ h: '다른 역 주변', links: others.map((p) => ({ label: p.title, path: p.path! })) }]} /></Sec>}
      <Sec><Contact s={s} from={`역/${name}`} error={err} /></Sec>
    </>
  );
}

/* ---------- 06 현장 기록 ---------- */
async function SitePage({ s, id, err }: { s: Site; id: string; err: boolean }) {
  const slug = s.partner.slug;
  const [all, live] = await Promise.all([sitesOf(s.partner.id, slug), livePages(s.partner.id)]);
  const site = all.find((x) => x.id.startsWith(id));
  if (!site) notFound();
  const near = all.filter((x) => x.region === site.region && x.id !== site.id).slice(0, 3);
  /* 이 현장이 있는 동의 지역 페이지 (현장 → 지역 페이지로 이어지게) */
  const dongPages = live.filter((p) => p.type === '지역' && p.regionKey === site.region).slice(0, 6);
  /* 현장 정보: 있는 값만 (업종마다 입력 항목이 달라 — 방 개수 · 자재 같은 값은 details) */
  const kv: [string, string][] = ([
    ['유형', site.buildingType ?? ''], ['평수', site.areaPyeong ? `${site.areaPyeong}평` : ''], ['기간', site.days ? daysText(s.t, site.days) : ''], ['층', site.floorNote ?? ''],
    ...Object.entries(site.details ?? {})
  ] as [string, string][]).filter(([, v]) => v);
  return (
    <>
      <Crumb slug={slug} items={[[s.cityName(site.city), site.city], [site.dong], [`${s.t.case} 기록`]]} />
      <Hero s={s} text eyebrow={`${s.t.case} 기록 · ${dotDate(site.workedAt)}`} title={site.title} />
      <Sec><Photos photos={site.photos} /></Sec>
      <Sec title={`${s.t.case} 정보`}><div className="s-kv">{kv.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div></Sec>
      {site.issues.length > 0 && <Sec title={s.t.issues}>{site.issues.map((x) => <div key={x.title} className="s-issue"><b>{x.title}</b><p className="s-p">{x.body}</p></div>)}</Sec>}
      <Sec title={s.t.ba} card>
        <div className="s-ba"><div><Ph photo={site.photos.find((p) => p.shot === '전') ?? site.photos[0]} shot="전" shotLabel={s.t.shots[0] ?? ''} /></div><div><Ph photo={site.photos.find((p) => p.shot === '후') ?? site.photos[site.photos.length - 1]} shot="후" shotLabel={s.t.shots[1] ?? ''} /></div></div>
        {site.summary && <span className="s-p" style={{ fontSize: 15 }}>{site.summary}</span>}
      </Sec>
      {near.length > 0 && <Sec title={`${site.dong} 다른 ${s.t.case}`}><SiteCards slug={slug} sites={near} t={s.t} /></Sec>}
      {dongPages.length > 0 && <Sec card><Related slug={slug} groups={[{ h: `${site.dong} ${s.t.kind}별 안내`, links: dongPages.map((p) => ({ label: `${site.dong} ${workLabel(p.work ?? '', s.industry.name)}`, path: p.path! })) }]} /></Sec>}
      <Sec><Contact s={s} from={site.path} error={err} /></Sec>
    </>
  );
}

/* ---------- 02 업종 가이드 ---------- */
async function GuidePage({ s, guideSlug, err }: { s: Site; guideSlug: string; err: boolean }) {
  const slug = s.partner.slug;
  const g = s.ic.guides.find((x) => x.slug === guideSlug);
  if (!g) notFound();
  const cases = (await sitesOf(s.partner.id, slug)).slice(0, 2);
  return (
    <>
      <Crumb slug={slug} items={[['가이드'], [g.title]]} />
      <Hero s={s} text eyebrow={`가이드 · ${s.industry.name}`} title={g.title} lead={g.lead} />
      <div className="s-wrap" style={{ marginTop: -8 }}><span className="s-h2sub" style={{ fontSize: 14 }}>{g.updated} 업데이트 · 읽는 데 {g.minutes}분</span></div>
      <section className="s-sec" style={{ paddingTop: 24 }}>
        <div className="s-sec__in">
          <div className="s-guide">
            <nav className="s-toc" aria-label="목차"><span>목차</span>{g.sections.map((x, i) => <a key={x.h} href={`#g${i + 1}`}><i>{i + 1}</i>{x.h}</a>)}</nav>
            <article className="s-article">
              {g.sections.map((x, i) => (
                <div key={x.h} style={{ display: 'contents' }}>
                  <h2 id={`g${i + 1}`}><i>{i + 1}</i>{x.h}</h2>
                  {x.p && <p className="s-p">{x.p}</p>}
                  {x.cost && <Cost ic={s.ic} />}
                  {x.checklist && <div className="s-check">{x.checklist.map((c) => <label key={c}><input type="checkbox" />{c}</label>)}</div>}
                  {x.cases && <SiteCards slug={slug} sites={cases} cols={2} t={s.t} />}
                </div>
              ))}
            </article>
          </div>
        </div>
      </section>
      <Sec><Contact s={s} from={`가이드/${guideSlug}`} error={err} /></Sec>
    </>
  );
}

/* ---------- 07 질문 ---------- */
async function QuestionPage({ s, qSlug, err }: { s: Site; qSlug: string; err: boolean }) {
  const slug = s.partner.slug;
  const q = s.ic.questions.find((x) => x.slug === qSlug);
  if (!q) notFound();
  const [all, pages] = await Promise.all([sitesOf(s.partner.id, slug), livePages(s.partner.id)]);
  const basis: SiteRow[] = [...all.filter((x) => x.buildingType === q.basis), ...all].filter((x, i, a) => a.indexOf(x) === i).slice(0, 2);
  const guidePage = pages.find((p) => p.type === '가이드');
  const guide = s.ic.guides.find((g) => guidePage?.path === `가이드/${g.slug}`);
  const others = pages.filter((p) => p.type === '질문' && p.path !== `질문/${qSlug}`);
  return (
    <>
      <Crumb slug={slug} items={[['질문'], [q.q.replace(/[은는]? ?(얼마나|며칠|몇).*$/, '').trim() || q.tag]]} />
      <section className="s-hero"><div className="s-sec__in s-sec__in--narrow" style={{ gap: 14 }}>
        <span className="s-eyebrow">질문 · {q.tag}</span>
        <h1 className="s-h1" style={{ fontSize: 'clamp(28px, 4vw, 40px)', lineHeight: 1.3 }}>{q.q}</h1>
        <div className="s-answer"><b>{q.short}</b><p>{q.a}</p></div>
      </div></section>
      <Sec title={`근거가 된 ${s.t.case}`} narrow><SiteCards slug={slug} sites={basis} cols={2} t={s.t} /></Sec>
      <Sec title={guide ? '관련 가이드' : undefined} narrow>
        {guide && guidePage?.path && <Link href={href(slug, guidePage.path)} className="s-guidelink"><div><b>{guide.title}</b><span>{guide.short}</span></div><i>›</i></Link>}
        <Related slug={slug} groups={[{ h: '다른 질문', links: others.map((p) => ({ label: p.title.endsWith('?') ? p.title : p.title + '?', path: p.path! })) }]} />
      </Sec>
      <Sec><Contact s={s} from={`질문/${qSlug}`} error={err} /></Sec>
    </>
  );
}

/* ---------- 08 문의 · 접수 완료 · 개인정보처리방침 ---------- */
function ContactPage({ s, err }: { s: Site; err: boolean }) {
  return (
    <>
      <Crumb slug={s.partner.slug} items={[['문의']]} />
      <Hero s={s} text title="문의" lead={s.t.contactLead} />
      <Sec><Contact s={s} from="문의" regions error={err} /></Sec>
      <Sec title="접수 후 안내"><After items={s.t.after} /></Sec>
    </>
  );
}

function Done({ s }: { s: Site }) {
  return (
    <>
      <Crumb slug={s.partner.slug} items={[['문의', '문의'], ['접수 완료']]} />
      <Sec narrow>
        <div className="s-done"><span className="s-done__i" aria-hidden="true">✓</span><b>문의가 접수됐어요</b><span>{josa(s.partner.name, '이')} 하루 안에 연락드려요. 급하시면 전화로 물어봐 주세요.</span></div>
      </Sec>
      <Sec title="접수 후 안내">
        <After items={s.t.after} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><a href={`tel:${s.partner.tel ?? ''}`} className="s-btn">전화하기</a><Link href={href(s.partner.slug)} className="s-btn s-btn--line">홈으로</Link></div>
      </Sec>
    </>
  );
}

function Privacy({ s }: { s: Site }) {
  return (
    <>
      <Crumb slug={s.partner.slug} items={[['개인정보처리방침']]} />
      <Hero s={s} text title="개인정보처리방침" lead={`${josa(s.partner.name, '은')} 문의 응대를 위해 이름과 연락처, 문의 내용만 받아요.`} />
      <Sec narrow><p className="s-p">본문은 실제 내용 입력 자리예요 · 수집 항목, 이용 목적, 보관 기간, 파기 방법, 문의처를 업체 정보로 채워요.</p></Sec>
    </>
  );
}
