/* 표 아래 페이지 넘김 (시안 공통: "1–10 / 총 6건" · ‹ 1 2 ›) */
import Link from 'next/link';

export default function Pager({ page, size, total, href }: { page: number; size: number; total: number; href: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(Math.max(1, page), pages);
  const from = total ? (cur - 1) * size + 1 : 0;
  const to = Math.min(cur * size, total);
  return (
    <nav className="pager" aria-label="페이지">
      <span className="pager__info">{from}–{to} / 총 {total}건</span>
      <span className="pager__sp" />
      <Link className="pager__btn" href={href(cur - 1)} aria-label="이전" aria-disabled={cur <= 1}>‹</Link>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <Link key={p} className="pager__num" href={href(p)} aria-current={p === cur ? 'page' : undefined}>{p}</Link>
      ))}
      <Link className="pager__btn" href={href(cur + 1)} aria-label="다음" aria-disabled={cur >= pages}>›</Link>
    </nav>
  );
}

export function paginate<T>(rows: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const cur = Math.min(Math.max(1, page || 1), pages);
  return { cur, items: rows.slice((cur - 1) * size, cur * size) };
}
