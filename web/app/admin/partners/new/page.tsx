import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { requirePerm } from '@/lib/auth';
import { getSetting, occupancy } from '@/lib/admin';
import { industriesAvailable, isUuid, plansAll } from '@/lib/partners';
import { PARTNER_APP_HOST } from '@/lib/config';
import { getDb, schema as t } from '@/db/client';
import { eq } from 'drizzle-orm';
import Wizard from './Wizard';

export const metadata = { title: '파트너 추가' };

/* 시안 3y-1 ~ 3y-4 — 파트너 추가 (업체 정보 → 로그인 계정 → 서비스 설정 → 전달)
 * 가입 문의 상세의 "파트너로 등록"에서 오면 ?lead= 로 문의 내용을 채워 둠 */
export default async function NewPartner({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const user = await requirePerm('파트너 관리');
  const { lead: leadId } = await searchParams;
  const db = await getDb();
  const [industries, plans, occ, regionOptions] = await Promise.all([
    industriesAvailable(), plansAll(), occupancy(), getSetting<string[]>('region_options', [])
  ]);
  const [lead] = leadId && isUuid(leadId) ? await db.select().from(t.leads).where(eq(t.leads.id, leadId)).limit(1) : [];
  const initial = lead ? {
    name: lead.company, ceo: lead.manager ?? '', mgr: lead.manager ?? '', mobile: lead.phone, email: lead.email ?? '',
    industry: industries.some((i) => i.name === lead.industry) ? lead.industry : '', regions: lead.regions, leadId: lead.id
  } : null;
  return (
    <>
      <TopBar title="파트너" user={user} />
      <div className="page">
        <div className="dhead">
          <Link href="/admin/partners" className="back">‹ 파트너 목록</Link>
          <h2 className="dhead__title">파트너 추가</h2>
        </div>
        <Wizard
          initial={initial}
          industries={industries.map((i) => ({ name: i.name, status: i.status }))}
          plans={plans.map((p) => ({ name: p.name, setup: p.setupFee, monthly: p.monthlyFee, features: p.defaultFeatures }))}
          occupancy={occ}
          regionOptions={Array.from(new Set([...regionOptions, ...(initial?.regions ?? [])]))}
          appHost={PARTNER_APP_HOST}
        />
      </div>
    </>
  );
}
