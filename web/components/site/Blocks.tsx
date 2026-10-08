/* 업체 공개 사이트 블록 12종 (시안 "섹션 블록 12종") — 페이지는 이 블록을 조합 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { daysText, dotDate, href, termsOf, type IndustryContent, type Photo, type Site, type SiteRow, type Terms } from '@/lib/site';
import { sendInquiry } from '@/app/p/[slug]/actions';

/** 사진 (없으면 자리표시) */
export function Ph({ photo, label, kind = '', shot, shotLabel }: { photo?: Photo | null; label?: string; kind?: '' | 'sq' | 'tall' | 'wide' | 'hero'; shot?: '전' | '후'; shotLabel?: string }) {
  const text = label ?? photo?.caption ?? '사진';
  return (
    <div className={'s-ph' + (kind ? ` s-ph--${kind}` : '')}>
      {photo?.src && <img src={photo.src} alt={text} loading={kind === 'hero' ? 'eager' : 'lazy'} />}
      <span>{text}</span>
      {shot && shotLabel !== '' && <b className={'s-shot' + (shot === '후' ? ' s-shot--after' : '')}>{shotLabel ?? (shot === '전' ? '작업 전' : '작업 후')}</b>}
    </div>
  );
}

export function Crumb({ slug, items }: { slug: string; items: [string, string?][] }) {
  return (
    <nav className="s-crumb" aria-label="위치">
      <Link href={href(slug)}>홈</Link>
      {items.map(([label, path], i) => (
        <span key={label} style={{ display: 'contents' }}><i>›</i>{path !== undefined && i < items.length - 1 ? <Link href={href(slug, path)}>{label}</Link> : <b>{label}</b>}</span>
      ))}
    </nav>
  );
}

/* 1 머리 */
export function Hero({ s, eyebrow, title, lead, photo, caption, text }: { s: Site; eyebrow?: string; title: string; lead?: string; photo?: Photo | null; caption?: string; text?: boolean }) {
  const tel = s.partner.tel ?? '';
  return (
    <section className={'s-hero' + (text ? ' s-hero--text' : '')}>
      <div className="s-hero__grid">
        <div className="s-hero__txt">
          {eyebrow && <span className="s-eyebrow">{eyebrow}</span>}
          <h1 className="s-h1">{title}</h1>
          {lead && <p className="s-lead">{lead}</p>}
          {!text && <div className="s-hero__btns"><a href={`tel:${tel}`} className="s-btn">전화 {tel}</a><a href="#contact" className="s-btn s-btn--line">{s.t.quote}</a></div>}
        </div>
        {!text && <Ph photo={photo} kind="hero" label={caption} />}
      </div>
      {!text && <div className="s-hero__cta"><a href={`tel:${tel}`} className="s-btn s-btn--block">전화로 물어보기</a></div>}
    </section>
  );
}

export function Sec({ title, sub, card, narrow, children, id }: { title?: string; sub?: string; card?: boolean; narrow?: boolean; children: ReactNode; id?: string }) {
  return (
    <section className={'s-sec' + (card ? ' s-sec--card' : '')} id={id}>
      <div className={'s-sec__in' + (narrow ? ' s-sec__in--narrow' : '')}>
        {title && <div className="s-sechead"><h2 className="s-h2">{title}</h2>{sub && <span className="s-h2sub">{sub}</span>}</div>}
        {children}
      </div>
    </section>
  );
}

/* 2 한눈 요약 */
export function Summary({ ic }: { ic: IndustryContent }) {
  return (
    <div className="s-sum">
      {ic.cost.summary.map((x) => (
        <div key={x.k}><span className="s-sum__k">{x.k}{x.example && <span className="s-ex">예시</span>}</span><span className="s-sum__v">{x.v}</span><span className="s-sum__n">{x.note}</span></div>
      ))}
    </div>
  );
}

