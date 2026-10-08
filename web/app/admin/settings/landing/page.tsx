import Link from 'next/link';
import { asc, eq, ne } from 'drizzle-orm';
import TopBar from '@/components/TopBar';
import ListState from '@/components/ListState';
import { requirePerm } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { getSetting, type DemoStats } from '@/lib/admin';
import { today } from '@/lib/config';
import { md } from '@/lib/format';
import { CAPTURE_INDUSTRIES, captures, landingValues } from '@/lib/landing';
import { deleteCapture, moveCapture, setCaptureVisible } from './actions';
import { CaptureAdd, ValuesForm } from './LandingTools';

export const metadata = { title: '랜딩 관리' };

const COLS = '96px minmax(0,1.2fr) 100px minmax(0,1fr) 100px 210px';

/* 랜딩 관리 (시안 없음 — 설정 아래 새 메뉴, 어드민 공용 부품으로): 실제 검색 화면 캡처 · 랜딩 값 */
export default async function LandingAdmin() {
  const user = await requirePerm('랜딩 관리');
  const db = await getDb();
  const [items, values, partners, inds, idxDays, stats, day] = await Promise.all([
    captures(true), landingValues(),
    db.select({ id: t.partners.id, name: t.partners.name }).from(t.partners).where(ne(t.partners.status, '종료')).orderBy(asc(t.partners.createdAt)),
    db.select({ id: t.industries.id }).from(t.industries).where(eq(t.industries.status, '사용 가능')),
    getSetting<number>('index_days', 23), getSetting<DemoStats | null>('demo_stats', null), today()
  ]);
  /* 참고값: 지금 데이터에서 계산 (넣을지는 담당자가 정함) */
  const hints = {
    industries: `업종 템플릿 사용 가능 ${inds.length}개`,
    pages: stats ? `발행·색인 전체 발행 ${Object.values(stats.partners).reduce((a, p) => a + p.pages, 0)}장` : '',
    indexDays: `설정의 색인 안내 ${idxDays}일`
  };
  return (
    <>
      <TopBar title="설정" user={user} />
      <div className="page">
        <div className="stack" style={{ gap: 10 }}>
          <Link href="/admin/settings" className="back">‹ 설정</Link>
          <div className="dhead__row"><span className="dhead__title">랜딩 관리</span>
            <a href="/landing/" target="_blank" rel="noreferrer" className="link-accent" style={{ marginLeft: 'auto' }}>랜딩 열기 ↗</a></div>
        </div>
        <div className="infobox infobox--i"><span className="infobox__i">i</span>랜딩에는 실제 값만 넣어요. 비워 두면 랜딩에서 그 자리가 빈칸으로 나와요</div>

        <section className="table">
          <div className="tablehead"><h2 className="panel__title">실제 검색 화면</h2><span className="panel__sub">실제 검색 결과 캡처만 · 다른 업체 상호는 흐리게 칠해서 올려요 · 보이게 한 것만 랜딩에 나와요</span></div>
          <div className="table__scroll">
            <div className="table__head" style={{ '--cols': COLS, '--min': '880px' } as React.CSSProperties}><span>캡처</span><span>검색어</span><span>업종</span><span>파트너 · 캡처한 날</span><span>랜딩</span><span /></div>
            {!items.length ? <ListState kind="empty" title="아직 캡처가 없어요" desc="캡처가 하나도 없으면 랜딩에서 이 섹션이 숨겨져요" /> : items.map((c, i) => (
              <div key={c.id} className="table__row" style={{ '--cols': COLS, '--min': '880px', minHeight: 76, opacity: c.visible ? 1 : 0.55 } as React.CSSProperties}>
                <a href={c.image} target="_blank" rel="noreferrer" className="capthumb" style={{ backgroundImage: `url("${c.image}")` }} aria-label={`${c.query} 캡처 크게 보기`} />
                <b style={{ fontSize: 15 }}>{c.query}</b>
                <span><span className="chip chip--plain">{c.industry}</span></span>
                <span className="cell-name"><b style={{ fontWeight: 700 }}>{c.partner || '—'}</b><small>{md(c.capturedAt)}{c.blur.length ? ` · 흐림 ${c.blur.length}곳` : ''}</small></span>
                <form action={setCaptureVisible.bind(null, c.id, !c.visible)}><button className="sw" role="switch" aria-checked={c.visible} aria-label={c.visible ? '랜딩에서 숨기기' : '랜딩에 보이기'} /></form>
                <span className="cell-act">
                  <form action={moveCapture.bind(null, c.id, -1)}><button className="btn-ghost btn-ghost--xs" disabled={i === 0} aria-label="앞으로">↑</button></form>
                  <form action={moveCapture.bind(null, c.id, 1)}><button className="btn-ghost btn-ghost--xs" disabled={i === items.length - 1} aria-label="뒤로">↓</button></form>
                  <form action={deleteCapture.bind(null, c.id)}><button className="btn-ghost btn-ghost--xs" style={{ color: 'var(--red)' }}>삭제</button></form>
                </span>
              </div>
            ))}
          </div>
          <div style={{ padding: 20, borderTop: '1px solid var(--line2)' }}>
            <CaptureAdd industries={[...CAPTURE_INDUSTRIES]} partners={partners} today={day} />
          </div>
        </section>

        <ValuesForm values={values} hints={hints} />
      </div>
    </>
  );
}
