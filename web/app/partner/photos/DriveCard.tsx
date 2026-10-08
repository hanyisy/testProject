'use client';
/* 구글 드라이브 카드 — 연결 전: 폴더 주소 붙여 넣고 연결 / 연결됨: 지금 동기화 · 폴더 바꾸기 */
import { useState, useTransition } from 'react';
import { connectDrive, syncDrive } from './actions';

type Props = { connected: boolean; url: string | null; folderName: string; synced: string };

export default function DriveCard({ connected, url, folderName, synced }: Props) {
  const [edit, setEdit] = useState(!connected);
  const [val, setVal] = useState(url ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const connect = () => start(async () => {
    const r = await connectDrive(val);
    if (r.ok) { setEdit(false); setMsg({ ok: true, text: '폴더를 연결했어요 · 새 사진은 하루 한 번 자동으로 가져와요' }); } else setMsg({ ok: false, text: r.error });
  });
  const sync = () => start(async () => {
    const r = await syncDrive();
    setMsg(r.ok ? { ok: true, text: r.imported ? `새 사진 ${r.imported}장을 가져왔어요` : '동기화했어요 · 새 사진이 없어요' } : { ok: false, text: r.error });
  });
  return (
    <section className="pcard" style={{ padding: 22, gap: 12 }}>
      <div className="row" style={{ alignItems: 'center' }}><span className="panel__title">구글 드라이브</span><span className={`chip chip--${connected ? 'ok' : 'gray'}`}>{connected ? '연결됨' : '연결 전'}</span></div>
      {connected && !edit && (
        <>
          <div className="box-surf box-surf--pad" style={{ gap: 3, minWidth: 0 }}>
            <b style={{ fontSize: 16 }}>{folderName}</b>
            {url && <a href={url} target="_blank" rel="noopener" className="hint ell" style={{ fontSize: 13 }}>{url}</a>}
            <span className="hint" style={{ fontSize: 14 }}>마지막 동기화 {synced}</span>
          </div>
          <span className="muted">이 폴더에 사진을 넣으면 자동으로 올라와요</span>
          <div className="row">
            <button type="button" className="btn-ghost" style={{ flex: 1, height: 48, borderRadius: 14, fontSize: 15 }} disabled={pending} onClick={sync}>{pending ? '동기화 중…' : '지금 동기화'}</button>
            <button type="button" className="btn-ghost" style={{ height: 48, borderRadius: 14, fontSize: 15 }} disabled={pending} onClick={() => { setEdit(true); setMsg(null); }}>폴더 바꾸기</button>
          </div>
        </>
      )}
      {edit && (
        <>
          {!connected && <span style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text2)' }}>드라이브 폴더를 연결해 두면, 폰에서 폴더에 사진을 넣기만 해도 자동으로 올라와요.</span>}
          <label className="fld" style={{ gap: 8 }}>
            <span className="fld__label">폴더 주소</span>
            <input className="fld__input" style={{ height: 50, fontSize: 15 }} value={val} onChange={(e) => setVal(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" inputMode="url" />
            <span className="hint">드라이브에서 폴더를 열고 주소창의 주소를 복사해 붙여 넣어 주세요</span>
          </label>
          <div className="row">
            {connected && <button type="button" className="btn-ghost" style={{ height: 52, borderRadius: 14 }} onClick={() => { setEdit(false); setVal(url ?? ''); setMsg(null); }}>취소</button>}
            <button type="button" className="pbtn pbtn--accent" style={{ flex: 1, height: 52, borderRadius: 14, fontSize: 16 }} disabled={pending || !val.trim()} onClick={connect}>
              {pending ? '연결하는 중…' : connected ? '이 폴더로 바꾸기' : '드라이브 폴더 연결하기'}
            </button>
          </div>
        </>
      )}
      {msg && <span className={msg.ok ? 'okline' : 'err-line'} role="status">{msg.text}</span>}
    </section>
  );
}
