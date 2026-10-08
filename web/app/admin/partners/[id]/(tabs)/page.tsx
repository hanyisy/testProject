import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { can as can_ } from '@/lib/permissions';
import { partnerDetail } from '@/lib/partners';
import { rel } from '@/lib/format';
import { today as getToday } from '@/lib/config';
import { and, desc, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { md } from '@/lib/format';
import { removeRegion, resolveRequest, saveInfo } from '../../actions';
import RegionAdd from './RegionAdd';
import Reissue from './Reissue';

export const metadata = { title: '파트너 · 기본 정보' };

/* 시안 3c — 파트너 상세 · 기본 정보 */
export default async function PartnerInfo({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm('파트너 관리');
  const { id } = await params;
  const db = await getDb();
  const [d, today] = await Promise.all([partnerDetail(id), getToday()]);
  if (!d) notFound();
  /* 파트너가 보낸 요청 (기능 추가 · 지역 추가 문의) */
  const requests = await db.select().from(t.partnerRequests).where(and(eq(t.partnerRequests.partnerId, d.partner.id), eq(t.partnerRequests.status, '접수'))).orderBy(desc(t.partnerRequests.createdAt));
  if (!d) notFound();
  const p = d.partner;
  const canEdit = can_(user.role, '파트너 관리');
  const lastLogin = d.lastLoginText ?? (d.account?.lastLoginAt ? rel(d.account.lastLoginAt, today) : '아직 없음');
  return (
    <div className="grid grid--2">
      <form action={saveInfo} className="card card--pad card--gap14">
        <input type="hidden" name="id" value={p.id} />
        <div className="panel__head"><h3 className="panel__title">업체 정보</h3></div>
        <label className="fld"><span className="fld__label">상호</span><input className="fld__input" name="name" defaultValue={p.name} placeholder="상호" required disabled={!canEdit} /></label>
        <label className="fld"><span className="fld__label">대표 연락처</span><input className="fld__input" name="tel" defaultValue={p.tel ?? ''} placeholder="010-0000-0000" inputMode="tel" disabled={!canEdit} /></label>
        <label className="fld"><span className="fld__label">담당자 이메일</span><input className="fld__input" name="email" type="email" defaultValue={p.email ?? ''} placeholder="이메일" disabled={!canEdit} /></label>
        {canEdit && <button className="btn-ghost" style={{ alignSelf: 'flex-end' }}>저장</button>}
      </form>

      <div className="stack">
        {requests.length > 0 && (
          <section className="card card--pad" style={{ borderColor: 'var(--warnf)' }}>
            <div className="panel__head"><h3 className="panel__title">파트너 요청</h3><span className="panel__sub">파트너 화면의 추가 문의</span></div>
            {requests.map((r) => (
              <form key={r.id} action={resolveRequest} className="row" style={{ alignItems: 'center', gap: 10, minHeight: 48 }}>
                <input type="hidden" name="id" value={r.id} /><input type="hidden" name="partnerId" value={d.partner.id} />
                <span className="chip chip--warn">{r.kind}</span><b style={{ flex: 1 }}>{r.subject}</b><span className="muted">{md(r.createdAt)}</span>
                {canEdit && <button className="btn-ghost btn-ghost--sm">처리 완료</button>}
              </form>
            ))}
          </section>
        )}
        <section className="card card--pad">
          <div className="panel__head"><h3 className="panel__title">업종</h3></div>
          <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 17, fontWeight: 800 }}>{d.industry.name}</span>
            <span className="chip chip--plain">{d.industry.code}</span>
            <Link href="/admin/templates" className="link-accent" style={{ marginLeft: 'auto' }}>템플릿 보기 ›</Link>
          </div>
          <span className="muted">운영 중에는 업종을 바꿀 수 없어요. 바꾸려면 종료 후 새로 등록해 주세요</span>
        </section>

        <section className="card card--pad">
          <div className="panel__head"><h3 className="panel__title">서비스 지역</h3><span className="panel__sub">업종×지역 점유와 함께 확인돼요</span></div>
          <div className="tags">
            {d.regions.map((r) => (
              <form key={r} action={removeRegion} className="tag-x">
                <input type="hidden" name="id" value={p.id} /><input type="hidden" name="region" value={r} />
                {r}
                {canEdit && <button aria-label={`${r} 빼기`}>×</button>}
              </form>
            ))}
          </div>
          {canEdit && <RegionAdd id={p.id} />}
        </section>

        <section className="card" style={{ padding: '8px 22px 18px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 0 6px' }}><h3 className="panel__title">로그인 계정</h3></div>
          <div className="kvl"><span className="kvl__k">아이디</span><span className="kvl__v mono">{d.account?.loginId ?? '—'}</span></div>
          <div className="kvl"><span className="kvl__k">담당자 휴대폰</span><span className="kvl__v">{d.account?.phone ?? p.mobile ?? '—'}</span></div>
          <div className="kvl"><span className="kvl__k">마지막 로그인</span><span className="kvl__v">{lastLogin}</span></div>
          <span className="muted" style={{ padding: '8px 0 12px' }}>현재 비밀번호는 본사에서도 볼 수 없어요</span>
          {canEdit && <Reissue id={p.id} loginId={d.account?.loginId ?? ''} phone={d.account?.phone ?? p.mobile ?? ''} />}
        </section>

        <section className="card card--pad">
          <div className="row" style={{ alignItems: 'center' }}>
            <h3 className="panel__title">드라이브 폴더</h3>
            <span className={`chip chip--${p.driveConnected ? 'ok' : 'gray'}`}>{p.driveConnected ? '연결됨' : '연결 전'}</span>
          </div>
          <div className="box-surf">
            <span className="mono" style={{ fontSize: 13, color: 'var(--text2)' }}>현장로그 / 파트너 / {p.name}</span>
            <span className="hint">{p.driveConnected ? `새 사진 ${d.newPhotos}장 · 마지막 동기화 ${d.syncedAgo ?? '방금'}` : '파트너가 폴더를 연결하면 사진이 자동으로 들어와요'}</span>
          </div>
          <div className="row">
            <button type="button" className="btn-ghost btn-ghost--sm" disabled={!p.driveConnected}>폴더 열기</button>
            <button type="button" className="btn-ghost btn-ghost--sm">다시 연결</button>
          </div>
        </section>
      </div>
    </div>
  );
}
