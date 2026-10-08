import '@/styles/partner.css';
import PartnerNav from '@/components/PartnerNav';
import { requirePartner } from '@/lib/auth';
import { partnerFrame } from '@/lib/partner-app';

/* 파트너 관리자 틀 — 로그인한 파트너 계정만, 자기 업체 데이터만 */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePartner();
  const f = await partnerFrame(user.partnerId);
  return (
    <div className="pshell">
      <PartnerNav name={f.partner.name} area={f.area} needs={f.needs} blogLocked={f.blogLocked} />
      <div className="pmain">{children}</div>
    </div>
  );
}
