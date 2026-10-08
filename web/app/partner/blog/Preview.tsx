'use client';
/* 초안 미리보기 (2f · 2f-2): 복사해서 올리기 → 올린 글 주소 저장 / 본사 대행 승인 */
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { approveBlog, requestToHq, saveBlogUrl } from './actions';

type Post = { id: string; title: string; body: string[]; url: string | null; status: '초안' | '승인 대기' | '승인' | '올림'; label: string; chip: string };

export default function Preview({ mode, post, photos }: { mode: '직접 올리기' | '본사 대행'; post: Post; photos: { src: string; alt: string }[] }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(post.url ?? '');
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();

  const copy = async () => {
    const text = post.title + '\n\n' + post.body.join('\n\n');
    try { await navigator.clipboard.writeText(text); } catch {
      /* 클립보드 권한이 없을 때 */
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    setCopied(true);
  };

  return (
    <section className="pcard blogprev">
      <div className="row" style={{ alignItems: 'center', gap: 8 }}>
        <span className="pcard__k" style={{ flex: 1 }}>초안 미리보기</span>
        <span className={`chip chip--${post.chip}`}>{post.label}</span>
      </div>
      <h2 className="blogprev__title">{post.title}</h2>
      <div className="blogprev__ph">{photos.length ? photos.map((p) => <img key={p.src} src={p.src} alt={p.alt} className="blogprev__img" loading="lazy" />) : <div className="phb">현장 사진이 아직 없어요</div>}</div>
      {post.body.map((b, i) => <p key={i} className="blogprev__p">{b}</p>)}

      {mode === '직접 올리기' ? (
        <>
          <button type="button" className="pbtn pbtn--accent pbtn--xl" onClick={copy}>{copied ? '복사됐어요 · 블로그에 붙여넣기' : '복사해서 올리기'}</button>
          <form className="blogprev__url" onSubmit={(e) => { e.preventDefault(); setErr(''); start(async () => { const r = await saveBlogUrl(post.id, url); if (!r.ok) setErr(r.error); else router.replace(`/partner/blog?d=${post.id}`, { scroll: false }); }); }}>
            <label className="pcard__k" htmlFor="blog-url">올린 글 주소</label>
            <div className="row" style={{ gap: 8 }}>
              <input id="blog-url" className="fld__input" style={{ flex: 1, height: 52, fontSize: 16 }} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="blog.naver.com/…" inputMode="url" />
              <button className="btn-ink" style={{ width: 84, height: 52, borderRadius: 12, fontSize: 17 }} disabled={pending || url.trim().length <= 5}>저장</button>
            </div>
            {err ? <span className="pubhint" style={{ margin: 0, textAlign: 'left' }}>{err}</span>
              : post.status === '올림' && <span className="okline">이번 달 발행 건수에 집계됐어요</span>}
          </form>
        </>
      ) : post.status === '올림' ? (
        <div className="blogprev__url">
          <span className="pcard__k">올린 글 주소</span>
          <a className="urlbox" href={`https://${post.url}`} target="_blank" rel="noreferrer"><span>{post.url}</span><b>글 보기 ›</b></a>
        </div>
      ) : post.status === '승인' ? (
        <div className="pbtn pbtn--xl pbtn--info">본사에서 올리는 중이에요</div>
      ) : (
        <>
          <button type="button" className="pbtn pbtn--accent pbtn--xl" disabled={pending} onClick={() => start(async () => { await approveBlog(post.id); router.replace(`/partner/blog?d=${post.id}`, { scroll: false }); })}>{pending ? '승인하는 중…' : '승인'}</button>
          <span className="hint" style={{ textAlign: 'center', marginTop: -6 }}>승인하면 본사에서 블로그에 올려 드려요</span>
        </>
      )}
    </section>
  );
}

/** 요금제에 없는 기능 · 지역 추가를 본사에 요청 */
export function RequestButton({ kind, subject, label = '추가 문의', className = 'pbtn pbtn--accent pbtn--xl' }: { kind: '기능 추가' | '지역 추가'; subject: string; label?: string; className?: string }) {
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <span className="okbox" style={{ justifyContent: 'center', width: '100%' }}>{done}</span>;
  return (
    <button type="button" className={className} disabled={pending}
      onClick={() => start(async () => { const r = await requestToHq(kind, subject); setDone(r.already ? '이미 문의했어요 · 본사에서 연락드릴게요' : '문의를 보냈어요 · 본사에서 연락드릴게요'); })}>
      {label}
    </button>
  );
}
