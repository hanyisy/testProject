import { asc, eq } from 'drizzle-orm';
import PartnerTop from '@/components/PartnerTop';
import ThemePick from '@/components/ThemePick';
import { requirePartner } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { partnerFrame, photoGroups } from '@/lib/partner-app';
import { logout } from '@/app/login/actions';
import PhotoActions from '../PhotoActions';
import { RequestButton } from '../blog/Preview';
import { AccountForm, BizForm, CompanyForm, NotifyList } from './SettingsForms';

export const metadata = { title: '설정' };

/* 시안 2h(데스크톱) · 1h(모바일) — 설정 */
export default async function SettingsPage() {
  const user = await requirePartner();
  const db = await getDb();
  const [frame, groups, [me], regionRows] = await Promise.all([
    partnerFrame(user.partnerId),
    photoGroups(user.partnerId),
    db.select({ name: t.users.name, loginId: t.users.loginId }).from(t.users).where(eq(t.users.id, user.id)).limit(1),
    db.select({ region: t.partnerRegions.region }).from(t.partnerRegions).where(eq(t.partnerRegions.partnerId, user.partnerId)).orderBy(asc(t.partnerRegions.sort))
  ]);
  const p = frame.partner;
  const regions = regionRows.map((r) => r.region);
  const hasBiz = !!(p.bizName && p.bizRegNo && p.taxEmail);
  return (
    <>
      <PartnerTop title="설정" actions={<PhotoActions newPhotos={groups.reduce((a, g) => a + g.photos.length, 0)} />} />
      <div className="ppage">
        <section className="pcard setcard">
          <span className="setcard__h">계정</span>
          <AccountForm name={me.name} loginId={me.loginId} />
          <div className="setcard__foot"><form action={logout}><button className="btn-ghost" style={{ height: 48, color: 'var(--red)' }}>로그아웃</button></form></div>
        </section>
        <div className="grid grid--2 setgrid">
          <div className="stack" style={{ gap: 16 }}>
            <section className="pcard setcard setcard--sm">
              <span className="setcard__h">업체 정보</span>
              <CompanyForm name={p.name} tel={p.tel ?? ''} />
            </section>
            <section className="pcard setcard setcard--sm">
              <span className="setcard__h">서비스 지역</span>
              <div className="tags">{regions.map((r) => <span key={r} className="regchip">{r}</span>)}</div>
              <div className="row" style={{ alignItems: 'center', gap: '6px 12px', flexWrap: 'wrap' }}>
                <span className="muted" style={{ fontSize: 14 }}>서비스 지역은 계약 범위예요. 추가하려면 문의해 주세요</span>
                <RequestButton kind="지역 추가" subject="서비스 지역 추가" label="지역 추가 문의 ›" className="linkbtn" />
              </div>
            </section>
            <section className="pcard setcard setcard--sm">
              <span className="setcard__h">화면 테마</span>
              <ThemePick />
            </section>
          </div>
          <div className="stack" style={{ gap: 16 }}>
            <section className="pcard setcard setcard--sm">
              <BizForm hasBiz={hasBiz} biz={{ name: p.bizName ?? '', reg: p.bizRegNo ?? '', email: p.taxEmail ?? '' }} />
            </section>
            <section className="pcard setcard setcard--sm">
              <span className="setcard__h">알림 설정</span>
              <NotifyList notify={p.notify} />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
