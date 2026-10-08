import Link from 'next/link';
import { eq, inArray } from 'drizzle-orm';
import TopBar from '@/components/TopBar';
import { requireStaff } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getDb, schema as t } from '@/db/client';
import { getSetting } from '@/lib/admin';
import { Integrations, NumInput, Stepper } from './SettingsTools';

export const metadata = { title: '설정' };

/* 시안 3n — 설정 */
export default async function SettingsPage() {
  const user = await requireStaff();
  const edit = can(user.role, '설정 · 외부 연동 값');
  const db = await getDb();
  const [staff, idxDays, capP, capT, minU, minP, payKey, alim, pending, hist] = await Promise.all([
    db.select({ id: t.users.id }).from(t.users).where(eq(t.users.kind, 'staff')),
    getSetting<number>('index_days', 23), getSetting<number>('cap_per_partner', 5), getSetting<number>('cap_total', 60),
    getSetting<number>('review_min_unique', 35), getSetting<number>('review_min_photos', 3),
    getSetting<string>('payment_key', ''), getSetting<string[]>('alimtalk_codes', ['', '']),
    db.select({ uniq: t.reviewItems.uniquePct, photos: t.reviewItems.photos }).from(t.reviewItems).where(inArray(t.reviewItems.state, ['대기', '발행 중 · 수정 대기'])),
    getSetting<{ indexHist?: [string, number][] } | null>('demo_stats', null)
  ]);
  /* 실측 90% 기준일 (발행·색인 3j와 같은 계산): 이보다 짧게 안내하면 경고 */
  const idx = (hist?.indexHist ?? []).map(([l, n]) => [l.match(/(\d+)[–-](\d+)/), n] as const).filter(([m]) => m);
  const total = idx.reduce((a, [, n]) => a + n, 0);
  let cum = 0, p90 = 23;
  for (const [m, n] of idx) { cum += n; if (cum >= total * 0.9) { p90 = Number(m![2]); break; } }
  const below = pending.filter((r) => r.uniq < minU || r.photos < minP).length;
  const mask = (v: string) => (v ? `${'•'.repeat(Math.max(0, Math.min(8, v.length - 4)))}${v.slice(-4)}` : '');

  return (
    <>
      <TopBar title="설정" user={user} />
      <div className="page">
        <Link href="/admin/staff" className="panel linkpanel" style={{ padding: '20px 22px' }}>
          <div className="stack" style={{ gap: 3, flex: 1 }}><b style={{ fontSize: 17 }}>직원 계정 관리</b><span className="hint" style={{ fontSize: 14 }}>직원 {staff.length}명 · 역할과 권한 · 임시 비밀번호</span></div>
          <span className="chev" aria-hidden="true" style={{ fontSize: 20 }}>›</span>
        </Link>
        {!edit && <div className="infobox infobox--i"><span className="infobox__i">i</span>설정 값은 최고 관리자 · 제작 담당만 바꿀 수 있어요</div>}
        <div className="grid grid--2" style={{ alignItems: 'start' }}>
          <section className="panel setpanel">
            <h2 className="panel__title">색인 안내 문구</h2>
            <Stepper k="index_days" value={idxDays} unit="일" base="기본 23일" edit={edit} big p90={p90} />
          </section>
          <section className="panel setpanel">
            <div className="panel__head"><h2 className="panel__title">하루 발행 상한</h2><span className="panel__sub">초과분은 다음 날로 넘어가요</span></div>
            <div className="grid grid--2" style={{ gap: 12 }}>
              <NumInput k="cap_per_partner" label="파트너당" value={capP} placeholder="10" edit={edit} />
              <NumInput k="cap_total" label="전체" value={capT} placeholder="60" edit={edit} />
            </div>
            <span className="muted">페이지 단위 · 번역 페이지 포함</span>
          </section>
        </div>
        <section className="panel setpanel" id="review">
          <div className="panel__head" style={{ alignItems: 'center' }}>
            <h2 className="panel__title">묶음에서 빠지는 기준</h2><span className="chip chip--warn">임시값 · 파일럿 후 조정</span>
            <span className="panel__sub" style={{ marginLeft: 'auto' }}>기준보다 낮은 페이지는 일괄 승인에서 빠지고 개별 검수로 가요</span>
          </div>
          <div className="grid grid--2" style={{ gap: 24 }}>
            <div className="fld"><span className="fld__label">고유 내용 비율 최소</span><Stepper k="review_min_unique" value={minU} unit="%" step={5} base="기본 35%" edit={edit} /></div>
            <div className="fld"><span className="fld__label">최소 사진 수</span><Stepper k="review_min_photos" value={minP} unit="장" base="기본 3장" edit={edit} /></div>
          </div>
          <div className="surfbox" style={{ fontSize: 14, fontWeight: 600 }}><span>지금 기준이면 묶음 대기 페이지 중 <b>{below}장</b>이 기준보다 낮아요 · 기준을 바꾸면 다음 묶음부터 적용돼요</span></div>
        </section>
        <section className="panel" style={{ padding: '8px 22px' }}>
          <div className="panel__head" style={{ padding: '14px 0 8px' }}><h2 className="panel__title">외부 연동</h2><span className="panel__sub">값을 넣지 않으면 승인 대기 중으로 표시돼요</span></div>
          <Integrations edit={edit} rows={[
            { k: 'payment_key', label: '결제 키', sub: '온라인 결제 · PG사 발급', ph: 'live_sk_…', shown: mask(payKey), set: !!payKey },
            { k: 'alim1', label: '알림톡 · 리드 검증', sub: '템플릿 코드', ph: 'HJ_LEAD_01', shown: alim[0] ?? '', set: !!alim[0] },
            { k: 'alim2', label: '알림톡 · 결과 입력 알림', sub: '템플릿 코드', ph: 'HJ_RESULT_01', shown: alim[1] ?? '', set: !!alim[1] }
          ]} />
        </section>
      </div>
    </>
  );
}
