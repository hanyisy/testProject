import Link from 'next/link';
import { asc } from 'drizzle-orm';
import TopBar from '@/components/TopBar';
import { requirePerm } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { TEMPLATE_GROUPS } from '@/lib/constants';
import { CodeAndDelete, GroupItems, NewIndustry, StatusPick } from './TemplateTools';

export const metadata = { title: '업종 템플릿' };

const TST: Record<string, string> = { '사용 가능': 'ok', '신규 중지': 'warn', '보관': 'gray' };
/* 점유 표 열 이름: 도 단위(강원 · 경기 …)는 빼고 시 이름만, 특별·광역시는 그대로 (시안 3h: 춘천 · 서울 서초) */
const short = (r: string) => r.replace(/^(강원|경기|충북|충남|전북|전남|경북|경남|제주)\s+/, '');

/* 시안 3h — 업종 템플릿 + 업종×지역 점유 */
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  const user = await requirePerm('업종 템플릿');
  const sp = await searchParams;
  const db = await getDb();
  const [inds, items, partners, regions] = await Promise.all([
    db.select().from(t.industries).orderBy(asc(t.industries.sort)),
    db.select().from(t.industryItems).orderBy(asc(t.industryItems.sort)),
    db.select({ id: t.partners.id, name: t.partners.name, status: t.partners.status, industryId: t.partners.industryId }).from(t.partners).orderBy(asc(t.partners.createdAt)),
    db.select().from(t.partnerRegions).orderBy(asc(t.partnerRegions.sort))
  ]);
  const use = (id: string) => ({ active: partners.filter((p) => p.industryId === id && p.status !== '종료').length, ended: partners.filter((p) => p.industryId === id && p.status === '종료').length });
  const sel = inds.find((x) => x.code === sp.i) ?? inds[0];
  const selUse = sel ? use(sel.id) : { active: 0, ended: 0 };

  /* 점유: 지역 열은 파트너 서비스 지역 전체 (파트너 등록 순 → 그 파트너의 지역 순) */
  const cols = Array.from(new Set(partners.flatMap((p) => regions.filter((r) => r.partnerId === p.id).map((r) => r.region))));
  const occRows = inds.filter((x) => x.status !== '보관').map((ind) => ({
    name: ind.name,
    cells: cols.map((region) => {
      const hits = regions.filter((r) => r.region === region).map((r) => partners.find((p) => p.id === r.partnerId)).filter((p) => p && p.industryId === ind.id);
      const live = hits.find((p) => p!.status !== '종료');
      if (live) return live.status === '준비 중' ? { t: `${live.name} · 준비`, k: 'warn' } : { t: live.name, k: 'ink' };
      return hits.length ? { t: '종료 · 비어 있음', k: 'gray' } : { t: '—', k: 'none' };
    })
  }));

  return (
    <>
      <TopBar title="업종 템플릿" user={user} />
      <div className="page">
        <div className="grid tplgrid">
          <section className="table">
            <div className="tablehead" style={{ alignItems: 'center' }}><h2 className="panel__title">업종</h2><span style={{ marginLeft: 'auto' }}><NewIndustry /></span></div>
            <div className="table__head" style={{ '--cols': 'minmax(0,1fr) 130px 90px 100px' } as React.CSSProperties}><span>업종명</span><span>코드</span><span className="r">파트너</span><span>상태</span></div>
            {inds.map((x) => {
              const u = use(x.id), on = x.id === sel?.id;
              return (
                <Link key={x.id} href={`/admin/templates?i=${x.code}`} scroll={false} className="table__row" aria-current={on ? 'true' : undefined}
                  style={{ '--cols': 'minmax(0,1fr) 130px 90px 100px', minHeight: 60, background: on ? 'var(--surf)' : undefined } as React.CSSProperties}>
                  <span style={{ fontSize: 15, fontWeight: on ? 800 : 600, color: on ? 'var(--ink)' : 'var(--text2)' }}>{x.name}</span>
                  <span className="cell-mono" style={{ fontSize: 13, color: 'var(--text2)' }}>{x.code}</span>
                  <span className="cell-num">{u.active}{u.ended ? ` (종료 ${u.ended})` : ''}</span>
                  <span><span className={`chip chip--${TST[x.status]}`}>{x.status}</span></span>
                </Link>
              );
            })}
          </section>
          {sel && (
            <section className="panel" style={{ padding: 22, gap: 16 }}>
              <CodeAndDelete id={sel.id} name={sel.name} code={sel.code} active={selUse.active} ended={selUse.ended}
                chip={<span className={`chip chip--${TST[sel.status]}`}>{sel.status}</span>} />
              <StatusPick id={sel.id} status={sel.status} />
              {TEMPLATE_GROUPS.map((g) => (
                <GroupItems key={g} id={sel.id} group={g} items={items.filter((i) => i.industryId === sel.id && i.group === g).map((i) => ({ id: i.id, label: i.label }))} />
              ))}
            </section>
          )}
        </div>

        <section className="table">
          <div className="tablehead"><h2 className="panel__title">업종×지역 점유 현황</h2><span className="panel__sub">한 지역의 한 업종에는 파트너 한 곳만</span></div>
          <div className="table__scroll">
            <div className="occ" style={{ gridTemplateColumns: `120px repeat(${cols.length}, minmax(96px, 1fr))` }}>
              <span />
              {cols.map((c) => <span key={c} className="occ__h">{short(c)}</span>)}
              {occRows.map((r) => [
                <span key={r.name} className="occ__biz">{r.name}</span>,
                ...r.cells.map((c, i) => <span key={r.name + i} className="occ__c"><span className={`occ__v occ__v--${c.k}`}>{c.t}</span></span>)
              ])}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
