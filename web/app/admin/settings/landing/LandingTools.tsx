'use client';
/* 랜딩 관리 입력: 캡처 올리기(끌어서 흐릴 곳 표시 → 이미지에 흐림을 입혀 올림) · 랜딩 값 */
import { useEffect, useRef, useState, useTransition } from 'react';
import type { LandingValues } from '@/lib/landing';
import { addCapture, saveLandingValues } from './actions';

type Rect = { x: number; y: number; w: number; h: number };

export function CaptureAdd({ industries, partners, today }: { industries: string[]; partners: { id: string; name: string }[]; today: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [rects, setRects] = useState<Rect[]>([]);
  const [draft, setDraft] = useState<Rect | null>(null);
  const [f, setF] = useState({ query: '', industry: industries[0], partnerId: partners[0]?.id ?? '', capturedOn: today });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();
  const start0 = useRef<{ x: number; y: number } | null>(null);

  /* 미리보기 그리기: 고른 영역은 실제로 흐리게 */
  const paint = (rs: Rect[], el = canvas.current, im = img) => {
    if (!el || !im) return;
    const ctx = el.getContext('2d')!;
    el.width = im.naturalWidth; el.height = im.naturalHeight;
    ctx.filter = 'none';
    ctx.drawImage(im, 0, 0);
    const blurPx = Math.max(8, Math.round(im.naturalWidth / 60));
    for (const r of rs) {
      ctx.save();
      ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      ctx.filter = `blur(${blurPx}px)`;
      /* 가장자리가 비치지 않게 두 번 */
      ctx.drawImage(im, 0, 0); ctx.drawImage(el, 0, 0);
      ctx.restore();
    }
  };
  useEffect(() => { paint([...rects, ...(draft ? [draft] : [])]); });

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * e.currentTarget.width, y: ((e.clientY - r.top) / r.height) * e.currentTarget.height };
  };
  const pick = (file?: File) => {
    if (!file) return;
    const im = new Image();
    im.onload = () => { setImg(im); setRects([]); setMsg(null); };
    im.src = URL.createObjectURL(file);
  };
  const submit = () => start(async () => {
    setMsg(null);
    const el = canvas.current;
    if (!el || !img) { setMsg({ ok: false, t: '캡처 이미지를 골라 주세요' }); return; }
    paint(rects);
    const blob: Blob | null = await new Promise((r) => el.toBlob(r, 'image/jpeg', 0.9));
    if (!blob) return;
    const fd = new FormData();
    fd.set('file', new File([blob], 'capture.jpg', { type: 'image/jpeg' }));
    Object.entries(f).forEach(([k, v]) => fd.set(k, v));
    fd.set('blur', JSON.stringify(rects.map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }))));
    const res = await addCapture(fd);
    if (res.ok) { setImg(null); setRects([]); setF({ ...f, query: '' }); setMsg({ ok: true, t: '추가했어요 · 랜딩에 바로 보여요' }); }
    else setMsg({ ok: false, t: res.error });
  });

  return (
    <div className="stack" style={{ gap: 12 }}>
      <b style={{ fontSize: 16 }}>캡처 추가</b>
      <div className="grid capadd">
        <div className="stack" style={{ gap: 8 }}>
          {img ? (
            <>
              <canvas ref={canvas} className="capcanvas" aria-label="캡처 미리보기 · 끌어서 흐릴 곳 표시"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start0.current = pos(e); }}
                onPointerMove={(e) => { const s = start0.current; if (!s) return; const p = pos(e); setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }); }}
                onPointerUp={() => { if (draft && draft.w > 6 && draft.h > 6) setRects([...rects, draft]); setDraft(null); start0.current = null; }} />
              <div className="row" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="hint">다른 업체 상호 · 전화번호 위를 끌어서 흐리게 칠해요 · 흐림 {rects.length}곳</span>
                {rects.length > 0 && <button type="button" className="linkbtn" onClick={() => setRects(rects.slice(0, -1))}>마지막 흐림 지우기</button>}
                <label className="linkbtn" style={{ marginLeft: 'auto' }}>다른 이미지<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} /></label>
              </div>
            </>
          ) : (
            <label className="drop" style={{ minHeight: 160 }}>
              <b>캡처 이미지 고르기</b><span>실제 검색 결과 화면 · JPG · PNG</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
            </label>
          )}
        </div>
        <div className="stack" style={{ gap: 12 }}>
          <label className="fld"><span className="fld__label">검색어</span><input className="fld__input" value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} placeholder="예) 춘천 상가철거" /></label>
          <label className="fld"><span className="fld__label">업종</span><select className="fld__input" value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })}>{industries.map((i) => <option key={i}>{i}</option>)}</select></label>
          <label className="fld"><span className="fld__label">파트너 (관리용 · 랜딩에 안 보여요)</span><select className="fld__input" value={f.partnerId} onChange={(e) => setF({ ...f, partnerId: e.target.value })}><option value="">없음</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="fld"><span className="fld__label">캡처한 날</span><input className="fld__input" type="date" value={f.capturedOn} onChange={(e) => setF({ ...f, capturedOn: e.target.value })} /></label>
          {msg && <span style={{ fontSize: 14, fontWeight: 700, color: msg.ok ? 'var(--s4f)' : 'var(--red)' }}>{msg.t}</span>}
          <button type="button" className="btn-ink" style={{ height: 46 }} disabled={!img || !f.query.trim() || pending} onClick={submit}>{pending ? '올리는 중…' : '흐림 입혀서 추가'}</button>
        </div>
      </div>
    </div>
  );
}

