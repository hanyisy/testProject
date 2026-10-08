import Link from 'next/link';
import { notFound } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { requirePerm } from '@/lib/auth';
import { partnerDetail, scopeLogs } from '@/lib/partners';
import { TIERS } from '@/lib/constants';
import TierPick from './TierPick';

export const metadata = { title: '양산 범위' };

const PHOTOS_PER_PAGE = 3; // 기획서 4장: 페이지당 고유 사진 3장 기준
const fmtWhen = (d: Date) => {
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' }).format(d);
  return p.replace(',', '');
};

/* 시안 3g — 양산 범위 선택 (기능 스위치 → 범위 선택). 선택은 최고 관리자 · 관리팀만 */
export default async function ScopePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm('파트너 관리');
  const { id } = await params;
  const [d, logs] = await Promise.all([partnerDetail(id), scopeLogs(id)]);
  if (!d) notFound();
  const can = user.role === '최고 관리자' || user.role === '관리팀';
  const canFill = Math.ceil(d.photos / PHOTOS_PER_PAGE);
  const COLS = '180px 160px minmax(0,1fr) 140px';
  return (
    <>
      <TopBar title="파트너" user={user} />
      <div className="page">
        <div className="dhead" style={{ gap: 8 }}>
          <Link href={`/admin/partners/${id}/features`} className="back">‹ 기능 스위치</Link>
          <div className="row" style={{ alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h2 className="phead__name">양산 범위</h2>
            <span style={{ fontSize: 15, color: 'var(--sub)' }}>{d.partner.name} · 보유 현장 사진 {d.photos}장 · 현장 {d.sites}곳</span>
          </div>
        </div>

        <div className="grid grid--3 scopegrid">
          {TIERS.map((t) => {
            const fill = Math.min(t.pages, canFill);
            const full = fill >= t.pages;
            return (
              <div key={t.name} className={'tier' + (d.partner.scope === t.name ? ' is-current' : '')}>
                <div className="row" style={{ alignItems: 'center' }}>
                  <span className="tier__name">{t.name}</span>
                  <span className={`chip chip--${t.risk[1]}`}>{t.risk[0]}</span>
                </div>
                <div className="tier__types">
                  <span className="fld__label">생성되는 페이지</span>
                  {t.types.map((x) => <span key={x} className="tier__type">{x}</span>)}
                </div>
                <div className="tier__nums">
                  <div className="fld" style={{ gap: 2 }}><span className="fld__label">예상 페이지</span><span className="tier__big">{t.pages}</span></div>
                  <div className="fld" style={{ gap: 2 }}><span className="fld__label">사진으로 채울 수 있는</span><span className="tier__big" style={{ color: full ? 'var(--s4f)' : 'var(--red)' }}>{fill}</span></div>
                </div>
                <div className="fld">
                  <span className="tier__track"><span style={{ width: `${Math.round((fill / t.pages) * 100)}%`, background: full ? 'var(--s4f)' : 'var(--red)', borderRadius: 4 }} /></span>
                  <span className="hint">{full ? '모든 페이지를 실제 사진으로 채울 수 있어요' : `${t.pages - fill}페이지는 사진 없이 글만으로 만들어져요`}</span>
                </div>
                <TierPick id={id} tier={t.name} current={d.partner.scope === t.name} can={can} note={`예상 ${t.pages}페이지 중 ${t.pages - fill}페이지는 실제 현장 사진 없이 만들어져요.`} />
              </div>
            );
          })}
        </div>

        <section className="table">
          <div style={{ padding: '18px 20px 6px' }}><h3 className="panel__title">선택 기록</h3></div>
          <div className="table__scroll">
            <div className="table__head" style={{ '--cols': COLS, '--min': '640px' } as React.CSSProperties}><span>일시</span><span>담당자</span><span>변경</span><span>경고 확인</span></div>
            {logs.map((l) => (
              <div key={l.id} className="table__row" style={{ '--cols': COLS, '--min': '640px', minHeight: 60 } as React.CSSProperties}>
                <span className="cell-txt" style={{ color: 'var(--sub)' }}>{fmtWhen(l.createdAt)}</span>
                <span className="cell-txt" style={{ color: 'var(--ink)', fontWeight: 700 }}>{l.who}</span>
                <span className="cell-txt" style={{ color: 'var(--ink)' }}>{l.what}</span>
                <span><span className={`chip chip--${l.warningAck === '확인함' ? 'warn' : 'gray'}`}>{l.warningAck}</span></span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
