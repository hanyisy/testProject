import Link from 'next/link';
import { notFound } from 'next/navigation';
import TopBar from '@/components/TopBar';
import MemoForm from './MemoForm';
import { requirePerm } from '@/lib/auth';
import { LEAD_STATUSES, LEAD_STATUS_CHIP, leadDetail } from '@/lib/admin';
import { md } from '@/lib/format';
import { setLeadOwner, setLeadStatus } from '../actions';

export const metadata = { title: '가입 문의' };

/* 시안 3-lead-2 — 가입 문의 상세 */
export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm('파트너 관리');
  const { id } = await params;
  const d = await leadDetail(id);
  if (!d) notFound();
  const l = d.lead;
  const kv: [string, string][] = [
    ['담당자', l.manager || '—'], ['연락처', l.phone], ['이메일', l.email || '—'], ['업종', l.industry],
    ['지역', l.regions.join(', ') || '—'], ['현재 홈페이지', l.homepage || '—']
  ];
  return (
    <>
      <TopBar title="가입 문의" user={user} />
      <div className="page">
        <div className="dhead">
          <Link href="/admin/leads" className="back">‹ 가입 문의</Link>
          <div className="dhead__row">
            <h2 className="dhead__title">{l.company}</h2>
            <span className={`chip chip--${LEAD_STATUS_CHIP[l.status]}`}>{l.status}</span>
            <span className={`chip chip--${d.av[1]}`}>{d.av[0]}</span>
            {l.requestType === 'waitlist' && <span className="chip chip--warn">대기 신청</span>}
            <span className="dhead__meta">접수 {md(l.receivedAt)} · 랜딩 가입 문의 폼</span>
          </div>
        </div>

        <div className="grid grid--12-1">
          <div className="stack">
            <section className="card kv" aria-labelledby="q-h">
              <div className="kv__title"><h3 className="panel__title" id="q-h">문의 내용</h3></div>
              {kv.map(([k, v]) => <div key={k} className="kv__row"><span className="kv__k">{k}</span><span className="kv__v">{v}</span></div>)}
              <div className="kv__block">
                <span className="kv__k">문의 내용</span>
                <p className="quote">{l.message || '남긴 내용이 없어요'}</p>
              </div>
            </section>

            <section className="card card--pad" aria-labelledby="m-h">
              <div className="panel__head"><h3 className="panel__title" id="m-h">상담 메모</h3><span className="panel__sub">날짜별로 쌓여요</span></div>
              <MemoForm id={l.id} />
              {d.memos.map((m) => (
                <div key={m.id} className="memo">
                  <div className="memo__when"><b>{md(m.at)}</b><small>{m.who}</small></div>
                  <span className="memo__t">{m.body}</span>
                </div>
              ))}
              {!d.memos.length && <span className="empty-line">아직 메모가 없어요</span>}
            </section>
          </div>

          <div className="stack">
            <section className="card card--pad" aria-labelledby="s-h">
              <div className="panel__head"><h3 className="panel__title" id="s-h">상태</h3></div>
              <form action={setLeadStatus} className="seg">
                <input type="hidden" name="id" value={l.id} />
                {LEAD_STATUSES.map((s) => (
                  <button key={s} name="status" value={s} className="seg__opt" aria-pressed={l.status === s}>{s}</button>
                ))}
              </form>
              <div className="stack" style={{ gap: 8, paddingTop: 6 }}>
                <span className="kv__k">담당 직원</span>
                <form action={setLeadOwner} className="filters">
                  <input type="hidden" name="id" value={l.id} />
                  {d.staff.map((s) => (
                    <button key={s.id} name="owner" value={s.id} className="pill pill--lg" aria-pressed={d.owner === s.name}>{s.name}</button>
                  ))}
                </form>
              </div>
            </section>

            <section className="card kv" aria-labelledby="o-h">
              <div className="kv__title"><h3 className="panel__title" id="o-h">업종×지역 점유</h3><span className="panel__sub">{l.industry}</span></div>
              {d.occ.map((o) => (
                <div key={o.region} className="occ">
                  <span className={'occ__region' + (o.mine ? ' is-mine' : '')}>{o.region}</span>
                  <span className="occ__mine">{o.mine ? '신청 지역' : ''}</span>
                  <span className={`chip chip--${o.kind}`}>{o.label}</span>
                </div>
              ))}
              {d.noTemplate && <span className="note-warn" style={{ marginTop: 10 }}>이 업종은 업종 템플릿이 아직 없어요</span>}
            </section>

            <section className="card card--pad" style={{ gap: 10 }}>
              {d.canRegister ? (
                <>
                  <Link href={`/admin/partners/new?lead=${l.id}`} className="btn-accent">파트너로 등록</Link>
                  <span className="hint">파트너 추가 화면이 이 문의 내용으로 채워진 채 열려요</span>
                </>
              ) : (
                <>
                  <span className="btn-off" aria-disabled="true">파트너로 등록</span>
                  <span className="text-warn">{d.reason}</span>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
