import Link from 'next/link';
import { notFound } from 'next/navigation';
import TopBar from '@/components/TopBar';
import PartnerTabs from './PartnerTabs';
import { requirePerm } from '@/lib/auth';
import { PARTNER_STATUS_CHIP } from '@/lib/constants';
import { partnerDetail, regionText } from '@/lib/partners';

/* 시안 3c–3f 공통 머리: 업체명 · 상태 · 업종 · 요금제 · 탭 */
export default async function PartnerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const user = await requirePerm('파트너 관리');
  const { id } = await params;
  const d = await partnerDetail(id);
  if (!d) notFound();
  const p = d.partner;
  return (
    <>
      <TopBar title="파트너" user={user} />
      <div className="page">
        <div className="phead">
          <Link href="/admin/partners" className="back">‹ 파트너 목록</Link>
          <div className="phead__row">
            <h2 className="phead__name">{p.name}</h2>
            <span className={`chip chip--${PARTNER_STATUS_CHIP[p.status]}`}>{p.status}</span>
            <span className="chip chip--plain">{d.industry.name}</span>
            <span className="chip chip--plain">{d.plan.name}</span>
            <span className="phead__meta">{regionText(d.regions)} · 발행 {d.pages} · 색인 {d.indexPct === null ? '—' : `${d.indexPct}%`}</span>
          </div>
          <PartnerTabs id={p.id} />
        </div>
        {children}
      </div>
    </>
  );
}
