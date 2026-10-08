import Link from 'next/link';
import { notFound } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { requirePerm } from '@/lib/auth';
import { reviewBundle } from '@/lib/review';
import BodyEditor from './BodyEditor';

export const metadata = { title: '검수 · 공통 본문 수정' };

/* 시안 3q — 공통 본문 수정 (빈 줄로 문단 · 바뀌는 칸 · 미리보기 · 반영 확인) */
export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ preview?: string }> }) {
  const user = await requirePerm('검수');
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const b = await reviewBundle(id);
  if (!b) notFound();
  /* 미리보기 대상: 묶음 앞 3장 (+ 개별 검수에서 "열어서 보기"로 온 페이지) */
  const extra = b.ex.find((e) => e.id === sp.preview);
  const previews = [...(extra ? [extra] : []), ...b.rows.slice(0, 3)].map((r) => ({ id: r.id, name: r.name, info: r.info, sites: r.sites, photos: r.photos }));
  const live = b.rows.filter((r) => r.state === '검수 완료' || r.state === '발행 중 · 수정 대기').length;
  /* 미리보기 제목 뒤: 지역 묶음은 "상가철거 · 사진 중심형", 그 외는 묶음 이름 */
  const work = b.kind.split(' · ')[0].split('×')[1] ?? '';
  const suffix = b.type === '지역' ? [work, b.draftStyle].filter(Boolean).join(' · ') : `· ${b.kind}`;
  return (
    <>
      <TopBar title="검수" user={user} />
      <div className="page">
        <div className="stack" style={{ gap: 12 }}>
          <Link href={`/admin/review/${b.id}`} className="back">‹ 묶음으로</Link>
          <div className="dhead__row"><span className="dhead__title">공통 본문 수정</span><span style={{ fontSize: 15, color: 'var(--sub)' }}>{b.partner} · {b.kind} · {b.rows.length}장</span></div>
        </div>
        <BodyEditor bundleId={b.id} body={b.commonBody.join('\n\n')} n={b.rows.length} live={live} previews={previews} suffix={suffix} />
      </div>
    </>
  );
}
