'use client';
/* 직원 추가 (3z-2) → 완료 · 전달용 안내문 (3z-3) */
import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { Role } from '@/lib/auth';
import { genPw } from '@/lib/pwgen';
import { checkStaffId, createStaff, sendStaffSms } from '../actions';
import { ROLE_CHIP, ROLE_INFO } from '../shared';

export default function NewStaffForm({ appHost }: { appHost: string }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', id: '', pw: '', role: '관리팀' as Role });
  const [idSt, setIdSt] = useState<null | 'ok' | 'taken' | 'invalid'>(null);
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sms, setSms] = useState(false);
  const [pending, start] = useTransition();
  const up = (o: Partial<typeof f>) => setF({ ...f, ...o });
  const ok = !!f.name.trim() && idSt === 'ok' && f.pw.length >= 8 && /[a-zA-Z]/.test(f.pw) && /[0-9]/.test(f.pw);
  const guide = `[현장로그] ${f.name}님 본사 계정이 만들어졌어요. 접속 주소 ${appHost}, 아이디 ${f.id}, 임시 비밀번호 ${f.pw}. 처음 로그인하면 비밀번호를 바꿔 주세요.`;

  if (created) {
    return (
      <>
        <span className="dhead__title">직원 계정이 만들어졌어요</span>
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', alignItems: 'start' }}>
          <section className="card" style={{ padding: '8px 22px 18px', display: 'flex', flexDirection: 'column' }}>
            <div className="row" style={{ alignItems: 'center', padding: '14px 0 8px', gap: 8 }}>
              <h3 className="panel__title">{f.name}</h3><span className={`chip chip--${ROLE_CHIP[f.role]}`}>{f.role}</span><span className="chip chip--warn">첫 로그인 전</span>
            </div>
            <div className="kvl"><span className="kvl__k">접속 주소</span><span className="kvl__v mono">{appHost}</span></div>
            <div className="kvl"><span className="kvl__k">아이디</span><span className="kvl__v mono">{f.id}</span></div>
            <div className="kvl"><span className="kvl__k">임시 비밀번호</span><span className="kvl__v mono">{f.pw}</span></div>
            <span className="muted" style={{ paddingTop: 10 }}>임시 비밀번호는 이 화면에서만 보여요. 나중에는 직원 상세에서 다시 만들어 전달해요</span>
          </section>
          <section className="card card--pad card--gap14">
            <div className="panel__head"><h3 className="panel__title">전달용 안내문</h3></div>
            <div className="guidebox">{guide}</div>
            <div className="row">
              <button type="button" className="btn-ghost" style={{ flex: 1, height: 50, fontSize: 15 }} onClick={() => { navigator.clipboard?.writeText(guide).catch(() => {}); setCopied(true); }}>{copied ? '복사됐어요' : '안내문 복사'}</button>
              <button type="button" className="btn-blue" style={{ flex: 1.4, height: 50 }} disabled={sms || !f.phone} onClick={async () => { await sendStaffSms(created, '계정 안내'); setSms(true); }}>{sms ? '문자를 보냈어요' : '휴대폰으로 문자 보내기'}</button>
            </div>
            {f.phone && <span className="muted">문자는 {f.phone}으로 가요</span>}
            <Link href="/admin/staff" className="btn-ink" style={{ height: 50, fontSize: 15 }}>직원 목록으로</Link>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <span className="dhead__title">직원 추가</span>
      <div className="grid grid--2" style={{ alignItems: 'start' }}>
        <section className="card card--pad card--gap14">
          <div className="panel__head"><h3 className="panel__title">직원 정보</h3></div>
          <label className="fld"><span className="fld__label">이름</span><input className="fld__input" value={f.name} onChange={(e) => up({ name: e.target.value })} placeholder="이름" /></label>
          <label className="fld"><span className="fld__label">휴대폰 번호</span><input className="fld__input" value={f.phone} onChange={(e) => up({ phone: e.target.value.replace(/[^0-9-]/g, '') })} placeholder="010-0000-0000" inputMode="tel" /></label>
          <label className="fld"><span className="fld__label">이메일</span><input className="fld__input" value={f.email} onChange={(e) => up({ email: e.target.value.trim() })} placeholder="이메일" type="email" /></label>
        </section>
        <section className="card card--pad card--gap14">
          <div className="panel__head"><h3 className="panel__title">로그인 계정</h3></div>
          <div className="fld">
            <span className="fld__label">아이디</span>
            <div className="row">
              <input className="fld__input mono" style={{ flex: 1 }} value={f.id} placeholder="영문 소문자·숫자" aria-label="아이디"
                onChange={(e) => { up({ id: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '') }); setIdSt(null); }} />
              <button type="button" className="btn-ghost" disabled={!f.id} onClick={async () => setIdSt(await checkStaffId(f.id))}>중복 확인</button>
            </div>
            {idSt && <span style={{ fontSize: 14, fontWeight: 800, color: idSt === 'ok' ? 'var(--s4f)' : 'var(--red)' }}>{idSt === 'ok' ? '사용할 수 있는 아이디예요' : idSt === 'taken' ? '이미 사용 중인 아이디예요' : '영문 소문자·숫자 3자 이상으로 정해 주세요'}</span>}
          </div>
          <div className="fld">
            <span className="fld__label">임시 비밀번호</span>
            <div className="row">
              <div className="auth__pw" style={{ flex: 1, height: 48, borderRadius: 11, padding: '0 6px 0 12px' }}>
                <input type={showPw ? 'text' : 'password'} value={f.pw} onChange={(e) => up({ pw: e.target.value })} aria-label="임시 비밀번호" className="mono" style={{ fontSize: 16 }} />
                <button type="button" className="auth__eye" onClick={() => setShowPw(!showPw)}>{showPw ? '가리기' : '보기'}</button>
              </div>
              <button type="button" className="btn-ghost" onClick={() => { up({ pw: genPw() }); setShowPw(true); }}>자동 생성</button>
            </div>
            <span className="muted">첫 로그인 때 비밀번호를 바꾸게 돼요</span>
          </div>
        </section>
      </div>
      <section className="card card--pad card--gap14">
        <div className="panel__head"><h3 className="panel__title">역할</h3></div>
        <div className="grid grid--3" style={{ gap: 10 }}>
          {ROLE_INFO.map(([r, sub]) => (
            <button key={r} type="button" className="roleopt" aria-pressed={f.role === r} onClick={() => up({ role: r })}><b>{r}</b><small>{sub}</small></button>
          ))}
        </div>
      </section>
      {err && <span className="pubhint" style={{ margin: 0, textAlign: 'right' }}>{err}</span>}
      <div className="wiz-foot">
        <Link href="/admin/staff" className="btn-ghost" style={{ height: 48, padding: '0 18px', fontSize: 15 }}>이전</Link>
        <button type="button" className="btn-blue" disabled={!ok || pending}
          onClick={() => start(async () => { setErr(''); const r = await createStaff(f); if (r.ok) setCreated(r.userId); else setErr(r.error); })}>계정 만들기</button>
      </div>
    </>
  );
}
