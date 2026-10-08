'use client';
/* 파트너 추가 4단계 (시안 3y-1 ~ 3y-4) */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Features } from '@/db/schema';
import { checkLoginId, createPartner, sendGuideSms } from './actions';

type Plan = { name: string; setup: number; monthly: number; features: Features };
type Props = {
  initial: { name: string; ceo: string; mgr: string; mobile: string; email: string; industry: string; regions: string[]; leadId: string } | null;
  industries: { name: string; status: string }[];
  plans: Plan[];
  occupancy: Record<string, Record<string, string>>;
  regionOptions: string[];
  appHost: string;
};

const STEPS = ['업체 정보', '로그인 계정', '서비스 설정', '전달'];
const PAY = ['계좌 입금', '온라인 결제', '둘 다'];
const FEATS: [keyof Features, string][] = [['alim', '알림톡 리드 검증'], ['blog', '블로그'], ['place', '플레이스 소식 초안'], ['ml', '다국어'], ['sheet', '구글시트 동기화']];
const BLOG = ['꺼짐', '직접 올리기', '본사 대행'] as const;
const won = (n: number) => n.toLocaleString('ko-KR');
const shown = (k: keyof Features, v: unknown) => (k === 'blog' ? String(v) : v ? '켜짐' : '꺼짐');

/** 시안 형식 임시 비밀번호 Ab12-cd3Ef */
function genPw() {
  const lo = 'abcdefghjkmnpqrstuvwxyz', up = 'ABCDEFGHJKLMNPQRSTUVWXYZ', d = '23456789';
  const r = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  return r(up) + r(lo) + r(d) + r(d) + '-' + r(lo) + r(lo) + r(d) + r(up) + r(lo);
}