/* 3 현장 카드 */
export function SiteCards({ slug, sites, cols = 3, t = termsOf() }: { slug: string; sites: SiteRow[]; cols?: 2 | 3 | 4; t?: Terms }) {
  if (!sites.length) return <span className="s-h2sub">아직 올라온 {t.case}이 없어요</span>;
  return (
    <div className={'s-cards' + (cols !== 3 ? ` s-cards--${cols}` : '')}>
      {sites.map((x) => (
        <Link key={x.id} href={href(slug, x.path)} className="s-card">
          <Ph photo={x.photos[0]} />
          <div className="s-sechead">
            <span className="s-card__t">{x.title}</span>
            <div className="s-meta"><span>{dotDate(x.workedAt)}</span>{x.areaPyeong ? <span className="s-chip">{x.areaPyeong}평</span> : null}{x.days ? <span className="s-chip">{daysText(t, x.days)}</span> : null}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* 4 사진 모음 */
export function Photos({ photos }: { photos: Photo[] }) {
  const [big, ...rest] = photos;
  return (
    <div className="s-photos">
      <Ph photo={big} />
      <div className="s-photos__small">{rest.slice(0, 4).map((p) => <Ph key={p.id} photo={p} kind="sq" />)}</div>
    </div>
  );
}

/* 5 작업 전 · 후 (현장별) */
export function Records({ sites, t = termsOf() }: { sites: SiteRow[]; t?: Terms }) {
  return (
    <>
      {sites.map((x) => {
        const before = x.photos.find((p) => p.shot === '전') ?? x.photos[0];
        const after = x.photos.find((p) => p.shot === '후') ?? x.photos[x.photos.length - 1];
        return (
          <div key={x.id} className="s-rec">
            <div className="s-rec__head"><span>{dotDate(x.workedAt)}</span><b>{x.title}</b>{x.areaPyeong ? <span className="s-chip">{x.areaPyeong}평</span> : null}{x.days ? <span className="s-chip">{daysText(t, x.days)}</span> : null}</div>
            <div className="s-ba"><div><Ph photo={before} kind="tall" shot="전" shotLabel={t.shots[0] ?? ''} /></div><div><Ph photo={after} kind="tall" shot="후" shotLabel={t.shots[1] ?? ''} /></div></div>
          </div>
        );
      })}
    </>
  );
}

/* 6 진행 순서 */
export function Steps({ ic }: { ic: IndustryContent }) {
  return <div className="s-steps">{ic.process.map(([t, d], i) => <div key={t}><span className="s-steps__n">{i + 1}</span><div className="s-steps__t"><b>{t}</b><span>{d}</span></div></div>)}</div>;
}

/* 7 비용 표 */
export function Cost({ ic }: { ic: IndustryContent }) {
  const tb = ic.cost.table;
  return (
    <div className="s-cost">
      {/* 가운데 칸이 설명 문장이면(개인회생 단계 설명 등) 굵기를 낮춰 읽기 쉽게 */}
      <div className={'s-table' + (tb.rows.some((r) => (r[1] ?? '').length > 16) ? ' s-table--long' : '')}>
        <div>{tb.head.map((h, i) => <span key={h}>{h}{i === 1 && tb.priced && <> <span className="s-ex">예시</span></>}</span>)}</div>
        {tb.rows.map((r) => <div key={r.join()}>{r.map((c, i) => <span key={i}>{c}</span>)}</div>)}
      </div>
      <div className="s-inc">
        <div><b>포함</b>{ic.cost.include.map((x) => <span key={x}><i>✓</i>{x}</span>)}</div>
        <div><b>별도</b>{ic.cost.exclude.map((x) => <span key={x}><i>·</i>{x}</span>)}</div>
      </div>
      <span className="s-note">{ic.cost.note}</span>
    </div>
  );
}

/* 8 지역 정보 */
export function RegionInfo({ items }: { items: [string, string][] }) {
  return <div className="s-info">{items.filter(([, b]) => b).map(([h, b]) => <div key={h}><b>{h}</b><p className="s-p">{b}</p></div>)}</div>;
}

/* 9 지도와 핀 — 지도 연동 전: 핀 위치는 이름으로 고르게 흩뿌림 */
export function MapPins({ label, pins, tall, station }: { label: string; pins: string[]; tall?: boolean; station?: string }) {
  /* 지도 자리(실제 지도 연동 전): 핀을 칸에 나눠 놓아 이름표가 겹치지 않게 · 역 지도는 가운데(역 표시)를 비움 */
  const cols = pins.length > 8 ? 3 : pins.length > 1 ? 2 : 1;
  const rows = Math.max(1, Math.ceil(pins.length / cols));
  const bands: [number, number][] = station ? [[26, 38], [64, 86]] : [[28, 82]];
  const total = bands.reduce((a, [s, e]) => a + e - s, 0);
  const rowTop = (r: number) => {
    let at = rows === 1 ? total / 2 : (r / (rows - 1)) * total;
    for (const [s, e] of bands) { if (at <= e - s) return s + at; at -= e - s; }
    return bands[bands.length - 1][1];
  };
  const pos = (s: string, i: number) => {
    const h = [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
    const c = i % cols, r = Math.floor(i / cols);
    return { left: `${6 + c * (88 / cols) + (h % 7)}%`, top: `${rowTop(r)}%` };
  };
  return (
    <div className={'s-map' + (tall ? ' s-map--tall' : '')}>
      <span className="s-map__label">{label}</span>
      {station && <><span className="s-ring" /><span className="s-station">{station}</span></>}
      {pins.map((p, i) => <span key={p + i} className="s-pin" style={pos(p, i)}><i /><b>{p}</b></span>)}
    </div>
  );
}

/* 10 질문과 답 */
export function QnA({ items, caseWord = '현장' }: { items: { q: string; a: string; photo?: Photo | null; basis: string }[]; caseWord?: string }) {
  return (
    <div className="s-qa">
      {items.map((x) => (
        <div key={x.q}>
          <div className="s-qa__q"><b><i>Q</i>{x.q}</b><p className="s-p">{x.a}</p></div>
          <div className="s-qa__basis"><Ph photo={x.photo} kind="wide" /><span>근거 {caseWord} · {x.basis}</span></div>
        </div>
      ))}
    </div>
  );
}

/* 11 관련 페이지 */
export function Related({ slug, groups }: { slug: string; groups: { h: string; links: { label: string; path: string }[] }[] }) {
  const gs = groups.filter((g) => g.links.length);
  if (!gs.length) return null;
  return <div className="s-rel">{gs.map((g) => <div key={g.h}><span className="s-rel__h">{g.h}</span>{g.links.map((l) => <Link key={l.path} href={href(slug, l.path)}>{l.label}<i>›</i></Link>)}</div>)}</div>;
}

/* 12 문의 */
export function Contact({ s, from, regions, error }: { s: Site; from: string; regions?: boolean; error?: boolean }) {
  return (
    <div className="s-contact" id="contact">
      <div className="s-contact__side">
        <div className="s-sechead"><h2 className="s-h2">{s.t.quote}</h2><span className="s-h2sub">{s.t.quoteSub}</span></div>
        <a href={`tel:${s.partner.tel ?? ''}`} className="s-contact__tel"><span>전화 · {s.partner.hours ?? '언제든'}</span><b>{s.partner.tel}</b></a>
        {regions && (
          <div className="s-regions">
            <b>서비스 지역</b>
            <div>{s.cities.map((c) => <span key={c}>{s.cityName(c)}</span>)}</div>
            <span>다른 지역은 전화로 먼저 물어봐 주세요</span>
          </div>
        )}
      </div>
      <form action={sendInquiry} className="s-form">
        <input type="hidden" name="slug" value={s.partner.slug} />
        <input type="hidden" name="from" value={from} />
        {error && <span className="s-err">이름 · 연락처를 확인하고 동의에 체크해 주세요</span>}
        <label className="s-field"><span>이름</span><input name="name" placeholder="이름" required autoComplete="name" /></label>
        <label className="s-field"><span>연락처</span><input name="phone" placeholder="010-0000-0000" required inputMode="tel" autoComplete="tel" /></label>
        <label className="s-field"><span>내용</span><textarea name="body" placeholder={s.content?.placeholder ?? '상황을 적어 주세요'} /></label>
        <label className="s-agree"><input type="checkbox" name="agree" value="y" required />개인정보 수집·이용에 동의해요 <a href={href(s.partner.slug, '개인정보처리방침')}>보기</a></label>
        <button className="s-btn s-btn--block">문의 남기기</button>
      </form>
    </div>
  );
}

/* 접수 후 안내 (문의 · 접수 완료) */
export const AFTER: [string, string][] = [['접수되면 확인 알림톡을 보내드려요', '남겨 주신 연락처로 바로 보내요'], ['하루 안에 연락드려요', '작업 중이면 저녁에 연락드릴 수 있어요'], ['사진을 보고 견적을 안내해요', '필요하면 현장에 직접 가서 확인해요']];
export function After({ items = AFTER }: { items?: [string, string][] }) {
  return <div className="s-after">{items.map(([b, s], i) => <div key={b}><span className="s-after__n">{i + 1}</span><div className="s-after__t"><b>{b}</b><span>{s}</span></div></div>)}</div>;
}
