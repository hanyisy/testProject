'use client';
/* 설정 (2h) 입력 부분: 계정 · 업체 정보 · 사업자 정보 · 알림 */
import { useState, useTransition } from 'react';
import { changeMyPassword, checkLoginId, saveAccount } from '@/lib/account-actions';
import { BizFields, bizOk } from '../billing/BillingActions';
import { clearBiz, saveBiz, type Biz } from '../billing/actions';
import { saveCompany, setNotify } from './actions';

const RULES = (n: string, n2: string) => [['8자 이상', n.length >= 8], ['영문과 숫자 함께', /[a-zA-Z]/.test(n) && /[0-9]/.test(n)], ['두 칸이 같아요', !!n2 && n === n2]] as const;

function Saved({ text = '저장됐어요' }: { text?: string }) {
  return <span className="okline">{text}</span>;
}

export function AccountForm({ name: n0, loginId: id0 }: { name: string; loginId: string }) {
  const [name, setName] = useState(n0);
  const [id, setId] = useState(id0);
  const [idSt, setIdSt] = useState<'ok' | 'taken' | 'invalid' | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [old, setOld] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();
  const idChanged = id !== id0;
  const canInfo = !!name.trim() && (!idChanged || idSt === 'ok');
  const rules = RULES(pw, pw2);
  const canPw = !!old && rules.every(([, ok]) => ok);
  const ST = { ok: ['사용할 수 있는 아이디예요', 'var(--s4f)'], taken: ['이미 사용 중인 아이디예요', 'var(--red)'], invalid: ['영문 소문자 · 숫자 · . _ 4–20자로 써 주세요', 'var(--red)'] } as const;

  return (
    <div className="setacct">
      <div className="stack" style={{ gap: 14 }}>
        <label className="fld"><span className="fld__label">담당자 이름</span><input className="fld__input fld__input--lg" value={name} onChange={(e) => { setName(e.target.value); setInfo(null); }} placeholder="이름" /></label>
        <div className="fld">
          <span className="fld__label">아이디</span>
          <div className="row">
            <input className="fld__input fld__input--lg fld__input--mono" style={{ flex: 1 }} value={id} aria-label="아이디"
              onChange={(e) => { setId(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '')); setIdSt(null); setInfo(null); }} />
            <button type="button" className="btn-ghost" style={{ height: 52 }} disabled={!id || pending} onClick={() => start(async () => setIdSt(await checkLoginId(id)))}>중복 확인</button>
          </div>
          {idSt && <span style={{ fontSize: 14, fontWeight: 800, color: ST[idSt][1] }}>{ST[idSt][0]}</span>}
        </div>
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <button type="button" className="btn-ink setbtn" disabled={!canInfo || pending}
            onClick={() => start(async () => { const r = await saveAccount(name, id); setInfo(r.ok ? '저장됐어요' : r.error); })}>이름·아이디 저장</button>
          {info && (info === '저장됐어요' ? <Saved /> : <span className="pubhint" style={{ margin: 0 }}>{info}</span>)}
        </div>
      </div>
      <form className="stack" style={{ gap: 14 }} onSubmit={(e) => {
        e.preventDefault();
        start(async () => { const r = await changeMyPassword(old, pw, pw2); setPwMsg(r.ok ? { ok: true, t: '바꿨어요' } : { ok: false, t: r.error }); if (r.ok) { setOld(''); setPw(''); setPw2(''); } });
      }}>
        <span className="fld__label" style={{ fontSize: 16, color: 'var(--ink)', fontWeight: 800 }}>비밀번호 변경</span>
        <label className="fld"><span className="fld__label">지금 비밀번호</span><input className="fld__input fld__input--lg" type="password" autoComplete="current-password" value={old} onChange={(e) => { setOld(e.target.value); setPwMsg(null); }} /></label>
        <label className="fld"><span className="fld__label">새 비밀번호</span><input className="fld__input fld__input--lg" type="password" autoComplete="new-password" placeholder="8자 이상" value={pw} onChange={(e) => { setPw(e.target.value); setPwMsg(null); }} /></label>
        <label className="fld"><span className="fld__label">한 번 더 입력</span><input className="fld__input fld__input--lg" type="password" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setPwMsg(null); }} /></label>
        <div className="pwrules">{rules.map(([t, ok]) => <span key={t} className={ok ? 'is-ok' : ''}><span>✓</span>{t}</span>)}</div>
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <button className="btn-ink setbtn" disabled={!canPw || pending}>비밀번호 바꾸기</button>
          {pwMsg && (pwMsg.ok ? <Saved text={pwMsg.t} /> : <span className="pubhint" style={{ margin: 0 }}>{pwMsg.t}</span>)}
        </div>
      </form>
    </div>
  );
}

