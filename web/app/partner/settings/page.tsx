import { asc, desc, eq } from 'drizzle-orm';
import PartnerTop from '@/components/PartnerTop';
import ThemePick from '@/components/ThemePick';
import { requirePartner } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { partnerFrame, photoGroups } from '@/lib/partner-app';
import { today } from '@/lib/config';
import { rel } from '@/lib/format';
import { logout } from '@/app/login/actions';
import PhotoActions from '../PhotoActions';
import { RequestButton } from '../blog/Preview';
import { AccountForm, BizForm, CompanyForm, NotifyList } from './SettingsForms';

export const metadata = { title: '설정' };

/* 시안 2h(데스크톱) · 1h(모바일) — 설정 */
export default async function SettingsPage() {
  const user = await requirePartner();
  const db = await getDb();
  const [frame, groups, [me], regionRows, notes, day] = await Promise.all([
    partnerFrame(user.partnerId),
    photoGroups(user.partnerId),
    db.select({ name: t.users.name, loginId: t.users.loginId }).from(t.users).where(eq(t.users.id, user.id)).limit(1),
    db.select({ region: t.partnerRegions.region }).from(t.partnerRegions).where(eq(t.partnerRegions.partnerId, user.partnerId)).orderBy(asc(t.partnerRegions.sort)),
    db.select().from(t.notifyLogs).where(eq(t.notifyLogs.partnerId, user.partnerId)).orderBy(desc(t.notifyLogs.createdAt)).limit(5),
    today()
  ]);
  const p = frame.partner;
  const regions = regionRows.map((r) => r.region);
  const hasBiz = !!(p.bizName && p.taxRegNo && p.taxEmail);
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
              <BizForm hasBiz={hasBiz} biz={{ name: p.bizName ?? '', reg: p.taxRegNo ?? '', email: p.taxEmail ?? '' }} />
            </section>
            <section className="pcard setcard setcard--sm">
              <span className="setcard__h">알림 설정</span>
              <NotifyList notify={p.notify} />
              {/* 최근 알림: 알림 설정이 꺼진 알림은 보내지 않고 "꺼짐"으로 남음 */}
              <div className="notilog">
                <span className="fld__label">최근 알림</span>
                {notes.length ? notes.map((n) => (
                  <div key={n.id} className="notilog__i"><span className={'chip chip--' + (n.sent ? 'ok' : 'gray')}>{n.sent ? '보냄' : '꺼짐'}</span><span className="notilog__t">{n.text}</span><span className="hint">{rel(n.createdAt, day)}</span></div>
                )) : <span className="hint">아직 보낸 알림이 없어요</span>}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
