import { notFound } from 'next/navigation';
import AutoRefresh from '@/components/AutoRefresh';
import CopyButton from '@/components/CopyButton';
import { requirePerm } from '@/lib/auth';
import { domainOf, partnerDetail } from '@/lib/partners';
import { domainStatus } from '@/lib/adapters/domain';
import { REGISTRARS } from '@/lib/constants';
import { dnsRecords, tempHost } from '@/lib/config';
import type { ChipKind } from '@/lib/format';
import { saveDomain, setRegistrar } from '../../../actions';

export const metadata = { title: '파트너 · 도메인 연결' };

const CONN: Record<string, ChipKind> = { '미연결': 'gray', '확인 중': 'warn', '연결됨': 'ok' };
const CERT: Record<string, ChipKind> = { '대기': 'gray', '발급 중': 'warn', '발급 완료': 'ok' };

/* 시안 3e — 도메인 연결 (연결 확인을 누르면 상태가 바뀌는 데모) */
export default async function DomainPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm('파트너 관리');
  const { id } = await params;
  const d = await partnerDetail(id);
  if (!d) notFound();
  const dm = await domainOf(id);
  const st = dm ? await domainStatus(dm) : { connection: '미연결' as const, certificate: '대기' as const };
  const registrar = dm?.registrar ?? '가비아';
  const records = dnsRecords(dm?.verifyToken ?? '—');
  const live = st.certificate === '발급 완료';
  const pending = st.connection === '확인 중' || st.certificate === '발급 중';
  const guide = REGISTRARS[registrar];
  const guideText = `[현장로그] ${dm?.domain ?? ''} 연결 안내\n` + guide.map((g, i) => `${i + 1}. ${g}`).join('\n') + '\n' + records.map((r) => r.join(' ')).join('\n');
  return (
    <div className="grid grid--14-1">
      {pending && <AutoRefresh />}
      <div className="stack">
        <section className="card card--pad card--gap14">
          <div className="panel__head"><h3 className="panel__title">도메인</h3></div>
          <form action={saveDomain} className="row">
            <input type="hidden" name="id" value={id} />
            <input className="fld__input fld__input--lg" name="domain" defaultValue={dm?.domain ?? ''} placeholder={`예) ${d.partner.slug}.kr`} aria-label="도메인" style={{ flex: 1 }} required />
            <button className="btn-blue" disabled={st.connection === '확인 중'}>{st.connection === '확인 중' ? '확인 중…' : st.connection === '연결됨' ? '다시 확인' : '연결 확인'}</button>
          </form>
          <div className="statline">
            <span>연결 <span className={`chip chip--${CONN[st.connection]}`}>{st.connection}</span></span>
            <span>인증서 <span className={`chip chip--${CERT[st.certificate]}`}>{st.certificate}</span></span>
          </div>
          {live ? (
            <div className="livebox">https://{dm!.domain} 로 공개 중이에요</div>
          ) : (
            <div className="tempaddr">
              <span className="hint" style={{ fontWeight: 700 }}>임시 주소</span>
              <span className="tempaddr__v">{tempHost(d.partner.slug)}</span>
              <span className="muted" style={{ marginLeft: 'auto' }}>연결 전 확인용 주소예요. 검색에는 올라가지 않아요</span>
            </div>
          )}
        </section>
        <section className="card card--pad" style={{ gap: 6 }}>
          <div className="panel__head"><h3 className="panel__title">넣어야 할 설정값</h3><span className="panel__sub">도메인 업체 관리 화면의 DNS 설정에 입력</span></div>
          <div className="table__scroll">
            <div className="dns dns--head" style={{ minWidth: 420 }}><span>유형</span><span>이름</span><span>값</span><span /></div>
            {records.map(([type, name, value]) => (
              <div key={type} className="dns dns--row" style={{ minWidth: 420 }}>
                <span><span className="chip chip--plain">{type}</span></span>
                <span className="dns__n">{name}</span>
                <span className="dns__v">{value}</span>
                <CopyButton text={value} />
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="stack">
        <section className="card card--pad card--gap14">
          <div className="panel__head"><h3 className="panel__title">도메인 업체별 안내</h3></div>
          <form action={setRegistrar} className="seg">
            <input type="hidden" name="id" value={id} />
            {Object.keys(REGISTRARS).map((r) => <button key={r} name="registrar" value={r} className="seg__opt seg__opt--sm" aria-pressed={registrar === r} disabled={!dm}>{r}</button>)}
          </form>
          {guide.map((g, i) => <div key={g} className="step-n"><span className="step-n__i">{i + 1}</span><span className="step-n__t">{g}</span></div>)}
          <span className="muted">반영까지 보통 10분, 길면 24시간 걸려요</span>
        </section>
        <section className="card card--pad" style={{ gap: 10 }}>
          <div className="panel__head"><h3 className="panel__title">파트너 안내</h3></div>
          <span className="hint" style={{ fontSize: 14 }}>설정값과 선택한 업체 안내를 한 번에 복사해요</span>
          <CopyButton text={guideText} label="파트너에게 보낼 안내문 복사" done="복사됐어요" className="btn-ghost btn-ghost--block" />
        </section>
      </div>
    </div>
  );
}