export function CompanyForm({ name: n0, tel: t0 }: { name: string; tel: string }) {
  const [name, setName] = useState(n0);
  const [tel, setTel] = useState(t0);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = name !== n0 || tel !== t0;
  return (
    <>
      <label className="fld"><span className="fld__label">상호</span><input className="fld__input fld__input--lg" value={name} onChange={(e) => { setName(e.target.value); setMsg(null); }} placeholder="상호" /></label>
      <label className="fld"><span className="fld__label">연락처</span><input className="fld__input fld__input--lg" value={tel} onChange={(e) => { setTel(e.target.value.replace(/[^0-9-]/g, '')); setMsg(null); }} placeholder="010-0000-0000" inputMode="tel" /></label>
      <span className="hint" style={{ fontSize: 14 }}>검색 페이지의 전화 버튼에 이 번호가 연결돼요</span>
      {(dirty || msg) && (
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          {dirty && <button type="button" className="btn-ink setbtn" disabled={pending} onClick={() => start(async () => { const r = await saveCompany(name, tel); setMsg(r.ok ? '저장됐어요' : r.error); })}>저장</button>}
          {msg && (msg === '저장됐어요' ? <Saved /> : <span className="pubhint" style={{ margin: 0 }}>{msg}</span>)}
        </div>
      )}
    </>
  );
}

export function BizForm({ hasBiz, biz }: { hasBiz: boolean; biz: Biz }) {
  const [f, setF] = useState<Biz>(biz);
  const [saved, setSaved] = useState(hasBiz);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <div className="row" style={{ alignItems: 'center' }}>
        <span className="setcard__h" style={{ flex: 1 }}>사업자 정보</span>
        <span className={`chip chip--${saved ? 'ok' : 'red'}`}>{saved ? '저장됨' : '미등록'}</span>
      </div>
      <span className="hint" style={{ fontSize: 14, marginTop: -6 }}>세금계산서 발행에 사용돼요</span>
      <BizFields f={f} set={(v) => { setF(v); setMsg(null); }} />
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <button type="button" className="btn-ink setbtn" disabled={!bizOk(f) || pending}
          onClick={() => start(async () => { const r = await saveBiz(f); if (r.ok) { setSaved(true); setMsg('저장됐어요'); } else setMsg(r.error); })}>저장</button>
        {msg && (msg === '저장됐어요' ? <Saved /> : <span className="pubhint" style={{ margin: 0 }}>{msg}</span>)}
        {saved && <button type="button" className="linkbtn linkbtn--red" style={{ marginLeft: 'auto' }} disabled={pending}
          onClick={() => start(async () => { await clearBiz(); setSaved(false); setF({ name: '', reg: f.reg, email: '' }); setMsg(null); })}>정보 삭제</button>}
      </div>
    </>
  );
}

const NOTIFY = [['lead', '새 문의 알림톡', '고객이 문의하면 바로 알려드려요'], ['result', '결과 입력 알림', '견적 후 7일이 지나면 알려드려요'], ['indexed', '색인 완료 알림', '페이지가 검색에 잡히면 알려드려요']] as const;

export function NotifyList({ notify }: { notify: Record<'lead' | 'result' | 'indexed', boolean> }) {
  const [v, setV] = useState(notify);
  return (
    <div className="notilist">
      {NOTIFY.map(([k, label, sub]) => (
        <button key={k} type="button" role="switch" aria-checked={v[k]} className="notirow"
          onClick={() => { const on = !v[k]; setV({ ...v, [k]: on }); setNotify(k, on); }}>
          <span><b>{label}</b><small>{sub}</small></span>
          <span className="sw" aria-checked={v[k]} />
        </button>
      ))}
    </div>
  );
}