export default function Wizard({ initial, industries, plans, occupancy, regionOptions, appHost }: Props) {
  const firstIndustry = initial?.industry || industries.find((i) => i.status === '사용 가능')?.name || '';
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    name: initial?.name ?? '', ceo: initial?.ceo ?? '', reg: '', tel: '', mgr: initial?.mgr ?? '', mobile: initial?.mobile ?? '', email: initial?.email ?? '',
    id: '', pw: '', industry: firstIndustry, regions: initial?.regions ?? [], plan: plans[0]?.name ?? '', pay: '계좌 입금', drive: false
  });
  const [feat, setFeat] = useState<Features | null>(null);
  const [idSt, setIdSt] = useState<null | 'ok' | 'taken' | 'invalid'>(null);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [createdRegions, setCreatedRegions] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [sms, setSms] = useState(false);

  const up = (o: Partial<typeof f>) => setF((x) => ({ ...x, ...o }));
  const plan = plans.find((p) => p.name === f.plan) ?? plans[0];
  const features = feat ?? plan.features;
  const takenBy = (r: string) => occupancy[f.industry]?.[r] ?? null;
  const validRegions = useMemo(() => f.regions.filter((r) => !occupancy[f.industry]?.[r]), [f.regions, f.industry, occupancy]);
  const okInfo = !!(f.name.trim() && f.mgr.trim() && f.mobile.trim());
  const okLogin = idSt === 'ok' && f.pw.length >= 8;
  const okSvc = validRegions.length > 0;
  const guide = `[현장로그] ${f.name} 계정이 만들어졌어요. 접속 주소 ${appHost}, 아이디 ${f.id}, 임시 비밀번호 ${f.pw}. 처음 로그인하면 비밀번호를 바꿔 주세요.`;
  const reach = [true, okInfo, okInfo && okLogin, !!created];

  async function create() {
    setBusy(true); setError('');
    const r = await createPartner({ ...f, regions: validRegions, features, leadId: initial?.leadId });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setCreatedRegions(validRegions); setCreated(r.partnerId); setStep(3);
  }

  return (
    <>
      <nav className="stepper" aria-label="단계">
        {STEPS.map((s, i) => {
          const done = i < step || (i === 3 && created);
          return (
            <button key={s} type="button" className="stepper__item" onClick={() => !created && reach[i] && i < 3 && setStep(i)} aria-current={i === step ? 'step' : undefined} disabled={!!created || !reach[i]}>
              <span className={'stepper__n' + (i <= step ? ' is-on' : '')}>{done && i !== step ? '✓' : i + 1}</span>
              <span className="stepper__label">{s}</span>
              {i < 3 && <span className="stepper__line" />}
            </button>
          );
        })}
      </nav>

      {step === 0 && (
        <>
          <div className="grid grid--2">
            <section className="card card--pad card--gap14">
              <div className="panel__head"><h3 className="panel__title">업체</h3></div>
              <Field label="상호" value={f.name} onChange={(v) => up({ name: v })} placeholder="예) 새봄클린" />
              <Field label="대표자명" value={f.ceo} onChange={(v) => up({ ceo: v })} placeholder="대표자 이름" />
              <Field label="사업자등록번호" value={f.reg} onChange={(v) => up({ reg: v })} placeholder="000-00-00000" inputMode="numeric" />
              <Field label="업체 대표 전화" value={f.tel} onChange={(v) => up({ tel: v })} placeholder="02-000-0000" inputMode="tel" />
            </section>
            <section className="card card--pad card--gap14">
              <div className="panel__head"><h3 className="panel__title">담당자</h3><span className="panel__sub">계정 안내와 알림을 받는 사람</span></div>
              <Field label="담당자 이름" value={f.mgr} onChange={(v) => up({ mgr: v })} placeholder="이름" />
              <Field label="담당자 휴대폰 번호" value={f.mobile} onChange={(v) => up({ mobile: v })} placeholder="010-0000-0000" inputMode="tel" />
              <Field label="담당자 이메일" value={f.email} onChange={(v) => up({ email: v })} placeholder="이메일" type="email" />
            </section>
          </div>
          <div className="wiz-foot"><span /><button type="button" className="btn-blue" disabled={!okInfo} onClick={() => setStep(1)}>다음 · 로그인 계정</button></div>
        </>
      )}

      {step === 1 && (
        <>
          <section className="card card--pad" style={{ gap: 18, maxWidth: 640, padding: 24 }}>
            <div className="fld" style={{ gap: 8 }}>
              <span className="fld__label">아이디</span>
              <div className="row">
                <input className="fld__input mono" value={f.id} placeholder="영문 소문자·숫자" style={{ flex: 1, height: 48 }} aria-label="아이디"
                  onChange={(e) => { up({ id: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '') }); setIdSt(null); }} />
                <button type="button" className="btn-ghost" style={{ height: 48 }} disabled={!f.id} onClick={async () => setIdSt(await checkLoginId(f.id))}>중복 확인</button>
              </div>
              {idSt && (
                <span style={{ fontSize: 14, fontWeight: 800, color: idSt === 'ok' ? 'var(--s4f)' : 'var(--red)' }}>
                  {idSt === 'ok' ? '사용할 수 있는 아이디예요' : idSt === 'taken' ? '이미 사용 중인 아이디예요' : '영문 소문자·숫자 3자 이상으로 정해 주세요'}
                </span>
              )}
              <span className="muted">이미 있는 아이디 예시 · malgeunjip, onmaru</span>
            </div>
            <div className="fld" style={{ gap: 8 }}>
              <span className="fld__label">임시 비밀번호</span>
              <div className="row">
                <div className="auth__pw" style={{ flex: 1, height: 48, borderRadius: 11, padding: '0 6px 0 12px' }}>
                  <input type={showPw ? 'text' : 'password'} value={f.pw} onChange={(e) => up({ pw: e.target.value })} aria-label="임시 비밀번호" className="mono" style={{ fontSize: 16 }} />
                  <button type="button" className="auth__eye" onClick={() => setShowPw(!showPw)}>{showPw ? '가리기' : '보기'}</button>
                </div>
                <button type="button" className="btn-ghost" style={{ height: 48 }} onClick={() => { up({ pw: genPw() }); setShowPw(true); }}>자동 생성</button>
              </div>
            </div>
            <div className="infobox">파트너가 처음 로그인하면 비밀번호를 바꾸게 돼요</div>
          </section>
          <div className="wiz-foot">
            <button type="button" className="btn-ghost" style={{ height: 48, padding: '0 18px', fontSize: 15 }} onClick={() => setStep(0)}>이전</button>
            <button type="button" className="btn-blue" disabled={!okLogin} onClick={() => setStep(2)}>다음 · 서비스 설정</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="grid grid--12-1">
            <div className="stack">
              <section className="card card--pad">
                <div className="panel__head"><h3 className="panel__title">업종</h3><span className="panel__sub">업종 템플릿에서</span></div>
                <div className="tags">
                  {industries.map((i) => {
                    const off = i.status !== '사용 가능';
                    return (
                      <button key={i.name} type="button" className="sel sel--lg" aria-pressed={f.industry === i.name} disabled={off} onClick={() => up({ industry: i.name })}>
                        {i.name}{off && <span className="sel__sub">{i.status}</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
              <section className="card card--pad">
                <div className="panel__head"><h3 className="panel__title">서비스 지역</h3><span className="panel__sub">업종×지역 점유 확인 · {validRegions.length}곳 선택</span></div>
                <div className="regpick">
                  {regionOptions.map((r) => {
                    const who = takenBy(r);
                    const on = f.regions.includes(r) && !who;
                    return (
                      <button key={r} type="button" className="regpick__opt" aria-pressed={on} disabled={!!who}
                        onClick={() => up({ regions: f.regions.includes(r) ? f.regions.filter((x) => x !== r) : [...f.regions, r] })}>
                        <b>{on ? '✓ ' : ''}{r}</b>
                        <small>{who ? `${who} 사용 중` : on ? '선택됨' : '비어 있음'}</small>
                      </button>
                    );
                  })}
                </div>
              </section>
              <section className="card card--pad">
                <div className="panel__head"><h3 className="panel__title">결제 방식</h3></div>
                <div className="seg seg--w420">
                  {PAY.map((m) => <button key={m} type="button" className="seg__opt seg__opt--sm" aria-pressed={f.pay === m} onClick={() => up({ pay: m })}>{m}</button>)}
                </div>
              </section>
              <section className="card card--pad" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <div className="feat__txt">
                  <div className="row" style={{ alignItems: 'center' }}>
                    <span style={{ fontSize: 17, fontWeight: 800 }}>구글 드라이브 폴더</span>
                    <span className={`chip chip--${f.drive ? 'ok' : 'gray'}`}>{f.drive ? '연결됨' : '나중에'}</span>
                  </div>
                  <span className="feat__sub">나중에 해도 돼요 · 파트너 상세에서 연결할 수 있어요</span>
                </div>
                <button type="button" className="btn-ghost" style={{ height: 44 }} onClick={() => up({ drive: !f.drive })}>{f.drive ? '연결 해제' : '지금 연결'}</button>
              </section>
            </div>
            <section className="card card--pad">
              <div className="panel__head"><h3 className="panel__title">요금제</h3></div>
              <div className="stack" style={{ gap: 8 }}>
                {plans.map((p) => (
                  <button key={p.name} type="button" className="planpick" aria-pressed={f.plan === p.name} onClick={() => { up({ plan: p.name }); setFeat(null); }}>
                    <span className="planpick__dot" aria-hidden="true" />
                    <span className="planpick__name">{p.name}</span>
                    <span className="planpick__price">{(p.setup ? `제작 ${won(p.setup)} · ` : '') + `월 ${won(p.monthly)}`}</span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 8 }}>
                <div className="panel__head" style={{ paddingBottom: 6 }}><span className="fld__label">기능 스위치</span><span className="muted">요금제 기본값 · 눌러서 조정</span></div>
                {FEATS.map(([k, label]) => {
                  const v = features[k];
                  const on = k === 'blog' ? v !== '꺼짐' : !!v;
                  const changed = shown(k, v) !== shown(k, plan.features[k]);
                  const next = k === 'blog' ? BLOG[(BLOG.indexOf(v as (typeof BLOG)[number]) + 1) % 3] : !v;
                  return (
                    <div key={k} className="diff" style={{ minHeight: 46 }}>
                      <span className="diff__k">{label}</span>
                      {changed && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>조정됨</span>}
                      <button type="button" className={'fval' + (on ? ' is-on' : '')} onClick={() => setFeat({ ...features, [k]: next } as Features)}>{shown(k, v)}</button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
          {error && <span className="err-line" role="alert">{error}</span>}
          <div className="wiz-foot">
            <button type="button" className="btn-ghost" style={{ height: 48, padding: '0 18px', fontSize: 15 }} onClick={() => setStep(1)}>이전</button>
            <button type="button" className="btn-blue" disabled={!okSvc || busy} onClick={create}>{busy ? '만드는 중…' : '계정 만들기'}</button>
          </div>
        </>
      )}

      {step === 3 && created && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', alignItems: 'start' }}>
          <section className="card" style={{ padding: '8px 22px 18px', display: 'flex', flexDirection: 'column' }}>
            <div className="row" style={{ alignItems: 'center', padding: '14px 0 8px' }}>
              <h3 className="panel__title">{f.name} 계정이 만들어졌어요</h3>
              <span className="chip chip--warn">준비 중</span>
            </div>
            <div className="kvl"><span className="kvl__k">접속 주소</span><span className="kvl__v mono">{appHost}</span></div>
            <div className="kvl"><span className="kvl__k">아이디</span><span className="kvl__v mono">{f.id}</span></div>
            <div className="kvl"><span className="kvl__k">임시 비밀번호</span><span className="kvl__v mono">{f.pw}</span></div>
            <div className="kvl"><span className="kvl__k">업종 · 지역</span><span className="kvl__v">{f.industry} · {createdRegions.join(', ')}</span></div>
            <div className="kvl"><span className="kvl__k">요금제</span><span className="kvl__v">{plan.name} · 월 {won(plan.monthly)}원 · {f.pay}</span></div>
            <span className="muted" style={{ paddingTop: 10 }}>임시 비밀번호는 이 화면에서만 보여요. 나중에는 다시 만들어 전달해야 해요</span>
          </section>
          <section className="card card--pad card--gap14">
            <div className="panel__head"><h3 className="panel__title">전달용 안내문</h3></div>
            <div className="guidebox">{guide}</div>
            <div className="row">
              <button type="button" className="btn-ghost" style={{ flex: 1, height: 50, fontSize: 15 }} onClick={() => { navigator.clipboard?.writeText(guide).catch(() => {}); setCopied(true); }}>{copied ? '복사됐어요' : '안내문 복사'}</button>
              <button type="button" className="btn-blue" style={{ flex: 1.4, height: 50 }} disabled={sms} onClick={async () => { await sendGuideSms(created); setSms(true); }}>{sms ? '문자를 보냈어요' : '담당자 휴대폰으로 문자 보내기'}</button>
            </div>
            <span className="muted">문자는 {f.mobile}으로 가요</span>
            <Link href={`/admin/partners/${created}`} className="btn-ink" style={{ height: 50, fontSize: 15 }}>파트너 상세로 이동</Link>
          </section>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', inputMode }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string; inputMode?: 'tel' | 'numeric' }) {
  return (
    <label className="fld">
      <span className="fld__label">{label}</span>
      <input className="fld__input" style={{ height: 48 }} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} inputMode={inputMode} />
    </label>
  );
}