export function ValuesForm({ values, hints }: { values: LandingValues; hints: Record<string, string> }) {
  const [v, setV] = useState(values);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();
  const num = (k: 'industries' | 'pages' | 'monthlyPages' | 'fixDays' | 'indexDays', label: string, unit: string) => (
    <label className="fld"><span className="fld__label">{label}</span>
      <span className="wonin"><input inputMode="numeric" value={v[k] ?? ''} placeholder="실제 값 입력" onChange={(e) => { setV({ ...v, [k]: e.target.value === '' ? null : Number(e.target.value.replace(/\D/g, '')) }); setMsg(null); }} /><span>{unit}</span></span>
      {hints[k] && <span className="muted">참고 · {hints[k]}</span>}
    </label>
  );
  const biz = (k: keyof LandingValues['business'], label: string, ph: string) => (
    <label className="fld"><span className="fld__label">{label}</span><input className="fld__input" value={v.business[k]} placeholder={ph} onChange={(e) => { setV({ ...v, business: { ...v.business, [k]: e.target.value } }); setMsg(null); }} /></label>
  );
  return (
    <section className="panel" style={{ padding: 22, gap: 16 }}>
      <div className="panel__head"><h2 className="panel__title">랜딩 값</h2><span className="panel__sub">숫자 띠 · 약속 · 실측 결과 · 푸터 사업자 정보</span></div>
      <div className="grid grid--3" style={{ gap: 14 }}>
        {num('industries', '운영 업종', '개')}{num('pages', '제작한 페이지', '건')}{num('monthlyPages', '매달 발행 (약속)', '장 이상')}
        {num('fixDays', '수정 반영 기한 (약속)', '영업일')}{num('indexDays', '색인까지 걸린 기간 (실측)', '일')}
      </div>
      <div className="grid grid--3" style={{ gap: 14, paddingTop: 14, borderTop: '1px solid var(--line2)' }}>
        {biz('ceo', '대표자', '이름')}{biz('bizNo', '사업자등록번호', '000-00-00000')}{biz('phone', '전화', '모바일 "전화 상담" 버튼에도 쓰여요')}
        {biz('email', '이메일', '이메일')}{biz('address', '주소', '사업장 주소')}
      </div>
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <button type="button" className="btn-ink" style={{ height: 46, padding: '0 22px' }} disabled={pending}
          onClick={() => start(async () => { const r = await saveLandingValues(v); setMsg(r.ok ? { ok: true, t: '저장했어요 · 랜딩에 바로 반영돼요' } : { ok: false, t: r.error }); })}>저장</button>
        {msg && <span style={{ fontSize: 14, fontWeight: 700, color: msg.ok ? 'var(--s4f)' : 'var(--red)' }}>{msg.t}</span>}
      </div>
    </section>
  );
}
