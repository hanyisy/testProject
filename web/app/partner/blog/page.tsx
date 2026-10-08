import Link from 'next/link';
import { and, asc, eq } from 'drizzle-orm';
import PartnerTop from '@/components/PartnerTop';
import { requirePartner } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { partnerFrame, photoGroups } from '@/lib/partner-app';
import { today } from '@/lib/config';
import PhotoActions from '../PhotoActions';
import Preview, { RequestButton } from './Preview';

export const metadata = { title: '블로그' };

/* 화면에 보이는 상태: 직접 올리기는 초안/올림, 본사 대행은 승인 대기/본사에서 올리는 중/올림 */
const LABEL = {
  '직접 올리기': { '초안': ['초안', 'gray'], '승인 대기': ['초안', 'gray'], '승인': ['초안', 'gray'], '올림': ['올림', 'ok'] },
  '본사 대행': { '초안': ['승인 대기', 'warn'], '승인 대기': ['승인 대기', 'warn'], '승인': ['본사에서 올리는 중', 'info'], '올림': ['올림', 'ok'] }
} as const;

/* 시안 2e(요금제에 없음) · 2f(직접 올리기) · 2f-2(본사 대행) — 모바일 1e · 1f */
export default async function BlogPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const user = await requirePartner();
  const sp = await searchParams;
  const db = await getDb();
  const [frame, groups, posts, day] = await Promise.all([
    partnerFrame(user.partnerId),
    photoGroups(user.partnerId),
    db.select().from(t.blogPosts).where(eq(t.blogPosts.partnerId, user.partnerId)).orderBy(asc(t.blogPosts.sort)),
    today()
  ]);
  const mode = frame.blogMode;
  const newPhotos = groups.reduce((a, g) => a + g.photos.length, 0);
  const top = <PartnerTop title="블로그" actions={<PhotoActions newPhotos={newPhotos} />} />;

  if (mode === '꺼짐') {
    return (
      <>
        {top}
        <div className="ppage">
          <section className="lockcard">
            <span className="lockcard__i" aria-hidden="true"><span className="lockcard__lock"><span /><span /></span></span>
            <div className="lockcard__t"><b>이용 중인 요금제에 없는 기능이에요</b><span>블로그 · 현장 기록으로 글 초안 만들기</span></div>
            <div className="lockcard__steps">
              {['현장 사진과 정보로 블로그 글 초안을 만들어 드려요', '복사해서 내 블로그에 붙여넣기만 하면 돼요', '올린 글 주소를 넣으면 이번 달 발행 건수에 집계돼요'].map((s, i) => (
                <div key={s}><span>{i + 1}</span><b>{s}</b></div>
              ))}
            </div>
            <RequestButton kind="기능 추가" subject="블로그 초안" />
          </section>
        </div>
      </>
    );
  }

  const label = LABEL[mode];
  const cur = posts.find((p) => p.id === sp.d) ?? posts.find((p) => p.status !== '올림') ?? posts[0];
  /* 초안 미리보기 사진: 그 현장의 공개 사진 3장 (사람 사진 · 자리표시 제외) — 현장 연결이 없으면 현장 제목으로 찾음 */
  const siteId = cur?.siteId ?? (cur ? (await db.select({ id: t.sites.id }).from(t.sites).where(and(eq(t.sites.partnerId, user.partnerId), eq(t.sites.title, cur.siteTitle))).limit(1))[0]?.id : null);
  const curPhotos = siteId
    ? (await db.select().from(t.photos).where(and(eq(t.photos.siteId, siteId), eq(t.photos.partnerPublic, true), eq(t.photos.hasPerson, false))).orderBy(asc(t.photos.sort)))
      .filter((p) => !p.fileKey.startsWith('demo/')).slice(0, 3).map((p) => ({ src: `/files/${p.fileKey}`, alt: p.caption ?? p.label ?? cur!.siteTitle }))
    : [];
  /* 이번 달 발행 = 올린 날이 이번 달(기준일의 달)인 글 */
  const ym = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d).slice(0, 7);
  const month = posts.filter((p) => p.status === '올림' && p.publishedAt && ym(p.publishedAt) === day.slice(0, 7)).length;
  const second = mode === '직접 올리기'
    ? { k: '올릴 초안', n: posts.filter((p) => p.status !== '올림').length }
    : { k: '승인 대기', n: posts.filter((p) => p.status === '초안' || p.status === '승인 대기').length };
  return (
    <>
      {top}
      <div className="ppage">
        <div className="grid grid--2 blogstats">
          <div className="pcard pstat"><span className="pcard__k">이번 달 발행</span><span className="pstat__n" style={{ fontSize: 34 }}>{month}<small style={{ fontSize: 18 }}>건</small></span></div>
          <div className="pcard pstat"><span className="pcard__k">{second.k}</span><span className="pstat__n" style={{ fontSize: 34 }}>{second.n}<small style={{ fontSize: 18 }}>건</small></span></div>
        </div>
        {!posts.length ? (
          <section className="pcard" style={{ padding: 28, alignItems: 'center', textAlign: 'center' }}>
            <b style={{ fontSize: 18 }}>아직 초안이 없어요</b>
            <span className="muted">현장을 발행하면 그 현장으로 블로그 초안을 만들어 드려요</span>
            <Link href="/partner/sites" className="pbtn pbtn--accent" style={{ marginTop: 8, height: 50, padding: '0 22px' }}>현장 발행하기</Link>
          </section>
        ) : (
          <div className="bloggrid">
            <div className="stack" style={{ gap: 10 }}>
              <span className="mklabel" style={{ padding: '0 4px' }}>현장별 초안</span>
              {posts.map((p) => {
                const [st, chip] = label[p.status];
                return (
                  <Link key={p.id} href={`/partner/blog?d=${p.id}`} scroll={false} className="draftpick" aria-current={p.id === cur?.id ? 'true' : undefined}>
                    <span className="draftpick__top"><small>{p.siteTitle} · {p.siteDate}</small><span className={`chip chip--${chip}`}>{st}</span></span>
                    <b>{p.title}</b>
                  </Link>
                );
              })}
            </div>
            {cur && (
              <Preview key={cur.id} mode={mode} photos={curPhotos}
                post={{ id: cur.id, title: cur.title, body: cur.body, url: cur.url, status: cur.status, label: label[cur.status][0], chip: label[cur.status][1] }} />
            )}
          </div>
        )}
      </div>
    </>
  );
}
